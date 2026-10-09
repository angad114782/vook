import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { coll } from '../../db/mongo.ts';
import { byId, count, escapeRegex, find, findOne, insert, insertMany, pageQuery, pagination, patch, type Row } from '../../db/repo.ts';
import { allowedEmployeeIds, appendAudit, effectiveEntitlements, effectivePermissions, invalidateTenant, recordWithinScope, type AuthUser } from '../../domain/access.ts';
import { AppError, forbidden, notFound } from '../../lib/errors.ts';
import { companyIdFor, me, ok, parse, reqMeta } from '../../lib/http.ts';
import { idempotent } from '../../lib/idempotency.ts';
import { sendMail } from '../../lib/mail.ts';
import { nextSeq, reserveSeq } from '../../lib/sequence.ts';
import { nowIso, pick, safeUser, today } from '../../lib/serialize.ts';
import { forgetUserSessions } from '../../middleware/session.ts';
import { env } from '../../config/env.ts';

export const employeeRouter = Router();

const SENSITIVE = ['annualCtc', 'bankName', 'branchName', 'accountHolder', 'accountNumber', 'ifsc'] as const;
const mobileKey = (v: unknown) => String(v ?? '').replace(/\D/g, '').slice(-10) || undefined;

/** Pay and bank details only leave the server for people allowed to manage employees or payroll (or the employee themself). */
async function viewFor(user: AuthUser, row: Row): Promise<Row> {
  const permissions = await effectivePermissions(user);
  const mayRead = permissions.includes('*') || permissions.includes('EMPLOYEE_MANAGEMENT.EDIT') || permissions.includes('PAYROLL.VIEW') || row.userId === user.id;
  const live = row.userId ? await byId('users', row.userId) : null;
  const view: Row = { ...row, user: live ? { id: live.id, name: live.name, email: live.email, role: live.role, accountStatus: live.isActive === false ? 'SUSPENDED' : live.passwordHash ? 'ACTIVE' : 'INVITED', lastLoginAt: live.lastLoginAt } : row.user };
  delete view.mobileKey;
  if (!mayRead) for (const k of SENSITIVE) delete view[k];
  return view;
}

async function companyOptions(user: AuthUser) {
  const rows = await find('companies', user.role === 'SUPER_ADMIN' ? {} : { _id: user.companyId ?? '' }, { projection: { name: 1, companyCode: 1 }, limit: 1000 });
  return rows.map((c) => ({ id: c.id, _id: c.id, name: c.name, companyCode: c.companyCode }));
}

employeeRouter.get('/employees', async (req, res) => {
  const user = me(req);
  const isPlatform = user.role === 'SUPER_ADMIN';
  const filter: Row = {};
  if (isPlatform) { if (typeof req.query.companyId === 'string') filter.companyId = req.query.companyId; }
  else {
    filter.companyId = user.companyId;
    const ids = await allowedEmployeeIds(user, 'EMPLOYEE_MANAGEMENT.VIEW');
    if (ids) filter._id = { $in: ids };
  }
  const status = String(req.query.status ?? '');
  if (status && status !== 'ALL') filter.status = status.toUpperCase();
  const department = String(req.query.department ?? '');
  if (department && department !== 'ALL') filter.department = department;
  const search = String(req.query.search ?? '').trim();
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = ['user.name', 'user.email', 'employeeId', 'mobile', 'phone', 'department', 'designation'].map((f) => ({ [f]: rx }));
  }
  const q = pageQuery(req.query);
  const [rows, total, active, departments, companies] = await Promise.all([
    find('employees', filter, { sort: { createdAt: -1, _id: -1 }, skip: q.skip, limit: q.pageSize }),
    count('employees', filter), count('employees', { ...filter, status: 'ACTIVE' }),
    coll('employees').distinct('department', filter), companyOptions(user),
  ]);
  const company = isPlatform && rows.length ? new Map((await find('companies', { _id: { $in: [...new Set(rows.map((r) => r.companyId))] } })).map((c) => [c.id, c])) : null;
  const employees = await Promise.all(rows.map(async (r) => {
    const v = await viewFor(user, r);
    if (!isPlatform) return v;
    const c = company?.get(r.companyId);
    return { id: v.id, employeeId: v.employeeId, name: v.user?.name ?? v.name, email: v.user?.email, mobile: v.mobile ?? v.phone, companyId: c ? { id: c.id, _id: c.id, name: c.name, companyCode: c.companyCode } : undefined, department: v.department, designation: v.designation, employmentType: v.employmentType, status: v.status, joiningDate: v.joiningDate };
  }));
  ok(res, {
    employees, companies,
    privacy: isPlatform ? 'Work contact and employment-directory fields only. Salary, banking, documents and identity records are excluded.' : 'ROLE_SCOPED',
    pagination: pagination(q, total),
    stats: { total, active, inactive: total - active, departments: departments.filter(Boolean).length },
  });
});

const employeeFields = {
  name: z.string().trim().min(1).max(120), email: z.string().trim().email().max(200).or(z.literal('')), mobile: z.string().trim().max(30),
  department: z.string().trim().max(120).nullable(), designation: z.string().trim().max(120).nullable(), departmentId: z.string().nullable(), branchId: z.string().nullable(),
  employmentType: z.string().trim().min(2).max(60), joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/), annualCtc: z.coerce.number().min(0).max(1e10).nullable(),
  shiftType: z.string().max(40).nullable(), shiftTiming: z.string().max(40).nullable(),
  accountHolder: z.string().trim().max(120), bankName: z.string().trim().max(120), branchName: z.string().trim().max(120), accountNumber: z.string().trim().max(40), ifsc: z.string().trim().max(20),
};
const createSchema = z.object(employeeFields).partial().required({ name: true });
const updateSchema = z.object({ ...employeeFields, version: z.number().int().optional() }).partial();

async function nextEmployeeCode(companyId: string) {
  const company = await byId('companies', companyId);
  const prefix = String(company?.employeePrefix ?? (String(company?.name ?? 'EMP').split(/\s+/).map((w: string) => w[0]).join('').slice(0, 3) || 'EMP')).toUpperCase();
  const seq = await nextSeq(`employee:${companyId}`, () => count('employees', { companyId }));
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

async function assertSeatAvailable(companyId: string, wanted = 1) {
  const ent = await effectiveEntitlements(companyId);
  const limit = Number(ent.limits.employees || 0);
  const current = await count('employees', { companyId, status: { $ne: 'EXITED' } });
  if (limit && current + wanted > limit) throw new AppError(409, 'EMPLOYEE_LIMIT_REACHED', 'Your plan’s employee limit is full. Upgrade the plan to add more people.', { limit, current });
  return { limit, current };
}

employeeRouter.post('/employees', (req, res) => idempotent(req, res, async () => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const body = parse(createSchema, req.body);
  await assertSeatAvailable(companyId);
  if (body.mobile && await findOne('employees', { companyId, mobileKey: mobileKey(body.mobile) })) throw new AppError(409, 'DUPLICATE_MOBILE', 'This mobile number already belongs to another employee.');
  if (body.email && await findOne('employees', { companyId, 'user.email': { $regex: `^${escapeRegex(body.email)}$`, $options: 'i' } })) throw new AppError(409, 'DUPLICATE_EMAIL', 'This email already belongs to another employee.');
  const { name, email, ...rest } = body;
  const row = await insert('employees', {
    companyId, employeeId: await nextEmployeeCode(companyId), status: 'ONBOARDING', employmentType: 'Permanent', joiningDate: today(), version: 1, createdAt: nowIso(),
    branchId: null, departmentId: null, department: null, designation: null, annualCtc: null, ...rest, mobileKey: mobileKey(body.mobile),
    user: { id: null, name, email: email ?? '', role: 'EMPLOYEE', accountStatus: 'NOT_CREATED' },
  }, 'employee');
  await appendAudit({ actorId: user.id, companyId, action: 'EMPLOYEE_CREATED', entityType: 'EMPLOYEE', entityId: row.id, newValue: pick(row, ['employeeId', 'department', 'designation', 'employmentType', 'joiningDate']), ...reqMeta(req) });
  return { status: 201, body: { data: await viewFor(user, row) } };
}));

const importRow = z.object({ name: z.any(), mobile: z.any(), email: z.any().optional(), department: z.any().optional(), designation: z.any().optional(), joiningDate: z.any().optional(), employmentType: z.any().optional(), annualCtc: z.any().optional() });
employeeRouter.post('/employees/import', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const { rows } = parse(z.object({ rows: z.array(importRow).max(500, 'Please upload up to 500 employees at a time.') }), req.body);
  if (!rows.length) throw new AppError(422, 'VALIDATION_ERROR', 'There are no employees in this file.');
  const ent = await effectiveEntitlements(companyId);
  const limit = Number(ent.limits.employees || 0);
  const existing = await find('employees', { companyId }, { projection: { mobileKey: 1, 'user.email': 1, status: 1 } });
  const mobiles = new Set(existing.map((e) => e.mobileKey).filter(Boolean));
  const emails = new Set(existing.map((e) => String(e.user?.email ?? '').toLowerCase()).filter(Boolean));
  let active = existing.filter((e) => e.status !== 'EXITED').length;
  const errors: { row: number; message: string }[] = [];
  const toInsert: Row[] = [];
  const company = await byId('companies', companyId);
  const prefix = String(company?.employeePrefix ?? (String(company?.name ?? 'EMP').split(/\s+/).map((w: string) => w[0]).join('').slice(0, 3) || 'EMP')).toUpperCase();
  rows.forEach((raw, index) => {
    const rowNumber = index + 2;
    const name = String(raw.name ?? '').trim();
    const mobile = String(raw.mobile ?? '').trim();
    const email = String(raw.email ?? '').trim();
    const key = mobileKey(mobile);
    if (!name || !key || key.length < 10) return void errors.push({ row: rowNumber, message: 'Name and a 10-digit mobile number are required' });
    if (mobiles.has(key)) return void errors.push({ row: rowNumber, message: 'This mobile number already belongs to another employee' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return void errors.push({ row: rowNumber, message: 'Email does not look right' });
    if (email && emails.has(email.toLowerCase())) return void errors.push({ row: rowNumber, message: 'This email already belongs to another employee' });
    if (limit && active >= limit) return void errors.push({ row: rowNumber, message: 'Your plan’s employee limit is full. Upgrade the plan to add more' });
    toInsert.push({
      companyId, employeeId: '', branchId: null, departmentId: null, department: String(raw.department || '') || null, designation: String(raw.designation || '') || null,
      employmentType: ['Permanent', 'Contract'].includes(String(raw.employmentType)) ? String(raw.employmentType) : 'Permanent', status: 'ONBOARDING',
      joiningDate: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.joiningDate ?? '')) ? String(raw.joiningDate) : today(), annualCtc: raw.annualCtc ? Number(raw.annualCtc) || null : null,
      mobile, mobileKey: key, version: 1, createdAt: nowIso(), user: { id: null, name, email, role: 'EMPLOYEE', accountStatus: 'NOT_CREATED' },
    });
    mobiles.add(key); if (email) emails.add(email.toLowerCase()); active += 1;
  });
  if (toInsert.length) {
    const first = await reserveSeq(`employee:${companyId}`, toInsert.length, () => count('employees', { companyId }));
    toInsert.forEach((row, i) => { row.employeeId = `${prefix}-${String(first + i).padStart(4, '0')}`; });
  }
  await insertMany('employees', toInsert, 'employee');
  if (toInsert.length) await appendAudit({ actorId: user.id, companyId, action: 'EMPLOYEES_IMPORTED', entityType: 'EMPLOYEE', entityId: 'bulk', newValue: { imported: toInsert.length, failed: errors.length }, ...reqMeta(req) });
  ok(res, { imported: toInsert.length, failed: errors.length, errors });
});

async function loadEmployee(req: import('express').Request, permission: string) {
  const user = me(req);
  const found = await byId('employees', String(req.params.id));
  if (!found) throw notFound('Employee');
  if (user.role !== 'SUPER_ADMIN' && !(await recordWithinScope(user, found, permission))) throw forbidden('This employee is outside your assigned organizational scope.', 'SCOPE_DENIED');
  return { user, found };
}

employeeRouter.get('/employees/:id', async (req, res) => {
  const { user, found } = await loadEmployee(req, 'EMPLOYEE_MANAGEMENT.VIEW');
  ok(res, await viewFor(user, found));
});

employeeRouter.patch('/employees/:id', async (req, res) => {
  const { user, found } = await loadEmployee(req, 'EMPLOYEE_MANAGEMENT.EDIT');
  const { version, name, email, ...body } = parse(updateSchema, req.body);
  if (version !== undefined && version !== Number(found.version ?? 1)) throw new AppError(409, 'VERSION_CONFLICT', 'This employee record changed after you opened it. Refresh and try again.');
  const set: Row = { ...body };
  if (body.mobile !== undefined) set.mobileKey = mobileKey(body.mobile);
  if (name !== undefined) set['user.name'] = name;
  if (email !== undefined) set['user.email'] = email;
  const updated = (await coll('employees').findOneAndUpdate({ _id: found.id, version: Number(found.version ?? 1) }, { $set: set, $inc: { version: 1 } }, { returnDocument: 'after' }));
  if (!updated) throw new AppError(409, 'VERSION_CONFLICT', 'This employee record changed after you opened it. Refresh and try again.');
  const after = { id: updated._id, ...updated };
  await appendAudit({ actorId: user.id, companyId: found.companyId, action: 'EMPLOYEE_UPDATED', entityType: 'EMPLOYEE', entityId: found.id, oldValue: pick(found, Object.keys(set)), newValue: pick(after, Object.keys(set)), ...reqMeta(req) });
  ok(res, await viewFor(user, after));
});

const ALLOWED: Record<string, string[]> = {
  ACTIVATE: ['DRAFT', 'INVITED', 'PREBOARDING', 'ONBOARDING', 'PROBATION', 'SUSPENDED'], START_NOTICE: ['ACTIVE', 'PROBATION'],
  SUSPEND: ['ACTIVE', 'PROBATION'], EXIT: ['NOTICE_PERIOD', 'RESIGNATION'], ARCHIVE: ['EXITED'],
};
const TRANSITIONS: Record<string, string> = { ACTIVATE: 'ACTIVE', SUSPEND: 'SUSPENDED', START_NOTICE: 'NOTICE_PERIOD', EXIT: 'EXITED', ARCHIVE: 'ARCHIVED' };

employeeRouter.post('/employees/:id/actions', async (req, res) => {
  const { user, found } = await loadEmployee(req, 'EMPLOYEE_MANAGEMENT.EDIT');
  const body = parse(z.object({ action: z.string().transform((s) => s.toUpperCase()), version: z.number().int(), reason: z.string().trim().max(500).optional() }), req.body);
  if (!ALLOWED[body.action]?.includes(String(found.status).toUpperCase())) throw new AppError(409, 'INVALID_EMPLOYEE_TRANSITION', `This employee cannot be moved from ${String(found.status).replaceAll('_', ' ').toLowerCase()} using that action.`);
  if (body.version !== Number(found.version ?? 1)) throw new AppError(409, 'VERSION_CONFLICT', 'This employee record changed after you opened it. Refresh and try again.');
  if (!body.reason) throw new AppError(422, 'AUDIT_REASON_REQUIRED', 'Add a reason for this lifecycle change.');
  const updated = await coll('employees').findOneAndUpdate({ _id: found.id, version: Number(found.version ?? 1) }, { $set: { status: TRANSITIONS[body.action] }, $inc: { version: 1 } }, { returnDocument: 'after' });
  if (!updated) throw new AppError(409, 'VERSION_CONFLICT', 'This employee record changed after you opened it. Refresh and try again.');
  if (body.action === 'EXIT' && found.userId) {
    await patch('users', { _id: found.userId }, { isActive: false });
    await coll('sessions').deleteMany({ userId: found.userId });
    forgetUserSessions(); invalidateTenant(found.companyId);
  }
  await appendAudit({ actorId: user.id, companyId: found.companyId, action: `EMPLOYEE_${body.action}`, entityType: 'EMPLOYEE', entityId: found.id, oldValue: { status: found.status }, newValue: { status: updated.status }, reason: body.reason, ...reqMeta(req) });
  ok(res, await viewFor(user, { id: updated._id, ...updated }));
});

// Creates a login for an employee record and emails an invitation.
employeeRouter.post('/employees/:id/account', async (req, res) => {
  const { user, found } = await loadEmployee(req, 'EMPLOYEE_MANAGEMENT.EDIT');
  const body = parse(z.object({ role: z.enum(['EMPLOYEE', 'MANAGER', 'SUPERVISOR', 'HR', 'FINANCE']).default('EMPLOYEE'), email: z.string().trim().email().max(200).optional() }), req.body);
  if (found.userId) throw new AppError(409, 'ACCOUNT_EXISTS', 'This employee already has a login.');
  const email = body.email ?? found.user?.email;
  if (!email) throw new AppError(422, 'EMAIL_REQUIRED', 'Add an email address for this employee first.');
  if (await findOne('users', { emailLower: email.toLowerCase() })) throw new AppError(409, 'EMAIL_IN_USE', 'Someone already uses this email.');
  // The employee's mobile becomes their login number, unless someone else already uses it.
  const mobileTaken = found.mobileKey ? await findOne('users', { mobileKey: found.mobileKey }) : null;
  const created = await insert('users', { name: found.user?.name ?? 'Employee', email, emailLower: email.toLowerCase(), ...(found.mobileKey && !mobileTaken ? { mobile: found.mobile, mobileKey: found.mobileKey } : {}), role: body.role, companyId: found.companyId, isActive: true, twoFactorEnabled: false, createdAt: nowIso(), lastLoginAt: null }, 'user');
  const def = await findOne('roleDefinitions', { companyId: found.companyId, key: body.role });
  if (def && ['EMPLOYEE', 'HR', 'FINANCE'].includes(body.role)) {
    await insert('roleAssignments', { companyId: found.companyId, userId: created.id, roleDefinitionId: def.id, scopeType: body.role === 'EMPLOYEE' ? 'SELF' : 'COMPANY', scopeId: body.role === 'EMPLOYEE' ? found.id : found.companyId, isPrimary: true, createdAt: nowIso() }, 'assignment');
  }
  await patch('employees', { _id: found.id }, { userId: created.id, 'user.id': created.id, 'user.email': email, 'user.accountStatus': 'INVITED', 'user.role': body.role });
  const token = randomBytes(32).toString('base64url');
  await insert('authTokens', { id: createHash('sha256').update(token).digest('hex'), userId: created.id, type: 'INVITE', expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString() }, 'token');
  await sendMail({ to: email, subject: 'You have been invited to Vook', text: 'Set your password to join your team.', link: `${env.CORS_ORIGIN}/accept-invitation?token=${token}` });
  invalidateTenant(found.companyId);
  await appendAudit({ actorId: user.id, companyId: found.companyId, action: 'EMPLOYEE_ACCOUNT_CREATED', entityType: 'EMPLOYEE', entityId: found.id, newValue: safeUser(created), ...reqMeta(req) });
  ok(res, await viewFor(user, (await byId('employees', found.id)) as Row));
});
