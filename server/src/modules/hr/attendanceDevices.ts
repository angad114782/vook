import { Router } from 'express';
import { z } from 'zod';
import { coll } from '../../db/mongo.ts';
import { byId, count, find, findOne, insert, remove, type Row } from '../../db/repo.ts';
import { appendAudit, effectiveEntitlements } from '../../domain/access.ts';
import { availableTo } from '../../domain/attendanceDevices.ts';
import { AppError, notFound } from '../../lib/errors.ts';
import { companyIdFor, me, ok, parse, reqMeta } from '../../lib/http.ts';
import { nowIso } from '../../lib/serialize.ts';
import { timezoneFor } from './attendance.ts';
import { localParts } from '../../lib/time.ts';

/**
 * A company registers each physical face / fingerprint device it owns (any number, across branches).
 * The platform admin supplies the connection (provider + API key/token); the company says which device is where.
 */
export const companyDeviceRouter = Router();
const BIO = z.enum(['FACE', 'FINGERPRINT']);

// Registering machines is an admin job; ordinary staff, managers and finance never touch it.
companyDeviceRouter.use('/attendance-devices', (req, _res, next) => {
  const role = me(req).role;
  if (role !== 'COMPANY_ADMIN' && role !== 'HR' && role !== 'SUPER_ADMIN') return next(new AppError(403, 'FORBIDDEN', 'Only a company admin or HR can manage attendance devices.'));
  next();
});

const ACCESS = z.enum(['ALL', 'BRANCH', 'SELECTED']);

/** Returns a plain-language reason when this employee may not punch on this device, otherwise null. */
export async function deviceAccessDenied(device: Row, employeeCode: string, companyId: string): Promise<string | null> {
  const mode = device.access ?? 'ALL';
  if (mode === 'ALL') return null;
  const employee = await findOne('employees', { companyId, employeeId: employeeCode });
  if (!employee) return null; // unknown people are rejected later with their own message
  if (mode === 'BRANCH') {
    if (employee.branchId && employee.branchId === device.branchId) return null;
    const place = device.branchId ? (await findOne('offices', { _id: device.branchId }))?.name : null;
    return `This device is only for staff of ${place ?? 'its own branch'}. Please punch at your own branch.`;
  }
  return (device.employeeIds as string[] | undefined)?.includes(employee.id) ? null : 'You are not allowed on this device. Ask HR to add you.';
}

const view = (d: Row, extra: Row = {}) => { const { ...rest } = d; return { ...rest, ...extra }; };

async function connectionsFor(companyId: string) {
  const [all, providers] = await Promise.all([find('attendanceIntegrations', { connectionMode: { $ne: 'MOBILE' } }), find('attendanceProviders', {})]);
  const name = new Map(providers.map((p) => [p.key, p.name]));
  const view = (c: Row) => ({ id: c.id, displayName: c.displayName, providerKey: c.providerKey, providerName: name.get(c.providerKey) ?? c.providerKey, connectionMode: c.connectionMode, biometrics: c.biometrics ?? [] });
  return { names: name, usable: all.filter((c) => c.status === 'ACTIVE' && availableTo(c, companyId)).map(view), all };
}
async function usableConnections(companyId: string) { return (await connectionsFor(companyId)).usable; }

companyDeviceRouter.get('/attendance-devices', async (req, res) => {
  const companyId = companyIdFor(req);
  const tz = await timezoneFor(companyId);
  const today = localParts(tz).date;
  const [devices, connectionSet, offices, ent, punches] = await Promise.all([
    find('attendanceDevices', { companyId }, { sort: { name: 1 } }), connectionsFor(companyId), find('offices', { companyId }, { projection: { name: 1 } }), effectiveEntitlements(companyId),
    // Punches today per device (the event time is stored in UTC; compare on the company's calendar day with a one-day margin, then filter exactly).
    find('attendanceEvents', { companyId, deviceId: { $exists: true }, occurredAt: { $gte: new Date(Date.now() - 36 * 3_600_000).toISOString() } }, { projection: { deviceId: 1, occurredAt: 1 }, limit: 20_000 }),
  ]);
  const chosenIds = [...new Set(devices.flatMap((d) => (d.employeeIds ?? []) as string[]))];
  const chosenPeople = chosenIds.length ? await find('employees', { companyId, _id: { $in: chosenIds } }, { projection: { employeeId: 1, 'user.name': 1, name: 1 } }) : [];
  const peopleNames = Object.fromEntries(chosenPeople.map((e) => [e.id, `${e.user?.name ?? e.name} (${e.employeeId})`]));
  const todayCount = new Map<string, number>();
  for (const e of punches) if (localParts(tz, new Date(e.occurredAt)).date === today) todayCount.set(e.deviceId, (todayCount.get(e.deviceId) ?? 0) + 1);
  const officeName = new Map(offices.map((o) => [o.id, o.name]));
  const connections = connectionSet.usable;
  const known = new Map(connectionSet.all.map((c) => [c.id, c]));
  // Why a machine might not be sending: the provider was removed, switched off by Vook, or no longer offered to this company.
  const stateOf = (d: Row) => { const c = known.get(d.connectionId); return !c ? 'REMOVED' : !availableTo(c, companyId) ? 'NO_ACCESS' : c.status !== 'ACTIVE' ? 'PAUSED' : 'OK'; };
  const conn = new Map(connectionSet.all.map((c) => [c.id, { displayName: c.displayName as string, providerName: (connectionSet.names.get(c.providerKey) ?? c.providerKey) as string }]));
  const limit = Number(ent.limits.devices ?? 0);
  ok(res, {
    devices: devices.map((d) => view(d, { employeeCount: (d.employeeIds ?? []).length, branchName: d.branchId ? officeName.get(d.branchId) ?? null : null, connectionState: stateOf(d), connectionName: conn.get(d.connectionId)?.displayName ?? 'Provider removed by Vook', providerName: conn.get(d.connectionId)?.providerName ?? null, punchesToday: todayCount.get(d.id) ?? 0, working: d.status === 'ACTIVE' && stateOf(d) === 'OK' && Boolean(d.lastEventAt) && Date.now() - new Date(d.lastEventAt).getTime() < 24 * 3_600_000 })),
    peopleNames, connections, branches: offices.map((o) => ({ id: o.id, name: o.name })),
    needsAttention: devices.filter((d) => stateOf(d) !== 'OK').length,
    companyCode: (await byId('companies', companyId))?.companyCode ?? null,
    summary: { total: devices.length, active: devices.filter((d) => d.status === 'ACTIVE').length, seenToday: devices.filter((d) => d.lastEventAt && Date.now() - new Date(d.lastEventAt).getTime() < 24 * 3_600_000).length, punchesToday: [...todayCount.values()].reduce((a, b) => a + b, 0), limit: limit || null },
  });
});

const deviceSchema = z.object({
  connectionId: z.string().min(1), serial: z.string().trim().min(2, 'Enter the serial number printed on the device.').max(80).regex(/^[\w.\-/ ]+$/, 'Use letters, numbers, dashes or dots in the serial number.'),
  name: z.string().trim().min(2, 'Enter the place name, for example “Main gate”.').max(100), modelNo: z.string().trim().max(60).optional(), branchId: z.string().nullish(), biometrics: z.array(BIO).max(2).optional(), notes: z.string().trim().max(300).optional(),
  access: ACCESS.default('ALL'), employeeIds: z.array(z.string()).max(2000).default([]),
});

async function checkAccess(companyId: string, access: string, branchId?: string | null, employeeIds: string[] = []) {
  if (access === 'BRANCH' && !branchId) throw new AppError(422, 'BRANCH_REQUIRED', 'Choose the branch for this device, because only people of that branch can use it.');
  if (access === 'SELECTED') {
    if (!employeeIds.length) throw new AppError(422, 'PEOPLE_REQUIRED', 'Choose at least one person who can use this device.');
    if ((await count('employees', { companyId, _id: { $in: employeeIds } })) !== new Set(employeeIds).size) throw new AppError(422, 'VALIDATION_ERROR', 'Some chosen people are not in your company.');
  }
}

async function assertBranch(companyId: string, branchId?: string | null) {
  if (branchId && !(await findOne('offices', { _id: branchId, companyId }))) throw new AppError(422, 'VALIDATION_ERROR', 'Choose one of your branches.');
}

companyDeviceRouter.post('/attendance-devices', async (req, res) => {
  const user = me(req);
  const companyId = companyIdFor(req);
  const body = parse(deviceSchema, req.body);
  const connection = await findOne('attendanceIntegrations', { _id: body.connectionId, status: 'ACTIVE' });
  if (!connection || connection.connectionMode === 'MOBILE' || !availableTo(connection, companyId)) throw new AppError(422, 'CONNECTION_UNAVAILABLE', 'That device connection is not available. Ask your platform admin to turn it on.');
  await assertBranch(companyId, body.branchId);
  await checkAccess(companyId, body.access, body.branchId, body.employeeIds);
  const biometrics = body.biometrics?.length ? body.biometrics : connection.biometrics;
  if (biometrics.some((b: string) => !connection.biometrics.includes(b))) throw new AppError(422, 'VALIDATION_ERROR', 'This connection cannot read that. Choose face or fingerprint as the connection allows.');
  const ent = await effectiveEntitlements(companyId);
  const limit = Number(ent.limits.devices ?? 0);
  const current = await count('attendanceDevices', { companyId });
  if (limit && current >= limit) throw new AppError(409, 'DEVICE_LIMIT_REACHED', 'Your plan’s device limit is full. Upgrade the plan to add more devices.', { limit, current });
  try {
    const row = await insert('attendanceDevices', { companyId, connectionId: connection.id, providerKey: connection.providerKey, serial: body.serial, modelNo: body.modelNo ?? '', name: body.name, branchId: body.branchId ?? null, biometrics, notes: body.notes ?? '', access: body.access, employeeIds: body.access === 'SELECTED' ? [...new Set(body.employeeIds)] : [], status: 'ACTIVE', eventCount: 0, lastEventAt: null, createdBy: user.id, createdAt: nowIso() }, 'device');
    await appendAudit({ actorId: user.id, companyId, action: 'ATTENDANCE_DEVICE_REGISTERED', entityType: 'ATTENDANCE_DEVICE', entityId: row.id, newValue: { name: row.name, serial: row.serial, branchId: row.branchId, biometrics }, ...reqMeta(req) });
    ok(res, row, 201);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new AppError(409, 'DEVICE_SERIAL_IN_USE', 'This serial number is already registered. Check the number on the device.');
    throw err;
  }
});

async function ownDevice(req: import('express').Request) {
  const device = await findOne('attendanceDevices', { _id: String(req.params.id), companyId: companyIdFor(req) });
  if (!device) throw notFound('Device');
  return device;
}

companyDeviceRouter.put('/attendance-devices/:id', async (req, res) => {
  const user = me(req);
  const device = await ownDevice(req);
  const body = parse(z.object({ name: z.string().trim().min(2).max(100), modelNo: z.string().trim().max(60), branchId: z.string().nullable(), biometrics: z.array(BIO).min(1, 'Choose face, fingerprint or both.').max(2), notes: z.string().trim().max(300), status: z.enum(['ACTIVE', 'DISABLED']), access: ACCESS, employeeIds: z.array(z.string()).max(2000) }).partial(), req.body);
  await assertBranch(device.companyId, body.branchId);
  const nextAccess = body.access ?? device.access ?? 'ALL';
  await checkAccess(device.companyId, nextAccess, body.branchId === undefined ? device.branchId : body.branchId, body.employeeIds ?? device.employeeIds);
  if (nextAccess !== 'SELECTED' && body.access) body.employeeIds = [];
  if (body.biometrics) {
    const connection = await byId('attendanceIntegrations', device.connectionId);
    if (connection && body.biometrics.some((b) => !connection.biometrics.includes(b))) throw new AppError(422, 'VALIDATION_ERROR', 'This connection cannot read that.');
  }
  const updated = (await coll('attendanceDevices').findOneAndUpdate({ _id: device.id }, { $set: { ...body, updatedAt: nowIso() } }, { returnDocument: 'after' }))!;
  await appendAudit({ actorId: user.id, companyId: device.companyId, action: body.status ? `ATTENDANCE_DEVICE_${body.status === 'ACTIVE' ? 'ENABLED' : 'DISABLED'}` : 'ATTENDANCE_DEVICE_UPDATED', entityType: 'ATTENDANCE_DEVICE', entityId: device.id, oldValue: { name: device.name, branchId: device.branchId, status: device.status }, newValue: body, ...reqMeta(req) });
  ok(res, { id: updated._id, ...updated });
});

companyDeviceRouter.delete('/attendance-devices/:id', async (req, res) => {
  const user = me(req);
  const device = await ownDevice(req);
  await remove('attendanceDevices', { _id: device.id });
  await appendAudit({ actorId: user.id, companyId: device.companyId, action: 'ATTENDANCE_DEVICE_REMOVED', entityType: 'ATTENDANCE_DEVICE', entityId: device.id, oldValue: { name: device.name, serial: device.serial }, ...reqMeta(req) });
  ok(res, null);
});

// Latest punches from one device: the first thing to look at when "the machine isn't working".
companyDeviceRouter.get('/attendance-devices/:id/events', async (req, res) => {
  const device = await ownDevice(req);
  const events = await find('attendanceEvents', { companyId: device.companyId, deviceId: device.id }, { sort: { occurredAt: -1 }, limit: 20 });
  const people = events.length ? new Map((await find('employees', { _id: { $in: [...new Set(events.map((e) => e.employeeId))] } }, { projection: { employeeId: 1, 'user.name': 1 } })).map((e) => [e.id, e])) : new Map();
  ok(res, events.map((e) => ({ id: e.id, type: e.type, modality: e.modality, occurredAt: e.occurredAt, employee: people.get(e.employeeId) ? { employeeId: people.get(e.employeeId)!.employeeId, name: people.get(e.employeeId)!.user?.name } : null })));
});
