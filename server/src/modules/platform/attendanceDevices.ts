import { createHash, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { coll } from '../../db/mongo.ts';
import { byId, find, findOne, insert, remove, type Row } from '../../db/repo.ts';
import { appendAudit } from '../../domain/access.ts';
import { availableTo, countConnections, loadProviders, needsCredentials, tellCompanies, type Biometric } from '../../domain/attendanceDevices.ts';
import { AppError, notFound } from '../../lib/errors.ts';
import { companyIdFor, me, ok, parse, reqMeta } from '../../lib/http.ts';
import { clientIp } from '../../lib/ip.ts';
import { decryptSecret, encryptSecret } from '../../lib/secrets.ts';
import { nowIso } from '../../lib/serialize.ts';
import { assertPublicHost } from '../../lib/ssrf.ts';
import { hit } from '../../lib/throttle.ts';
import { deviceAccessDenied } from '../hr/attendanceDevices.ts';
import { delayMinutes, policyFor, shiftStartMinutes, timezoneFor } from '../hr/attendance.ts';
import { localParts } from '../../lib/time.ts';
import { insert as insertRow } from '../../db/repo.ts';

/** Platform-admin screens for attendance devices (providers + connections) and the tenant's read-only view. */
export const deviceRouter = Router();
/** Devices send punches here with their API key + token; no browser session involved. */
export const publicDeviceRouter = Router();

const sha = (v: string) => createHash('sha256').update(v).digest('hex');
const RESERVED = new Set(['apiKey', 'apiToken']);
const BIO = z.enum(['FACE', 'FINGERPRINT']);
const MODES = ['CLOUD_API', 'LOCAL_BRIDGE', 'DEVICE_PUSH', 'MOBILE'] as const;
type ConnectionMode = (typeof MODES)[number];

const providerSchema = z.object({
  key: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9_]{2,40}$/, 'Use letters, numbers and underscores, for example ACME_FACE_PRO.'),
  name: z.string().trim().min(2).max(80),
  mode: z.enum(MODES),
  biometrics: z.array(BIO).max(2),
  description: z.string().trim().max(300).default(''),
  fields: z.array(z.object({ key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,30}$/, 'Field names use letters and numbers only.'), label: z.string().trim().min(1).max(60), required: z.boolean().default(false), secret: z.boolean().optional(), placeholder: z.string().max(80).optional() })).max(12).default([]),
}).superRefine((p, ctx) => {
  if (needsCredentials(p.mode) && p.biometrics.length === 0) ctx.addIssue({ code: 'custom', path: ['biometrics'], message: 'Choose what the device reads: face, fingerprint or both.' });
  const seen = new Set<string>();
  p.fields.forEach((f, i) => { if (RESERVED.has(f.key) || seen.has(f.key)) ctx.addIssue({ code: 'custom', path: ['fields', i, 'key'], message: RESERVED.has(f.key) ? 'API key and API token are added automatically.' : 'Each setting needs a different name.' }); seen.add(f.key); });
});

/** What the screen may show: never any credential material. */
const connectionView = (c: Row) => {
  const { secrets, apiKeyHash, tokenHash, ...rest } = c;
  return { ...rest, scope: 'GLOBAL', secretConfigured: Boolean(secrets?.apiKey && secrets?.apiToken), hasApiKey: Boolean(secrets?.apiKey), hasApiToken: Boolean(secrets?.apiToken), biometrics: c.biometrics ?? [] };
};

deviceRouter.get('/attendance-integrations', async (req, res) => {
  const user = me(req);
  const [providers, connections] = await Promise.all([loadProviders(), find('attendanceIntegrations', {}, { sort: { createdAt: -1 } })]);
  if (user.role === 'SUPER_ADMIN') {
    // Who uses what: per connection, the companies, how many machines each has, and when one last sent a punch.
    const [usage, companies] = await Promise.all([
      coll('attendanceDevices').aggregate([{ $group: { _id: { c: '$connectionId', co: '$companyId' }, devices: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] } }, lastEventAt: { $max: '$lastEventAt' } } }]).toArray(),
      find('companies', {}, { projection: { name: 1, companyCode: 1 }, sort: { name: 1 }, limit: 2000 }),
    ]);
    const name = new Map(companies.map((c) => [c.id, c.name as string]));
    const by = new Map<string, Row[]>();
    for (const u of usage) { const list = by.get(u._id.c) ?? []; list.push({ companyId: u._id.co, companyName: name.get(u._id.co) ?? 'Unknown company', devices: u.devices, active: u.active, lastEventAt: u.lastEventAt ?? null }); by.set(u._id.c, list); }
    return ok(res, {
      providers, manifests: providers, companies: companies.map((c) => ({ id: c.id, name: c.name, companyCode: c.companyCode })),
      connections: connections.map((c) => {
        const used = (by.get(c.id) ?? []).sort((x, y) => y.devices - x.devices);
        return { ...connectionView(c), availability: c.availability ?? { mode: 'ALL', companyIds: [] }, usage: used, deviceCount: used.reduce((n, u) => n + u.devices, 0), companyCount: used.length };
      }),
    });
  }
  // Companies only learn which ways of verifying attendance the platform currently offers.
  const companyId = companyIdFor(req);
  const policy = await policyFor(companyId);
  const active = connections.filter((c) => c.status === 'ACTIVE');
  const available = [...new Set(active.flatMap((c) => (c.biometrics ?? []) as Biometric[]))];
  ok(res, { policy: {
    verificationMethods: { gps: policy.verification.gpsRequired, geofence: policy.verification.geofenceRequired, device: policy.verification.deviceRequired, face: policy.verification.selfieRequired, biometric: policy.verification.biometricEnabled },
    requireAnyVerification: true, minimumGpsAccuracyMeters: (policy as Row).minimumGpsAccuracyMeters ?? 100, allowRemoteAttendance: (policy as Row).allowRemoteAttendance ?? false,
  }, availableBiometrics: available, deviceSupport: { face: available.includes('FACE'), fingerprint: available.includes('FINGERPRINT') } });
});

// ── Providers: the catalogue of supported devices (add any vendor, any type) ──
deviceRouter.post('/attendance-providers', async (req, res) => {
  const user = me(req);
  const body = parse(providerSchema, req.body);
  if (await findOne('attendanceProviders', { key: body.key })) throw new AppError(409, 'PROVIDER_EXISTS', 'A provider with this code already exists. Choose another code.');
  const row = await insert('attendanceProviders', { ...body, builtIn: false, isActive: true, createdBy: user.id, createdAt: nowIso() }, 'provider');
  await appendAudit({ actorId: user.id, action: 'ATTENDANCE_PROVIDER_ADDED', entityType: 'ATTENDANCE_PROVIDER', entityId: row.id, newValue: { key: row.key, mode: row.mode, biometrics: row.biometrics }, ...reqMeta(req) });
  ok(res, row, 201);
});

deviceRouter.put('/attendance-providers/:key', async (req, res) => {
  const user = me(req);
  const found = await findOne('attendanceProviders', { key: String(req.params.key).toUpperCase() });
  if (!found) throw notFound('Provider');
  const body = parse(providerSchema, { ...req.body, key: found.key });
  const used = await countConnections(found.key);
  if (used && body.mode !== found.mode) throw new AppError(409, 'PROVIDER_IN_USE', 'This provider already has connections, so its connection type cannot change.');
  const removed = (found.biometrics as Biometric[]).filter((b) => !body.biometrics.includes(b));
  if (used && removed.length) throw new AppError(409, 'PROVIDER_IN_USE', 'This provider already has connections, so you cannot stop it from reading face or fingerprint.');
  const { key: _key, ...set } = body;
  const updated = (await coll('attendanceProviders').findOneAndUpdate({ _id: found.id }, { $set: { ...set, updatedAt: nowIso() } }, { returnDocument: 'after' }))!;
  await appendAudit({ actorId: user.id, action: 'ATTENDANCE_PROVIDER_UPDATED', entityType: 'ATTENDANCE_PROVIDER', entityId: found.id, oldValue: { name: found.name, biometrics: found.biometrics }, newValue: { name: body.name, biometrics: body.biometrics }, ...reqMeta(req) });
  ok(res, { id: updated._id, ...updated });
});

deviceRouter.delete('/attendance-providers/:key', async (req, res) => {
  const user = me(req);
  await loadProviders(); // make sure the built-in brands were added before anything is removed, so they are not added back later
  const found = await findOne('attendanceProviders', { key: String(req.params.key).toUpperCase() });
  if (!found) throw notFound('Provider');
  if (await countConnections(found.key)) throw new AppError(409, 'PROVIDER_IN_USE', 'This provider still has connections. Remove them first, then delete the provider.');
  await remove('attendanceProviders', { _id: found.id });
  await appendAudit({ actorId: user.id, action: 'ATTENDANCE_PROVIDER_REMOVED', entityType: 'ATTENDANCE_PROVIDER', entityId: found.id, oldValue: { key: found.key }, ...reqMeta(req) });
  ok(res, null);
});

// ── Connections: one per physical setup, always with an API key and token ──
const secretString = (min: number, label: string) => z.string().trim().min(min, `${label} must be at least ${min} characters.`).max(500);
const connectionSchema = z.object({
  providerKey: z.string().trim().toUpperCase().min(1),
  displayName: z.string().trim().min(2).max(100),
  biometrics: z.array(BIO).max(2).optional(),
  publicConfig: z.record(z.string(), z.union([z.string().max(500), z.number(), z.boolean()])).default({}),
  secrets: z.object({ apiKey: secretString(8, 'API key').optional(), apiToken: secretString(16, 'API token').optional() }).catchall(secretString(1, 'Secret')).default({}),
  deviceSerials: z.array(z.string().trim().min(1).max(80)).max(500).default([]),
  reason: z.string().trim().max(300).optional(),
});

async function checkAgainstProvider(provider: Row, body: z.infer<typeof connectionSchema>, existing?: Row) {
  const publicFields = (provider.fields as Row[]).filter((f) => !f.secret);
  const secretFields = (provider.fields as Row[]).filter((f) => f.secret);
  if (Object.keys(body.publicConfig).some((k) => !publicFields.some((f) => f.key === k))) throw new AppError(422, 'VALIDATION_ERROR', 'Some settings do not belong to this provider.');
  const allowedSecrets = new Set([...secretFields.map((f) => f.key), 'apiKey', 'apiToken']);
  if (Object.keys(body.secrets).some((k) => !allowedSecrets.has(k))) throw new AppError(422, 'VALIDATION_ERROR', 'Some credentials do not belong to this provider.');
  const merged = { ...(existing?.publicConfig ?? {}), ...body.publicConfig };
  const missing = publicFields.filter((f) => f.required && !String(merged[f.key] ?? '').trim()).map((f) => f.label);
  const have = (k: string) => Boolean(body.secrets[k as 'apiKey'] || existing?.secrets?.[k]);
  if (needsCredentials(provider.mode)) {
    if (!have('apiKey')) missing.push('API key');
    if (!have('apiToken')) missing.push('API token');
  }
  for (const f of secretFields) if (f.required && !have(f.key)) missing.push(f.label);
  if (missing.length) throw new AppError(422, 'MISSING_DETAILS', `Please fill in: ${[...new Set(missing)].join(', ')}.`);
  const biometrics = body.biometrics ?? existing?.biometrics ?? provider.biometrics;
  if (needsCredentials(provider.mode) && biometrics.length === 0) throw new AppError(422, 'MISSING_DETAILS', 'Choose what this device reads: face, fingerprint or both.');
  if (biometrics.some((b: Biometric) => !provider.biometrics.includes(b))) throw new AppError(422, 'VALIDATION_ERROR', `${provider.name} cannot read ${biometrics.filter((b: Biometric) => !provider.biometrics.includes(b)).join(' / ').toLowerCase()}.`);
  return { biometrics: biometrics as Biometric[], publicConfig: merged };
}

async function writeConnection(req: import('express').Request, existing?: Row) {
  const user = me(req);
  const body = parse(connectionSchema, req.body);
  const provider = await findOne('attendanceProviders', { key: existing?.providerKey ?? body.providerKey });
  if (!provider || provider.isActive === false) throw new AppError(422, 'VALIDATION_ERROR', 'Choose a supported attendance provider.');
  const { biometrics, publicConfig } = await checkAgainstProvider(provider, body, existing);
  const secrets: Record<string, string> = { ...(existing?.secrets ?? {}) };
  for (const [k, v] of Object.entries(body.secrets)) if (v) secrets[k] = encryptSecret(v);
  const set: Row = { providerKey: provider.key, displayName: body.displayName, connectionMode: provider.mode, biometrics, publicConfig, deviceSerials: [...new Set(body.deviceSerials)], secrets, status: 'DRAFT', revision: Number(existing?.revision ?? 0) + 1, lastErrorCode: null, updatedAt: nowIso(), scope: 'GLOBAL' };
  if (body.secrets.apiKey) { set.apiKeyHash = sha(body.secrets.apiKey); set.apiKeyHint = `••••${body.secrets.apiKey.slice(-4)}`; }
  if (body.secrets.apiToken) set.tokenHash = sha(body.secrets.apiToken);
  try {
    const row = existing
      ? (await coll('attendanceIntegrations').findOneAndUpdate({ _id: existing.id }, { $set: set }, { returnDocument: 'after' }).then((r) => ({ id: r!._id, ...r })))
      : await insert('attendanceIntegrations', { ...set, createdAt: nowIso(), createdBy: user.id }, 'attendance_connection');
    await appendAudit({ actorId: user.id, action: existing ? 'ATTENDANCE_DEVICE_CONNECTION_UPDATED' : 'ATTENDANCE_DEVICE_CONNECTION_SAVED', entityType: 'ATTENDANCE_CONNECTION', entityId: row.id, newValue: { providerKey: provider.key, displayName: body.displayName, biometrics, credentialsChanged: Object.keys(body.secrets) }, description: body.reason, ...reqMeta(req) });
    return connectionView(row as Row);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new AppError(409, 'API_KEY_IN_USE', 'This API key is already used by another connection. Use a different key.');
    throw err;
  }
}

// One-step setup, the main way to add a device brand: pick a provider that already exists or type a new name, then give the key and token.
// A new provider defaults to "the device sends punches to Vook"; other connection types are an optional extra.
const quickSchema = z.object({
  providerKey: z.string().trim().toUpperCase().optional(),
  name: z.string().trim().min(2, 'Enter the provider name.').max(80).optional(),
  biometrics: z.array(BIO).max(2).optional(),
  mode: z.enum(MODES).optional(),
  fields: z.array(z.object({ label: z.string().trim().min(1).max(60), required: z.boolean().default(false) })).max(12).optional(),
  publicConfig: z.record(z.string(), z.union([z.string().max(500), z.number(), z.boolean()])).default({}),
  secrets: z.object({ apiKey: secretString(8, 'API key').optional(), apiToken: secretString(16, 'API token').optional() }).catchall(secretString(1, 'Secret')).default({}),
});
const camel = (label: string) => label.replace(/[^a-zA-Z0-9]+(.)?/g, (_m, c: string) => (c ? c.toUpperCase() : '')).replace(/^./, (c) => c.toLowerCase()).slice(0, 30) || 'setting';

deviceRouter.post('/attendance-integrations/quick', async (req, res) => {
  const user = me(req);
  const body = parse(quickSchema, req.body);
  let provider: Row | null = null;
  if (body.providerKey) {
    provider = await findOne('attendanceProviders', { key: body.providerKey });
    if (!provider || provider.isActive === false) throw new AppError(422, 'VALIDATION_ERROR', 'Choose a provider from the list, or type a new name.');
  } else {
    if (!body.name) throw new AppError(422, 'MISSING_DETAILS', 'Enter the provider name.');
    const mode = body.mode ?? 'DEVICE_PUSH';
    if (needsCredentials(mode) && !body.biometrics?.length) throw new AppError(422, 'MISSING_DETAILS', 'Choose what the device reads: face, fingerprint or both.');
    const base = body.name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 34) || 'DEVICE';
    const taken = new Set((await find('attendanceProviders', {})).map((p) => p.key as string));
    let key = base.length >= 3 ? base : `${base}_DEV`;
    for (let n = 2; taken.has(key); n++) key = `${base}_${n}`;
    const seen = new Set<string>();
    const fields = (body.fields ?? []).map((f) => { let k = camel(f.label); while (seen.has(k) || RESERVED.has(k)) k += '2'; seen.add(k); return { key: k, label: f.label, required: f.required }; });
    // The screen sends values under the label the admin typed; store them under the generated setting name.
    for (const f of fields) { const label = (body.fields ?? []).find((x) => camel(x.label) === f.key.replace(/\d+$/, '') || x.label === f.label)?.label; if (label && label in body.publicConfig) { body.publicConfig[f.key] = body.publicConfig[label]!; if (label !== f.key) delete body.publicConfig[label]; } }
    provider = { key, name: body.name, mode, biometrics: mode === 'MOBILE' ? [] : body.biometrics ?? [], description: '', fields, builtIn: false, isActive: true } as Row;
  }
  const mode = provider.mode as ConnectionMode;
  const existingCount = await countConnections(provider.key);
  const input = { providerKey: provider.key, displayName: existingCount ? `${provider.name} (${existingCount + 1})` : provider.name, biometrics: body.biometrics, publicConfig: body.publicConfig, secrets: body.secrets, deviceSerials: [] as string[] };
  const { biometrics, publicConfig } = await checkAgainstProvider(provider, input as never);
  const apiKey = body.secrets.apiKey;
  if (needsCredentials(mode) && apiKey && await findOne('attendanceIntegrations', { apiKeyHash: sha(apiKey) })) throw new AppError(409, 'API_KEY_IN_USE', 'This API key is already used by another provider. Use a different key.');

  const secrets: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.secrets)) if (v) secrets[k] = encryptSecret(v);
  const draft: Row = { providerKey: provider.key, displayName: input.displayName, connectionMode: mode, biometrics, publicConfig, deviceSerials: [], secrets, scope: 'GLOBAL', revision: 1 };
  // Cloud and bridge setups are checked against the vendor before anything is saved, so a typo never becomes a "live" connection.
  const failure = await probe(draft);
  if (failure) throw new AppError(422, 'DEVICE_TEST_FAILED', FRIENDLY[failure] ?? 'The test did not pass. Please check the details.', { code: failure });

  if (!(await findOne('attendanceProviders', { key: provider.key }))) await insert('attendanceProviders', { ...provider, createdBy: user.id, createdAt: nowIso() }, 'provider');
  const row = await insert('attendanceIntegrations', {
    ...draft, ...(apiKey ? { apiKeyHash: sha(apiKey), apiKeyHint: `••••${apiKey.slice(-4)}` } : {}), ...(body.secrets.apiToken ? { tokenHash: sha(body.secrets.apiToken) } : {}),
    status: 'ACTIVE', testedRevision: 1, lastTestedAt: nowIso(), createdAt: nowIso(), createdBy: user.id,
  }, 'attendance_connection');
  await appendAudit({ actorId: user.id, action: 'ATTENDANCE_DEVICE_PROVIDER_QUICK_SETUP', entityType: 'ATTENDANCE_CONNECTION', entityId: row.id, newValue: { providerKey: provider.key, name: provider.name, biometrics, newProvider: !body.providerKey }, ...reqMeta(req) });
  ok(res, { ...connectionView(row), providerKey: provider.key }, 201);
});

// Which companies may use a connection: everyone, or only the companies the platform admin picks.
deviceRouter.put('/attendance-integrations/:id/availability', async (req, res) => {
  const user = me(req);
  const row = await byId('attendanceIntegrations', String(req.params.id));
  if (!row) throw notFound('Device connection');
  const body = parse(z.object({ mode: z.enum(['ALL', 'SELECTED']), companyIds: z.array(z.string()).max(2000).default([]) }), req.body);
  const companyIds = body.mode === 'SELECTED' ? [...new Set(body.companyIds)] : [];
  if (body.mode === 'SELECTED') {
    if (!companyIds.length) throw new AppError(422, 'COMPANIES_REQUIRED', 'Choose at least one company, or choose “All companies”.');
    if ((await coll('companies').countDocuments({ _id: { $in: companyIds } as never })) !== companyIds.length) throw new AppError(422, 'VALIDATION_ERROR', 'Some chosen companies do not exist.');
  }
  const before = (row.availability ?? { mode: 'ALL', companyIds: [] }) as { mode: string; companyIds: string[] };
  const next = { mode: body.mode, companyIds };
  const updated = (await coll('attendanceIntegrations').findOneAndUpdate({ _id: row.id }, { $set: { availability: next, updatedAt: nowIso() } }, { returnDocument: 'after' }))!;
  // Companies that lose access and already have machines on it must hear about it; new ones are told they can start.
  const withDevices = (await coll('attendanceDevices').distinct('companyId', { connectionId: row.id })) as string[];
  const had = (id: string) => before.mode !== 'SELECTED' || before.companyIds.includes(id);
  const has = (id: string) => next.mode !== 'SELECTED' || next.companyIds.includes(id);
  await tellCompanies(withDevices.filter((id) => had(id) && !has(id)), 'Attendance device provider no longer available', `${row.displayName} is no longer available to your company, so its machines have stopped sending attendance. Contact Vook support if this is unexpected.`, { connectionId: row.id });
  if (next.mode === 'SELECTED') await tellCompanies(companyIds.filter((id) => !had(id)), 'New attendance device provider available', `${row.displayName} is now available. Add your machines under Time & attendance → Attendance devices.`, { connectionId: row.id });
  await appendAudit({ actorId: user.id, action: 'ATTENDANCE_DEVICE_AVAILABILITY_CHANGED', entityType: 'ATTENDANCE_CONNECTION', entityId: row.id, oldValue: before, newValue: next, ...reqMeta(req) });
  ok(res, connectionView({ id: updated._id, ...updated }));
});

deviceRouter.post('/attendance-integrations', async (req, res) => ok(res, await writeConnection(req), 201));
deviceRouter.put('/attendance-integrations/:id', async (req, res) => {
  const existing = await byId('attendanceIntegrations', String(req.params.id));
  if (!existing) throw notFound('Device connection');
  ok(res, await writeConnection(req, existing));
});

deviceRouter.delete('/attendance-integrations/:id', async (req, res) => {
  const user = me(req);
  const existing = await byId('attendanceIntegrations', String(req.params.id));
  if (!existing) throw notFound('Device connection');
  const linked = await coll('attendanceDevices').aggregate([{ $match: { connectionId: existing.id } }, { $group: { _id: '$companyId', n: { $sum: 1 } } }]).toArray();
  if (linked.length) {
    const machines = linked.reduce((n, l) => n + l.n, 0);
    throw new AppError(409, 'CONNECTION_IN_USE', `${machines} ${machines === 1 ? 'machine is' : 'machines are'} linked to this in ${linked.length} ${linked.length === 1 ? 'company' : 'companies'}. Turn it off instead, or ask those companies to remove their machines first.`, { devices: machines, companies: linked.length });
  }
  await remove('attendanceIntegrations', { _id: existing.id });
  await appendAudit({ actorId: user.id, action: 'ATTENDANCE_DEVICE_CONNECTION_REMOVED', entityType: 'ATTENDANCE_CONNECTION', entityId: existing.id, oldValue: { displayName: existing.displayName, providerKey: existing.providerKey }, ...reqMeta(req) });
  ok(res, null);
});

/** Reaches the vendor (for cloud connections) with the stored credentials; other modes are checked for completeness. */
async function probe(connection: Row): Promise<string | null> {
  const mode = connection.connectionMode as string;
  const config = (connection.publicConfig ?? {}) as Row;
  try {
    // Custom providers name their settings freely, so look for the address / bridge id by what the value looks like.
    const entries = Object.entries(config).map(([k, v]) => [k, String(v ?? '').trim()] as const).filter(([, v]) => v);
    if (mode === 'CLOUD_API') {
      const address = entries.find(([k]) => k === 'baseUrl')?.[1] ?? entries.find(([k, v]) => /url|address|host|server|endpoint/i.test(k) || /^https?:\/\//i.test(v))?.[1];
      if (!address) return null;
      const base = /^[a-z]+:\/\//i.test(address) ? address : `https://${address}`;
      const health = String(config.healthPath ?? '');
      const url = new URL(health ? `${base.replace(/\/$/, '')}/${health.replace(/^\//, '')}` : base);
      if (url.protocol !== 'https:') return 'HTTPS_REQUIRED';
      await assertPublicHost(url.hostname);
      const res = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'manual', headers: { 'X-API-Key': decryptSecret(connection.secrets.apiKey), Authorization: `Bearer ${decryptSecret(connection.secrets.apiToken)}` } });
      return res.status === 401 || res.status === 403 ? 'CREDENTIALS_REJECTED' : null;
    }
    if (mode === 'LOCAL_BRIDGE') {
      const id = entries.find(([k]) => /bridge/i.test(k))?.[1];
      return !id || /^[\w.-]{3,80}$/.test(id) ? null : 'BRIDGE_ID_INVALID';
    }
    return null; // device-push and phone GPS need no outbound call
  } catch (err) { return err instanceof AppError ? err.code : 'UNREACHABLE'; }
}
const FRIENDLY: Record<string, string> = {
  HTTPS_REQUIRED: 'The server address must start with https:// so the key and token travel safely.',
  CREDENTIALS_REJECTED: 'The vendor rejected the API key or token. Please check them.',
  UNREACHABLE: 'We could not reach that server. Check the address and that it is online.',
  BRIDGE_ID_INVALID: 'The bridge ID looks wrong. Use letters, numbers, dots or dashes.',
  HOST_NOT_ALLOWED: 'That server address is not allowed.',
};

const ACTIONS = ['test', 'activate', 'disable'] as const;
{
  deviceRouter.post('/attendance-integrations/:id/:action', async (req, res) => {
    const user = me(req);
    const action = String(req.params.action) as (typeof ACTIONS)[number];
    if (!ACTIONS.includes(action)) throw notFound('Action');
    const row = await byId('attendanceIntegrations', String(req.params.id));
    if (!row) throw notFound('Device connection');
    let set: Row;
    if (action === 'test') {
      if (needsCredentials(row.connectionMode) && !(row.secrets?.apiKey && row.secrets?.apiToken)) throw new AppError(422, 'MISSING_DETAILS', 'Add the API key and API token before testing.');
      const failure = await probe(row);
      if (failure) {
        await coll('attendanceIntegrations').updateOne({ _id: row.id }, { $set: { status: 'ERROR', lastErrorCode: failure, lastTestedAt: nowIso() } });
        throw new AppError(422, 'DEVICE_TEST_FAILED', FRIENDLY[failure] ?? 'The test did not pass. Please check the details.', { code: failure });
      }
      set = { status: 'TESTED', lastTestedAt: nowIso(), lastErrorCode: null, testedRevision: row.revision ?? 0 };
    } else if (action === 'activate') {
      if (row.status !== 'TESTED' || row.testedRevision !== (row.revision ?? 0)) throw new AppError(409, 'DEVICE_NOT_TESTED', 'Test the latest details first, then turn it on.');
      set = { status: 'ACTIVE' };
    } else set = { status: 'DISABLED' };
    const updated = (await coll('attendanceIntegrations').findOneAndUpdate({ _id: row.id }, { $set: set }, { returnDocument: 'after' }))!;
    if (action === 'disable' || action === 'activate') {
      const affected = (await coll('attendanceDevices').distinct('companyId', { connectionId: row.id })) as string[];
      await tellCompanies(affected, action === 'disable' ? 'Attendance devices paused' : 'Attendance devices back on', action === 'disable' ? `${row.displayName} was switched off by Vook. Machines using it will not send attendance until it is switched on again.` : `${row.displayName} is switched on again. Your machines can send attendance.`, { connectionId: row.id });
    }
    await appendAudit({ actorId: user.id, action: `ATTENDANCE_DEVICE_CONNECTION_${action === 'test' ? 'TESTED' : action === 'activate' ? 'ACTIVATED' : 'DISABLED'}`, entityType: 'ATTENDANCE_CONNECTION', entityId: row.id, oldValue: { status: row.status }, newValue: { status: updated.status }, ...reqMeta(req) });
    ok(res, connectionView({ id: updated._id, ...updated }));
  });
}

// ── Punches arriving from devices ──────────────────────────────────────
const punchSchema = z.object({
  deviceSerial: z.string().trim().min(1).max(80), employeeCode: z.string().trim().min(1).max(40),
  modality: BIO, eventType: z.enum(['CHECK_IN', 'CHECK_OUT']), occurredAt: z.string().datetime().optional(), externalEventId: z.string().trim().min(1).max(100).optional(),
  companyCode: z.string().trim().max(40).optional(), // optional cross-check only; the company always comes from the registered device
});

publicDeviceRouter.post('/attendance-events/ingest', async (req, res) => {
  const ip = clientIp(req);
  const unauthorized = async () => { await hit(`device:fail:${ip}`, 15 * 60_000); return new AppError(401, 'DEVICE_UNAUTHORIZED', 'The API key or token is not valid.'); };
  if ((await hit(`device:fail:${ip}`, 15 * 60_000)) > 60) throw new AppError(429, 'RATE_LIMITED', 'Too many failed attempts from this address. Please wait a while.');
  const key = req.headers['x-api-key'];
  const token = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ''))?.[1];
  if (typeof key !== 'string' || !token) throw await unauthorized();
  const connection = await findOne('attendanceIntegrations', { apiKeyHash: sha(key) });
  const given = Buffer.from(sha(token));
  const want = Buffer.from(String(connection?.tokenHash ?? '0'.repeat(64)));
  if (!connection || given.length !== want.length || !timingSafeEqual(given, want)) throw await unauthorized();
  if (connection.status !== 'ACTIVE') throw new AppError(403, 'CONNECTION_NOT_ACTIVE', 'This device connection is not switched on.');
  if ((await hit(`device:rate:${connection.id}`, 60_000)) > 1200) throw new AppError(429, 'RATE_LIMITED', 'Too many punches per minute from this connection.');

  const body = parse(punchSchema, req.body);
  // The device's serial decides the company and branch. A company cannot punch for another company's people.
  const device = await findOne('attendanceDevices', { connectionId: connection.id, serial: body.deviceSerial });
  if (!device || device.status !== 'ACTIVE') throw new AppError(403, 'DEVICE_NOT_REGISTERED', 'This device is not registered, or it is switched off. A company admin must add its serial number first.');
  if (!availableTo(connection, device.companyId)) throw new AppError(403, 'CONNECTION_NOT_AVAILABLE', 'This provider is not available to the device’s company. Contact Vook support.');
  if (!(device.biometrics as Biometric[]).includes(body.modality) || !(connection.biometrics as Biometric[]).includes(body.modality)) throw new AppError(422, 'MODALITY_NOT_ENABLED', `This device is set up for ${(device.biometrics as string[]).join(' / ').toLowerCase()} only.`);
  const occurred = body.occurredAt ? new Date(body.occurredAt) : new Date();
  if (Math.abs(occurred.getTime() - Date.now()) > 36 * 3_600_000) throw new AppError(422, 'TIME_OUT_OF_RANGE', 'The punch time is too far from now.');
  const company = await byId('companies', device.companyId);
  const denied = await deviceAccessDenied(device, body.employeeCode, device.companyId);
  if (denied) throw new AppError(403, 'DEVICE_NOT_ALLOWED_FOR_EMPLOYEE', denied);
  if (!company || (body.companyCode && body.companyCode !== company.companyCode)) throw new AppError(422, 'COMPANY_MISMATCH', 'The company code does not match the company this device belongs to.');
  const employee = await findOne('employees', { companyId: company.id, employeeId: body.employeeCode });
  if (!employee || ['EXITED', 'ARCHIVED'].includes(employee.status)) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'No active employee in this device’s company has that employee code.');

  const eventId = `ingest:${connection.id}:${body.externalEventId ?? `${occurred.getTime()}:${employee.id}:${body.deviceSerial}`}`;
  try { await coll('attendanceEvents').insertOne({ _id: eventId as never, companyId: company.id, employeeId: employee.id, type: body.eventType, occurredAt: occurred.toISOString(), source: 'BIOMETRIC', modality: body.modality, deviceId: device.id, deviceSerial: body.deviceSerial, branchId: device.branchId ?? null, connectionId: connection.id, verification: { biometric: body.modality } }); }
  catch { return ok(res, { accepted: true, duplicate: true }); } // the device retried; the first copy already counted
  await coll('attendanceDevices').updateOne({ _id: device.id }, { $set: { lastEventAt: occurred.toISOString() }, $inc: { eventCount: 1 } });

  // Apply to the attendance sheet unless payroll has locked that day.
  const tz = await timezoneFor(company.id);
  const { date, time } = localParts(tz, occurred);
  const [y, m] = date.split('-').map(Number);
  if (await findOne('attendancePeriods', { companyId: company.id, year: y, month: m, status: 'LOCKED' })) return ok(res, { accepted: true, applied: false, reason: 'PERIOD_LOCKED' });
  const policy = await policyFor(company.id);
  const delay = delayMinutes(time, shiftStartMinutes(employee, policy.standardStart));
  const late = delay > Number(policy.graceMinutes ?? 0);
  // Several devices (or a device that was offline) can deliver punches out of order: the earliest check-in and the latest check-out win.
  const where = { deviceId: device.id, deviceName: device.name, branchIdOfPunch: device.branchId ?? null };
  let row = await findOne('attendance', { employeeId: employee.id, date });
  if (body.eventType === 'CHECK_IN') {
    const set = { checkIn: time, status: late ? 'Late' : 'Present', lateMinutes: late ? delay : 0, source: 'BIOMETRIC', modality: body.modality, ...where };
    if (!row) row = await insertRow('attendance', { companyId: company.id, employeeId: employee.id, branchId: employee.branchId, departmentId: employee.departmentId, date, checkOut: null, createdAt: nowIso(), ...set }, 'attendance').catch(async () => (await findOne('attendance', { employeeId: employee.id, date }))!);
    else if (!row.checkIn || time < row.checkIn) await coll('attendance').updateOne({ _id: row.id }, { $set: set });
  } else {
    if (!row?.checkIn) return ok(res, { accepted: true, applied: false, reason: 'NO_CHECK_IN' });
    if (!row.checkOut || time > row.checkOut) await coll('attendance').updateOne({ _id: row.id }, { $set: { checkOut: time, checkOutDeviceId: device.id } });
  }
  ok(res, { accepted: true, applied: true, date, time });
});

