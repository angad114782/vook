import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, role: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: role, exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

async function api<T>(page: Page, path: string, method = 'GET', body?: unknown): Promise<{ status: number; data: T; disposition: string | null }> {
  return page.evaluate(async ({ path, method, body }) => {
    const response = await fetch(`/api/v2${path}`, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'mock-csrf-v2' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const contentType = response.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();
    return { status: response.status, data: payload.data ?? payload, disposition: response.headers.get('content-disposition') };
  }, { path, method, body });
}

test('Super Admin manages companies, plans, and payments', async ({ page }) => {
  await login(page, 'SUPER ADMIN');
  const company = await api<{ id: string }>(page, '/companies', 'POST', { name: 'Workflow Demo Ltd', adminName: 'Workflow Owner', adminEmail: 'owner@workflow.example', planVersionId: 'plan_basic_v1', acquisitionChannel: 'MANUAL_TRIAL', trialDays: 5 });
  expect(company.status).toBe(201);
  expect(company.data.id).toBeTruthy();
  const plan = await api<{ id: string; draftRevision: number }>(page, '/plans', 'POST', { name: 'Workflow Plan', type: 'PAID', price: 4999, maxUsers: 50, moduleIds: ['module_attendance', 'module_leave'] });
  expect(plan.status).toBe(201);
  const version = await api<{ id: string }>(page, `/plans/${plan.data.id}/publish`, 'POST', { draftRevision: plan.data.draftRevision, reason: 'E2E commercial approval' });
  expect(version.status).toBe(200);
  expect((await api(page, '/subscriptions', 'POST', { companyId: company.data.id, planVersionId: version.data.id, billingCycle: 'Monthly', months: 12, reason: 'E2E assignment' })).status).toBe(201);
  expect((await api(page, '/payments')).status).toBe(200);
});

test('Company Admin manages organization and workforce records', async ({ page }) => {
  await login(page, 'COMPANY ADMIN');
  const department = await api<{ id: string }>(page, '/departments', 'POST', { name: 'Workflow Operations', code: 'WFOPS' });
  expect(department.status).toBe(201);
  const employee = await api<{ id: string }>(page, '/employees', 'POST', { name: 'Workflow Employee', email: 'employee@workflow.example', department: 'Workflow Operations' });
  expect(employee.status).toBe(201);
  expect((await api(page, `/employees/${employee.data.id}`)).status).toBe(200);
  expect((await api(page, '/attendance-integrations', 'POST', { providerKey: 'BIOMETRIC_API', displayName: 'Workflow device' })).status).toBe(201);
});

test('hierarchy, Finance, and Company Admin complete approval workflows', async ({ page }) => {
  await login(page, 'SUPERVISOR');
  let leave = await api<{ status: string; approvalStage: string }>(page, '/leave-requests/leave_1/actions', 'POST', { action: 'APPROVE', comment: 'Recommended' });
  expect(leave.data).toMatchObject({ status: 'PENDING', approvalStage: 'MANAGER_APPROVAL' });
  await login(page, 'MANAGER');
  leave = await api<{ status: string; approvalStage: string }>(page, '/leave-requests/leave_1/actions', 'POST', { action: 'APPROVE', comment: 'Manager approved' });
  expect(leave.data.approvalStage).toBe('HR_COMPLETION');
  const managerExpense = await api<{ status: string }>(page, '/expenses/expense_1', 'PATCH', { status: 'APPROVED', comment: 'Within budget' });
  expect(managerExpense.data.status).toBe('MANAGER_APPROVED');

  await login(page, 'HR');
  leave = await api<{ status: string; approvalStage: string }>(page, '/leave-requests/leave_1/actions', 'POST', { action: 'APPROVE', comment: 'Recorded by HR' });
  expect(leave.data.status).toBe('APPROVED');

  await login(page, 'FINANCE');
  const expense = await api<{ status: string }>(page, '/expenses/expense_1', 'PATCH', { status: 'APPROVED', comment: 'Finance approved' });
  expect(expense.data.status).toBe('FINANCE_APPROVED');
  const payroll = await api<{ runId: string }>(page, '/payroll-runs', 'POST', { month: 12, year: 2030 });
  expect(payroll.status).toBe(201);
  await api(page, `/payroll-runs/${payroll.data.runId}/review`, 'POST', { comment: 'Finance review complete' });
  await login(page, 'COMPANY ADMIN');
  await api(page, `/payroll-runs/${payroll.data.runId}/approve`, 'POST', { comment: 'Authorized' });
  await api(page, `/payroll-runs/${payroll.data.runId}/finalize`, 'POST', { comment: 'Finalized' });
  expect((await api<{ status: string }>(page, `/payroll-runs/${payroll.data.runId}/publish`, 'POST', { comment: 'Published' })).data.status).toBe('PUBLISHED');
});

test('Employee creates leave, expense, support comment, and downloadable file', async ({ page }) => {
  await login(page, 'EMPLOYEE');
  expect((await api(page, '/leave-requests/mine', 'POST', { leaveType: 'Casual', startDate: '2026-09-20', endDate: '2026-09-20', reason: 'Workflow test' })).status).toBe(201);
  expect((await api(page, '/expenses/mine', 'POST', { category: 'Travel', amount: 1234, description: 'Workflow test' })).status).toBe(201);
  expect((await api(page, '/support-tickets/ticket_1/comments', 'POST', { body: 'Workflow comment', clientMessageId: 'workflow-comment-1' })).status).toBe(201);

  const upload = await page.evaluate(async () => {
    const form = new FormData();
    form.set('file', new File(['workflow receipt'], 'workflow.txt', { type: 'text/plain' }));
    const response = await fetch('/api/v2/files/receipts', { method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': 'mock-csrf-v2' }, body: form });
    return (await response.json()).data.fileUrl as string;
  });
  const download = await api<string>(page, upload);
  expect(download.data).toBe('workflow receipt');
  expect(download.disposition).toContain('attachment');
});

test('public PayU checkout is simulated and provisions after verification', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'SUPER ADMIN', exact: true })).toBeVisible();
  const payload = { company: { name: 'Workflow Registration', email: 'billing@workflow.example' }, admin: { name: 'Web Owner', email: 'web.owner@workflow.example' }, plan: 'PRO', provider: 'PAYU', idempotencyKey: 'e2e-payu' };
  const registration = await api<{ registrationId: string; orderId: string }>(page, '/onboarding/checkout', 'POST', payload);
  expect(registration.status).toBe(201);
  expect(registration.data.registrationId).toBeTruthy();
  expect(registration.data.orderId).toBeTruthy();
  const replay = await api<{ registrationId: string }>(page, '/onboarding/checkout', 'POST', payload);
  expect(replay.data.registrationId).toBe(registration.data.registrationId);
  expect((await api(page, '/onboarding/verify-email', 'POST', { token: registration.data.registrationId })).status).toBe(200);
});
