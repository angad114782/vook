import { Router } from 'express';
import { z } from 'zod';
import { coll } from '../../db/mongo.ts';
import { byId, count, escapeRegex, find, findOne, insert, pageQuery, pagination, patch, type Row } from '../../db/repo.ts';
import { allowedEmployeeIds, appendAudit, recordWithinScope, type AuthUser } from '../../domain/access.ts';
import { AppError, forbidden, notFound } from '../../lib/errors.ts';
import { companyIdFor, me, ok, parse, reqMeta } from '../../lib/http.ts';
import { notify } from '../../lib/notify.ts';
import { nowIso } from '../../lib/serialize.ts';
import { durationLabel, haversineMeters, localParts, minutes } from '../../lib/time.ts';

export const attendanceRouter = Router();

const DEFAULT_POLICY = {
  standardStart: '09:00', standardEnd: '18:00', graceMinutes: 15, overtimeAfterMinutes: 30, breakMinutes: 60, weeklyOffs: [0, 6],
  verification: { gpsRequired: false, geofenceRequired: false, deviceRequired: false, ipRequired: false, selfieRequired: false, biometricEnabled: false },
};
export const policyFor = async (companyId: string) => {
  const found = await byId('attendancePolicies', companyId);
  return { ...DEFAULT_POLICY, ...(found ?? {}), verification: { ...DEFAULT_POLICY.verification, ...(found?.verification ?? {}) } };
};
export const timezoneFor = async (companyId: string) => (await byId('companies', companyId))?.timezone ?? 'Asia/Kolkata';
export const myEmployee = (user: AuthUser) => findOne('employees', { userId: user.id, companyId: user.companyId });

/** Start of the person's own shift ("06:00 - 14:00") or, for general staff, the company's standard start. */
export const shiftStartMinutes = (employee: Row, fallback: string) => { const m = /^(\d{2}:\d{2})\s*-/.exec(String(employee.shiftTiming ?? '')); return minutes(m ? m[1]! : fallback); };
/** Minutes after the shift start (negative = early), wrapped so a night shift punching just after midnight is not "hours late". */
export const delayMinutes = (punch: string, start: number) => ((minutes(punch) - start + 1440 + 720) % 1440) - 720;

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 09:30');
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-01-15');

/** `{ employeeId: {$in} }` for the records the user may see, or {} when company-wide. */
async function employeeScope(user: AuthUser, permission: string): Promise<Row> {
  const ids = await allowedEmployeeIds(user, permission);
  return ids ? { employeeId: { $in: ids } } : {};
}

async function employeeIdsMatching(companyId: string, search: string): Promise<string[]> {
  const rx = { $regex: escapeRegex(search), $options: 'i' };
  const rows = await find('employees', { companyId, $or: [{ 'user.name': rx }, { employeeId: rx }] }, { projection: { _id: 1 }, limit: 2000 });
  return rows.map((r) => r.id);
}

async function populateAttendance(rows: Row[]) {
  const employees = rows.length ? await find('employees', { _id: { $in: [...new Set(rows.map((r) => r.employeeId))] } }) : [];
  const byEmp = new Map(employees.map((e) => [e.id, e]));
  return rows.map((r) => {
    const e = byEmp.get(r.employeeId);
    return { ...r, employeeId: e ? { id: e.id, employeeId: e.employeeId, department: e.department, designation: e.designation, userId: { name: e.user?.name } } : r.employeeId };
  });
}

async function summary(req: import('express').Request) {
  const user = me(req);
  const companyId = companyIdFor(req);
  const tz = await timezoneFor(companyId);
  const { date: todayDate } = localParts(tz);
  const scope = await employeeScope(user, 'ATTENDANCE.VIEW');
  const empFilter: Row = { companyId, status: { $ne: 'EXITED' }, ...(scope.employeeId ? { _id: scope.employeeId } : {}) };
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [employees, todayRows, lateRows, policy] = await Promise.all([
    find('employees', empFilter, { projection: { employmentType: 1, department: 1 } }),
    find('attendance', { companyId, date: todayDate, ...scope }, { projection: { employeeId: 1, status: 1 } }),
    find('attendance', { companyId, date: { $gte: since }, status: 'Late', ...scope }, { projection: { checkIn: 1, lateMinutes: 1 } }),
    policyFor(companyId),
  ]);
  const presentIds = new Set(todayRows.filter((r) => r.status !== 'Absent').map((r) => r.employeeId));
  const total = employees.length;
  const present = employees.filter((e) => presentIds.has(e.id)).length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const start = minutes(policy.standardStart);
  const delays = lateRows.map((r) => (typeof r.lateMinutes === 'number' ? r.lateMinutes : r.checkIn ? Math.max(0, minutes(r.checkIn) - start) : 0)).filter((m) => m > 0);
  const byDept = new Map<string, { total: number; present: number }>();
  for (const e of employees) {
    const key = e.department ?? 'Unassigned';
    const d = byDept.get(key) ?? { total: 0, present: 0 };
    d.total += 1; if (presentIds.has(e.id)) d.present += 1;
    byDept.set(key, d);
  }
  return {
    stats: {
      totalWorkforce: total, perm: employees.filter((e) => e.employmentType === 'Permanent').length, cont: employees.filter((e) => e.employmentType === 'Contract').length,
      presentToday: present, presentPct: pct(present), absent: total - present, absentPct: pct(total - present), lateArrivals: lateRows.length,
      avgDelay: delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : 0,
    },
    departments: [...byDept].map(([department, d]) => ({ department, total: d.total, present: d.present, percentage: d.total ? Math.round((d.present / d.total) * 100) : 0 })),
  };
}

attendanceRouter.get('/attendance/summary', async (req, res) => ok(res, await summary(req)));

attendanceRouter.get('/attendance', async (req, res) => {
  // The older HR screen calls this path without paging to get the dashboard numbers.
  if (req.query.page === undefined && req.query.limit === undefined && req.query.pageSize === undefined) return ok(res, await summary(req));
  const user = me(req);
  const companyId = companyIdFor(req);
  const filter: Row = { companyId, ...(await employeeScope(user, 'ATTENDANCE.VIEW')) };
  const month = Number(req.query.month) || 0;
  const year = Number(req.query.year) || 0;
  if (year && month) filter.date = { $gte: `${year}-${String(month).padStart(2, '0')}-01`, $lte: `${year}-${String(month).padStart(2, '0')}-31` };
  else if (year) filter.date = { $gte: `${year}-01-01`, $lte: `${year}-12-31` };
  const search = String(req.query.search ?? '').trim();
  if (search) {
    const ids = await employeeIdsMatching(companyId, search);
    filter.employeeId = filter.employeeId ? { $in: ids.filter((id) => (filter.employeeId.$in as string[]).includes(id)) } : { $in: ids };
  }
  const q = pageQuery(req.query);
  const [rows, total] = await Promise.all([find('attendance', filter, { sort: { date: -1, _id: -1 }, skip: q.skip, limit: q.pageSize }), count('attendance', filter)]);
  ok(res, { records: await populateAttendance(rows), pagination: pagination(q, total) });
});

async function periodLocked(companyId: string, date: string) {
  const [y, m] = date.split('-').map(Number);
  return findOne('attendancePeriods', { companyId, year: y, month: m, status: 'LOCKED' });
}

attendanceRouter.post('/attendance', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const body = parse(z.object({ employeeId: z.string().min(1), date: DATE, checkIn: HHMM.optional(), checkOut: HHMM.optional(), status: z.enum(['Present', 'Late', 'Absent', 'Half Day', 'Leave', 'Holiday', 'Week Off']), notes: z.string().max(500).optional() }), req.body);
  const employee = await findOne('employees', { _id: body.employeeId, companyId });
  if (!employee) throw notFound('Employee');
  if (!(await recordWithinScope(user, employee, 'ATTENDANCE.CREATE'))) throw forbidden('This employee is outside your scope.', 'SCOPE_DENIED');
  if (await periodLocked(companyId, body.date)) throw new AppError(409, 'ATTENDANCE_PERIOD_LOCKED', 'This attendance period is locked. Use the regularization workflow for corrections.');
  if (body.checkIn && body.checkOut && minutes(body.checkOut) < minutes(body.checkIn)) throw new AppError(422, 'VALIDATION_ERROR', 'Check-out must be after check-in.');
  if (await findOne('attendance', { employeeId: employee.id, date: body.date })) throw new AppError(409, 'ATTENDANCE_EXISTS', 'An attendance record already exists for this person on this date. Use a regularization to change it.');
  const row = await insert('attendance', { companyId, branchId: employee.branchId, departmentId: employee.departmentId, source: 'MANUAL', createdBy: user.id, createdAt: nowIso(), ...body }, 'attendance');
  await appendAudit({ actorId: user.id, companyId, action: 'ATTENDANCE_MANUAL_ENTRY', entityType: 'ATTENDANCE', entityId: row.id, newValue: row, ...reqMeta(req) });
  ok(res, (await populateAttendance([row]))[0], 201);
});

// ── Periods ────────────────────────────────────────────────────────────
attendanceRouter.get('/attendance-periods/current', async (req, res) => {
  const companyId = companyIdFor(req);
  const { month, year } = parse(z.object({ month: z.coerce.number().int().min(1).max(12), year: z.coerce.number().int().min(2000).max(2100) }), req.query);
  const found = await findOne('attendancePeriods', { companyId, month, year });
  const now = nowIso();
  ok(res, found ?? { id: `attendance_period_${companyId}_${year}_${month}`, companyId, month, year, status: 'OPEN', version: 0, lockedBy: null, lockedAt: null, createdAt: now, updatedAt: now });
});

attendanceRouter.post('/attendance-periods/lock', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const body = parse(z.object({ month: z.number().int().min(1).max(12), year: z.number().int().min(2000).max(2100), version: z.number().int().optional() }), req.body);
  const found = await findOne('attendancePeriods', { companyId, month: body.month, year: body.year });
  if (found?.status === 'LOCKED') return ok(res, found);
  if (found && body.version !== Number(found.version)) throw new AppError(409, 'VERSION_CONFLICT', 'This attendance period changed in another session. Refresh and try again.');
  const prefix = `${body.year}-${String(body.month).padStart(2, '0')}`;
  const open = await count('attendanceRegularizations', { companyId, date: { $regex: `^${prefix}` }, status: { $nin: ['APPROVED', 'REJECTED'] } });
  if (open) throw new AppError(409, 'ATTENDANCE_EXCEPTIONS_OPEN', `${open} attendance regularization request${open === 1 ? '' : 's'} must be resolved before locking.`, { count: open });
  const now = nowIso();
  const next = { status: 'LOCKED', version: Number(found?.version ?? 0) + 1, lockedBy: user.id, lockedAt: now, updatedAt: now };
  const period = found ? await patch('attendancePeriods', { _id: found.id, version: found.version }, next) : await insert('attendancePeriods', { companyId, month: body.month, year: body.year, createdAt: now, ...next }, 'attendance_period');
  if (!period) throw new AppError(409, 'VERSION_CONFLICT', 'This attendance period changed in another session. Refresh and try again.');
  await appendAudit({ actorId: user.id, companyId, action: 'ATTENDANCE_PERIOD_LOCKED', entityType: 'ATTENDANCE_PERIOD', entityId: period.id, oldValue: found, newValue: period, ...reqMeta(req) });
  ok(res, period);
});

// ── My attendance ──────────────────────────────────────────────────────
attendanceRouter.get('/attendance/mine', async (req, res) => {
  const user = me(req);
  const employee = await myEmployee(user);
  const filter: Row = { employeeId: employee?.id ?? '__none__' };
  const month = Number(req.query.month) || 0;
  const year = Number(req.query.year) || 0;
  if (year && month) filter.date = { $gte: `${year}-${String(month).padStart(2, '0')}-01`, $lte: `${year}-${String(month).padStart(2, '0')}-31` };
  const rows = await find('attendance', filter, { sort: { date: -1 }, limit: 400 });
  const records = rows.map((r) => ({
    date: r.date, day: new Date(`${r.date}T00:00:00Z`).toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' }), status: r.status,
    checkIn: r.checkIn || '--', checkOut: r.checkOut || '--', hours: durationLabel(r.checkIn, r.checkOut), ot: '--',
  }));
  const totalMinutes = rows.reduce((sum, r) => sum + (r.checkIn && r.checkOut ? Math.max(0, minutes(r.checkOut) - minutes(r.checkIn)) : 0), 0);
  ok(res, { records, stats: { present: rows.filter((r) => r.status === 'Present').length, late: rows.filter((r) => r.status === 'Late').length, absent: rows.filter((r) => r.status === 'Absent').length, totalHours: Math.round(totalMinutes / 60), workingDays: rows.length } });
});

attendanceRouter.get('/attendance/mine/today', async (req, res) => {
  const user = me(req);
  const employee = await myEmployee(user);
  const { date } = localParts(await timezoneFor(user.companyId!));
  ok(res, { record: employee ? await findOne('attendance', { employeeId: employee.id, date }) : null });
});

const punch = (kind: 'in' | 'out') => async (req: import('express').Request, res: import('express').Response) => {
  const user = me(req);
  const companyId = user.companyId!;
  const loc = parse(z.object({ latitude: z.coerce.number().min(-90).max(90).optional(), longitude: z.coerce.number().min(-180).max(180).optional(), accuracyMeters: z.coerce.number().min(0).max(100_000).optional() }), req.body);
  const [policy, tz, employee] = await Promise.all([policyFor(companyId), timezoneFor(companyId), myEmployee(user)]);
  if (!employee) throw new AppError(404, 'EMPLOYEE_PROFILE_REQUIRED', 'No employee profile is linked to this account.');
  const verification = policy.verification;
  const hasLocation = loc.latitude !== undefined && loc.longitude !== undefined;
  if (verification.gpsRequired && !hasLocation) throw new AppError(422, 'LOCATION_REQUIRED', 'Please allow location access to mark attendance.');
  let geofence = 'NOT_REQUIRED';
  if (verification.geofenceRequired && hasLocation) {
    const office = employee.branchId ? await byId('offices', employee.branchId) : null;
    if (office?.latitude != null && office?.longitude != null) {
      const distance = haversineMeters(loc.latitude!, loc.longitude!, office.latitude, office.longitude);
      if (distance > Number(office.geofenceRadiusMeters ?? 250)) throw new AppError(403, 'OUTSIDE_GEOFENCE', 'You seem to be away from your office location. Move closer and try again.');
      geofence = 'VERIFIED';
    } else geofence = 'NO_BRANCH_LOCATION';
  }
  const { date, time } = localParts(tz);
  // Live punches are never blocked by a payroll lock; corrections to locked days go through regularization.
  let row = await findOne('attendance', { employeeId: employee.id, date });
  const delay = delayMinutes(time, shiftStartMinutes(employee, policy.standardStart));
  const late = delay > Number(policy.graceMinutes ?? 0);
  const lateMinutes = late ? delay : 0;
  if (kind === 'in') {
    if (!row) {
      try {
        row = await insert('attendance', { companyId, employeeId: employee.id, branchId: employee.branchId, departmentId: employee.departmentId, date, checkIn: time, checkOut: null, status: late ? 'Late' : 'Present', lateMinutes, source: 'WEB', createdAt: nowIso() }, 'attendance');
      } catch { row = await findOne('attendance', { employeeId: employee.id, date }); } // double-tap: the other request won
    } else if (!row.checkIn) {
      row = await patch('attendance', { _id: row.id }, { checkIn: time, status: late ? 'Late' : 'Present', lateMinutes });
    }
  } else {
    if (!row?.checkIn) throw new AppError(409, 'CHECK_IN_REQUIRED', 'Check in before checking out.');
    if (!row.checkOut) row = await patch('attendance', { _id: row.id }, { checkOut: time });
  }
  await insert('attendanceEvents', {
    companyId, employeeId: employee.id, attendanceId: row!.id, type: kind === 'in' ? 'CHECK_IN' : 'CHECK_OUT', occurredAt: nowIso(), source: 'WEB',
    location: hasLocation ? { latitude: loc.latitude, longitude: loc.longitude, accuracyMeters: loc.accuracyMeters ?? 0 } : null,
    verification: { gps: hasLocation ? 'VERIFIED' : 'NOT_PROVIDED', geofence, device: verification.deviceRequired ? 'REQUIRED' : 'OPTIONAL', ip: verification.ipRequired ? 'REQUIRED' : 'OPTIONAL' },
  }, 'attendance_event');
  await appendAudit({ actorId: user.id, companyId, action: kind === 'in' ? 'ATTENDANCE_CHECK_IN' : 'ATTENDANCE_CHECK_OUT', entityType: 'ATTENDANCE', entityId: row!.id, newValue: { time, source: 'WEB' }, ...reqMeta(req) });
  ok(res, { message: kind === 'in' ? 'Checked in.' : 'Checked out.', record: row });
};
attendanceRouter.post('/attendance/mine/check-in', punch('in'));
attendanceRouter.post('/attendance/mine/check-out', punch('out'));

// ── Policy ─────────────────────────────────────────────────────────────
const policySchema = z.object({
  standardStart: HHMM, standardEnd: HHMM, graceMinutes: z.number().int().min(0).max(240), overtimeAfterMinutes: z.number().int().min(0).max(600), breakMinutes: z.number().int().min(0).max(240),
  weeklyOffs: z.array(z.number().int().min(0).max(6)).max(7),
  verification: z.object({ gpsRequired: z.boolean(), geofenceRequired: z.boolean(), deviceRequired: z.boolean(), ipRequired: z.boolean(), selfieRequired: z.boolean(), biometricEnabled: z.boolean() }).partial(),
}).partial();
attendanceRouter.get('/attendance-policy', async (req, res) => ok(res, await policyFor(companyIdFor(req))));
attendanceRouter.put('/attendance-policy', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const body = parse(policySchema, req.body);
  const before = await policyFor(companyId);
  const next = { ...before, ...body, verification: { ...before.verification, ...(body.verification ?? {}) } };
  await coll('attendancePolicies').replaceOne({ _id: companyId }, { companyId, ...next, updatedAt: nowIso() }, { upsert: true });
  await appendAudit({ actorId: user.id, companyId, action: 'ATTENDANCE_POLICY_UPDATED', entityType: 'ATTENDANCE_POLICY', entityId: companyId, oldValue: before, newValue: next, ...reqMeta(req) });
  ok(res, next);
});
attendanceRouter.put('/attendance-verification-policy', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const verification = parse(policySchema.shape.verification.unwrap(), req.body?.verification ?? req.body);
  const before = await policyFor(companyId);
  const next = { ...before, verification: { ...before.verification, ...verification } };
  await coll('attendancePolicies').replaceOne({ _id: companyId }, { companyId, ...next, updatedAt: nowIso() }, { upsert: true });
  await appendAudit({ actorId: user.id, companyId, action: 'ATTENDANCE_VERIFICATION_UPDATED', entityType: 'ATTENDANCE_POLICY', entityId: companyId, oldValue: before.verification, newValue: next.verification, ...reqMeta(req) });
  ok(res, next);
});

// ── Regularizations ────────────────────────────────────────────────────
const STAGE_ROLE: Record<string, string> = { SUPERVISOR_RECOMMENDATION: 'SUPERVISOR', MANAGER_APPROVAL: 'MANAGER', HR_COMPLETION: 'HR' };

async function withEmployee(rows: Row[]) {
  const employees = rows.length ? await find('employees', { _id: { $in: [...new Set(rows.map((r) => r.employeeId))] } }) : [];
  const byEmp = new Map(employees.map((e) => [e.id, e]));
  return rows.map((r) => {
    const o = byEmp.get(r.employeeId);
    return { ...r, employee: o ? { id: o.id, employeeId: o.employeeId, department: o.department, user: { name: o.user?.name ?? 'Employee' } } : undefined };
  });
}

attendanceRouter.get('/attendance-regularizations/mine', async (req, res) => {
  const employee = await myEmployee(me(req));
  const rows = employee ? await find('attendanceRegularizations', { employeeId: employee.id }, { sort: { createdAt: -1 }, limit: 200 }) : [];
  ok(res, { regularizations: await withEmployee(rows) });
});
attendanceRouter.get('/attendance-regularizations', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const rows = await find('attendanceRegularizations', { companyId, ...(await employeeScope(user, 'ATTENDANCE.VIEW')) }, { sort: { createdAt: -1 }, limit: 500 });
  ok(res, { regularizations: await withEmployee(rows) });
});

attendanceRouter.post('/attendance-regularizations/mine', async (req, res) => {
  const user = me(req);
  const body = parse(z.object({ date: DATE, requestedCheckIn: HHMM.nullish(), requestedCheckOut: HHMM.nullish(), reason: z.string().trim().min(3, 'Please tell us why').max(500) }).refine((b) => b.requestedCheckIn || b.requestedCheckOut, { message: 'Add the check-in or check-out time you want recorded.' }), req.body);
  const employee = await myEmployee(user);
  if (!employee) throw new AppError(404, 'EMPLOYEE_PROFILE_REQUIRED', 'No employee profile is linked to this account.');
  if (body.date > localParts(await timezoneFor(user.companyId!)).date) throw new AppError(422, 'VALIDATION_ERROR', 'You cannot correct a day that has not happened yet.');
  if (await findOne('attendanceRegularizations', { employeeId: employee.id, date: body.date, status: 'PENDING' })) throw new AppError(409, 'REGULARIZATION_EXISTS', 'A pending request already exists for this date.');
  const row = await insert('attendanceRegularizations', { companyId: user.companyId, employeeId: employee.id, branchId: employee.branchId, departmentId: employee.departmentId, date: body.date, requestedCheckIn: body.requestedCheckIn ?? null, requestedCheckOut: body.requestedCheckOut ?? null, reason: body.reason, status: 'PENDING', approvalStage: 'SUPERVISOR_RECOMMENDATION', history: [], createdAt: nowIso() }, 'regularization');
  await appendAudit({ actorId: user.id, companyId: user.companyId, action: 'ATTENDANCE_REGULARIZATION_REQUESTED', entityType: 'ATTENDANCE_REGULARIZATION', entityId: row.id, newValue: row, ...reqMeta(req) });
  ok(res, row, 201);
});

attendanceRouter.post('/attendance-regularizations/:id/actions', async (req, res) => {
  const user = me(req);
  const body = parse(z.object({ action: z.string().transform((s) => s.toUpperCase()).pipe(z.enum(['APPROVE', 'REJECT'])), comment: z.string().max(500).optional() }), req.body);
  const found = await findOne('attendanceRegularizations', { _id: String(req.params.id), companyId: user.companyId });
  if (!found) throw notFound('Attendance regularization');
  if (found.status !== 'PENDING') throw new AppError(409, 'ALREADY_DECIDED', 'This request has already been decided.');
  const expected = STAGE_ROLE[found.approvalStage];
  if (user.role !== expected && user.role !== 'COMPANY_ADMIN') throw new AppError(409, 'WORKFLOW_STAGE_MISMATCH', `This step needs a ${String(expected).toLowerCase()} to decide.`);
  if (user.role !== 'COMPANY_ADMIN' && !(await recordWithinScope(user, found, 'ATTENDANCE.APPROVE'))) throw forbidden('This request is outside your scope.', 'SCOPE_DENIED');
  const owner = await byId('employees', found.employeeId);
  if (owner?.userId === user.id) throw new AppError(403, 'SELF_APPROVAL', 'You cannot decide your own request.');
  const entry = { actorId: user.id, role: user.role, action: body.action, comment: body.comment ?? null, at: nowIso() };
  let set: Row;
  if (body.action === 'REJECT') set = { status: 'REJECTED', approvalStage: 'COMPLETED' };
  else if (user.role === 'SUPERVISOR') set = { approvalStage: 'MANAGER_APPROVAL' };
  else if (user.role === 'MANAGER') set = { approvalStage: 'HR_COMPLETION' };
  else set = { status: 'APPROVED', approvalStage: 'COMPLETED' };
  const updated = await coll('attendanceRegularizations').findOneAndUpdate({ _id: found.id, status: 'PENDING', approvalStage: found.approvalStage }, { $set: set, $push: { history: entry } as never }, { returnDocument: 'after' });
  if (!updated) throw new AppError(409, 'ALREADY_DECIDED', 'This request was just decided by someone else.');
  if (set.status === 'APPROVED') {
    const patchSet: Row = { regularized: true };
    if (found.requestedCheckIn) patchSet.checkIn = found.requestedCheckIn;
    if (found.requestedCheckOut) patchSet.checkOut = found.requestedCheckOut;
    const existing = await findOne('attendance', { employeeId: found.employeeId, date: found.date });
    if (existing) await patch('attendance', { _id: existing.id }, patchSet);
    else if (owner) await insert('attendance', { companyId: found.companyId, employeeId: owner.id, branchId: owner.branchId, departmentId: owner.departmentId, date: found.date, status: 'Present', source: 'REGULARIZATION', ...patchSet }, 'attendance');
  }
  if (owner?.userId && set.status) await notify({ userId: owner.userId, companyId: found.companyId, type: 'ATTENDANCE', title: `Attendance correction ${set.status.toLowerCase()}`, message: `Your request for ${found.date} was ${set.status.toLowerCase()}.`, data: { regularizationId: found.id } });
  await appendAudit({ actorId: user.id, companyId: found.companyId, action: `ATTENDANCE_REGULARIZATION_${body.action}`, entityType: 'ATTENDANCE_REGULARIZATION', entityId: found.id, oldValue: { status: found.status, approvalStage: found.approvalStage }, newValue: set, ...reqMeta(req) });
  ok(res, { id: updated._id, ...updated });
});

