import 'fake-indexeddb/auto';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getMockState, resetMockState } from './db';
import { handlers } from './handlers';
import { MOCK_PASSWORD } from './seed';

const server = setupServer(...handlers);
const endpoint = (path: string) => `http://localhost/api/v2${path}`;

async function login(email: string) {
  return fetch(endpoint('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: MOCK_PASSWORD }),
  });
}
async function json(path: string, method: string, body?: unknown) {
  return fetch(endpoint(path), { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

describe('mock API behavior', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  beforeEach(async () => { await resetMockState(); });
  afterAll(() => server.close());

  it('returns meaningful 401 and role-based 403 errors', async () => {
    const anonymous = await fetch(endpoint('/employees'));
    expect(anonymous.status).toBe(401);
    expect((await anonymous.json()).error.code).toBe('UNAUTHENTICATED');

    expect((await login('employee@demo.vook.app')).status).toBe(200);
    const forbidden = await fetch(endpoint('/companies'));
    expect(forbidden.status).toBe(403);
    expect((await forbidden.json()).error.code).toBe('FORBIDDEN');
  });

  it('enforces tenant scope while filtering and paginating', async () => {
    expect((await login('manager@demo.vook.app')).status).toBe(200);
    const response = await fetch(endpoint('/employees?companyId=company_apex&page=1&pageSize=1&search=an'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.employees.length).toBeLessThanOrEqual(1);
    expect(body.data.employees.every((employee: { companyId: string }) => employee.companyId === 'company_northstar')).toBe(true);
    expect(body.data.pagination).toMatchObject({ page: 1, pageSize: 1 });
  });

  it('persists CRUD changes and validates malformed records', async () => {
    expect((await login('hr@demo.vook.app')).status).toBe(200);
    const invalid = await fetch(endpoint('/employees'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(invalid.status).toBe(422);
    expect((await invalid.json()).error.code).toBe('VALIDATION_ERROR');

    const created = await fetch(endpoint('/employees'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Demo New Hire', email: 'new.hire@example.test', department: 'Engineering' }),
    });
    const employee = (await created.json()).data;
    expect(created.status).toBe(201);
    const reloaded = await fetch(endpoint(`/employees/${employee.id}`));
    expect((await reloaded.json()).data.user.name).toBe('Demo New Hire');
  });

  it('stores and downloads an uploaded mock file', async () => {
    expect((await login('employee@demo.vook.app')).status).toBe(200);
    const form = new FormData();
    form.set('file', new File(['demo receipt'], 'receipt.txt', { type: 'text/plain' }));
    const upload = await fetch(endpoint('/files/receipts'), { method: 'POST', body: form });
    const uploaded = (await upload.json()).data;
    expect(upload.status).toBe(201);
    const download = await fetch(endpoint(uploaded.fileUrl));
    expect(download.headers.get('content-disposition')).toContain('attachment');
    expect(await download.text()).toBe('demo receipt');
  });

  it('publishes immutable plans, pins subscriptions, and migrates explicitly', async () => {
    expect((await login('superadmin@demo.vook.app')).status).toBe(200);
    const createdResponse = await json('/plans', 'POST', { name: 'Field Teams', type: 'FIELD', price: 4500, annualPrice: 45000, maxUsers: 80, moduleIds: ['module_attendance'], defaultTrialDays: 7 });
    const created = (await createdResponse.json()).data;
    expect(created.status).toBe('DRAFT');
    expect(created.moduleIds).toEqual(expect.arrayContaining(['module_dashboard', 'module_support', 'module_subscription', 'module_company_settings', 'module_roles', 'module_attendance']));

    const v1Response = await json(`/plans/${created.id}/publish`, 'POST', { draftRevision: created.draftRevision, reason: 'Initial commercial launch' });
    const v1 = (await v1Response.json()).data;
    expect(v1.version).toBe(1);
    await json('/subscriptions', 'POST', { companyId: 'company_orbit', planVersionId: v1.id, billingCycle: 'Monthly', months: 12, reason: 'Customer approved version 1' });

    const savedDraftResponse = await json(`/plans/${created.id}`, 'PUT', { draftRevision: created.draftRevision, maxUsers: 120, moduleIds: ['module_attendance', 'module_leave'] });
    const savedDraft = (await savedDraftResponse.json()).data;
    const v2 = (await (await json(`/plans/${created.id}/publish`, 'POST', { draftRevision: savedDraft.draftRevision, reason: 'Add leave module' })).json()).data;
    let state = await getMockState();
    expect(state.subscriptions.find((item) => item.companyId === 'company_orbit')?.planVersionId).toBe(v1.id);
    const subscription = state.subscriptions.find((item) => item.companyId === 'company_orbit')!;
    await json(`/subscriptions/${subscription.id}/migrate`, 'POST', { planVersionId: v2.id, reason: 'Customer accepted version 2' });
    state = await getMockState();
    expect(state.subscriptions.find((item) => item.id === subscription.id)?.planVersionId).toBe(v2.id);
    expect(state.audit.some((event) => event.action === 'SUBSCRIPTION_MIGRATE')).toBe(true);
  });

  it('protects Company Admin and persists custom scoped roles', async () => {
    expect((await login('companyadmin@demo.vook.app')).status).toBe(200);
    const locked = await json('/role-definitions/role_company_admin', 'PUT', { permissions: [] });
    expect(locked.status).toBe(409);
    expect((await locked.json()).error.code).toBe('SYSTEM_ROLE_LOCKED');

    const customResponse = await json('/role-definitions', 'POST', { name: 'Leave Reviewer', permissions: ['DASHBOARD.VIEW', 'LEAVE_MANAGEMENT.VIEW', 'LEAVE_MANAGEMENT.APPROVE'] });
    const custom = (await customResponse.json()).data;
    expect(custom.kind).toBe('CUSTOM');
    const assignmentResponse = await json('/role-assignments', 'POST', { userId: 'user_manager', roleDefinitionId: custom.id, scopeType: 'DEPARTMENT', scopeId: 'dept_ops' });
    expect(assignmentResponse.status).toBe(201);
    const state = await getMockState();
    expect(state.roleAssignments.some((assignment) => assignment.roleDefinitionId === custom.id && assignment.scopeId === 'dept_ops')).toBe(true);
  });

  it('requires GPS and carries payroll through Finance and Company Admin stages', async () => {
    expect((await login('employee@demo.vook.app')).status).toBe(200);
    const missingLocation = await json('/attendance/mine/check-in', 'POST', {});
    expect(missingLocation.status).toBe(422);
    expect((await missingLocation.json()).error.code).toBe('LOCATION_REQUIRED');

    const regularization = (await (await json('/attendance-regularizations/mine', 'POST', { date: '2026-09-01', requestedCheckIn: '09:05', reason: 'Missed web punch' })).json()).data;
    expect((await login('supervisor@demo.vook.app')).status).toBe(200);
    expect((await json(`/attendance-regularizations/${regularization.id}/actions`, 'POST', { action: 'APPROVE', comment: 'Recommended' })).status).toBe(200);
    expect((await login('manager@demo.vook.app')).status).toBe(200);
    expect((await json(`/attendance-regularizations/${regularization.id}/actions`, 'POST', { action: 'APPROVE', comment: 'Approved' })).status).toBe(200);
    expect((await login('hr@demo.vook.app')).status).toBe(200);
    const regularizationDone = await json(`/attendance-regularizations/${regularization.id}/actions`, 'POST', { action: 'APPROVE', comment: 'Recorded' });
    expect((await regularizationDone.json()).data.status).toBe('APPROVED');

    expect((await login('finance@demo.vook.app')).status).toBe(200);
    const run = (await (await json('/payroll-runs', 'POST', { month: 12, year: 2030 })).json()).data;
    expect(run.status).toBe('CALCULATED');
    expect((await json(`/payroll-runs/${run.runId}/review`, 'POST', { comment: 'Finance review complete' })).status).toBe(200);
    expect((await login('companyadmin@demo.vook.app')).status).toBe(200);
    await json(`/payroll-runs/${run.runId}/approve`, 'POST', { comment: 'Authorized' });
    await json(`/payroll-runs/${run.runId}/finalize`, 'POST', { comment: 'Finalized' });
    const published = await json(`/payroll-runs/${run.runId}/publish`, 'POST', { comment: 'Released to employees' });
    expect((await published.json()).data.status).toBe('PUBLISHED');
  });

  it('normalizes integration manifests and never persists provider secrets', async () => {
    expect((await login('superadmin@demo.vook.app')).status).toBe(200);
    const listed = (await (await fetch(endpoint('/integrations'))).json()).data;
    expect(listed).toHaveLength(3);
    expect(listed.every((provider: { publicFields?: unknown[]; secretFields?: unknown[] }) => Array.isArray(provider.publicFields) && Array.isArray(provider.secretFields))).toBe(true);

    const saved = await json('/integrations/PAYU', 'PUT', { publicConfig: { merchantKey: 'demo-merchant' }, secrets: { merchantSalt: 'never-store-this' }, reason: 'Configure sandbox provider' });
    expect((await saved.json()).data).toMatchObject({ providerKey: 'PAYU', secretConfigured: true, pendingConfiguration: true });
    expect((await json('/integrations/PAYU/test', 'POST')).status).toBe(200);
    const activated = await json('/integrations/PAYU/activate', 'POST', { reason: 'Sandbox validation passed' });
    expect((await activated.json()).data).toMatchObject({ status: 'ACTIVE', pendingConfiguration: false });

    const state = await getMockState();
    const stored = state.integrations.find((provider) => provider.providerKey === 'PAYU');
    expect(stored).not.toHaveProperty('secrets');
  });

  it('replays checkout idempotently and provisions the verified PayU tenant', async () => {
    const payload = { company: { name: 'Document Demo Labs', email: 'hello@document.demo' }, admin: { name: 'Demo Owner', email: 'owner@document.demo' }, plan: 'PRO', billingCycle: 'Annual', provider: 'PAYU', idempotencyKey: 'document-demo-annual' };
    const first = await json('/onboarding/checkout', 'POST', payload);
    const order = (await first.json()).data;
    const replay = await json('/onboarding/checkout', 'POST', payload);
    expect((await replay.json()).data).toMatchObject({ registrationId: order.registrationId, orderId: order.orderId, idempotentReplay: true });
    const verified = await json('/onboarding/verify-email', 'POST', { token: order.registrationId });
    expect(verified.status).toBe(200);
    expect((await login('owner@document.demo')).status).toBe(200);
    const state = await getMockState();
    const registration = state.registrations.find((item) => item.registrationId === order.registrationId)!;
    expect(registration.status).toBe('PROVISIONED');
    expect(state.subscriptions.some((item) => item.companyId === registration.companyId && item.planVersionId === registration.planVersionId)).toBe(true);
    expect(state.invoices.some((item) => item.companyId === registration.companyId)).toBe(true);
  });
});
