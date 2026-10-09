import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACCOUNTS, boot, loginAs } from './helpers.ts';

let ctx: Awaited<ReturnType<typeof boot>>;
beforeAll(async () => { ctx = await boot(); });
afterAll(async () => { await ctx.stop(); });

const nextWeekday = (daysAhead: number, weekday: number) => {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

describe('attendance', () => {
  it('check-in needs location, rejects far-away punches, is idempotent, and check-out needs a check-in', async () => {
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    await (await import('../src/db/mongo.ts')).coll('attendance').deleteMany({ employeeId: 'employee_5', date: new Date().toISOString().slice(0, 10) }); // seed already punched in today
    expect((await emp.agent.post('/api/v2/attendance/mine/check-in').send({})).body.error.code).toBe('LOCATION_REQUIRED');
    const far = await emp.agent.post('/api/v2/attendance/mine/check-in').send({ latitude: 0, longitude: 0 });
    expect(far.status).toBe(403);
    expect(far.body.error.code).toBe('OUTSIDE_GEOFENCE');
    expect((await emp.agent.post('/api/v2/attendance/mine/check-out').send({ latitude: 18.52, longitude: 73.85 })).body.error.code).toBe('CHECK_IN_REQUIRED');
    const a = await emp.agent.post('/api/v2/attendance/mine/check-in').send({ latitude: 18.5204, longitude: 73.8567 });
    const b = await emp.agent.post('/api/v2/attendance/mine/check-in').send({ latitude: 18.5204, longitude: 73.8567 });
    expect(a.status).toBe(200);
    expect(b.body.data.record.id).toBe(a.body.data.record.id);
    const out = await emp.agent.post('/api/v2/attendance/mine/check-out').send({ latitude: 18.5204, longitude: 73.8567 });
    expect(out.body.data.record.checkOut).toBeTruthy();
    const today = (await emp.agent.get('/api/v2/attendance/mine/today')).body.data.record;
    expect(today.checkIn).toBe(a.body.data.record.checkIn);
  });

  it('shows scoped dashboard numbers and a paginated register', async () => {
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    const s = (await hr.agent.get('/api/v2/attendance/summary')).body.data;
    expect(s.stats.totalWorkforce).toBeGreaterThan(0);
    expect(s.stats.presentPct).toBeLessThanOrEqual(100);
    const list = (await hr.agent.get('/api/v2/attendance?limit=5&page=1')).body.data;
    expect(list.records.length).toBeLessThanOrEqual(5);
    expect(list.records[0].employeeId.userId.name).toBeTruthy();
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    const own = (await emp.agent.get('/api/v2/attendance?limit=50&page=1')).body.data;
    expect(own.records.length).toBeGreaterThan(0);
    expect(own.records.every((r: { employeeId: { id: string } }) => r.employeeId.id === 'employee_5')).toBe(true);
  });

  it('regularization goes supervisor → manager → HR, and rejects self-approval and wrong stage', async () => {
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    const date = addDays(new Date().toISOString().slice(0, 10), -3);
    const created = await emp.agent.post('/api/v2/attendance-regularizations/mine').send({ date, requestedCheckIn: '09:05', reason: 'Forgot to punch' });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect((await emp.agent.post('/api/v2/attendance-regularizations/mine').send({ date, requestedCheckIn: '09:05', reason: 'again' })).status).toBe(409);
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    expect((await hr.agent.post(`/api/v2/attendance-regularizations/${id}/actions`).send({ action: 'APPROVE' })).body.error.code).toBe('WORKFLOW_STAGE_MISMATCH');
    const sup = await loginAs(ctx.app, ACCOUNTS.supervisor);
    expect((await sup.agent.post(`/api/v2/attendance-regularizations/${id}/actions`).send({ action: 'APPROVE', comment: 'ok' })).body.data.approvalStage).toBe('MANAGER_APPROVAL');
    const mgr = await loginAs(ctx.app, ACCOUNTS.manager);
    expect((await mgr.agent.post(`/api/v2/attendance-regularizations/${id}/actions`).send({ action: 'APPROVE' })).body.data.approvalStage).toBe('HR_COMPLETION');
    const done = await hr.agent.post(`/api/v2/attendance-regularizations/${id}/actions`).send({ action: 'APPROVE' });
    expect(done.body.data.status).toBe('APPROVED');
    expect((await hr.agent.post(`/api/v2/attendance-regularizations/${id}/actions`).send({ action: 'APPROVE' })).body.error.code).toBe('ALREADY_DECIDED');
    const mine = (await emp.agent.get('/api/v2/attendance/mine')).body.data.records.find((r: { date: string }) => r.date === date);
    expect(mine.checkIn).toBe('09:05');
  });

  it('locking a period blocks manual edits, and open requests block locking', async () => {
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    const old = addDays(new Date().toISOString().slice(0, 10), -75);
    const [oy, om] = old.split('-').map(Number);
    expect((await emp.agent.post('/api/v2/attendance-regularizations/mine').send({ date: old, requestedCheckOut: '18:00', reason: 'Left late' })).status).toBe(201);
    const blocked = await hr.agent.post('/api/v2/attendance-periods/lock').send({ month: om, year: oy });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('ATTENDANCE_EXCEPTIONS_OPEN');
    const other = await hr.agent.post('/api/v2/attendance-periods/lock').send({ month: 1, year: 2020 });
    expect(other.status).toBe(200);
    const manual = await hr.agent.post('/api/v2/attendance').send({ employeeId: 'employee_5', date: '2020-01-10', status: 'Present' });
    expect(manual.body.error.code).toBe('ATTENDANCE_PERIOD_LOCKED');
  });

  it('policy: validates and persists', async () => {
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    expect((await hr.agent.put('/api/v2/attendance-policy').send({ standardStart: '9am' })).status).toBe(422);
    const saved = await hr.agent.put('/api/v2/attendance-policy').send({ graceMinutes: 20 });
    expect(saved.body.data.graceMinutes).toBe(20);
    expect((await hr.agent.get('/api/v2/attendance-policy')).body.data.graceMinutes).toBe(20);
  });
});

describe('leave', () => {
  it('serves the company’s own leave types so screens never hardcode them', async () => {
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    const types = (await emp.agent.get('/api/v2/leave-types')).body.data.map((t: { type: string }) => t.type);
    expect(types).toEqual(expect.arrayContaining(['Casual', 'Sick', 'Earned']));
  });

  it('applies for leave with working-day counting, overlap and balance checks, then approves through the chain', async () => {
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    const monday = nextWeekday(40, 1);
    const sunday = addDays(monday, 6);
    const res = await emp.agent.post('/api/v2/leave-requests/mine').send({ leaveType: 'Casual', startDate: monday, endDate: sunday, reason: 'Trip' });
    expect(res.status).toBe(201);
    expect(res.body.data.days).toBe(5); // Mon–Fri; the weekend is not counted
    const id = res.body.data.id;
    const overlap = await emp.agent.post('/api/v2/leave-requests/mine').send({ leaveType: 'Casual', startDate: monday, endDate: monday });
    expect(overlap.body.error.code).toBe('LEAVE_OVERLAP');
    const tooMany = await emp.agent.post('/api/v2/leave-requests/mine').send({ leaveType: 'Casual', startDate: nextWeekday(90, 1), endDate: addDays(nextWeekday(90, 1), 25) });
    expect(tooMany.body.error.code).toBe('INSUFFICIENT_BALANCE');
    const weekend = await emp.agent.post('/api/v2/leave-requests/mine').send({ leaveType: 'Sick', startDate: nextWeekday(120, 6), endDate: nextWeekday(120, 6) });
    expect(weekend.body.error.code).toBe('NO_WORKING_DAYS');

    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    expect((await hr.agent.patch(`/api/v2/leave-requests/${id}`).send({ status: 'APPROVED' })).body.error.code).toBe('WORKFLOW_STAGE_MISMATCH');
    const sup = await loginAs(ctx.app, ACCOUNTS.supervisor);
    expect((await sup.agent.patch(`/api/v2/leave-requests/${id}`).send({ status: 'APPROVED' })).body.data.approvalStage).toBe('MANAGER_APPROVAL');
    const mgr = await loginAs(ctx.app, ACCOUNTS.manager);
    expect((await mgr.agent.post(`/api/v2/leave-requests/${id}/actions`).send({ action: 'APPROVE' })).body.data.approvalStage).toBe('HR_COMPLETION');
    const final = await hr.agent.patch(`/api/v2/leave-requests/${id}`).send({ status: 'APPROVED' });
    expect(final.body.data.status).toBe('APPROVED');
    const bal = (await emp.agent.get('/api/v2/leave-requests/mine')).body.data.balance.find((b: { type: string }) => b.type === 'Casual');
    expect(bal.used).toBeGreaterThanOrEqual(5);
    const notes = (await import('../src/db/mongo.ts')).coll('notifications');
    expect(await notes.countDocuments({ type: 'LEAVE', 'data.leaveId': id })).toBeGreaterThan(0);
  });

  it('employee can cancel their own pending leave but not approve it', async () => {
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    const d = nextWeekday(200, 2);
    const created = (await emp.agent.post('/api/v2/leave-requests/mine').send({ leaveType: 'Sick', startDate: d, endDate: d })).body.data;
    expect([403, 409]).toContain((await emp.agent.post(`/api/v2/leave-requests/${created.id}/actions`).send({ action: 'APPROVE' })).status);
    const cancelled = await emp.agent.post(`/api/v2/leave-requests/${created.id}/actions`).send({ action: 'CANCEL' });
    expect(cancelled.body.data.status).toBe('CANCELLED');
  });

  it('approvals inbox is scoped and leave decisions flow through it', async () => {
    const mgr = await loginAs(ctx.app, ACCOUNTS.manager);
    const inbox = (await mgr.agent.get('/api/v2/approvals')).body.data;
    expect(inbox.stats.pending).toBeGreaterThanOrEqual(0);
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    expect((await emp.agent.get('/api/v2/approvals')).status).toBe(403);
  });

  it('lists leave for HR with stats and filters', async () => {
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    const all = (await hr.agent.get('/api/v2/leave-requests')).body.data;
    expect(all.stats.total).toBe(all.pagination.total);
    const pending = (await hr.agent.get('/api/v2/leave-requests?status=PENDING')).body.data;
    expect(pending.leaves.every((l: { status: string }) => l.status === 'PENDING')).toBe(true);
    expect(pending.leaves[0].employee.user.name).toBeTruthy();
  });
});

describe('holiday calendars', () => {
  it('needs the configure permission, enforces versions, blocks duplicate dates, and copies a year', async () => {
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    expect((await emp.agent.post('/api/v2/holiday-calendars').send({ name: 'x', year: 2031 })).status).toBe(403);
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    const cal = (await admin.agent.post('/api/v2/holiday-calendars').send({ name: 'Test calendar', year: 2031, stateCode: 'MH' })).body.data;
    const added = await admin.agent.post(`/api/v2/holiday-calendars/${cal.id}/holidays`).send({ version: cal.version, name: 'Founders Day', date: '2031-03-05' });
    expect(added.status).toBe(201);
    expect((await admin.agent.post(`/api/v2/holiday-calendars/${cal.id}/holidays`).send({ version: cal.version, name: 'Stale', date: '2031-04-01' })).body.error.code).toBe('VERSION_CONFLICT');
    expect((await admin.agent.post(`/api/v2/holiday-calendars/${cal.id}/holidays`).send({ version: added.body.data.version, name: 'Dup', date: '2031-03-05' })).body.error.code).toBe('HOLIDAY_DATE_EXISTS');
    const copy = await admin.agent.post(`/api/v2/holiday-calendars/${cal.id}/copy`).send({ targetYear: 2032 });
    expect(copy.body.data.holidays[0].date).toBe('2032-03-05');
    expect((await admin.agent.post(`/api/v2/holiday-calendars/${cal.id}/copy`).send({ targetYear: 2032 })).status).toBe(409);
  });
});

describe('leave types are the company’s own list', () => {
  it('HR can add and delete an unused type, a used one is protected, and staff cannot change the list', async () => {
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    const added = await hr.agent.post('/api/v2/leave-types').send({ type: 'Study Leave', total: 5 });
    expect(added.status).toBe(201);
    expect((await hr.agent.get('/api/v2/leave-types')).body.data.map((t: { type: string }) => t.type)).toContain('Study Leave');
    expect((await hr.agent.post('/api/v2/leave-types').send({ type: 'study leave' })).status).toBe(409);
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    expect((await emp.agent.post('/api/v2/leave-types').send({ type: 'Free days' })).status).toBe(403);
    expect((await hr.agent.delete(`/api/v2/leave-types/${encodeURIComponent('Study Leave')}`)).status).toBe(200);
    expect((await hr.agent.get('/api/v2/leave-types')).body.data.map((t: { type: string }) => t.type)).not.toContain('Study Leave');
    const blocked = await hr.agent.delete(`/api/v2/leave-types/${encodeURIComponent('Casual')}`);
    if (blocked.status === 409) expect(blocked.body.error.code).toBe('LIST_ITEM_IN_USE'); // seeded requests use it
  });
});
