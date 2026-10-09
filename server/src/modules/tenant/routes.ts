import { randomBytes, createHash } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { coll } from '../../db/mongo.ts';
import { byId, count, escapeRegex, find, findOne, findPage, insert, patch, remove, type Row } from '../../db/repo.ts';
import { appendAudit, effectiveEntitlements, invalidateTenant, subscriptionAccess } from '../../domain/access.ts';
import { AppError, notFound } from '../../lib/errors.ts';
import { companyIdFor, me, ok, parse, reqMeta } from '../../lib/http.ts';
import { sendMail } from '../../lib/mail.ts';
import { nowIso, pick, safeUser } from '../../lib/serialize.ts';
import { env } from '../../config/env.ts';
import { forgetUserSessions } from '../../middleware/session.ts';
import { mobileKeyOf } from '../../lib/ip.ts';

export const tenantRouter = Router();

// ── Companies (platform) ───────────────────────────────────────────────
tenantRouter.get('/companies/options', async (req, res) => {
  const user = me(req);
  const filter = user.role === 'SUPER_ADMIN' ? {} : { _id: user.companyId ?? '' };
  const rows = await find('companies', filter, { projection: { name: 1, companyCode: 1 }, sort: { name: 1 }, limit: 1000 });
  ok(res, rows.map((c) => ({ id: c.id, name: c.name, companyCode: c.companyCode })));
});

tenantRouter.get('/companies', async (req, res) => {
  const search = String(req.query.search ?? '').trim();
  const status = String(req.query.status ?? '');
  const filter: Row = {};
  if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' };
  if (status && status !== 'ALL') filter.status = status;
  const { rows, pagination } = await findPage('companies', filter, req.query, { name: 1 });
  const [total, active, trial] = await Promise.all([count('companies'), count('companies', { status: 'ACTIVE' }), count('companies', { status: 'TRIAL' })]);
  ok(res, { companies: rows, pagination, stats: { total, active, trial, expiringSoon: trial } });
});

tenantRouter.post('/companies', () => { throw new AppError(405, 'ONLINE_SIGNUP_REQUIRED', 'Companies are created through online signup after successful checkout.'); });

const COMPANY_PROFILE_FIELDS = ['name', 'legalName', 'displayName', 'email', 'phone', 'address', 'industry', 'timezone', 'currency', 'website', 'logo', 'gstin', 'pan'] as const;
const companyProfileSchema = z.object({
  name: z.string().trim().min(1).max(160), legalName: z.string().trim().max(200), displayName: z.string().trim().max(160), email: z.string().trim().email().max(200).or(z.literal('')),
  phone: z.string().trim().max(40), address: z.union([z.string().max(500), z.record(z.string(), z.any())]), industry: z.string().trim().max(120), timezone: z.string().trim().max(60), currency: z.string().trim().max(8),
  website: z.string().trim().max(200), logo: z.string().max(400_000).nullable(), gstin: z.string().trim().max(20), pan: z.string().trim().max(12),
}).partial();
const platformCompanySchema = companyProfileSchema.extend({
  status: z.enum(['ACTIVE', 'TRIAL', 'SUSPENDED', 'EXPIRED', 'CANCELLED']).optional(), maxUsers: z.number().int().min(0).optional(), planExpiry: z.string().optional(),
});

tenantRouter.get('/companies/:id', async (req, res) => {
  const company = await byId('companies', String(req.params.id));
  if (!company) throw notFound('Company');
  ok(res, company);
});
const updateCompany = async (req: import('express').Request, res: import('express').Response) => {
  const user = me(req);
  const before = await byId('companies', String(req.params.id));
  if (!before) throw notFound('Company');
  const set = parse(platformCompanySchema, req.body);
  const updated = await patch('companies', { _id: before.id }, { ...set, updatedAt: nowIso() });
  invalidateTenant(before.id);
  await appendAudit({ actorId: user.id, companyId: before.id, action: 'COMPANY_UPDATED', entityType: 'COMPANY', entityId: before.id, oldValue: before, newValue: updated, ...reqMeta(req) });
  ok(res, updated);
};
tenantRouter.put('/companies/:id', updateCompany);
tenantRouter.patch('/companies/:id', updateCompany);
tenantRouter.delete('/companies/:id', async (req, res) => {
  const user = me(req);
  const id = String(req.params.id);
  const company = await byId('companies', id);
  if (!company) throw notFound('Company');
  const [employees, users] = await Promise.all([count('employees', { companyId: id }), count('users', { companyId: id })]);
  if (employees > 0 || users > 1) throw new AppError(409, 'COMPANY_NOT_EMPTY', 'This company already has people and records. Suspend it instead of deleting it.', { employees, users });
  await Promise.all(['users', 'roleAssignments', 'roleDefinitions', 'subscriptions', 'entitlementOverrides', 'onboardings', 'departments', 'designations', 'offices'].map((c) => remove(c as never, { companyId: id })));
  await remove('companies', { _id: id });
  invalidateTenant(id);
  await appendAudit({ actorId: user.id, companyId: id, action: 'COMPANY_DELETED', entityType: 'COMPANY', entityId: id, oldValue: company, ...reqMeta(req) });
  ok(res, null);
});

// ── Own company ────────────────────────────────────────────────────────
tenantRouter.get('/company', async (req, res) => {
  const company = await byId('companies', companyIdFor(req));
  if (!company) throw notFound('Company');
  ok(res, company);
});
tenantRouter.patch('/company', async (req, res) => {
  const user = me(req);
  const id = companyIdFor(req);
  const before = await byId('companies', id);
  if (!before) throw notFound('Company');
  const set = parse(companyProfileSchema, req.body);
  const updated = await patch('companies', { _id: id }, { ...set, updatedAt: nowIso() });
  await appendAudit({ actorId: user.id, companyId: id, action: 'COMPANY_PROFILE_UPDATED', entityType: 'COMPANY', entityId: id, oldValue: pick(before, Object.keys(set)), newValue: set, ...reqMeta(req) });
  ok(res, updated);
});

// ── Dashboard ──────────────────────────────────────────────────────────
tenantRouter.get('/dashboard', async (req, res) => {
  const companyId = companyIdFor(req);
  const [employees, activeEmployees, departments, deptGroups, roleGroups, totalUsers, ent, onboarding] = await Promise.all([
    count('employees', { companyId }), count('employees', { companyId, status: 'ACTIVE' }), find('departments', { companyId }),
    coll('employees').aggregate([{ $match: { companyId } }, { $group: { _id: '$department', count: { $sum: 1 } } }]).toArray(),
    coll('users').aggregate([{ $match: { companyId } }, { $group: { _id: '$role', count: { $sum: 1 } } }]).toArray(),
    count('users', { companyId }), effectiveEntitlements(companyId), findOne('onboardings', { companyId }),
  ]);
  const [pendingLeaves, pendingExpenses, payslipsProcessed] = await Promise.all([
    count('leaves', { companyId, status: 'PENDING' }),
    count('expenses', { companyId, status: { $in: ['PENDING', 'SUBMITTED', 'MANAGER_APPROVED'] } }),
    count('payslips', { companyId, status: { $in: ['PROCESSED', 'PUBLISHED', 'PAID'] } }),
  ]);
  const byDept = new Map(deptGroups.map((g) => [g._id as string, g.count as number]));
  ok(res, {
    stats: { totalEmployees: employees, activeEmployees, departments: departments.length, pendingLeaves, pendingExpenses, payslipsProcessed, totalUsers },
    roleDistribution: Object.fromEntries(roleGroups.map((g) => [g._id as string, g.count as number])),
    deptBreakdown: departments.map((d) => ({ department: d.name, count: byDept.get(d.name) ?? 0 })),
    onboarding, subscription: subscriptionAccess(ent.subscription),
    limitUsage: { employees, employeeLimit: ent.limits.employees },
  });
});

// ── Users (company admin / platform) ───────────────────────────────────
const TENANT_ROLES = ['COMPANY_ADMIN', 'HR', 'FINANCE', 'MANAGER', 'SUPERVISOR', 'EMPLOYEE'] as const;
const sha = (v: string) => createHash('sha256').update(v).digest('hex');

tenantRouter.get('/users', async (req, res) => {
  const user = me(req);
  const filter: Row = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId };
  const search = String(req.query.search ?? '').trim();
  if (search) filter.$or = [{ name: { $regex: escapeRegex(search), $options: 'i' } }, { email: { $regex: escapeRegex(search), $options: 'i' } }];
  const { rows, pagination } = await findPage('users', filter, req.query, { createdAt: -1, _id: -1 });
  const employees = rows.length ? await find('employees', { userId: { $in: rows.map((r) => r.id) } }) : [];
  const users = rows.map((u) => ({ ...safeUser(u), employee: employees.find((e) => e.userId === u.id) ?? null, accountStatus: u.isActive === false ? 'SUSPENDED' : u.passwordHash ? 'ACTIVE' : 'INVITED' }));
  ok(res, { users, pagination });
});

tenantRouter.post('/users', async (req, res) => {
  const actor = me(req);
  const body = parse(z.object({ name: z.string().trim().min(1).max(120), email: z.string().trim().email().max(200), mobile: z.string().trim().max(20).optional(), role: z.enum([...TENANT_ROLES, 'SUPER_ADMIN']) }), req.body);
  const mobileKey = body.mobile ? mobileKeyOf(body.mobile) : undefined;
  if (body.mobile && !mobileKey) throw new AppError(422, 'INVALID_MOBILE', 'Enter a valid 10-digit mobile number.');
  if (mobileKey && await findOne('users', { mobileKey })) throw new AppError(409, 'MOBILE_IN_USE', 'Someone already uses this mobile number.');
  if (body.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') throw new AppError(403, 'FORBIDDEN', 'Only a platform admin can create platform admins.');
  const companyId = body.role === 'SUPER_ADMIN' ? null : companyIdFor(req);
  if (await findOne('users', { emailLower: body.email.toLowerCase() })) throw new AppError(409, 'EMAIL_IN_USE', 'Someone already uses this email.');
  const created = await insert('users', { name: body.name, email: body.email, emailLower: body.email.toLowerCase(), ...(mobileKey ? { mobile: body.mobile, mobileKey } : {}), role: body.role, companyId, isActive: true, twoFactorEnabled: false, createdAt: nowIso(), lastLoginAt: null }, 'user');
  if (companyId) {
    const def = await findOne('roleDefinitions', { companyId, key: body.role });
    if (def) {
      const scopeType = ['COMPANY_ADMIN', 'HR', 'FINANCE'].includes(body.role) ? 'COMPANY' : body.role === 'EMPLOYEE' ? 'SELF' : null;
      if (scopeType) await insert('roleAssignments', { companyId, userId: created.id, roleDefinitionId: def.id, scopeType, scopeId: scopeType === 'COMPANY' ? companyId : created.id, isPrimary: true, createdAt: nowIso() }, 'assignment');
    }
  }
  const token = randomBytes(32).toString('base64url');
  await insert('authTokens', { id: sha(token), userId: created.id, type: 'INVITE', expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString() }, 'token');
  await sendMail({ to: body.email, subject: 'You have been invited to Vook', text: 'Set your password to join your team.', link: `${env.CORS_ORIGIN}/accept-invitation?token=${token}` });
  invalidateTenant(companyId);
  await appendAudit({ actorId: actor.id, companyId, action: 'USER_CREATED', entityType: 'USER', entityId: created.id, newValue: safeUser(created), ...reqMeta(req) });
  ok(res, { ...safeUser(created), employee: null, accountStatus: 'INVITED', invitationSent: true }, 201);
});

async function loadManagedUser(req: import('express').Request) {
  const actor = me(req);
  const target = await byId('users', String(req.params.id));
  if (!target || (actor.role !== 'SUPER_ADMIN' && target.companyId !== actor.companyId)) throw notFound('User');
  return { actor, target };
}

tenantRouter.patch('/users/:id', async (req, res) => {
  const { actor, target } = await loadManagedUser(req);
  const parsed = parse(z.object({ name: z.string().trim().min(1).max(120), isActive: z.boolean(), role: z.enum(TENANT_ROLES), mobile: z.string().trim().max(20).nullable() }).partial(), req.body);
  const { mobile, ...rest } = parsed;
  const body: Row = { ...rest };
  if (mobile !== undefined) {
    const key = mobile ? mobileKeyOf(mobile) : null;
    if (mobile && !key) throw new AppError(422, 'INVALID_MOBILE', 'Enter a valid 10-digit mobile number.');
    if (key && await findOne('users', { mobileKey: key, _id: { $ne: target.id } })) throw new AppError(409, 'MOBILE_IN_USE', 'Someone already uses this mobile number.');
    Object.assign(body, key ? { mobile, mobileKey: key } : { mobile: null, mobileKey: null });
  }
  if (target.id === actor.id && body.isActive === false) throw new AppError(409, 'CANNOT_SUSPEND_SELF', 'You cannot suspend your own account.');
  if (body.role && target.role === 'SUPER_ADMIN') throw new AppError(403, 'FORBIDDEN', 'Platform admin roles cannot be changed here.');
  const updated = await patch('users', { _id: target.id }, body);
  if (body.isActive === false || body.role) { await coll('sessions').deleteMany({ userId: target.id }); forgetUserSessions(); }
  invalidateTenant(target.companyId);
  await appendAudit({ actorId: actor.id, companyId: target.companyId, action: 'USER_UPDATED', entityType: 'USER', entityId: target.id, oldValue: pick(target, Object.keys(body)), newValue: body, ...reqMeta(req) });
  ok(res, safeUser(updated));
});

tenantRouter.delete('/users/:id', async (req, res) => {
  const { actor, target } = await loadManagedUser(req);
  if (target.id === actor.id) throw new AppError(409, 'CANNOT_DELETE_SELF', 'You cannot delete your own account.');
  if (await findOne('employees', { userId: target.id })) throw new AppError(409, 'USER_HAS_EMPLOYEE', 'This login belongs to an employee. Suspend it instead of deleting it.');
  await Promise.all([remove('users', { _id: target.id }), remove('roleAssignments', { userId: target.id }), coll('sessions').deleteMany({ userId: target.id })]);
  forgetUserSessions(); invalidateTenant(target.companyId);
  await appendAudit({ actorId: actor.id, companyId: target.companyId, action: 'USER_DELETED', entityType: 'USER', entityId: target.id, oldValue: safeUser(target), ...reqMeta(req) });
  ok(res, null);
});

tenantRouter.post('/users/:id/revoke-sessions', async (req, res) => {
  const { actor, target } = await loadManagedUser(req);
  await coll('sessions').deleteMany({ userId: target.id });
  forgetUserSessions();
  await appendAudit({ actorId: actor.id, companyId: target.companyId, action: 'USER_SESSIONS_REVOKED', entityType: 'USER', entityId: target.id, ...reqMeta(req) });
  ok(res, { revoked: true });
});
