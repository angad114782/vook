import { Router } from 'express';
import { z } from 'zod';
import { coll } from '../../db/mongo.ts';
import { byId, count, escapeRegex, find, findOne, insert, pageQuery, pagination, type Row } from '../../db/repo.ts';
import { allowedEmployeeIds, appendAudit, can, effectivePermissions, recordWithinScope, type AuthUser } from '../../domain/access.ts';
import { AppError, forbidden, notFound } from '../../lib/errors.ts';
import { companyIdFor, me, ok, parse, reqMeta } from '../../lib/http.ts';
import { idempotent } from '../../lib/idempotency.ts';
import { notify } from '../../lib/notify.ts';
import { newId } from '../../lib/ids.ts';
import { nowIso } from '../../lib/serialize.ts';
import { daysBetweenInclusive } from '../../lib/time.ts';
import { myEmployee, policyFor } from './attendance.ts';

export const leaveRouter = Router();

const DEFAULT_LEAVE_TYPES = [{ type: 'Casual', total: 12, paid: true }, { type: 'Sick', total: 10, paid: true }, { type: 'Earned', total: 18, paid: true }, { type: 'Unpaid', total: 0, paid: false }];
const normType = (t: string) => t.toLowerCase().replace(/\s*leave$/, '').trim();
const STAGE_ROLE: Record<string, string> = { SUPERVISOR_RECOMMENDATION: 'SUPERVISOR', MANAGER_APPROVAL: 'MANAGER', HR_COMPLETION: 'HR' };
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-01-15');

async function leaveTypes(companyId: string) {
  const company = await byId('companies', companyId);
  return (company?.leavePolicy?.types as typeof DEFAULT_LEAVE_TYPES | undefined) ?? DEFAULT_LEAVE_TYPES;
}

/** Counts only days people actually work: skips weekly offs and published (non-optional) holidays. */
async function workingDays(companyId: string, start: string, end: string) {
  const policy = await policyFor(companyId);
  const years = new Set([start.slice(0, 4), end.slice(0, 4)]);
  const calendars = await find('holidayCalendars', { companyId, year: { $in: [...years].map(Number) } });
  const holidays = new Set(calendars.flatMap((c) => (c.holidays ?? []).filter((h: Row) => !h.optional).map((h: Row) => h.date as string)));
  let days = 0;
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += 86_400_000) {
    const d = new Date(t);
    if (policy.weeklyOffs.includes(d.getUTCDay()) || holidays.has(d.toISOString().slice(0, 10))) continue;
    days += 1;
  }
  return days;
}

async function balances(employeeId: string, companyId: string, year = new Date().getUTCFullYear()) {
  const types = await leaveTypes(companyId);
  const taken = await coll('leaves').aggregate([
    { $match: { employeeId, status: { $in: ['APPROVED', 'PENDING'] }, startDate: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } } },
    { $group: { _id: { $toLower: '$leaveType' }, used: { $sum: '$days' } } },
  ]).toArray();
  const usedBy = new Map(taken.map((t) => [normType(t._id as string), t.used as number]));
  return types.map((t) => ({ type: t.type, total: t.total, used: usedBy.get(normType(t.type)) ?? 0, remaining: Math.max(0, t.total - (usedBy.get(normType(t.type)) ?? 0)), paid: t.paid }));
}

async function withEmployee(rows: Row[]) {
  const employees = rows.length ? await find('employees', { _id: { $in: [...new Set(rows.map((r) => r.employeeId))] } }) : [];
  const byEmp = new Map(employees.map((e) => [e.id, e]));
  return rows.map((r) => {
    const e = byEmp.get(r.employeeId);
    return { ...r, employee: e ? { id: e.id, employeeId: e.employeeId, department: e.department, user: { name: e.user?.name, email: e.user?.email } } : undefined };
  });
}

async function scopedFilter(user: AuthUser, companyId: string, permission: string): Promise<Row> {
  const ids = await allowedEmployeeIds(user, permission);
  return { companyId, ...(ids ? { employeeId: { $in: ids } } : {}) };
}

leaveRouter.get('/leave-types', async (req, res) => ok(res, (await leaveTypes(companyIdFor(req))).map(({ type, total, paid }) => ({ type, total, paid }))));

// Leave types are the company's own list: HR can add one (days a year and paid or not) or delete one nobody has used.
leaveRouter.post('/leave-types', async (req, res) => {
  const user = me(req);
  if (user.role !== 'COMPANY_ADMIN' && user.role !== 'HR') throw forbidden('Only a company admin or HR can change the leave types.');
  const companyId = companyIdFor(req);
  const body = parse(z.object({ type: z.string().trim().min(2, 'Enter at least 2 letters.').max(40), total: z.coerce.number().int().min(0).max(365).default(12), paid: z.boolean().default(true) }), req.body);
  const types = await leaveTypes(companyId);
  if (types.some((t) => normType(t.type) === normType(body.type))) throw new AppError(409, 'DUPLICATE_NAME', 'This leave type already exists.');
  const next = [...types, { type: body.type, total: body.total, paid: body.paid }];
  await coll('companies').updateOne({ _id: companyId as never }, { $set: { 'leavePolicy.types': next } });
  await appendAudit({ actorId: user.id, companyId, action: 'LEAVE_TYPE_ADDED', entityType: 'LEAVE_TYPE', entityId: body.type, newValue: body, ...reqMeta(req) });
  ok(res, { type: body.type, total: body.total, paid: body.paid }, 201);
});

leaveRouter.delete('/leave-types/:type', async (req, res) => {
  const user = me(req);
  if (user.role !== 'COMPANY_ADMIN' && user.role !== 'HR') throw forbidden('Only a company admin or HR can change the leave types.');
  const companyId = companyIdFor(req);
  const types = await leaveTypes(companyId);
  const found = types.find((t) => normType(t.type) === normType(String(req.params.type)));
  if (!found) throw notFound('Leave type');
  const used = await coll('leaves').countDocuments({ companyId, leaveType: { $regex: `^${escapeRegex(found.type)}( leave)?$`, $options: 'i' } } as never);
  if (used) throw new AppError(409, 'LIST_ITEM_IN_USE', `“${found.type}” is used in ${used} leave ${used === 1 ? 'request' : 'requests'}. It cannot be deleted.`, { count: used });
  await coll('companies').updateOne({ _id: companyId as never }, { $set: { 'leavePolicy.types': types.filter((t) => t !== found) } });
  await appendAudit({ actorId: user.id, companyId, action: 'LEAVE_TYPE_DELETED', entityType: 'LEAVE_TYPE', entityId: found.type, oldValue: found, ...reqMeta(req) });
  ok(res, null);
});

leaveRouter.get('/leave-requests', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const base = await scopedFilter(user, companyId, 'LEAVE_MANAGEMENT.VIEW');
  const filter: Row = { ...base };
  const status = String(req.query.status ?? '').toUpperCase();
  if (status && status !== 'ALL') filter.status = status;
  const leaveType = String(req.query.leaveType ?? '').toLowerCase();
  if (leaveType && leaveType !== 'all') filter.leaveType = { $regex: `^${escapeRegex(normType(leaveType))}( leave)?$`, $options: 'i' };
  const search = String(req.query.search ?? '').trim();
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    const ids = (await find('employees', { companyId, $or: [{ 'user.name': rx }, { employeeId: rx }] }, { projection: { _id: 1 }, limit: 2000 })).map((e) => e.id);
    filter.employeeId = base.employeeId ? { $in: ids.filter((id) => (base.employeeId.$in as string[]).includes(id)) } : { $in: ids };
  }
  const q = pageQuery(req.query);
  const [rows, total, pending, approved, rejected, all] = await Promise.all([
    find('leaves', filter, { sort: { createdAt: -1, _id: -1 }, skip: q.skip, limit: q.pageSize }), count('leaves', filter),
    count('leaves', { ...base, status: 'PENDING' }), count('leaves', { ...base, status: 'APPROVED' }), count('leaves', { ...base, status: 'REJECTED' }), count('leaves', base),
  ]);
  ok(res, { leaves: await withEmployee(rows), pagination: pagination(q, total), stats: { total: all, pending, approved, rejected, filtered: total !== all } });
});

leaveRouter.get('/leave-requests/mine', async (req, res) => {
  const user = me(req);
  const employee = await myEmployee(user);
  const leaves = employee ? await find('leaves', { employeeId: employee.id }, { sort: { createdAt: -1 }, limit: 200 }) : [];
  ok(res, {
    leaves, stats: { pending: leaves.filter((l) => l.status === 'PENDING').length, approved: leaves.filter((l) => l.status === 'APPROVED').length },
    balance: employee ? (await balances(employee.id, user.companyId!)).map(({ type, total, used, remaining }) => ({ type, total, used, remaining })) : [],
  });
});

leaveRouter.post('/leave-requests/mine', (req, res) => idempotent(req, res, async () => {
  const user = me(req);
  const body = parse(z.object({ leaveType: z.string().trim().min(1).max(40), startDate: DATE, endDate: DATE, reason: z.string().trim().max(500).optional() }), req.body);
  if (body.endDate < body.startDate) throw new AppError(422, 'VALIDATION_ERROR', 'The end date cannot be before the start date.');
  const employee = await myEmployee(user);
  if (!employee) throw new AppError(404, 'EMPLOYEE_PROFILE_REQUIRED', 'No employee profile is linked to this account.');
  const types = await leaveTypes(user.companyId!);
  const type = types.find((t) => normType(t.type) === normType(body.leaveType));
  if (!type) throw new AppError(422, 'VALIDATION_ERROR', `“${body.leaveType}” is not a leave type your company offers.`);
  if (daysBetweenInclusive(body.startDate, body.endDate) > 120) throw new AppError(422, 'VALIDATION_ERROR', 'Please split very long leaves into smaller requests.');
  const days = await workingDays(user.companyId!, body.startDate, body.endDate);
  if (days === 0) throw new AppError(422, 'NO_WORKING_DAYS', 'These dates are all weekly offs or holidays, so no leave is needed.');
  const overlap = await findOne('leaves', { employeeId: employee.id, status: { $in: ['PENDING', 'APPROVED'] }, startDate: { $lte: body.endDate }, endDate: { $gte: body.startDate } });
  if (overlap) throw new AppError(409, 'LEAVE_OVERLAP', 'You already have a leave request on some of these dates.');
  if (type.paid) {
    const remaining = (await balances(employee.id, user.companyId!, Number(body.startDate.slice(0, 4)))).find((b) => normType(b.type) === normType(type.type))?.remaining ?? 0;
    if (days > remaining) throw new AppError(422, 'INSUFFICIENT_BALANCE', `You have ${remaining} ${type.type.toLowerCase()} leave day${remaining === 1 ? '' : 's'} left, but this request needs ${days}.`, { remaining, requested: days });
  }
  const createdAt = nowIso();
  const leave = await insert('leaves', { companyId: user.companyId, employeeId: employee.id, branchId: employee.branchId, departmentId: employee.departmentId, leaveType: type.type, startDate: body.startDate, endDate: body.endDate, reason: body.reason ?? null, days, status: 'PENDING', approvalStage: 'SUPERVISOR_RECOMMENDATION', version: 1, createdAt }, 'leave');
  await insert('approvals', { companyId: user.companyId, employeeId: employee.id, entityType: 'LEAVE', entityId: leave.id, type: 'Leave', details: `${type.type} leave · ${days} day${days === 1 ? '' : 's'}`, date: body.startDate, priority: 'Medium', status: 'PENDING', currentStage: 'SUPERVISOR_RECOMMENDATION', history: [], createdAt }, 'approval');
  await appendAudit({ actorId: user.id, companyId: user.companyId, action: 'LEAVE_REQUESTED', entityType: 'LEAVE_REQUEST', entityId: leave.id, newValue: leave, ...reqMeta(req) });
  return { status: 201, body: { data: leave } };
}));

type Decision = 'APPROVE' | 'REJECT' | 'CANCEL';
export async function decideLeave(user: AuthUser, leaveId: string, decision: Decision, comment: string | null, req: import('express').Request) {
  const found = await findOne('leaves', { _id: leaveId, companyId: user.companyId });
  if (!found) throw notFound('Leave request');
  const owner = await byId('employees', found.employeeId);
  const entry = { actorId: user.id, role: user.role, action: decision, comment, at: nowIso() };

  if (decision === 'CANCEL') {
    if (owner?.userId !== user.id) throw forbidden('You can only cancel your own leave.', 'SCOPE_DENIED');
    if (!['PENDING', 'APPROVED'].includes(found.status)) throw new AppError(409, 'ALREADY_DECIDED', 'This leave can no longer be cancelled.');
  } else {
    if (found.status !== 'PENDING') throw new AppError(409, 'ALREADY_DECIDED', 'This request has already been decided.');
    const expected = STAGE_ROLE[found.approvalStage ?? 'SUPERVISOR_RECOMMENDATION'];
    if (user.role !== expected && user.role !== 'COMPANY_ADMIN') throw new AppError(409, 'WORKFLOW_STAGE_MISMATCH', `This step needs a ${String(expected).toLowerCase()} to decide.`, { currentStage: found.approvalStage, expectedRole: expected });
    if (!(await recordWithinScope(user, found, `LEAVE_MANAGEMENT.${decision}`))) throw forbidden('This request is outside your approval scope.', 'SCOPE_DENIED');
    if (!can(await effectivePermissions(user), `LEAVE_MANAGEMENT.${decision}`)) throw forbidden('Your role does not grant this leave decision.');
    if (owner?.userId === user.id) throw new AppError(403, 'SELF_APPROVAL', 'You cannot decide your own leave.');
  }

  let set: Row;
  if (decision === 'CANCEL') set = { status: 'CANCELLED', approvalStage: 'COMPLETED' };
  else if (decision === 'REJECT') set = { status: 'REJECTED', approvalStage: 'COMPLETED' };
  else if (user.role === 'SUPERVISOR') set = { approvalStage: 'MANAGER_APPROVAL' };
  else if (user.role === 'MANAGER') set = { approvalStage: 'HR_COMPLETION' };
  else set = { status: 'APPROVED', approvalStage: 'COMPLETED' };

  const updated = await coll('leaves').findOneAndUpdate({ _id: found.id, status: found.status, approvalStage: found.approvalStage }, { $set: set, $inc: { version: 1 } }, { returnDocument: 'after' });
  if (!updated) throw new AppError(409, 'ALREADY_DECIDED', 'This request was just decided by someone else.');
  const nextStatus = set.status ?? found.status;
  await coll('approvals').updateOne({ entityType: 'LEAVE', entityId: found.id }, { $set: { status: nextStatus, currentStage: set.approvalStage, updatedAt: nowIso() }, $push: { history: entry } as never });

  if (owner?.userId && decision !== 'CANCEL') {
    await notify({ userId: owner.userId, companyId: found.companyId, type: 'LEAVE', title: `Leave ${nextStatus.toLowerCase()}`, message: set.approvalStage === 'COMPLETED' ? `Your leave request is ${nextStatus.toLowerCase()}.` : `Your leave request moved to ${String(set.approvalStage).replaceAll('_', ' ').toLowerCase()}.`, data: { leaveId: found.id } });
  }
  if (decision === 'APPROVE' && set.status === 'APPROVED') {
    // Reflect approved leave on the attendance sheet so payroll sees it.
    for (let t = Date.parse(`${found.startDate}T00:00:00Z`); t <= Date.parse(`${found.endDate}T00:00:00Z`); t += 86_400_000) {
      const date = new Date(t).toISOString().slice(0, 10);
      await coll('attendance').updateOne({ employeeId: found.employeeId, date }, { $setOnInsert: { _id: newId('attendance'), companyId: found.companyId, branchId: owner?.branchId ?? null, departmentId: owner?.departmentId ?? null, status: 'Leave', leaveType: found.leaveType, source: 'LEAVE', checkIn: null, checkOut: null, createdAt: nowIso() } }, { upsert: true });
    }
  }
  await appendAudit({ actorId: user.id, companyId: found.companyId, action: `LEAVE_${decision}`, entityType: 'LEAVE_REQUEST', entityId: found.id, oldValue: { status: found.status, approvalStage: found.approvalStage }, newValue: set, ...reqMeta(req) });
  return { id: updated._id, ...updated };
}

const decisionSchema = z.object({ status: z.string().optional(), action: z.string().optional(), comment: z.string().max(500).nullish(), reason: z.string().max(500).nullish(), version: z.number().optional() });
const toDecision = (b: z.infer<typeof decisionSchema>): Decision => {
  const raw = String(b.status ?? b.action ?? '').toUpperCase();
  if (raw.includes('CANCEL')) return 'CANCEL';
  if (raw.includes('REJECT')) return 'REJECT';
  if (raw.includes('APPROV')) return 'APPROVE';
  throw new AppError(422, 'VALIDATION_ERROR', 'Choose approve or reject.');
};
const leaveDecision = async (req: import('express').Request, res: import('express').Response) => {
  const body = parse(decisionSchema, req.body);
  ok(res, await decideLeave(me(req), String(req.params.id), toDecision(body), body.comment ?? body.reason ?? null, req));
};
leaveRouter.patch('/leave-requests/:id', leaveDecision);
leaveRouter.post('/leave-requests/:id/actions', leaveDecision);

// ── Approvals inbox ────────────────────────────────────────────────────
leaveRouter.get('/approvals', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const filter = await scopedFilter(user, companyId, 'APPROVALS.VIEW');
  const q = pageQuery(req.query);
  const today = nowIso().slice(0, 10);
  const [rows, total, pending, approvedToday, rejected, escalated] = await Promise.all([
    find('approvals', filter, { sort: { createdAt: -1, _id: -1 }, skip: q.skip, limit: q.pageSize }), count('approvals', filter),
    count('approvals', { ...filter, status: 'PENDING' }), count('approvals', { ...filter, status: 'APPROVED', updatedAt: { $regex: `^${today}` } }),
    count('approvals', { ...filter, status: 'REJECTED' }), count('approvals', { ...filter, escalatedAt: { $exists: true, $ne: null } }),
  ]);
  const withEmp = await withEmployee(rows);
  ok(res, { approvals: withEmp, pagination: pagination(q, total), stats: { pending, approvedToday, rejected, escalated } });
});

leaveRouter.patch('/approvals/:id', async (req, res) => {
  const user = me(req);
  const body = parse(decisionSchema, req.body);
  const decision = toDecision(body);
  const found = await findOne('approvals', { _id: String(req.params.id), companyId: user.companyId });
  if (!found) throw notFound('Approval');
  if (found.entityType === 'LEAVE') {
    await decideLeave(user, found.entityId, decision, body.comment ?? null, req);
    return ok(res, await byId('approvals', found.id));
  }
  if (decision === 'CANCEL') throw new AppError(422, 'VALIDATION_ERROR', 'Choose approve or reject.');
  if (found.status !== 'PENDING') throw new AppError(409, 'ALREADY_DECIDED', 'This request has already been decided.');
  if (!can(await effectivePermissions(user), `APPROVALS.${decision}`)) throw forbidden('Your role does not grant this approval decision.');
  if (!(await recordWithinScope(user, found, `APPROVALS.${decision}`))) throw forbidden('This approval is outside your scope.', 'SCOPE_DENIED');
  const owner = await byId('employees', found.employeeId);
  if (owner?.userId === user.id) throw new AppError(403, 'SELF_APPROVAL', 'You cannot decide your own request.');
  const updated = await coll('approvals').findOneAndUpdate({ _id: found.id, status: 'PENDING' }, { $set: { status: decision === 'REJECT' ? 'REJECTED' : 'APPROVED', updatedAt: nowIso() }, $push: { history: { actorId: user.id, role: user.role, action: decision, comment: body.comment ?? null, at: nowIso() } } as never }, { returnDocument: 'after' });
  if (!updated) throw new AppError(409, 'ALREADY_DECIDED', 'This request was just decided by someone else.');
  await appendAudit({ actorId: user.id, companyId: found.companyId, action: `APPROVAL_${decision}`, entityType: 'APPROVAL', entityId: found.id, oldValue: { status: found.status }, newValue: { status: updated.status }, ...reqMeta(req) });
  ok(res, { id: updated._id, ...updated });
});

// ── Holiday calendars ──────────────────────────────────────────────────
const holidayWriteGuard = async (req: import('express').Request) => {
  if (!can(await effectivePermissions(me(req)), 'LEAVE_MANAGEMENT.CONFIGURE')) throw forbidden('Changing holiday calendars needs the “configure leave” permission.');
};
const loadCalendar = async (req: import('express').Request) => {
  const found = await findOne('holidayCalendars', { _id: String(req.params.id), companyId: companyIdFor(req) });
  if (!found) throw notFound('Holiday calendar');
  return found;
};
const bump = (found: Row, body: { version?: number }) => {
  if (Number(body.version) !== Number(found.version)) throw new AppError(409, 'VERSION_CONFLICT', 'This calendar changed in another session. Refresh and try again.');
};
const saveCalendar = async (found: Row, set: Row) => {
  const updated = await coll('holidayCalendars').findOneAndUpdate({ _id: found.id, version: found.version }, { $set: { ...set, updatedAt: nowIso() }, $inc: { version: 1 } }, { returnDocument: 'after' });
  if (!updated) throw new AppError(409, 'VERSION_CONFLICT', 'This calendar changed in another session. Refresh and try again.');
  return { id: updated._id, ...updated };
};

leaveRouter.get('/holiday-calendars', async (req, res) => {
  const year = Number(req.query.year) || 0;
  ok(res, { calendars: await find('holidayCalendars', { companyId: companyIdFor(req), ...(year ? { year } : {}) }, { sort: { year: -1, name: 1 } }) });
});

leaveRouter.post('/holiday-calendars', async (req, res) => {
  await holidayWriteGuard(req);
  const user = me(req);
  const companyId = companyIdFor(req);
  const body = parse(z.object({ name: z.string().trim().min(1).max(120), year: z.number().int().min(2000).max(2100), stateCode: z.string().max(10).nullish(), branchIds: z.array(z.string()).optional(), employeeGroupIds: z.array(z.string()).optional() }), req.body);
  if (await findOne('holidayCalendars', { companyId, year: body.year, name: body.name })) throw new AppError(409, 'HOLIDAY_CALENDAR_EXISTS', 'A calendar with this name already exists for the selected year.');
  const now = nowIso();
  const calendar = await insert('holidayCalendars', { companyId, name: body.name, year: body.year, stateCode: body.stateCode ?? null, branchIds: body.branchIds ?? [], employeeGroupIds: body.employeeGroupIds ?? [], holidays: [], version: 1, permittedActions: ['EDIT', 'COPY', 'PUBLISH'], createdAt: now, updatedAt: now }, 'holiday_calendar');
  await appendAudit({ actorId: user.id, companyId, action: 'HOLIDAY_CALENDAR_CREATED', entityType: 'HOLIDAY_CALENDAR', entityId: calendar.id, newValue: calendar, ...reqMeta(req) });
  ok(res, calendar, 201);
});

leaveRouter.patch('/holiday-calendars/:id', async (req, res) => {
  await holidayWriteGuard(req);
  const found = await loadCalendar(req);
  const { version, ...set } = parse(z.object({ version: z.number(), name: z.string().trim().min(1).max(120), stateCode: z.string().max(10).nullable(), branchIds: z.array(z.string()), employeeGroupIds: z.array(z.string()) }).partial(), req.body);
  bump(found, { version });
  const updated = await saveCalendar(found, set);
  await appendAudit({ actorId: me(req).id, companyId: found.companyId, action: 'HOLIDAY_CALENDAR_UPDATED', entityType: 'HOLIDAY_CALENDAR', entityId: found.id, oldValue: found, newValue: updated, ...reqMeta(req) });
  ok(res, updated);
});

leaveRouter.post('/holiday-calendars/:id/holidays', async (req, res) => {
  await holidayWriteGuard(req);
  const found = await loadCalendar(req);
  const body = parse(z.object({ version: z.number(), name: z.string().trim().min(1, 'Holiday name is required').max(120), date: DATE, kind: z.string().max(30).optional(), optional: z.boolean().optional() }), req.body);
  bump(found, body);
  if ((found.holidays ?? []).some((h: Row) => h.date === body.date)) throw new AppError(409, 'HOLIDAY_DATE_EXISTS', 'A holiday already exists on this date.');
  const holidays = [...(found.holidays ?? []), { id: newId('holiday'), name: body.name, date: body.date, kind: body.kind ?? 'COMPANY', optional: Boolean(body.optional) }].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const updated = await saveCalendar(found, { holidays });
  await appendAudit({ actorId: me(req).id, companyId: found.companyId, action: 'HOLIDAY_ADDED', entityType: 'HOLIDAY_CALENDAR', entityId: found.id, newValue: { added: body.name, date: body.date }, ...reqMeta(req) });
  ok(res, updated, 201);
});

leaveRouter.delete('/holiday-calendars/:id/holidays/:holidayId', async (req, res) => {
  await holidayWriteGuard(req);
  const found = await loadCalendar(req);
  const body = parse(z.object({ version: z.number() }), req.body);
  bump(found, body);
  const updated = await saveCalendar(found, { holidays: (found.holidays ?? []).filter((h: Row) => h.id !== req.params.holidayId) });
  await appendAudit({ actorId: me(req).id, companyId: found.companyId, action: 'HOLIDAY_REMOVED', entityType: 'HOLIDAY_CALENDAR', entityId: found.id, newValue: { removed: req.params.holidayId }, ...reqMeta(req) });
  ok(res, updated);
});

leaveRouter.post('/holiday-calendars/:id/copy', async (req, res) => {
  await holidayWriteGuard(req);
  const source = await loadCalendar(req);
  const { targetYear } = parse(z.object({ targetYear: z.number().int().min(2000).max(2100) }), req.body);
  if (await findOne('holidayCalendars', { companyId: source.companyId, year: targetYear, stateCode: source.stateCode })) throw new AppError(409, 'HOLIDAY_CALENDAR_EXISTS', `A matching calendar already exists for ${targetYear}.`);
  const now = nowIso();
  const { id: _sourceId, _id: _sourceKey, ...rest } = source;
  const calendar = await insert('holidayCalendars', { ...rest, name: `${source.name} ${targetYear}`, year: targetYear, version: 1, createdAt: now, updatedAt: now, holidays: (source.holidays ?? []).map((h: Row) => ({ ...h, id: newId('holiday'), date: `${targetYear}-${String(h.date).slice(5)}` })) }, 'holiday_calendar');
  await appendAudit({ actorId: me(req).id, companyId: source.companyId, action: 'HOLIDAY_CALENDAR_COPIED', entityType: 'HOLIDAY_CALENDAR', entityId: calendar.id, newValue: calendar, ...reqMeta(req) });
  ok(res, calendar, 201);
});

