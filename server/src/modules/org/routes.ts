import { Router } from 'express';
import { z } from 'zod';
import { coll } from '../../db/mongo.ts';
import { count, find, findOne, insert, patch, type Row } from '../../db/repo.ts';
import { appendAudit, effectiveEntitlements, recordWithinScope } from '../../domain/access.ts';
import { AppError, forbidden, notFound } from '../../lib/errors.ts';
import { companyIdFor, me, ok, parse, reqMeta } from '../../lib/http.ts';
import { nowIso } from '../../lib/serialize.ts';

export const orgRouter = Router();

const codeSchema = z.string().trim().min(1).max(20);
const nameSchema = z.string().trim().min(1).max(120);

// ── Departments ────────────────────────────────────────────────────────
async function departmentsWithCounts(companyId: string) {
  const [departments, groups] = await Promise.all([
    find('departments', { companyId }, { sort: { name: 1 } }),
    coll('employees').aggregate([{ $match: { companyId, status: { $ne: 'EXITED' } } }, { $group: { _id: '$department', total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] } } } }]).toArray(),
  ]);
  const byName = new Map(groups.map((g) => [g._id as string, g]));
  return departments.map((d) => ({ ...d, total: byName.get(d.name)?.total ?? 0, active: byName.get(d.name)?.active ?? 0 }));
}

orgRouter.get('/departments/summary', async (req, res) => {
  ok(res, (await departmentsWithCounts(companyIdFor(req))).map((d) => ({ name: d.name, count: d.total })));
});
orgRouter.get('/departments', async (req, res) => ok(res, await departmentsWithCounts(companyIdFor(req))));

orgRouter.post('/departments', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const body = parse(z.object({ name: nameSchema, code: codeSchema, branchIds: z.array(z.string()).max(100).optional(), headEmployeeId: z.string().nullable().optional() }), req.body);
  if (await findOne('departments', { companyId, $or: [{ name: { $regex: `^${body.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }, { code: body.code }] })) {
    throw new AppError(409, 'DUPLICATE_NAME', 'A department with this name or code already exists.');
  }
  const created = await insert('departments', { companyId, isActive: true, branchIds: [], ...body, createdAt: nowIso() }, 'dept');
  await appendAudit({ actorId: user.id, companyId, action: 'DEPARTMENT_CREATED', entityType: 'DEPARTMENT', entityId: created.id, newValue: created, ...reqMeta(req) });
  ok(res, { ...created, total: 0, active: 0 }, 201);
});

orgRouter.patch('/departments/:id', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const before = await findOne('departments', { _id: String(req.params.id), companyId });
  if (!before) throw notFound('Department');
  const body = parse(z.object({ name: nameSchema, code: codeSchema, isActive: z.boolean(), branchIds: z.array(z.string()).max(100), headEmployeeId: z.string().nullable() }).partial(), req.body);
  const updated = await patch('departments', { _id: before.id }, { ...body, updatedAt: nowIso() });
  if (body.name && body.name !== before.name) await coll('employees').updateMany({ companyId, departmentId: before.id }, { $set: { department: body.name } }); // denormalised name stays in sync
  await appendAudit({ actorId: user.id, companyId, action: 'DEPARTMENT_UPDATED', entityType: 'DEPARTMENT', entityId: before.id, oldValue: before, newValue: updated, ...reqMeta(req) });
  ok(res, updated);
});

orgRouter.delete('/departments/:id', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const found = await findOne('departments', { _id: String(req.params.id), companyId });
  if (!found) throw notFound('Department');
  const people = await coll('employees').countDocuments({ companyId, $or: [{ departmentId: found.id }, { department: found.name }], status: { $nin: ['EXITED', 'ARCHIVED'] } });
  if (people) throw new AppError(409, 'DEPARTMENT_IN_USE', `${people} ${people === 1 ? 'person is' : 'people are'} in ${found.name}. Move them to another department first.`, { people });
  await coll('designations').updateMany({ companyId, departmentId: found.id }, { $set: { departmentId: null } });
  await coll('departments').deleteOne({ _id: found.id as never });
  await appendAudit({ actorId: user.id, companyId, action: 'DEPARTMENT_DELETED', entityType: 'DEPARTMENT', entityId: found.id, oldValue: found, ...reqMeta(req) });
  ok(res, null);
});

// ── Designations ───────────────────────────────────────────────────────
async function populateDesignations(rows: Row[], companyId: string) {
  const [departments, offices] = await Promise.all([find('departments', { companyId }, { projection: { name: 1 } }), find('offices', { companyId })]);
  return rows.map((d) => {
    const dept = departments.find((x) => x.id === d.departmentId);
    return { ...d, departmentId: dept ? { _id: dept.id, name: dept.name } : undefined, branchIds: (d.branchIds ?? []).map((id: string) => offices.find((o) => o.id === id)).filter(Boolean) };
  });
}
orgRouter.get('/designations', async (req, res) => {
  const companyId = companyIdFor(req);
  ok(res, await populateDesignations(await find('designations', { companyId }, { sort: { name: 1 } }), companyId));
});
orgRouter.post('/designations', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const body = parse(z.object({ name: nameSchema, code: codeSchema, departmentId: z.string().nullish(), branchIds: z.array(z.string()).max(100).optional() }), req.body);
  if (await findOne('designations', { companyId, $or: [{ name: { $regex: `^${body.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }, { code: body.code }] })) {
    throw new AppError(409, 'DUPLICATE_NAME', 'A designation with this name or code already exists.');
  }
  const created = await insert('designations', { companyId, isActive: true, branchIds: [], ...body, departmentId: body.departmentId || null, createdAt: nowIso() }, 'des');
  await appendAudit({ actorId: user.id, companyId, action: 'DESIGNATION_CREATED', entityType: 'DESIGNATION', entityId: created.id, newValue: created, ...reqMeta(req) });
  ok(res, (await populateDesignations([created], companyId))[0], 201);
});
orgRouter.patch('/designations/:id', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const before = await findOne('designations', { _id: String(req.params.id), companyId });
  if (!before) throw notFound('Designation');
  const body = parse(z.object({ name: nameSchema, code: codeSchema, isActive: z.boolean(), departmentId: z.string().nullable(), branchIds: z.array(z.string()).max(100) }).partial(), req.body);
  const updated = await patch('designations', { _id: before.id }, { ...body, updatedAt: nowIso() });
  if (body.name && body.name !== before.name) await coll('employees').updateMany({ companyId, designation: before.name }, { $set: { designation: body.name } });
  await appendAudit({ actorId: user.id, companyId, action: 'DESIGNATION_UPDATED', entityType: 'DESIGNATION', entityId: before.id, oldValue: before, newValue: updated, ...reqMeta(req) });
  ok(res, (await populateDesignations([updated!], companyId))[0]);
});

orgRouter.delete('/designations/:id', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const found = await findOne('designations', { _id: String(req.params.id), companyId });
  if (!found) throw notFound('Designation');
  const people = await coll('employees').countDocuments({ companyId, designation: found.name, status: { $nin: ['EXITED', 'ARCHIVED'] } });
  if (people) throw new AppError(409, 'DESIGNATION_IN_USE', `${people} ${people === 1 ? 'person has' : 'people have'} the title ${found.name}. Change their designation first.`, { people });
  await coll('designations').deleteOne({ _id: found.id as never });
  await appendAudit({ actorId: user.id, companyId, action: 'DESIGNATION_DELETED', entityType: 'DESIGNATION', entityId: found.id, oldValue: found, ...reqMeta(req) });
  ok(res, null);
});

// ── Branches (offices) ─────────────────────────────────────────────────
orgRouter.get(['/offices', '/branches'], async (req, res) => ok(res, await find('offices', { companyId: companyIdFor(req) }, { sort: { name: 1 } })));
const branchSchema = z.object({
  name: nameSchema, code: codeSchema, city: z.string().trim().max(80).optional(), address: z.string().trim().max(300).optional(),
  latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(),
  geofenceRadiusMeters: z.number().min(10).max(100_000).optional(), isActive: z.boolean().optional(),
});
orgRouter.post('/branches', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const body = parse(branchSchema, req.body);
  const ent = await effectiveEntitlements(companyId);
  const limit = Number(ent.limits.branches || 0);
  const current = await count('offices', { companyId, isActive: { $ne: false } });
  if (limit && current >= limit) throw new AppError(409, 'BRANCH_LIMIT_REACHED', 'Your plan’s branch limit is full. Upgrade the plan to add more.', { limit, current });
  const created = await insert('offices', { companyId, isActive: true, geofenceRadiusMeters: 250, ...body }, 'branch');
  await appendAudit({ actorId: user.id, companyId, action: 'BRANCH_CREATED', entityType: 'BRANCH', entityId: created.id, newValue: created, ...reqMeta(req) });
  ok(res, created, 201);
});
orgRouter.patch('/branches/:id', async (req, res) => {
  const user = me(req);
  const found = await findOne('offices', { _id: String(req.params.id) });
  if (!found) throw notFound('Branch');
  if (!(await recordWithinScope(user, found, 'ORGANIZATION.EDIT'))) throw forbidden('This branch is outside your scope.', 'SCOPE_DENIED');
  const body = parse(branchSchema.partial(), req.body);
  const updated = await patch('offices', { _id: found.id }, body);
  await appendAudit({ actorId: user.id, companyId: found.companyId, action: 'BRANCH_UPDATED', entityType: 'BRANCH', entityId: found.id, oldValue: found, newValue: updated, ...reqMeta(req) });
  ok(res, updated);
});

// ── Teams ──────────────────────────────────────────────────────────────
const teamSchema = z.object({
  name: nameSchema, branchId: z.string().nullish(), departmentId: z.string().nullish(), managerEmployeeId: z.string().nullish(), supervisorEmployeeId: z.string().nullish(),
  employeeIds: z.array(z.string()).max(2000).optional(),
});
async function assertEmployeesInCompany(companyId: string, ids: (string | null | undefined)[]) {
  const wanted = [...new Set(ids.filter((x): x is string => !!x))];
  if (!wanted.length) return;
  if ((await count('employees', { companyId, _id: { $in: wanted } })) !== wanted.length) throw forbidden('Everyone on a team must belong to this company.', 'SCOPE_DENIED');
}
orgRouter.get('/teams', async (req, res) => ok(res, await find('teams', { companyId: companyIdFor(req) }, { sort: { name: 1 } })));
orgRouter.post('/teams', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const body = parse(teamSchema, req.body);
  await assertEmployeesInCompany(companyId, [...(body.employeeIds ?? []), body.managerEmployeeId, body.supervisorEmployeeId]);
  const created = await insert('teams', { companyId, employeeIds: [], ...body }, 'team');
  await appendAudit({ actorId: user.id, companyId, action: 'TEAM_CREATED', entityType: 'TEAM', entityId: created.id, newValue: created, ...reqMeta(req) });
  ok(res, created, 201);
});
orgRouter.patch('/teams/:id', async (req, res) => {
  const user = me(req);
  const found = await findOne('teams', { _id: String(req.params.id) });
  if (!found) throw notFound('Team');
  if (!(await recordWithinScope(user, found, 'ORGANIZATION.EDIT'))) throw forbidden('This team is outside your scope.', 'SCOPE_DENIED');
  const body = parse(teamSchema.partial(), req.body);
  await assertEmployeesInCompany(found.companyId, [...(body.employeeIds ?? []), body.managerEmployeeId, body.supervisorEmployeeId]);
  const updated = await patch('teams', { _id: found.id }, body);
  await appendAudit({ actorId: user.id, companyId: found.companyId, action: 'TEAM_UPDATED', entityType: 'TEAM', entityId: found.id, oldValue: found, newValue: updated, ...reqMeta(req) });
  ok(res, updated);
});

// ── Reporting lines ────────────────────────────────────────────────────
orgRouter.get('/reporting-lines', async (req, res) => ok(res, await find('reportingLines', { companyId: companyIdFor(req) })));
orgRouter.post('/reporting-lines', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const body = parse(z.object({ managerEmployeeId: z.string().min(1), reportEmployeeId: z.string().min(1), relationship: z.enum(['MANAGER', 'SUPERVISOR', 'DOTTED']).default('MANAGER'), effectiveFrom: z.string().optional() }).refine((b) => b.managerEmployeeId !== b.reportEmployeeId, { message: 'Someone cannot report to themselves.' }), req.body);
  await assertEmployeesInCompany(companyId, [body.managerEmployeeId, body.reportEmployeeId]);
  const created = await insert('reportingLines', { companyId, ...body, effectiveFrom: body.effectiveFrom ?? nowIso().slice(0, 10) }, 'reporting');
  await appendAudit({ actorId: user.id, companyId, action: 'REPORTING_LINE_CREATED', entityType: 'REPORTING_LINE', entityId: created.id, newValue: created, ...reqMeta(req) });
  ok(res, created, 201);
});

