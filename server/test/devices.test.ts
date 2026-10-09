import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACCOUNTS, boot, loginAs } from './helpers.ts';

let ctx: Awaited<ReturnType<typeof boot>>;
beforeAll(async () => { ctx = await boot(); });
afterAll(async () => { await ctx.stop(); });

const KEY = 'acme-key-12345678';
const TOKEN = 'acme-token-1234567890abcd';
const punch = (headers: Record<string, string>, body: object) => request(ctx.app).post('/api/v2/attendance-events/ingest').set(headers).send(body);
const auth = { 'X-API-Key': KEY, Authorization: `Bearer ${TOKEN}` };

describe('attendance device providers', () => {
  it('lists the shipped providers (face-only, fingerprint-only and both) and lets only the platform admin change anything', async () => {
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    const { providers, connections } = (await sa.agent.get('/api/v2/attendance-integrations')).body.data;
    const bio = (key: string) => providers.find((p: { key: string }) => p.key === key).biometrics;
    expect(bio('FACE_TERMINAL')).toEqual(['FACE']);
    expect(bio('FINGERPRINT_TERMINAL')).toEqual(['FINGERPRINT']);
    expect(bio('FACE_FINGERPRINT_TERMINAL')).toEqual(['FACE', 'FINGERPRINT']);
    expect(connections.every((c: { secrets?: unknown }) => c.secrets === undefined)).toBe(true);
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    expect((await admin.agent.post('/api/v2/attendance-providers').send({})).status).toBe(403);
    expect((await admin.agent.post('/api/v2/attendance-integrations').send({})).status).toBe(403);
    const tenantView = (await admin.agent.get('/api/v2/attendance-integrations')).body.data;
    expect(tenantView.providers).toBeUndefined(); // companies never see platform device setup
    expect(tenantView.deviceSupport).toBeDefined();
  });

  it('adds a custom vendor of any connection type and any biometric mix, with validation', async () => {
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    const good = { key: 'acme_palm_pro', name: 'Acme Pro reader', mode: 'DEVICE_PUSH', biometrics: ['FACE', 'FINGERPRINT'], description: 'Our own reader', fields: [{ key: 'siteId', label: 'Site ID', required: true }] };
    const made = await sa.agent.post('/api/v2/attendance-providers').send(good);
    expect(made.status).toBe(201);
    expect(made.body.data.key).toBe('ACME_PALM_PRO');
    expect((await sa.agent.post('/api/v2/attendance-providers').send(good)).body.error.code).toBe('PROVIDER_EXISTS');
    expect((await sa.agent.post('/api/v2/attendance-providers').send({ ...good, key: 'NO_BIO', biometrics: [] })).status).toBe(422);
    expect((await sa.agent.post('/api/v2/attendance-providers').send({ ...good, key: 'BAD_FIELD', fields: [{ key: 'apiKey', label: 'x', required: true }] })).status).toBe(422);
    // The list is plain data: even the providers that came with Vook can be removed (unless connections use them), and stay removed.
    expect((await sa.agent.delete('/api/v2/attendance-providers/SUPREMA_BIOSTAR')).body.error.code).toBe('PROVIDER_IN_USE');
    expect((await sa.agent.delete('/api/v2/attendance-providers/ESSL_EATTENDANCE')).status).toBe(200);
    expect((await sa.agent.get('/api/v2/attendance-integrations')).body.data.providers.some((p: { key: string }) => p.key === 'ESSL_EATTENDANCE')).toBe(false);
    const renamed = await sa.agent.put('/api/v2/attendance-providers/ACME_PALM_PRO').send({ ...good, name: 'Acme Pro reader v2' });
    expect(renamed.body.data.name).toBe('Acme Pro reader v2');
  });
});

let connectionId = '';

describe('connections need an API key and token', () => {
  it('refuses a connection without credentials, then stores them encrypted and never returns them', async () => {
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    const base = { providerKey: 'ACME_PALM_PRO', displayName: 'Head office reader', publicConfig: { siteId: 'HQ-1' }, deviceSerials: ['ACME-001'], biometrics: ['FACE'] };
    const none = await sa.agent.post('/api/v2/attendance-integrations').send(base);
    expect(none.status).toBe(422);
    expect(none.body.error.message).toMatch(/API key/);
    expect(none.body.error.message).toMatch(/API token/);
    expect((await sa.agent.post('/api/v2/attendance-integrations').send({ ...base, secrets: { apiKey: 'short', apiToken: TOKEN } })).status).toBe(422);
    expect((await sa.agent.post('/api/v2/attendance-integrations').send({ ...base, publicConfig: {}, secrets: { apiKey: KEY, apiToken: TOKEN } })).body.error.message).toMatch(/Site ID/);
    expect((await sa.agent.post('/api/v2/attendance-integrations').send({ ...base, biometrics: ['FACE', 'FINGERPRINT'], secrets: { apiKey: KEY, apiToken: TOKEN } })).status).toBe(201);
    const list = (await sa.agent.get('/api/v2/attendance-integrations')).body.data.connections;
    const made = list.find((c: { displayName: string }) => c.displayName === 'Head office reader');
    connectionId = made.id;
    expect(made.secretConfigured).toBe(true);
    expect(made.apiKeyHint).toBe('••••5678');
    expect(JSON.stringify(list)).not.toContain(TOKEN);
    expect(JSON.stringify(list)).not.toContain(KEY);
    const { coll } = await import('../src/db/mongo.ts');
    expect(JSON.stringify(await coll('attendanceIntegrations').findOne({ _id: connectionId as never }))).not.toContain(TOKEN);
    expect((await sa.agent.post('/api/v2/attendance-integrations').send({ ...base, displayName: 'Copy', secrets: { apiKey: KEY, apiToken: TOKEN } })).body.error.code).toBe('API_KEY_IN_USE');
  });

  it('the connection can only claim what its provider can read; vendor face-only providers refuse fingerprint', async () => {
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    const r = await sa.agent.post('/api/v2/attendance-integrations').send({ providerKey: 'FACE_TERMINAL', displayName: 'Lobby face', biometrics: ['FINGERPRINT'], secrets: { apiKey: 'lobby-key-0001', apiToken: 'lobby-token-0000000001' } });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toMatch(/cannot read fingerprint/);
  });

  it('must be tested with the latest details before it can be turned on, and editing resets that', async () => {
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    expect((await sa.agent.post(`/api/v2/attendance-integrations/${connectionId}/activate`).send({})).body.error.code).toBe('DEVICE_NOT_TESTED');
    expect((await sa.agent.post(`/api/v2/attendance-integrations/${connectionId}/test`).send({})).body.data.status).toBe('TESTED');
    const edited = await sa.agent.put(`/api/v2/attendance-integrations/${connectionId}`).send({ providerKey: 'ACME_PALM_PRO', displayName: 'Head office reader', publicConfig: { siteId: 'HQ-2' }, deviceSerials: ['ACME-001', 'ACME-002'], biometrics: ['FACE', 'FINGERPRINT'] }); // credentials left blank = keep
    expect(edited.status).toBe(200);
    expect(edited.body.data.status).toBe('DRAFT');
    expect(edited.body.data.secretConfigured).toBe(true);
    expect((await sa.agent.post(`/api/v2/attendance-integrations/${connectionId}/activate`).send({})).body.error.code).toBe('DEVICE_NOT_TESTED');
    await sa.agent.post(`/api/v2/attendance-integrations/${connectionId}/test`).send({});
    expect((await sa.agent.post(`/api/v2/attendance-integrations/${connectionId}/activate`).send({})).body.data.status).toBe('ACTIVE');
  });

  it('cloud connections must use https and a reachable, accepting server', async () => {
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    const c = await sa.agent.post('/api/v2/attendance-integrations').send({ providerKey: 'ZKTECO_BIOTIME', displayName: 'ZK cloud', publicConfig: { baseUrl: 'http://insecure.example.com' }, secrets: { apiKey: 'zk-key-00000001', apiToken: 'zk-token-000000000001' } });
    const test = await sa.agent.post(`/api/v2/attendance-integrations/${c.body.data.id}/test`).send({});
    expect(test.status).toBe(422);
    expect(test.body.error.message).toMatch(/https/);
  });
});

describe('devices sending punches', () => {
  const body = (extra: object = {}) => ({ deviceSerial: 'ACME-001', employeeCode: 'NS-0006', modality: 'FACE', eventType: 'CHECK_IN', externalEventId: `evt-${Math.random()}`, ...extra });

  it('a company registers several devices on one connection, across branches, with a plan limit and no serial reuse', async () => {
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    const view = (await admin.agent.get('/api/v2/attendance-devices')).body.data;
    const conn = view.connections.find((c: { id: string }) => c.id === connectionId);
    expect(conn).toBeDefined();
    const branch = view.branches[0]?.id ?? null;
    const add = (serial: string, name: string) => admin.agent.post('/api/v2/attendance-devices').send({ connectionId, serial, name, branchId: branch });
    const first = await admin.agent.post('/api/v2/attendance-devices').send({ connectionId, serial: 'ACME-001', modelNo: 'SpeedFace-V5L', name: 'Main gate, ground floor', branchId: branch });
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ serial: 'ACME-001', modelNo: 'SpeedFace-V5L', name: 'Main gate, ground floor' });
    expect((await admin.agent.post('/api/v2/attendance-devices').send({ connectionId, serial: 'ACME-009', name: '' })).status).toBe(422); // a place name is required
    expect((await add('ACME-002', 'Back door')).status).toBe(201);
    expect((await add('ACME-001', 'Duplicate')).body.error.code).toBe('DEVICE_SERIAL_IN_USE');
    expect((await admin.agent.post('/api/v2/attendance-devices').send({ connectionId: 'nope', serial: 'X-1', name: 'Bad' })).body.error.code).toBe('CONNECTION_UNAVAILABLE');
    const after = (await admin.agent.get('/api/v2/attendance-devices')).body.data;
    expect(after.summary.total).toBe(2);
    expect(after.devices.map((d: { serial: string }) => d.serial).sort()).toEqual(['ACME-001', 'ACME-002']);
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    expect((await emp.agent.post('/api/v2/attendance-devices').send({ connectionId, serial: 'E-1', name: 'Nope' })).status).toBe(403);
  });

  it('rejects wrong or missing credentials without saying which part was wrong', async () => {
    expect((await punch({}, body())).status).toBe(401);
    const a = await punch({ 'X-API-Key': KEY, Authorization: 'Bearer wrong-token-wrong-token' }, body());
    const b = await punch({ 'X-API-Key': 'no-such-key-1234', Authorization: `Bearer ${TOKEN}` }, body());
    expect(a.status).toBe(401);
    expect(a.body.error.message).toBe(b.body.error.message);
  });

  it('a device can be switched off and its punches stop, while the company id comes only from the registered device', async () => {
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    const dev = (await admin.agent.get('/api/v2/attendance-devices')).body.data.devices.find((d: { serial: string }) => d.serial === 'ACME-002');
    await admin.agent.put(`/api/v2/attendance-devices/${dev.id}`).send({ status: 'DISABLED' });
    expect((await punch(auth, body({ deviceSerial: 'ACME-002' }))).body.error.code).toBe('DEVICE_NOT_REGISTERED');
    await admin.agent.put(`/api/v2/attendance-devices/${dev.id}`).send({ status: 'ACTIVE' });
    expect((await punch(auth, body({ deviceSerial: 'ACME-002', companyCode: 'SOMEONE-ELSE' }))).body.error.code).toBe('COMPANY_MISMATCH');
  });

  it('records a punch from a registered device and is safe against retries', async () => {
    const { coll } = await import('../src/db/mongo.ts');
    await coll('attendance').deleteMany({ employeeId: 'employee_extra_1' });
    await coll('attendancePeriods').deleteMany({}); // the sample data has this month locked for payroll; punches on a locked month are stored but not applied
    const first = body({ externalEventId: 'evt-fixed-1' });
    const ok1 = await punch(auth, first);
    expect(ok1.status).toBe(200);
    expect(ok1.body.data).toMatchObject({ accepted: true, applied: true });
    const again = await punch(auth, first);
    expect(again.body.data.duplicate).toBe(true);
    const rows = await coll('attendance').find({ employeeId: 'employee_extra_1' }).toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.source).toBe('BIOMETRIC');
    expect(rows[0]!.modality).toBe('FACE');
    const out = await punch(auth, body({ eventType: 'CHECK_OUT' }));
    expect(out.body.data.applied).toBe(true);
  });

  it('enforces the device list, the enabled biometrics, and real employees', async () => {
    expect((await punch(auth, body({ deviceSerial: 'ROGUE-9' }))).body.error.code).toBe('DEVICE_NOT_REGISTERED');
    expect((await punch(auth, body({ employeeCode: 'NS-9999' }))).body.error.code).toBe('EMPLOYEE_NOT_FOUND');
    expect((await punch(auth, body({ companyCode: 'WRONG' }))).body.error.code).toBe('COMPANY_MISMATCH');
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    const faceOnly = await sa.agent.post('/api/v2/attendance-integrations').send({ providerKey: 'FACE_TERMINAL', displayName: 'Lobby face', secrets: { apiKey: 'lobby-key-0001', apiToken: 'lobby-token-0000000001' } });
    await sa.agent.post(`/api/v2/attendance-integrations/${faceOnly.body.data.id}/test`).send({});
    await sa.agent.post(`/api/v2/attendance-integrations/${faceOnly.body.data.id}/activate`).send({});
    const co = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    await co.agent.post('/api/v2/attendance-devices').send({ connectionId: faceOnly.body.data.id, serial: 'ACME-001', name: 'Lobby' });
    const finger = await punch({ 'X-API-Key': 'lobby-key-0001', Authorization: 'Bearer lobby-token-0000000001' }, body({ modality: 'FINGERPRINT' }));
    expect(finger.status).toBe(422);
    expect(finger.body.error.code).toBe('MODALITY_NOT_ENABLED');
    expect((await punch({ 'X-API-Key': 'lobby-key-0001', Authorization: 'Bearer lobby-token-0000000001' }, body({ modality: 'FACE', externalEventId: 'evt-face-ok' }))).status).toBe(200);
  });

  it('stops accepting punches the moment a connection is disabled', async () => {
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    await sa.agent.post(`/api/v2/attendance-integrations/${connectionId}/disable`).send({});
    const res = await punch(auth, body());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CONNECTION_NOT_ACTIVE');
  });
});

describe('one form for every provider', () => {
  it('picks an existing provider (face-only, fingerprint-only, both) or creates a new one, always with key and token', async () => {
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    const secrets = (n: number) => ({ apiKey: `pick-key-000${n}`, apiToken: `pick-token-00000000${n}` });
    const existing = await sa.agent.post('/api/v2/attendance-integrations/quick').send({ providerKey: 'FACE_TERMINAL', secrets: secrets(1) });
    expect(existing.status).toBe(201);
    expect(existing.body.data.biometrics).toEqual(['FACE']);
    expect(existing.body.data.status).toBe('ACTIVE');
    const second = await sa.agent.post('/api/v2/attendance-integrations/quick').send({ providerKey: 'FACE_TERMINAL', secrets: secrets(2) });
    expect(second.body.data.displayName).toMatch(/\(\d+\)$/); // a second account for the same brand gets its own name
    expect((await sa.agent.post('/api/v2/attendance-integrations/quick').send({ providerKey: 'FACE_TERMINAL', secrets: { apiKey: 'only-key-0001' } })).body.error.message).toMatch(/API token/);
    expect((await sa.agent.post('/api/v2/attendance-integrations/quick').send({ providerKey: 'NOPE_X', secrets: secrets(3) })).status).toBe(422);
    const withSettings = await sa.agent.post('/api/v2/attendance-integrations/quick').send({ name: 'Site Reader', biometrics: ['FACE'], mode: 'LOCAL_BRIDGE', fields: [{ label: 'Bridge ID', required: true }], publicConfig: { 'Bridge ID': 'office-1' }, secrets: secrets(4) });
    expect(withSettings.status).toBe(201);
    const cloud = await sa.agent.post('/api/v2/attendance-integrations/quick').send({ name: 'Cloud Reader', biometrics: ['FACE'], mode: 'CLOUD_API', fields: [{ label: 'Base Url', required: true }], publicConfig: { 'Base Url': 'http://not-secure.example.com' }, secrets: secrets(5) });
    expect(cloud.status).toBe(422);
    expect(cloud.body.error.message).toMatch(/https/);
    const { providers, connections } = (await sa.agent.get('/api/v2/attendance-integrations')).body.data;
    expect(providers.some((p: { name: string }) => p.name === 'Cloud Reader')).toBe(false); // a failed check saves nothing
    expect(connections.some((c: { displayName: string }) => c.displayName === 'Cloud Reader')).toBe(false);
  });
});

describe('simple setup and who may punch where', () => {
  it('quick setup: provider name + what it reads + key + token creates a ready connection for every company', async () => {
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    const r = await sa.agent.post('/api/v2/attendance-integrations/quick').send({ name: 'Quick Reader', biometrics: ['FINGERPRINT'], secrets: { apiKey: 'quick-key-0001', apiToken: 'quick-token-0000000001' } });
    expect(r.status).toBe(201);
    expect(r.body.data.status).toBe('ACTIVE');
    expect(r.body.data.biometrics).toEqual(['FINGERPRINT']);
    expect((await sa.agent.post('/api/v2/attendance-integrations/quick').send({ name: 'Other', biometrics: ['FACE'], secrets: { apiKey: 'quick-key-0001', apiToken: 'quick-token-0000000002' } })).body.error.code).toBe('API_KEY_IN_USE');
    expect((await sa.agent.post('/api/v2/attendance-integrations/quick').send({ name: 'Quick Reader', biometrics: ['FACE'], secrets: { apiKey: 'quick-key-0002', apiToken: 'quick-token-0000000003' } })).status).toBe(201); // same name gets its own code
    expect((await sa.agent.post('/api/v2/attendance-integrations/quick').send({ name: 'No keys', biometrics: ['FACE'], secrets: { apiKey: 'x', apiToken: 'y' } })).status).toBe(422);
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    expect((await admin.agent.post('/api/v2/attendance-integrations/quick').send({})).status).toBe(403);
    const seen = (await admin.agent.get('/api/v2/attendance-devices')).body.data.connections;
    expect(seen.some((c: { id: string }) => c.id === r.body.data.id)).toBe(true);
  });

  it('a device can allow everyone, only its own branch, or chosen people', async () => {
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    const view = (await admin.agent.get('/api/v2/attendance-devices')).body.data;
    const conn = view.connections.find((c: { displayName: string; biometrics: string[] }) => c.displayName === 'Quick Reader' && c.biometrics.includes('FINGERPRINT'));
    const { coll } = await import('../src/db/mongo.ts');
    const worker = (await coll('employees').findOne({ employeeId: 'NS-0006' }))!;
    const other = (await coll('offices').find({ _id: { $ne: worker.branchId as never } }).toArray())[0];
    const add = (serial: string, extra: object) => admin.agent.post('/api/v2/attendance-devices').send({ connectionId: conn.id, serial, name: serial, ...extra });
    expect((await add('Q-BR', { access: 'BRANCH' })).body.error.code).toBe('BRANCH_REQUIRED');
    expect((await add('Q-SEL', { access: 'SELECTED' })).body.error.code).toBe('PEOPLE_REQUIRED');
    expect((await add('Q-ALL', { access: 'ALL' })).status).toBe(201);
    expect((await add('Q-HOME', { access: 'BRANCH', branchId: worker.branchId })).status).toBe(201);
    expect((await add('Q-AWAY', { access: 'BRANCH', branchId: other._id })).status).toBe(201);
    expect((await add('Q-ME', { access: 'SELECTED', employeeIds: [worker._id] })).status).toBe(201);
    expect((await add('Q-NOT-ME', { access: 'SELECTED', employeeIds: [(await coll('employees').findOne({ employeeId: 'NS-0007' }))!._id] })).status).toBe(201);
    const send = (serial: string) => punch({ 'X-API-Key': 'quick-key-0001', Authorization: 'Bearer quick-token-0000000001' }, { deviceSerial: serial, employeeCode: 'NS-0006', modality: 'FINGERPRINT', eventType: 'CHECK_IN', externalEventId: `acc-${serial}` });
    expect((await send('Q-ALL')).status).toBe(200);
    expect((await send('Q-HOME')).status).toBe(200);
    const away = await send('Q-AWAY');
    expect(away.status).toBe(403);
    expect(away.body.error.code).toBe('DEVICE_NOT_ALLOWED_FOR_EMPLOYEE');
    expect(away.body.error.message).toContain(other.name);
    expect((await send('Q-ME')).status).toBe(200);
    expect((await send('Q-NOT-ME')).body.error.code).toBe('DEVICE_NOT_ALLOWED_FOR_EMPLOYEE');
  });
});

describe('platform admin and company admin stay connected', () => {
  it('the platform admin decides which companies get a provider, sees who uses it, and companies are told when it changes', async () => {
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    const { coll } = await import('../src/db/mongo.ts');
    const mine = (await coll('users').findOne({ email: ACCOUNTS.companyAdmin }))!.companyId as string;
    const overview = (await sa.agent.get('/api/v2/attendance-integrations')).body.data;
    const other = overview.companies.find((c: { id: string }) => c.id !== mine);
    expect(other).toBeDefined();

    const made = await sa.agent.post('/api/v2/attendance-integrations/quick').send({ name: 'Scoped Reader', biometrics: ['FACE'], secrets: { apiKey: 'scope-key-0001', apiToken: 'scope-token-0000000001' } });
    const id = made.body.data.id as string;
    const headers = { 'X-API-Key': 'scope-key-0001', Authorization: 'Bearer scope-token-0000000001' };
    const sendPunch = (serial: string) => punch(headers, { deviceSerial: serial, employeeCode: 'NS-0006', modality: 'FACE', eventType: 'CHECK_IN', externalEventId: `scope-${serial}-${Math.random()}` });

    // Only another company is allowed: ours cannot see or use it.
    expect((await sa.agent.put(`/api/v2/attendance-integrations/${id}/availability`).send({ mode: 'SELECTED', companyIds: [] })).body.error.code).toBe('COMPANIES_REQUIRED');
    expect((await sa.agent.put(`/api/v2/attendance-integrations/${id}/availability`).send({ mode: 'SELECTED', companyIds: [other.id] })).status).toBe(200);
    expect((await admin.agent.get('/api/v2/attendance-devices')).body.data.connections.some((c: { id: string }) => c.id === id)).toBe(false);
    expect((await admin.agent.post('/api/v2/attendance-devices').send({ connectionId: id, serial: 'SC-1', name: 'Nope' })).body.error.code).toBe('CONNECTION_UNAVAILABLE');
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    expect((await emp.agent.put(`/api/v2/attendance-integrations/${id}/availability`).send({ mode: 'ALL' })).status).toBe(403);

    // Open to everyone: the company registers a machine and it works.
    await sa.agent.put(`/api/v2/attendance-integrations/${id}/availability`).send({ mode: 'ALL' });
    expect((await admin.agent.post('/api/v2/attendance-devices').send({ connectionId: id, serial: 'SC-1', name: 'Gate' })).status).toBe(201);
    expect((await sendPunch('SC-1')).status).toBe(200);
    const seen = (await sa.agent.get('/api/v2/attendance-integrations')).body.data.connections.find((c: { id: string }) => c.id === id);
    expect(seen.deviceCount).toBe(1);
    expect(seen.usage[0]).toMatchObject({ companyId: mine, devices: 1 });
    expect(seen.usage[0].lastEventAt).toBeTruthy();

    // Taken away from this company: its machine stops, the screen says why, and an admin is notified.
    await sa.agent.put(`/api/v2/attendance-integrations/${id}/availability`).send({ mode: 'SELECTED', companyIds: [other.id] });
    expect((await sendPunch('SC-1')).body.error.code).toBe('CONNECTION_NOT_AVAILABLE');
    const view = (await admin.agent.get('/api/v2/attendance-devices')).body.data;
    expect(view.devices.find((d: { serial: string }) => d.serial === 'SC-1')).toMatchObject({ connectionState: 'NO_ACCESS', working: false });
    expect(view.needsAttention).toBeGreaterThan(0);
    expect((await admin.agent.get('/api/v2/notifications')).body.data.items.some((n: { title: string }) => n.title === 'Attendance device provider no longer available')).toBe(true);

    // Back for everyone, then switched off: paused state, notification, and it cannot be deleted while machines are linked.
    await sa.agent.put(`/api/v2/attendance-integrations/${id}/availability`).send({ mode: 'ALL' });
    await sa.agent.post(`/api/v2/attendance-integrations/${id}/disable`).send({});
    expect((await admin.agent.get('/api/v2/attendance-devices')).body.data.devices.find((d: { serial: string }) => d.serial === 'SC-1').connectionState).toBe('PAUSED');
    expect((await admin.agent.get('/api/v2/notifications')).body.data.items.some((n: { title: string }) => n.title === 'Attendance devices paused')).toBe(true);
    const del = await sa.agent.delete(`/api/v2/attendance-integrations/${id}`);
    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe('CONNECTION_IN_USE');
    const dev = (await admin.agent.get('/api/v2/attendance-devices')).body.data.devices.find((d: { serial: string }) => d.serial === 'SC-1');
    await admin.agent.delete(`/api/v2/attendance-devices/${dev.id}`);
    expect((await sa.agent.delete(`/api/v2/attendance-integrations/${id}`)).status).toBe(200);
  });
});
