import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { io as connect, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACCOUNTS, boot, DEMO_PASSWORD, loginAs } from './helpers.ts';

let ctx: Awaited<ReturnType<typeof boot>>;
let server: Server;
let base = '';
beforeAll(async () => {
  ctx = await boot();
  const { initRealtime } = await import('../src/realtime/gateway.ts');
  server = createServer(ctx.app);
  initRealtime(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  const { closeRealtime } = await import('../src/realtime/gateway.ts');
  await closeRealtime();
  server.close();
  await ctx.stop();
});

const cookieFor = async (email: string) => {
  const res = await request(ctx.app).post('/api/v2/auth/login').send({ email, password: DEMO_PASSWORD });
  return (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');
};
const open = async (email: string): Promise<Socket> => {
  const socket = connect(base, { extraHeaders: { cookie: await cookieFor(email) }, transports: ['websocket'], reconnection: false });
  await new Promise<void>((resolve, reject) => { socket.on('connect', () => resolve()); socket.on('connect_error', reject); });
  return socket;
};
const ask = <T = any>(socket: Socket, event: string, payload: unknown) => new Promise<T>((resolve) => socket.emit(event, payload, resolve));
const next = <T = any>(socket: Socket, event: string) => new Promise<T>((resolve) => socket.once(event, resolve));

describe('notifications', () => {
  it('pages with a cursor, marks read, and keeps preferences', async () => {
    const { coll } = await import('../src/db/mongo.ts');
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    const me = (await emp.agent.get('/api/v2/auth/session')).body.data.user;
    await coll('notifications').insertMany(Array.from({ length: 5 }, (_, i) => ({ _id: `n_test_${i}`, userId: me.id, title: `T${i}`, message: 'm', type: 'X', isRead: false, createdAt: new Date(Date.now() + i).toISOString() })));
    const page1 = (await emp.agent.get('/api/v2/notifications?limit=3')).body.data;
    expect(page1.items).toHaveLength(3);
    expect(page1.nextCursor).toBeTruthy();
    const page2 = (await emp.agent.get(`/api/v2/notifications?limit=3&cursor=${page1.nextCursor}`)).body.data;
    expect(page2.items.every((n: { id: string }) => !page1.items.some((p: { id: string }) => p.id === n.id))).toBe(true);
    expect(page1.unreadCount).toBeGreaterThanOrEqual(5);
    expect((await emp.agent.patch('/api/v2/notifications/read').send({ ids: ['n_test_0', 'not-mine'] })).status).toBe(404);
    expect((await emp.agent.patch('/api/v2/notifications/read').send({ ids: ['n_test_0'] })).status).toBe(200);
    expect((await emp.agent.get('/api/v2/notifications?status=unread&limit=100')).body.data.items.some((n: { id: string }) => n.id === 'n_test_0')).toBe(false);
    const other = await loginAs(ctx.app, ACCOUNTS.hr);
    expect((await other.agent.patch('/api/v2/notifications/n_test_1/read')).status).toBe(404); // someone else's
    expect((await emp.agent.patch('/api/v2/notifications/read-all')).status).toBe(200);
    expect((await emp.agent.get('/api/v2/notifications')).body.data.unreadCount).toBe(0);
    const prefs = await emp.agent.put('/api/v2/notifications/preferences').send({ preferences: { email: false, hacker: true } });
    expect(prefs.body.data.preferences.email).toBe(false);
    expect(prefs.body.data.preferences.hacker).toBeUndefined();
  });
});

describe('support', () => {
  it('keeps tickets private to their company, hides internal notes, and de-duplicates retried messages', async () => {
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    const created = await emp.agent.post('/api/v2/support-tickets').send({ category: 'Payroll', subject: 'Missing allowance', description: 'My allowance is not on the payslip.' });
    expect(created.status).toBe(201);
    expect(created.body.data.ticketNo).toMatch(/^SUP-\d+$/);
    const id = created.body.data.id;
    const sup = await loginAs(ctx.app, ACCOUNTS.supervisor);
    expect((await sup.agent.get(`/api/v2/support-tickets/${id}`)).status).toBe(404); // a colleague cannot open it
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    expect((await admin.agent.get(`/api/v2/support-tickets/${id}`)).status).toBe(200);
    const a = await emp.agent.post(`/api/v2/support-tickets/${id}/comments`).send({ body: 'Any update?', clientMessageId: 'cm-1' });
    const b = await emp.agent.post(`/api/v2/support-tickets/${id}/comments`).send({ body: 'Any update?', clientMessageId: 'cm-1' });
    expect(b.body.data.id).toBe(a.body.data.id);
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    await sa.agent.post(`/api/v2/support-tickets/${id}/comments`).send({ body: 'Internal: check the ledger', isInternal: true });
    await sa.agent.post(`/api/v2/support-tickets/${id}/comments`).send({ body: 'We are looking into it.' });
    const customerView = (await emp.agent.get(`/api/v2/support-tickets/${id}/comments`)).body.data.comments.map((c: { body: string }) => c.body);
    expect(customerView).toContain('We are looking into it.');
    expect(customerView.some((b: string) => b.startsWith('Internal'))).toBe(false);
    const staffView = (await sa.agent.get(`/api/v2/support-tickets/${id}/comments`)).body.data.comments.map((c: { body: string }) => c.body);
    expect(staffView.some((b: string) => b.startsWith('Internal'))).toBe(true);
    expect((await emp.agent.patch(`/api/v2/support-tickets/${id}`).send({ status: 'RESOLVED' })).status).toBe(403);
    expect((await sa.agent.patch(`/api/v2/support-tickets/${id}`).send({ status: 'RESOLVED' })).body.data.status).toBe('RESOLVED');
    const { coll } = await import('../src/db/mongo.ts');
    expect(await coll('notifications').countDocuments({ type: 'SUPPORT', 'data.ticketId': id })).toBeGreaterThan(0);
  });

  it('delivers chat live over sockets with identity from the session only', async () => {
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    const ticket = (await emp.agent.post('/api/v2/support-tickets').send({ category: 'General', subject: 'Live chat', description: 'Testing the live chat.' })).body.data;
    const customer = await open(ACCOUNTS.employee);
    const staff = await open(ACCOUNTS.superAdmin);
    const outsider = await open(ACCOUNTS.supervisor);
    try {
      expect((await ask(outsider, 'support:join', { ticketId: ticket.id })).ok).toBe(false);
      expect((await ask(customer, 'support:join', { ticketId: ticket.id })).ok).toBe(true);
      expect((await ask(staff, 'support:join', { ticketId: ticket.id })).ok).toBe(true);
      const seen = next(staff, 'support:comment');
      const sent = await ask(customer, 'support:comment', { ticketId: ticket.id, body: 'Hello support', clientMessageId: 'sock-1', authorId: { id: 'someone-else' } });
      expect(sent.ok).toBe(true);
      expect(sent.comment.authorId.id).not.toBe('someone-else');
      expect((await seen).body).toBe('Hello support');
      const dup = await ask(customer, 'support:comment', { ticketId: ticket.id, body: 'Hello support', clientMessageId: 'sock-1' });
      expect(dup.comment.id).toBe(sent.comment.id);
      const typing = next(customer, 'support:typing');
      customer.emit('support:typing', { ticketId: ticket.id, isTyping: true });
      staff.emit('support:typing', { ticketId: ticket.id, isTyping: true });
      expect((await typing).isTyping).toBe(true);
      const internalSeen = new Promise<boolean>((resolve) => { customer.once('support:comment', () => resolve(true)); setTimeout(() => resolve(false), 600); });
      await ask(staff, 'support:comment', { ticketId: ticket.id, body: 'staff-only note', clientMessageId: 'sock-2', isInternal: true });
      expect(await internalSeen).toBe(false);
      expect((await ask(customer, 'support:comment', { ticketId: ticket.id, body: '' })).ok).toBe(false);
    } finally { customer.close(); staff.close(); outsider.close(); }
  });

  it('pushes new notifications to the person live, and refuses sockets without a session', async () => {
    const socket = await open(ACCOUNTS.employee);
    try {
      const got = next(socket, 'notification:created');
      const mgr = await loginAs(ctx.app, ACCOUNTS.manager);
      const emp = await loginAs(ctx.app, ACCOUNTS.employee);
      const leave = (await emp.agent.post('/api/v2/leave-requests/mine').send({ leaveType: 'Sick', startDate: '2031-05-12', endDate: '2031-05-12' })).body.data;
      const sup = await loginAs(ctx.app, ACCOUNTS.supervisor);
      await sup.agent.post(`/api/v2/leave-requests/${leave.id}/actions`).send({ action: 'REJECT', comment: 'No cover' });
      expect((await got).title).toMatch(/leave/i);
      void mgr;
    } finally { socket.close(); }
    const anonymous = connect(base, { transports: ['websocket'], reconnection: false });
    const error = await new Promise<Error>((resolve) => anonymous.on('connect_error', resolve));
    expect(error.message).toBe('UNAUTHENTICATED');
    anonymous.close();
  });
});

describe('activity, search, reports, shifts', () => {
  it('activity and audit history are admin-only and company-scoped', async () => {
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    expect((await hr.agent.get('/api/v2/activity-events?limit=5')).status).toBe(200); // HR sees the activity feed
    expect((await hr.agent.get('/api/v2/audit-events')).status).toBe(403); // but not the audit trail
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    expect((await emp.agent.get('/api/v2/activity-events')).status).toBe(403);
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    const a = (await admin.agent.get('/api/v2/activity-events?limit=5')).body.data;
    expect(a.stats.total).toBeGreaterThan(0);
    expect(a.logs.length).toBeLessThanOrEqual(5);
    const audit = (await admin.agent.get('/api/v2/audit-events')).body.data.logs;
    expect(audit.every((l: { companyId: string | null }) => l.companyId === 'company_northstar')).toBe(true);
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    expect((await sa.agent.get('/api/v2/activity-events?companyId=ALL')).status).toBe(200);
  });

  it('search returns only what the person may see', async () => {
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    const r = (await hr.agent.get('/api/v2/search?q=a')).body.data;
    expect(r.employees).toEqual([]); // too short — no scan
    const found = (await hr.agent.get('/api/v2/search?q=Dev')).body.data;
    expect(found.employees.length).toBeGreaterThan(0);
    expect(found.companies).toEqual([]);
    expect(found.users).toEqual([]);
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    const none = (await emp.agent.get('/api/v2/search?q=Dev')).body.data;
    expect(none.employees).toEqual([]);
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    expect((await sa.agent.get('/api/v2/search?q=North')).body.data.companies.length).toBeGreaterThan(0);
  });

  it('reports are built from real records and exports are defused against spreadsheet formulas', async () => {
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    const w = (await hr.agent.get('/api/v2/reports/workforce')).body.data;
    expect(w.summary.total).toBe(w.summary.active + w.summary.inactive);
    const att = (await hr.agent.get('/api/v2/reports/attendance')).body.data;
    expect(att.byStatus).toHaveProperty('Present');
    expect((await hr.agent.get('/api/v2/reports/payroll')).body.data.summary.count).toBeGreaterThan(0);
    expect((await hr.agent.get('/api/v2/reports/leave')).body.data.total).toBeGreaterThan(0);
    expect((await hr.agent.get('/api/v2/reports/nonsense')).status).toBe(404);
    await hr.agent.post('/api/v2/employees').send({ name: '=HYPERLINK("http://x")', mobile: '9777777777' });
    expect((await hr.agent.post('/api/v2/reports/workforce/export').send({})).status).toBe(403); // HR may view, not export
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    const csv = await admin.agent.post('/api/v2/reports/workforce/export').send({});
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain("'=HYPERLINK");
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    expect((await emp.agent.post('/api/v2/reports/workforce/export').send({})).status).toBe(403);
  });

  it('shifts: HR assigns once per day; the supervisor sees only their own team', async () => {
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    const sup = await loginAs(ctx.app, ACCOUNTS.supervisor);
    const date = '2031-06-02';
    expect((await sup.agent.post('/api/v2/shifts').send({ employeeId: 'employee_5', date, shiftName: 'Morning' })).status).toBe(403); // view-only role
    const made = await hr.agent.post('/api/v2/shifts').send({ employeeId: 'employee_5', date, shiftName: 'Morning' });
    expect(made.status).toBe(201);
    expect(made.body.data.startTime).toBe('06:00');
    expect((await hr.agent.post('/api/v2/shifts').send({ employeeId: 'employee_5', date, shiftName: 'Night' })).body.error.code).toBe('SHIFT_EXISTS');
    await hr.agent.post('/api/v2/shifts').send({ employeeId: 'employee_1', date, shiftName: 'Evening' });
    const all = (await hr.agent.get(`/api/v2/shifts?date=${date}`)).body.data;
    expect(all.stats.totalWorkers).toBe(2);
    const team = (await sup.agent.get(`/api/v2/shifts?date=${date}`)).body.data;
    expect(team.stats.totalWorkers).toBe(1); // employee_1 is not in the supervisor's team
    expect(team.shifts.Morning[0].workerCode).toMatch(/-\d+$/);
    const moved = await hr.agent.patch(`/api/v2/shifts/${made.body.data.id}`).send({ status: 'Cancelled' });
    expect(moved.body.data.status).toBe('Cancelled');
    expect((await hr.agent.get(`/api/v2/shifts?date=${date}`)).body.data.stats.totalWorkers).toBe(1);
  });

  it('profile returns the person without secrets and can be updated', async () => {
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    const p = (await emp.agent.get('/api/v2/profile')).body.data;
    expect(p.passwordHash).toBeUndefined();
    expect(p.employee.employeeId).toBeTruthy();
    const patched = await emp.agent.patch('/api/v2/profile').send({ name: 'Dev P. Patel', role: 'SUPER_ADMIN' });
    expect(patched.body.data.name).toBe('Dev P. Patel');
    expect((await emp.agent.get('/api/v2/access')).body.data.role).toBe('EMPLOYEE');
  });
});
