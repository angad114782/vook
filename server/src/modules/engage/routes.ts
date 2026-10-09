import { Router } from 'express';
import { z } from 'zod';
import { env, isProd } from '../../config/env.ts';
import { coll } from '../../db/mongo.ts';
import { byId, count, escapeRegex, find, findOne, findPage, insert, patch, type Row } from '../../db/repo.ts';
import { allowedEmployeeIds, appendAudit, can, effectivePermissions } from '../../domain/access.ts';
import { AppError, forbidden, notFound } from '../../lib/errors.ts';
import { companyIdFor, me, ok, parse, reqMeta } from '../../lib/http.ts';
import { notify } from '../../lib/notify.ts';
import { nextSeq } from '../../lib/sequence.ts';
import { nowIso, safeUser } from '../../lib/serialize.ts';
import { updateSelf } from '../auth/routes.ts';
import { emitToTicket } from '../../realtime/gateway.ts';
import { addComment, sees } from '../../domain/support.ts';

export const engageRouter = Router();

// ── Notifications ──────────────────────────────────────────────────────
const encodeCursor = (r: Row) => Buffer.from(`${r.createdAt}|${r.id}`).toString('base64url');
const decodeCursor = (c: string) => { const [createdAt, id] = Buffer.from(c, 'base64url').toString().split('|'); return createdAt && id ? { createdAt, id } : null; };

engageRouter.get('/notifications', async (req, res) => {
  const user = me(req);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
  const filter: Row = { userId: user.id };
  if (req.query.status === 'unread') filter.isRead = { $ne: true };
  const cursor = typeof req.query.cursor === 'string' ? decodeCursor(req.query.cursor) : null;
  if (cursor) filter.$or = [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor.id } }];
  const [rows, unreadCount, total] = await Promise.all([find('notifications', filter, { sort: { createdAt: -1, _id: -1 }, limit: limit + 1 }), count('notifications', { userId: user.id, isRead: { $ne: true } }), count('notifications', { userId: user.id })]);
  const items = rows.slice(0, limit);
  ok(res, { items, notifications: items, nextCursor: rows.length > limit ? encodeCursor(items[items.length - 1]!) : null, unreadCount, unread: unreadCount, pagination: { total, page: 1, limit, totalPages: Math.max(1, Math.ceil(total / limit)) } });
});
engageRouter.patch('/notifications/read', async (req, res) => {
  const { ids } = parse(z.object({ ids: z.array(z.string().min(1)).min(1, 'Choose at least one notification.').max(200) }), req.body);
  const unique = [...new Set(ids)];
  if ((await count('notifications', { _id: { $in: unique }, userId: me(req).id })) !== unique.length) throw notFound('Notification');
  await coll('notifications').updateMany({ _id: { $in: unique }, userId: me(req).id }, { $set: { isRead: true, readAt: nowIso() } });
  ok(res, null);
});
engageRouter.patch('/notifications/read-all', async (req, res) => { await coll('notifications').updateMany({ userId: me(req).id, isRead: { $ne: true } }, { $set: { isRead: true, readAt: nowIso() } }); ok(res, null); });
engageRouter.patch('/notifications/:id/read', async (req, res) => {
  const r = await coll('notifications').updateOne({ _id: String(req.params.id), userId: me(req).id }, { $set: { isRead: true, readAt: nowIso() } });
  if (!r.matchedCount) throw notFound('Notification');
  ok(res, null);
});
const PREF_KEYS = ['email', 'inApp', 'payroll', 'leave', 'support'] as const;
const DEFAULT_PREFS = { email: true, inApp: true, payroll: true, leave: true, support: true };
engageRouter.get('/notifications/preferences', async (req, res) => ok(res, { preferences: { ...DEFAULT_PREFS, ...((await byId('users', me(req).id))?.notificationPreferences ?? {}) } }));
engageRouter.put('/notifications/preferences', async (req, res) => {
  const { preferences } = parse(z.object({ preferences: z.record(z.string(), z.boolean()) }), req.body);
  const clean = Object.fromEntries(Object.entries(preferences).filter(([k]) => (PREF_KEYS as readonly string[]).includes(k)));
  const user = await byId('users', me(req).id);
  const merged = { ...DEFAULT_PREFS, ...(user?.notificationPreferences ?? {}), ...clean };
  await patch('users', { _id: me(req).id }, { notificationPreferences: merged });
  ok(res, { preferences: merged });
});

// ── Support tickets + conversation ─────────────────────────────────────
const TICKET_STATUS = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
const ticketScope = (user: Row): Row => user.role === 'SUPER_ADMIN' ? {} : user.role === 'COMPANY_ADMIN' ? { companyId: user.companyId } : { companyId: user.companyId, userId: user.id };

async function ticketViews(rows: Row[]) {
  const [users, companies] = await Promise.all([
    rows.length ? find('users', { _id: { $in: [...new Set(rows.map((r) => r.userId).filter(Boolean))] } }, { projection: { name: 1, email: 1, role: 1 } }) : [],
    rows.length ? find('companies', { _id: { $in: [...new Set(rows.map((r) => r.companyId).filter(Boolean))] } }, { projection: { name: 1, companyCode: 1 } }) : [],
  ]);
  const uBy = new Map(users.map((u) => [u.id, u])), cBy = new Map(companies.map((c) => [c.id, c]));
  return rows.map((r) => ({ ...r, user: uBy.get(r.userId), company: cBy.get(r.companyId) }));
}

engageRouter.get('/support-tickets', async (req, res) => {
  const user = me(req);
  const filter: Row = ticketScope(user);
  const status = String(req.query.status ?? '');
  if (status && status !== 'ALL') filter.status = status;
  if (user.role === 'SUPER_ADMIN' && typeof req.query.companyId === 'string' && req.query.companyId && req.query.companyId !== 'ALL') filter.companyId = req.query.companyId;
  const search = String(req.query.search ?? '').trim();
  if (search) { const rx = { $regex: escapeRegex(search), $options: 'i' }; filter.$or = [{ subject: rx }, { ticketNo: rx }]; }
  const base = ticketScope(user);
  const [{ rows, pagination }, total, open, inProgress, resolved] = await Promise.all([findPage('tickets', filter, req.query, { updatedAt: -1, _id: -1 }), count('tickets', base), count('tickets', { ...base, status: 'PENDING' }), count('tickets', { ...base, status: 'IN_PROGRESS' }), count('tickets', { ...base, status: 'RESOLVED' })]);
  ok(res, { tickets: await ticketViews(rows), pagination, stats: { total, open, inProgress, resolved } });
});

engageRouter.post('/support-tickets', async (req, res) => {
  const user = me(req);
  const body = parse(z.object({ category: z.string().trim().min(1).max(60), subject: z.string().trim().min(3, 'Please give your question a short title.').max(160), description: z.string().trim().min(3, 'Please describe what you need.').max(5000), priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'), companyId: z.string().optional(), attachment: z.string().max(200).optional() }), req.body);
  const companyId = user.role === 'SUPER_ADMIN' ? body.companyId ?? null : user.companyId;
  const seq = await nextSeq('ticket', () => count('tickets').then((n) => 1040 + n));
  const now = nowIso();
  const ticket = await insert('tickets', { ticketNo: `SUP-${seq}`, companyId, userId: user.id, category: body.category, subject: body.subject, description: body.description, priority: body.priority, attachment: body.attachment, status: 'PENDING', createdAt: now, updatedAt: now }, 'ticket');
  await appendAudit({ actorId: user.id, companyId, action: 'SUPPORT_TICKET_CREATED', entityType: 'SUPPORT_TICKET', entityId: ticket.id, newValue: { ticketNo: ticket.ticketNo }, ...reqMeta(req) });
  ok(res, (await ticketViews([ticket]))[0], 201);
});

async function loadTicket(req: import('express').Request) {
  const ticket = await byId('tickets', String(req.params.id));
  if (!ticket || !sees(me(req), ticket)) throw notFound('Support ticket');
  return ticket;
}
engageRouter.get('/support-tickets/:id', async (req, res) => ok(res, (await ticketViews([await loadTicket(req)]))[0]));

engageRouter.patch('/support-tickets/:id', async (req, res) => {
  const user = me(req);
  const ticket = await loadTicket(req);
  const body = parse(z.object({ status: z.enum(TICKET_STATUS), priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) }).partial(), req.body);
  if (user.role !== 'SUPER_ADMIN') {
    // Customers can close (or re-open) their own ticket, nothing else.
    if (body.priority || (body.status && !['CLOSED', 'PENDING'].includes(body.status))) throw forbidden('Only the support team can change this.');
  }
  const updated = await patch('tickets', { _id: ticket.id }, { ...body, updatedAt: nowIso() });
  emitToTicket(ticket.id, 'support:ticket-updated', { ticketId: ticket.id, status: updated!.status, priority: updated!.priority, updatedAt: updated!.updatedAt });
  if (body.status && ticket.userId !== user.id) await notify({ userId: ticket.userId, companyId: ticket.companyId, type: 'SUPPORT', title: `Ticket ${ticket.ticketNo} is ${body.status.replaceAll('_', ' ').toLowerCase()}`, message: ticket.subject, data: { ticketId: ticket.id } });
  await appendAudit({ actorId: user.id, companyId: ticket.companyId, action: 'SUPPORT_TICKET_UPDATED', entityType: 'SUPPORT_TICKET', entityId: ticket.id, oldValue: { status: ticket.status, priority: ticket.priority }, newValue: body, ...reqMeta(req) });
  ok(res, (await ticketViews([updated!]))[0]);
});

engageRouter.get('/support-tickets/:id/comments', async (req, res) => {
  const user = me(req);
  const ticket = await loadTicket(req);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
  const filter: Row = { ticketId: ticket.id, ...(user.role === 'SUPER_ADMIN' ? {} : { isInternal: { $ne: true } }) };
  if (typeof req.query.before === 'string') { const b = await byId('comments', req.query.before); if (b) filter.createdAt = { $lt: b.createdAt }; }
  const rows = await find('comments', filter, { sort: { createdAt: -1, _id: -1 }, limit: limit + 1 });
  const page = rows.slice(0, limit).reverse();
  const cursors = (ticket.readCursors ?? []) as Row[];
  ok(res, { comments: page, hasMore: rows.length > limit, nextCursor: rows.length > limit ? page[0]?.id ?? null : null, readCursors: cursors });
});

engageRouter.post('/support-tickets/:id/comments', async (req, res) => {
  const user = me(req);
  const ticket = await loadTicket(req);
  const body = parse(z.object({ body: z.string().trim().min(1, 'Write a message first.').max(5000), clientMessageId: z.string().max(80).optional(), isInternal: z.boolean().optional() }), req.body);
  const comment = await addComment(user, ticket, body);
  emitToTicket(ticket.id, 'support:comment', comment, comment.isInternal);
  ok(res, comment, 201);
});

// ── Activity + audit (admins only) ─────────────────────────────────────
// The activity feed (what happened, by whom) is visible to admins and HR; the audit trail with before/after values stays admin-only.
const requireAdmin = (user: Row, allowHr = false) => { if (!['SUPER_ADMIN', 'COMPANY_ADMIN', ...(allowHr ? ['HR'] : [])].includes(user.role)) throw forbidden('You do not have access to the activity history.'); };

engageRouter.get('/activity-events', async (req, res) => {
  const user = me(req);
  requireAdmin(user, true);
  const filter: Row = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId };
  if (user.role === 'SUPER_ADMIN' && typeof req.query.companyId === 'string' && req.query.companyId && req.query.companyId !== 'ALL') filter.companyId = req.query.companyId;
  for (const key of ['status', 'module'] as const) { const v = String(req.query[key] ?? ''); if (v && v !== 'ALL') filter[key] = v; }
  const search = String(req.query.search ?? '').trim();
  if (search) { const rx = { $regex: escapeRegex(search), $options: 'i' }; filter.$or = [{ action: rx }, { description: rx }]; }
  const { rows, pagination } = await findPage('activity', filter, req.query, { createdAt: -1, _id: -1 });
  const base = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId };
  const today = nowIso().slice(0, 10);
  const [users, companies, total, success, failed, todayCount] = await Promise.all([
    rows.length ? find('users', { _id: { $in: [...new Set(rows.map((r) => r.userId).filter(Boolean))] } }, { projection: { name: 1, email: 1, role: 1 } }) : [],
    rows.length ? find('companies', { _id: { $in: [...new Set(rows.map((r) => r.companyId).filter(Boolean))] } }, { projection: { name: 1, companyCode: 1 } }) : [],
    count('activity', base), count('activity', { ...base, status: 'SUCCESS' }), count('activity', { ...base, status: 'FAILED' }), count('activity', { ...base, createdAt: { $gte: today } }),
  ]);
  const uBy = new Map(users.map((u) => [u.id, u])), cBy = new Map(companies.map((c) => [c.id, c]));
  const logs = rows.map((r) => ({ ...r, user: uBy.get(r.userId) ?? null, company: cBy.get(r.companyId) }));
  ok(res, { logs, activity: logs, pagination, stats: { total, today: todayCount, success, failed } });
});

engageRouter.get('/audit-events', async (req, res) => {
  const user = me(req);
  requireAdmin(user);
  const filter: Row = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId };
  const search = String(req.query.search ?? '').trim();
  if (search) { const rx = { $regex: escapeRegex(search), $options: 'i' }; filter.$or = [{ action: rx }, { entityType: rx }]; }
  const { rows, pagination } = await findPage('audit', filter, req.query, { createdAt: -1, _id: -1 });
  ok(res, { logs: rows, pagination });
});

// ── Global search (only what the person may see) ───────────────────────
engageRouter.get('/search', async (req, res) => {
  const user = me(req);
  const q = String(req.query.q ?? '').trim().slice(0, 80);
  const empty = { query: q, companies: [], employees: [], users: [], documents: [] };
  if (q.length < 2) return ok(res, empty);
  const rx = { $regex: escapeRegex(q), $options: 'i' };
  const perms = await effectivePermissions(user);
  const isSA = user.role === 'SUPER_ADMIN';
  const [companies, employees, users, documents] = await Promise.all([
    isSA ? find('companies', { $or: [{ name: rx }, { companyCode: rx }] }, { limit: 5, projection: { name: 1, companyCode: 1 } }) : [],
    isSA || can(perms, 'EMPLOYEE_MANAGEMENT.VIEW') ? (async () => {
      const filter: Row = { $or: [{ 'user.name': rx }, { employeeId: rx }, { 'user.email': rx }] };
      if (!isSA) { filter.companyId = user.companyId; const ids = await allowedEmployeeIds(user, 'EMPLOYEE_MANAGEMENT.VIEW'); if (ids) filter._id = { $in: ids }; }
      return find('employees', filter, { limit: 5, projection: { employeeId: 1, 'user.name': 1, 'user.email': 1, companyId: 1 } });
    })() : [],
    isSA || user.role === 'COMPANY_ADMIN' ? find('users', { ...(isSA ? {} : { companyId: user.companyId }), $or: [{ name: rx }, { email: rx }] }, { limit: 5, projection: { name: 1, email: 1, role: 1, companyId: 1 } }) : [],
    !isSA && can(perms, 'DOCUMENTS.VIEW') ? find('documents', { companyId: user.companyId, visibility: 'ALL', name: rx }, { limit: 5, projection: { name: 1, category: 1 } }) : [],
  ]);
  ok(res, {
    query: q,
    companies: companies.map((c) => ({ id: c.id, type: 'company', name: c.name, title: c.name, subtitle: c.companyCode, companyCode: c.companyCode, path: '/companies' })),
    employees: employees.map((e) => ({ id: e.id, type: 'employee', name: e.user?.name, title: e.user?.name, subtitle: e.employeeId, employeeId: e.employeeId, email: e.user?.email, companyId: e.companyId, path: '/hr/employees' })),
    users: users.map((u) => ({ id: u.id, type: 'user', name: u.name, title: u.name, subtitle: u.email, email: u.email, role: u.role, companyId: u.companyId })),
    documents: documents.map((d) => ({ id: d.id, type: 'document', name: d.name, title: d.name, subtitle: d.category })),
  });
});

// ── Profile ────────────────────────────────────────────────────────────
engageRouter.get('/profile', async (req, res) => {
  const user = me(req);
  const [full, employee] = await Promise.all([byId('users', user.id), findOne('employees', { userId: user.id, companyId: user.companyId })]);
  ok(res, { ...safeUser(full), employee });
});
engageRouter.patch('/profile', updateSelf);

// ── Shifts ─────────────────────────────────────────────────────────────
const SHIFT_NAMES = ['Morning', 'Evening', 'Night'] as const;
const SHIFT_TIMES: Record<string, [string, string]> = { Morning: ['06:00', '14:00'], Evening: ['14:00', '22:00'], Night: ['22:00', '06:00'] };
const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

engageRouter.get('/shifts', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date)) ? String(req.query.date) : new Date().toISOString().slice(0, 10);
  const ids = await allowedEmployeeIds(user, 'SHIFT_MANAGEMENT.VIEW');
  const filter: Row = { companyId, date, status: { $ne: 'Cancelled' }, ...(ids ? { employeeId: { $in: ids } } : {}) };
  const rows = await find('shifts', filter, { limit: 5000 });
  const employees = rows.length ? new Map((await find('employees', { _id: { $in: [...new Set(rows.map((r) => r.employeeId))] } }, { projection: { employeeId: 1, 'user.name': 1, department: 1, designation: 1 } })).map((e) => [e.id, e])) : new Map();
  const dept = typeof req.query.department === 'string' && req.query.department !== 'All Departments' ? req.query.department : null;
  const views = rows.map((r) => { const e = employees.get(r.employeeId); return { id: r.id, employeeId: r.employeeId, name: e?.user?.name ?? 'Unknown', workerCode: e?.employeeId ?? '', dept: e?.department ?? 'Unassigned', role: e?.designation ?? 'Worker', shift: `${r.startTime} - ${r.endTime}`, shiftName: r.shiftName, status: r.status }; }).filter((v) => !dept || v.dept === dept);
  const grouped: Record<string, Row[]> = { Morning: [], Evening: [], Night: [] };
  for (const v of views) grouped[v.shiftName]?.push(v);
  const [departments, policy] = await Promise.all([find('departments', { companyId }, { projection: { name: 1 } }), byId('attendancePolicies', companyId)]);
  const requirements = (policy?.shiftRequirements ?? []) as Row[];
  const plans = departments.filter((d) => !dept || d.name === dept).flatMap((d) => SHIFT_NAMES.map((shift) => {
    const assigned = grouped[shift]!.filter((v) => v.dept === d.name).length;
    const required = Number(requirements.find((r) => r.department === d.name && r.shift === shift)?.required ?? Math.max(assigned, 1));
    return { department: d.name, shift, required, assigned, shortage: Math.max(0, required - assigned) };
  }));
  const shortages = plans.filter((p) => p.shortage > 0).map((p) => ({ station: `${p.department} - ${p.shift}`, shift: `${p.shift} Shift`, required: p.required, actual: p.assigned, severity: p.shortage > 1 ? 'critical' : 'high' }));
  ok(res, { stats: { totalWorkers: views.length, morningShift: grouped.Morning!.length, eveningShift: grouped.Evening!.length, nightShift: grouped.Night!.length }, shifts: grouped, plans, shortages });
});

engageRouter.post('/shifts', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const body = parse(z.object({ employeeId: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), shiftName: z.enum(SHIFT_NAMES), startTime: HHMM.optional(), endTime: HHMM.optional(), notes: z.string().max(300).optional() }), req.body);
  const employee = await findOne('employees', { _id: body.employeeId, companyId });
  if (!employee) throw notFound('Employee');
  const ids = await allowedEmployeeIds(user, 'SHIFT_MANAGEMENT.CREATE');
  if (ids && !ids.includes(employee.id)) throw forbidden('This employee is outside your scope.', 'SCOPE_DENIED');
  if (await findOne('shifts', { employeeId: employee.id, date: body.date, status: { $ne: 'Cancelled' } })) throw new AppError(409, 'SHIFT_EXISTS', 'This person already has a shift on that day.');
  const [startTime, endTime] = [body.startTime ?? SHIFT_TIMES[body.shiftName]![0], body.endTime ?? SHIFT_TIMES[body.shiftName]![1]];
  const shift = await insert('shifts', { companyId, employeeId: employee.id, date: body.date, shiftName: body.shiftName, startTime, endTime, status: 'Assigned', notes: body.notes ?? null, createdBy: user.id, createdAt: nowIso() }, 'shift');
  if (employee.userId) await notify({ userId: employee.userId, companyId, type: 'SHIFT', title: 'New shift assigned', message: `${body.shiftName} shift on ${body.date} (${startTime} - ${endTime}).`, data: { shiftId: shift.id } });
  await appendAudit({ actorId: user.id, companyId, action: 'SHIFT_ASSIGNED', entityType: 'SHIFT', entityId: shift.id, newValue: shift, ...reqMeta(req) });
  ok(res, shift, 201);
});

engageRouter.patch('/shifts/:id', async (req, res) => {
  const user = me(req);
  const found = await findOne('shifts', { _id: String(req.params.id), companyId: user.companyId });
  if (!found) throw notFound('Shift');
  const ids = await allowedEmployeeIds(user, 'SHIFT_MANAGEMENT.EDIT');
  if (ids && !ids.includes(found.employeeId)) throw forbidden('This shift is outside your scope.', 'SCOPE_DENIED');
  const body = parse(z.object({ shiftName: z.enum(SHIFT_NAMES), startTime: HHMM, endTime: HHMM, status: z.enum(['Assigned', 'Completed', 'Cancelled']), notes: z.string().max(300) }).partial(), req.body);
  const updated = await patch('shifts', { _id: found.id }, body);
  await appendAudit({ actorId: user.id, companyId: found.companyId, action: 'SHIFT_UPDATED', entityType: 'SHIFT', entityId: found.id, oldValue: found, newValue: updated, ...reqMeta(req) });
  ok(res, updated);
});

// ── Reports ────────────────────────────────────────────────────────────
async function reportScope(req: import('express').Request) {
  const user = me(req);
  const companyId = companyIdFor(req);
  const ids = await allowedEmployeeIds(user, 'REPORTS_ANALYTICS.VIEW');
  return { companyId, empFilter: { companyId, ...(ids ? { _id: { $in: ids } } : {}) } as Row, byEmp: (ids ? { employeeId: { $in: ids } } : {}) as Row };
}
const group = async (name: 'employees' | 'leaves' | 'attendance' | 'payslips', match: Row, key: string, extra: Row = {}) =>
  (await coll(name).aggregate([{ $match: match }, { $group: { _id: `$${key}`, count: { $sum: 1 }, ...extra } }, { $sort: { _id: 1 } }]).toArray());

engageRouter.get('/reports/:kind', async (req, res) => {
  const kind = String(req.params.kind);
  const { companyId, empFilter, byEmp } = await reportScope(req);
  if (kind === 'workforce') {
    const [total, active, depts, types, recent] = await Promise.all([
      count('employees', empFilter), count('employees', { ...empFilter, status: 'ACTIVE' }),
      coll('employees').aggregate([{ $match: empFilter }, { $group: { _id: '$department', count: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] } } } }, { $sort: { count: -1 } }]).toArray(),
      group('employees', empFilter, 'employmentType'), find('employees', empFilter, { sort: { joiningDate: -1 }, limit: 5 }),
    ]);
    return ok(res, { summary: { total, active, inactive: total - active }, byDepartment: depts.map((d) => ({ department: d._id ?? 'Unassigned', count: d.count, active: d.active })), byEmploymentType: types.map((t) => ({ type: t._id ?? 'Unspecified', count: t.count })), recentJoinees: recent.map((e) => ({ employeeId: e.employeeId, name: e.user?.name, department: e.department, designation: e.designation, joiningDate: e.joiningDate, status: e.status })) });
  }
  if (kind === 'leave') {
    const match: Row = { companyId, ...byEmp };
    if (typeof req.query.from === 'string') match.startDate = { ...(match.startDate ?? {}), $gte: req.query.from };
    if (typeof req.query.to === 'string') match.startDate = { ...(match.startDate ?? {}), $lte: req.query.to };
    const [total, byStatus, byType] = await Promise.all([count('leaves', match), group('leaves', match, 'status'), group('leaves', match, 'leaveType')]);
    return ok(res, { total, byStatus: byStatus.map((s) => ({ status: s._id, count: s.count })), byType: byType.map((t) => ({ type: t._id, count: t.count })) });
  }
  if (kind === 'payroll') {
    const match: Row = { companyId, ...byEmp };
    const [sum, months, recent] = await Promise.all([
      coll('payslips').aggregate([{ $match: match }, { $group: { _id: null, net: { $sum: '$netPay' }, gross: { $sum: '$grossSalary' }, ded: { $sum: '$totalDeductions' }, n: { $sum: 1 } } }]).toArray(),
      coll('payslips').aggregate([{ $match: match }, { $group: { _id: { y: '$year', m: '$month' }, net: { $sum: '$netPay' }, n: { $sum: 1 } } }, { $sort: { '_id.y': 1, '_id.m': 1 } }, { $limit: 12 }]).toArray(),
      find('payslips', match, { sort: { year: -1, month: -1, _id: -1 }, limit: 5 }),
    ]);
    const emp = recent.length ? new Map((await find('employees', { _id: { $in: recent.map((r) => r.employeeId) } }, { projection: { 'user.name': 1 } })).map((e) => [e.id, e])) : new Map();
    return ok(res, { summary: { totalNet: sum[0]?.net ?? 0, totalGross: sum[0]?.gross ?? 0, totalDeductions: sum[0]?.ded ?? 0, count: sum[0]?.n ?? 0 }, byMonth: months.map((m) => ({ label: new Date(Date.UTC(m._id.y, m._id.m - 1, 1)).toLocaleString('en', { month: 'short', timeZone: 'UTC' }), net: m.net, count: m.n })), recent: recent.map((p) => ({ id: p.id, employeeName: emp.get(p.employeeId)?.user?.name, month: p.month, year: p.year, netSalary: p.netPay, status: p.status })) });
  }
  if (kind === 'attendance') {
    const now = new Date();
    const year = Number(req.query.year) || now.getUTCFullYear(), month = Number(req.query.month) || now.getUTCMonth() + 1;
    const match: Row = { companyId, ...byEmp, date: { $gte: `${year}-${String(month).padStart(2, '0')}-01`, $lte: `${year}-${String(month).padStart(2, '0')}-31` } };
    const [totalRecords, totalEmployees, by] = await Promise.all([count('attendance', match), count('employees', empFilter), group('attendance', match, 'status')]);
    const b = Object.fromEntries(by.map((x) => [x._id, x.count]));
    return ok(res, { period: { year, month }, totalRecords, totalEmployees, byStatus: { Present: b.Present ?? 0, Late: b.Late ?? 0, Absent: b.Absent ?? 0, Leave: b.Leave ?? 0, Holiday: b.Holiday ?? 0 } });
  }
  throw notFound('Report');
});

const csvCell = (v: unknown) => { const s = String(v ?? ''); const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe; };
engageRouter.post('/reports/:kind/export', async (req, res) => {
  const user = me(req);
  if (!can(await effectivePermissions(user), 'REPORTS_ANALYTICS.EXPORT')) throw forbidden('You need permission to export reports.');
  const kind = String(req.params.kind);
  const { empFilter } = await reportScope(req);
  if (kind !== 'workforce') throw new AppError(422, 'VALIDATION_ERROR', 'Only the workforce report can be exported as a file for now.');
  const rows = await find('employees', empFilter, { sort: { employeeId: 1 }, limit: 20_000 });
  const header = ['Employee ID', 'Name', 'Department', 'Designation', 'Employment type', 'Joining date', 'Status'];
  const csv = [header, ...rows.map((e) => [e.employeeId, e.user?.name, e.department, e.designation, e.employmentType, e.joiningDate, e.status])].map((r) => r.map(csvCell).join(',')).join('\n');
  await appendAudit({ actorId: user.id, companyId: user.companyId, action: 'REPORT_EXPORTED', entityType: 'REPORT', entityId: kind, newValue: { rows: rows.length }, ...reqMeta(req) });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${kind}-report.csv"`);
  res.send(`﻿${csv}\n`);
});

// ── Development helper: read queued emails (verification / reset links). Never mounted in production. ──
if (!isProd && env.NODE_ENV !== 'test') {
  engageRouter.get('/dev/mail-outbox', async (req, res) => {
    if (me(req).role !== 'SUPER_ADMIN') throw forbidden();
    ok(res, await find('mailOutbox', {}, { sort: { createdAt: -1 }, limit: 20 }));
  });
}
