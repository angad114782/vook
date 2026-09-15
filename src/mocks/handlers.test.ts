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

  it('returns paginated notification inbox data and honors unread status', async () => {
    expect((await login('employee@demo.vook.app')).status).toBe(200);
    const unreadResponse = await fetch(endpoint('/notifications?status=unread&limit=1'));
    const unreadBody = (await unreadResponse.json()).data;
    expect(unreadResponse.status).toBe(200);
    expect(unreadBody.items).toHaveLength(1);
    expect(unreadBody.nextCursor).toBeNull();
    expect(unreadBody.unreadCount).toBe(1);

    expect((await json('/notifications/notification_2/read', 'PATCH')).status).toBe(200);
    const refreshedUnread = (await (await fetch(endpoint('/notifications?status=unread'))).json()).data;
    expect(refreshedUnread.items).toHaveLength(0);
    expect(refreshedUnread.unreadCount).toBe(0);
    const all = (await (await fetch(endpoint('/notifications?status=all'))).json()).data;
    expect(all.items[0]).toMatchObject({ id: 'notification_2', isRead: true });
  });

  it('prevents a user from marking another account’s notifications as read', async () => {
    expect((await login('companyadmin@demo.vook.app')).status).toBe(200);
    const ownAndForeign = await json('/notifications/read', 'PATCH', { ids: ['notification_1', 'notification_2'] });
    expect(ownAndForeign.status).toBe(404);
    expect((await json('/notifications/notification_2/read', 'PATCH')).status).toBe(404);
    const state = await getMockState();
    expect(state.notifications.find((item) => item.id === 'notification_1')?.isRead).toBe(false);
    expect(state.notifications.find((item) => item.id === 'notification_2')?.isRead).toBe(false);
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

  it('returns only directory-safe employee data to the Super Admin', async () => {
    expect((await login('superadmin@demo.vook.app')).status).toBe(200);
    const response = await fetch(endpoint('/employees?status=ACTIVE&search=northstar&page=1&limit=100'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.privacy).toContain('Salary, banking, documents and identity records are excluded');
    expect(body.data.companies[0]).toEqual(expect.objectContaining({ _id: expect.any(String), companyCode: expect.any(String) }));
    expect(body.data.employees.length).toBeGreaterThan(0);
    expect(body.data.employees.every((employee: Record<string, unknown>) => !('annualCtc' in employee) && !('bankName' in employee))).toBe(true);
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

  it('disables trials in saved plan drafts and keeps existing subscriptions pinned', async () => {
    expect((await login('superadmin@demo.vook.app')).status).toBe(200);
    const createdResponse = await json('/plans', 'POST', { name: 'Field Teams', type: 'FIELD', price: 4500, annualPrice: 45000, maxUsers: 80, moduleIds: ['module_attendance'], trialEnabled: true, defaultTrialDays: 7 });
    const created = (await createdResponse.json()).data;
    expect(created.status).toBe('DRAFT');
    expect(created.draft.trial).toEqual({ enabled: false, days: 0 });
    expect(created.moduleIds).toEqual(expect.arrayContaining(['module_dashboard', 'module_support', 'module_subscription', 'module_company_settings', 'module_roles', 'module_attendance']));

    const v1Response = await json(`/plans/${created.id}/publish`, 'POST', { draftRevision: created.draftRevision, reason: 'Initial commercial launch' });
    const v1 = (await v1Response.json()).data;
    expect(v1.version).toBe(1);
    expect(v1.trial).toEqual({ enabled: false, days: 0 });

    const before = await getMockState();
    const pinned = before.subscriptions.find((item) => item.companyId === 'company_orbit')!;
    const proPlan = before.plans.find((item) => item.id === 'plan_pro')!;
    const savedDraftResponse = await json(`/plans/${proPlan.id}`, 'PUT', { draftRevision: proPlan.draftRevision, maxUsers: 300, trialEnabled: true, defaultTrialDays: 14 });
    const savedDraft = (await savedDraftResponse.json()).data;
    expect(savedDraft.draft.trial).toEqual({ enabled: false, days: 0 });
    const v2 = (await (await json(`/plans/${proPlan.id}/publish`, 'POST', { draftRevision: savedDraft.draftRevision, reason: 'Update employee limit' })).json()).data;
    const after = await getMockState();
    expect(v2.trial).toEqual({ enabled: false, days: 0 });
    expect(after.subscriptions.find((item) => item.id === pinned.id)?.planVersionId).toBe(pinned.planVersionId);
    expect(after.companies.find((item) => item.id === 'company_orbit')?.plan).toBe('PRO');
  });

  it('rejects manual provisioning and payment changes while preserving support actions', async () => {
    expect((await login('superadmin@demo.vook.app')).status).toBe(200);
    const before = await getMockState();
    const companyCount = before.companies.length;
    const subscriptionCount = before.subscriptions.length;
    const paymentCount = before.payments.length;

    expect((await json('/companies', 'POST', { name: 'Manual Tenant', adminEmail: 'manual@example.test' })).status).toBe(405);
    expect((await json('/subscriptions', 'POST', { companyId: 'company_orbit', planVersionId: 'plan_pro_v1' })).status).toBe(405);
    for (const action of ['extend-trial', 'change-plan', 'migrate', 'reactivate', 'renew', 'retry-payment']) {
      expect((await json(`/subscriptions/${before.subscriptions[0].id}/${action}`, 'POST', {})).status).toBe(405);
    }
    expect((await json('/payments/offline', 'POST', { companyId: 'company_orbit', amount: 1000 })).status).toBe(405);
    expect((await json(`/payments/${before.payments[0].id}`, 'PATCH', { status: 'PAID' })).status).toBe(405);
    const onlinePayments = (await (await fetch(endpoint('/payments?source=RAZORPAY&status=PAID'))).json()).data.payments;
    expect(onlinePayments.length).toBeGreaterThan(0);
    expect(onlinePayments.every((payment: { source: string; status: string }) => payment.source === 'RAZORPAY' && payment.status === 'PAID')).toBe(true);
    expect((await json('/subscription/checkout', 'POST', { planVersionId: 'plan_pro_v1', billingCycle: 'Annual', provider: 'PAYU' })).status).toBe(422);
    expect((await json('/onboarding/trial', 'POST', { company: { name: 'Trial Tenant' }, admin: { name: 'Trial Owner', email: 'trial@example.test' }, plan: 'PRO' })).status).toBe(410);

    const failedSupportMutation = await json(`/subscriptions/${before.subscriptions[0].id}/suspend`, 'POST', { reason: 'Support hold' });
    expect(failedSupportMutation.status).toBe(200);
    const scheduledCancel = await json(`/subscriptions/${before.subscriptions[1].id}/cancel`, 'POST', { reason: 'Customer requested cancellation' });
    expect(scheduledCancel.status).toBe(200);
    expect((await scheduledCancel.json()).data).toMatchObject({ cancelAtPeriodEnd: true, status: before.subscriptions[1].status });

    const after = await getMockState();
    expect(after.companies).toHaveLength(companyCount);
    expect(after.subscriptions).toHaveLength(subscriptionCount);
    expect(after.payments).toHaveLength(paymentCount);
    expect(after.subscriptions.find((item) => item.id === before.subscriptions[0].id)?.status).toBe('SUSPENDED');
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
    expect(listed).toHaveLength(4);
    expect(listed.map((provider: { providerKey: string }) => provider.providerKey)).toContain('WHATSAPP');
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

  it('configures WhatsApp in platform integrations', async () => {
    expect((await login('superadmin@demo.vook.app')).status).toBe(200);
    const integrations = (await (await fetch(endpoint('/integrations'))).json()).data;
    const whatsapp = integrations.find((provider: { providerKey: string }) => provider.providerKey === 'WHATSAPP');
    expect(whatsapp.publicFields.map((field: { key: string }) => field.key)).toEqual(['phoneNumberId', 'businessAccountId']);
    expect(whatsapp.secretFields.map((field: { key: string }) => field.key)).toContain('accessToken');

    const savedWhatsApp = await json('/integrations/WHATSAPP', 'PUT', { publicConfig: { phoneNumberId: '123456789', businessAccountId: '987654321' }, secrets: { accessToken: 'demo-access-token' }, reason: 'Configure WhatsApp demo' });
    expect((await savedWhatsApp.json()).data).toMatchObject({ status: 'DRAFT', secretConfigured: true });
    expect((await json('/integrations/WHATSAPP/test', 'POST')).status).toBe(200);
    expect((await json('/integrations/WHATSAPP/activate', 'POST', { reason: 'Demo test passed' })).status).toBe(200);

    const state = await getMockState();
    const storedWhatsApp = state.integrations.find((provider) => provider.providerKey === 'WHATSAPP');
    expect(storedWhatsApp).not.toHaveProperty('secrets');
  });

  it('requires Razorpay checkout before provisioning a tenant', async () => {
    const payload = { company: { name: 'Document Demo Labs', email: 'hello@document.demo' }, admin: { name: 'Demo Owner', email: 'owner@document.demo' }, plan: 'PRO', billingCycle: 'Annual', provider: 'RAZORPAY' };
    expect((await json('/onboarding/checkout', 'POST', { ...payload, provider: 'PAYU' })).status).toBe(422);
    expect((await json('/onboarding/trial', 'POST', payload)).status).toBe(410);

    const failedResponse = await json('/onboarding/checkout', 'POST', { ...payload, admin: { ...payload.admin, email: 'failed@document.demo' }, simulateFailure: true });
    const failedOrder = (await failedResponse.json()).data;
    expect(failedOrder.status).toBe('FAILED');
    expect((await json('/onboarding/verify-email', 'POST', { token: failedOrder.registrationId })).status).toBe(409);

    const first = await json('/onboarding/checkout', 'POST', payload);
    const order = (await first.json()).data;
    expect(first.status).toBe(201);
    expect(order).toMatchObject({ provider: 'RAZORPAY', status: 'PAID' });
    const verified = await json('/onboarding/verify-email', 'POST', { token: order.registrationId });
    expect(verified.status).toBe(200);
    expect((await login('owner@document.demo')).status).toBe(200);
    const state = await getMockState();
    const registration = state.registrations.find((item) => item.registrationId === order.registrationId)!;
    expect(registration.status).toBe('PROVISIONED');
    expect(state.companies.find((item) => item.id === registration.companyId)?.status).toBe('ACTIVE');
    expect(state.subscriptions.some((item) => item.companyId === registration.companyId && item.planVersionId === registration.planVersionId)).toBe(true);
    expect(state.invoices.some((item) => item.companyId === registration.companyId)).toBe(true);
  });
});
