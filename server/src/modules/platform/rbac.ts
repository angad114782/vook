import { Router } from 'express';
import { z } from 'zod';
import { coll } from '../../db/mongo.ts';
import { byId, count, find, findOne, insert, remove, type Row } from '../../db/repo.ts';
import { appendAudit, enabledPermissionKeys, invalidateTenant } from '../../domain/access.ts';
import { AppError, forbidden, notFound } from '../../lib/errors.ts';
import { companyIdFor, me, ok, parse, reqMeta } from '../../lib/http.ts';
import { nowIso } from '../../lib/serialize.ts';

export const rbacRouter = Router();

const ownedRole = async (req: import('express').Request) => {
  const role = await byId('roleDefinitions', String(req.params.id));
  if (!role) throw notFound('Role');
  if (role.companyId !== me(req).companyId) throw forbidden('This role belongs to another company.', 'SCOPE_DENIED');
  return role;
};

rbacRouter.get('/role-definitions', async (req, res) => ok(res, await find('roleDefinitions', { companyId: companyIdFor(req) }, { sort: { kind: 1, name: 1 } })));

rbacRouter.post('/role-definitions', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const body = parse(z.object({ name: z.string().trim().min(1).max(80), key: z.string().max(60).optional(), description: z.string().max(300).optional(), permissions: z.array(z.string().regex(/^[A-Z_]+\.[A-Z_]+$/)).max(500).default([]) }), req.body);
  if (await findOne('roleDefinitions', { companyId, name: { $regex: `^${body.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } })) throw new AppError(409, 'ROLE_NAME_IN_USE', 'A role with this name already exists.');
  const allowed = await enabledPermissionKeys(companyId);
  if (body.permissions.some((p) => !allowed.has(p))) throw forbidden('Custom roles can only use actions from modules in your plan.', 'ENTITLEMENT_REQUIRED');
  const role = await insert('roleDefinitions', { companyId, key: String(body.key ?? body.name).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_'), name: body.name, description: body.description ?? '', kind: 'CUSTOM', locked: false, permissions: [...new Set(body.permissions)], revision: 1, createdAt: nowIso() }, 'role');
  await appendAudit({ actorId: user.id, companyId, action: 'ROLE_CREATED', entityType: 'ROLE_DEFINITION', entityId: role.id, newValue: role, ...reqMeta(req) });
  ok(res, role, 201);
});

const updateRole = async (req: import('express').Request, res: import('express').Response) => {
  const user = me(req);
  const role = await ownedRole(req);
  if (role.locked) throw new AppError(409, 'SYSTEM_ROLE_LOCKED', 'The Company Admin role cannot be changed.');
  const body = parse(z.object({ name: z.string().trim().min(1).max(80), description: z.string().max(300), permissions: z.array(z.string().regex(/^[A-Z_]+\.[A-Z_]+$/)).max(500) }).partial(), req.body);
  const requested = body.permissions ?? role.permissions;
  const allowed = await enabledPermissionKeys(role.companyId);
  const stored = new Set<string>(role.permissions);
  if (requested.some((p: string) => !allowed.has(p) && !stored.has(p))) throw forbidden('New permissions must belong to modules in your plan. Permissions you already had stay saved but inactive.', 'ENTITLEMENT_REQUIRED');
  const updated = await coll('roleDefinitions').findOneAndUpdate({ _id: role.id, revision: role.revision ?? 1 }, { $set: { ...body, permissions: [...new Set(requested)] }, $inc: { revision: 1 } }, { returnDocument: 'after' });
  if (!updated) throw new AppError(409, 'VERSION_CONFLICT', 'This role was just changed by someone else. Refresh and try again.');
  invalidateTenant(role.companyId);
  await appendAudit({ actorId: user.id, companyId: role.companyId, action: 'ROLE_UPDATED', entityType: 'ROLE_DEFINITION', entityId: role.id, oldValue: { permissions: role.permissions, name: role.name }, newValue: { permissions: updated.permissions, name: updated.name }, ...reqMeta(req) });
  ok(res, { id: updated._id, ...updated });
};
rbacRouter.put('/role-definitions/:id', updateRole);
rbacRouter.patch('/role-definitions/:id', updateRole);
rbacRouter.put('/role-definitions/:id/permissions', updateRole);

rbacRouter.delete('/role-definitions/:id', async (req, res) => {
  const user = me(req);
  const role = await ownedRole(req);
  if (role.kind !== 'CUSTOM') throw new AppError(409, 'TEMPLATE_ROLE_REQUIRED', 'Standard roles cannot be deleted.');
  const used = await count('roleAssignments', { roleDefinitionId: role.id });
  if (used) throw new AppError(409, 'ROLE_IN_USE', 'Remove everyone from this role before deleting it.', { assignmentCount: used });
  await remove('roleDefinitions', { _id: role.id });
  invalidateTenant(role.companyId);
  await appendAudit({ actorId: user.id, companyId: role.companyId, action: 'ROLE_DELETED', entityType: 'ROLE_DEFINITION', entityId: role.id, oldValue: role, ...reqMeta(req) });
  ok(res, null);
});

// Legacy flat view used by the older permissions screen.
rbacRouter.get('/role-permissions', async (req, res) => {
  const defs = await find('roleDefinitions', { companyId: companyIdFor(req) });
  ok(res, defs.flatMap((d) => (d.permissions as string[]).map((permission) => ({ roleId: d.id, role: d.key, module: permission.split('.')[0], permission, isGranted: true }))));
});
rbacRouter.put('/role-permissions', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const body = parse(z.object({ roleDefinitionId: z.string().optional(), role: z.string().optional(), permissions: z.union([z.array(z.string()), z.record(z.string(), z.boolean())]) }), req.body);
  const role = await findOne('roleDefinitions', { companyId, ...(body.roleDefinitionId ? { _id: body.roleDefinitionId } : { key: body.role }) });
  if (!role) throw notFound('Role');
  if (role.locked) throw new AppError(409, 'SYSTEM_ROLE_LOCKED', 'The Company Admin role cannot be changed.');
  const requested = Array.isArray(body.permissions) ? body.permissions : Object.entries(body.permissions).filter(([, g]) => g).map(([p]) => p);
  const allowed = await enabledPermissionKeys(companyId);
  if (requested.some((p) => !allowed.has(p))) throw forbidden('Permissions must belong to modules in your plan.', 'ENTITLEMENT_REQUIRED');
  const updated = await coll('roleDefinitions').findOneAndUpdate({ _id: role.id }, { $set: { permissions: [...new Set(requested)] }, $inc: { revision: 1 } }, { returnDocument: 'after' });
  invalidateTenant(companyId);
  await appendAudit({ actorId: user.id, companyId, action: 'ROLE_PERMISSION_UPDATED', entityType: 'ROLE_DEFINITION', entityId: role.id, oldValue: role.permissions, newValue: updated!.permissions, ...reqMeta(req) });
  ok(res, { id: updated!._id, ...updated });
});

// ── Assignments (who has which role, over which part of the company) ──
async function assignmentView(a: Row) {
  const [user, def] = await Promise.all([byId('users', a.userId), byId('roleDefinitions', a.roleDefinitionId)]);
  return { ...a, userId: user ? { id: user.id, _id: user.id, name: user.name, email: user.email } : a.userId, roleDefinition: def, role: def?.key ?? a.role, roleName: def?.name ?? a.role, permissions: def?.permissions ?? [] };
}
rbacRouter.get('/role-assignments', async (req, res) => {
  const rows = await find('roleAssignments', { companyId: companyIdFor(req) }, { limit: 5000 });
  const users = rows.length ? new Map((await find('users', { _id: { $in: [...new Set(rows.map((r) => r.userId))] } }, { projection: { name: 1, email: 1 } })).map((u) => [u.id, u])) : new Map();
  const defs = rows.length ? new Map((await find('roleDefinitions', { _id: { $in: [...new Set(rows.map((r) => r.roleDefinitionId))] } })).map((d) => [d.id, d])) : new Map();
  ok(res, rows.map((a) => { const u = users.get(a.userId); const d = defs.get(a.roleDefinitionId); return { ...a, userId: u ? { id: u.id, _id: u.id, name: u.name, email: u.email } : a.userId, roleDefinition: d, role: d?.key ?? a.role, roleName: d?.name ?? a.role, permissions: d?.permissions ?? [] }; }));
});

rbacRouter.post('/role-assignments', async (req, res) => {
  const actor = me(req);
  const companyId = companyIdFor(req);
  const body = parse(z.object({ userId: z.string(), roleDefinitionId: z.string().optional(), role: z.string().optional(), scopeType: z.enum(['COMPANY', 'BRANCH', 'DEPARTMENT', 'TEAM', 'SELF']).default('COMPANY'), scopeId: z.string().nullish() }), req.body);
  const user = await findOne('users', { _id: body.userId, companyId });
  const def = await findOne('roleDefinitions', { companyId, ...(body.roleDefinitionId ? { _id: body.roleDefinitionId } : { key: body.role }) });
  if (!user || !def) throw new AppError(422, 'INVALID_ASSIGNMENT', 'Select a person and a role from this company.');
  if (['BRANCH', 'DEPARTMENT', 'TEAM'].includes(body.scopeType) && !body.scopeId) throw new AppError(422, 'SCOPE_REQUIRED', 'Choose which branch, department or team this role covers.');
  const scopeCollection = ({ BRANCH: 'offices', DEPARTMENT: 'departments', TEAM: 'teams' } as const)[body.scopeType as 'BRANCH'];
  if (scopeCollection && !(await findOne(scopeCollection, { _id: body.scopeId!, companyId }))) throw forbidden('That scope does not belong to this company.', 'SCOPE_DENIED');
  let scopeId = body.scopeId || null;
  if (body.scopeType === 'COMPANY') scopeId = companyId;
  if (body.scopeType === 'SELF') scopeId = (await findOne('employees', { userId: user.id, companyId }))?.id ?? user.id;
  if (await findOne('roleAssignments', { companyId, userId: user.id, roleDefinitionId: def.id, scopeType: body.scopeType, scopeId })) throw new AppError(409, 'ASSIGNMENT_EXISTS', 'This person already has this role for this scope.');
  const created = await insert('roleAssignments', { companyId, userId: user.id, roleDefinitionId: def.id, scopeType: body.scopeType, scopeId, isPrimary: false, createdAt: nowIso() }, 'assignment');
  invalidateTenant(companyId);
  await appendAudit({ actorId: actor.id, companyId, action: 'ROLE_ASSIGNED', entityType: 'ROLE_ASSIGNMENT', entityId: created.id, newValue: created, ...reqMeta(req) });
  ok(res, await assignmentView(created), 201);
});

rbacRouter.delete('/role-assignments/:id', async (req, res) => {
  const actor = me(req);
  const a = await byId('roleAssignments', String(req.params.id));
  if (!a) throw notFound('Role assignment');
  if (a.companyId !== actor.companyId) throw forbidden('This assignment belongs to another company.', 'SCOPE_DENIED');
  if (a.isPrimary) throw new AppError(409, 'PRIMARY_ASSIGNMENT_REQUIRED', 'A person’s main role cannot be removed. Change their role instead.');
  await remove('roleAssignments', { _id: a.id });
  invalidateTenant(a.companyId);
  await appendAudit({ actorId: actor.id, companyId: a.companyId, action: 'ROLE_UNASSIGNED', entityType: 'ROLE_ASSIGNMENT', entityId: a.id, oldValue: a, ...reqMeta(req) });
  ok(res, null);
});

// ── Approval workflows (per company) ───────────────────────────────────
const DEFAULT_WORKFLOWS = [
  { type: 'leave', steps: [{ order: 1, role: 'MANAGER', action: 'Review & Approve', escalateAfter: 24 }, { order: 2, role: 'HR', action: 'Final Approval', escalateAfter: 24 }], autoEscalate: true, escalateHours: 24 },
  { type: 'expense', steps: [{ order: 1, role: 'MANAGER', action: 'Review & Approve', escalateAfter: 24 }, { order: 2, role: 'FINANCE', action: 'Final Approval', escalateAfter: 48 }], autoEscalate: true, escalateHours: 24 },
  { type: 'correction', steps: [{ order: 1, role: 'SUPERVISOR', action: 'Review & Approve', escalateAfter: 12 }], autoEscalate: true, escalateHours: 12 },
];
rbacRouter.get('/workflows', async (req, res) => {
  const companyId = companyIdFor(req);
  let rows = await find('workflows', { companyId });
  if (!rows.length) rows = await Promise.all(DEFAULT_WORKFLOWS.map((w) => insert('workflows', { id: `workflow_${w.type}_${companyId}`, companyId, ...w }, 'workflow')));
  ok(res, rows);
});
rbacRouter.put('/workflows/:type', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const type = String(req.params.type);
  const body = parse(z.object({
    steps: z.array(z.object({ order: z.number().int().min(1).max(10), role: z.enum(['SUPERVISOR', 'MANAGER', 'HR', 'FINANCE', 'COMPANY_ADMIN']), action: z.string().trim().min(1).max(60), escalateAfter: z.number().int().min(1).max(720).optional() })).min(1, 'Add at least one approval step.').max(6),
    autoEscalate: z.boolean().optional(), escalateHours: z.number().int().min(1).max(720).optional(),
  }), req.body);
  const existing = await findOne('workflows', { companyId, type });
  const next = { ...body, steps: [...body.steps].sort((a, b) => a.order - b.order) };
  const saved = existing
    ? (await coll('workflows').findOneAndUpdate({ _id: existing.id }, { $set: next }, { returnDocument: 'after' }))
    : await insert('workflows', { id: `workflow_${type}_${companyId}`, companyId, type, ...next }, 'workflow');
  await appendAudit({ actorId: user.id, companyId, action: 'WORKFLOW_UPDATED', entityType: 'WORKFLOW', entityId: type, oldValue: existing?.steps, newValue: next.steps, ...reqMeta(req) });
  ok(res, saved && '_id' in saved ? { id: saved._id, ...saved } : saved);
});
