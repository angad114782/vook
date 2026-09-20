// @ts-nocheck -- The in-browser database intentionally models heterogeneous API resources.
import { delay, http, HttpResponse, type HttpResponseResolver } from 'msw';
import { getMockFile, getMockState, putMockFile, resetMockState, updateMockState } from './db';
import { demoAccounts, MOCK_PASSWORD, type MockState, type MockUser } from './seed';
import { accessSnapshot, appendAudit, effectiveEntitlements, effectivePermissions, enabledPermissionKeys, recordWithinScope, roleAssignmentView, subscriptionAccess, subscriptionFor } from './domain';

type Row = Record<string, any>;

const ok = (data: unknown, status = 200) => HttpResponse.json({ data }, { status });
const fail = (status: number, code: string, message: string, details?: unknown) => HttpResponse.json({ error: { code, message, details, requestId: `mock_${Date.now()}` } }, { status });
const page = (rows: Row[], url: URL) => {
  const pageNumber = Math.max(1, Number(url.searchParams.get('page') || 1));
  const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get('pageSize') || url.searchParams.get('limit') || 20)));
  const start = (pageNumber - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), pagination: { total: rows.length, page: pageNumber, limit: pageSize, pageSize, totalPages: Math.max(1, Math.ceil(rows.length / pageSize)) } };
};
const bodyOf = async (request: Request): Promise<Row> => {
  const type = request.headers.get('content-type') || '';
  if (type.includes('multipart/form-data')) {
    const form = await request.formData();
    return Object.fromEntries(form.entries());
  }
  try { return await request.json() as Row; } catch { return {}; }
};
const id = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const integrationDefinitions: Record<string, Row> = {
  RAZORPAY: {
    displayName: 'Razorpay', category: 'PAYMENTS', available: true,
    publicFields: [{ key: 'keyId', label: 'Key ID', required: true }, { key: 'environment', label: 'Environment', required: true }],
    secretFields: [{ key: 'keySecret', label: 'Key secret', required: true }, { key: 'webhookSecret', label: 'Webhook secret', required: true }],
  },
  PAYU: {
    displayName: 'PayU', category: 'PAYMENTS', available: true,
    publicFields: [{ key: 'merchantKey', label: 'Merchant key', required: true }, { key: 'environment', label: 'Environment', required: true }],
    secretFields: [{ key: 'merchantSalt', label: 'Merchant salt', required: true }],
  },
  SMTP: {
    displayName: 'Email delivery', category: 'MESSAGING', available: true,
    publicFields: [{ key: 'host', label: 'SMTP host', required: true }, { key: 'port', label: 'Port', required: true }, { key: 'fromAddress', label: 'From address', required: true }],
    secretFields: [{ key: 'username', label: 'Username', required: true }, { key: 'password', label: 'Password', required: true }],
  },
  WHATSAPP: {
    displayName: 'WhatsApp Cloud API', category: 'WHATSAPP', available: true,
    publicFields: [{ key: 'phoneNumberId', label: 'Phone Number ID', required: true }, { key: 'businessAccountId', label: 'WhatsApp Business Account ID', required: false }],
    secretFields: [{ key: 'accessToken', label: 'Permanent access token', required: true }],
  },
};

function integrationView(row: Row): Row {
  const providerKey = String(row.providerKey ?? row.key ?? 'CUSTOM').toUpperCase();
  const definition = integrationDefinitions[providerKey] ?? {
    displayName: row.name ?? providerKey, category: row.category ?? 'OTHER', available: false,
    publicFields: [], secretFields: [],
  };
  return {
    id: row.id ?? `integration_${providerKey.toLowerCase()}`,
    ...definition,
    ...row,
    providerKey,
    displayName: row.displayName ?? row.name ?? definition.displayName,
    publicFields: row.publicFields ?? definition.publicFields ?? [],
    secretFields: row.secretFields ?? definition.secretFields ?? [],
    publicConfig: row.publicConfig ?? {},
    secretConfigured: Boolean(row.secretConfigured),
    pendingConfiguration: Boolean(row.pendingConfiguration),
  };
}

function companyFor(state: MockState, user: MockUser | null, url: URL): Row | undefined {
  const requested = url.searchParams.get('companyId');
  const companyId = user?.role === 'SUPER_ADMIN' && requested ? requested : user?.companyId || requested || 'company_northstar';
  return state.companies.find((item) => item.id === companyId) as Row | undefined;
}
function employeeView(state: MockState, row: Row): Row {
  const user = row.user || state.users.find((item) => item.id === row.userId);
  return { ...row, user: user ? { id: user.id, name: user.name, email: user.email, role: user.role, accountStatus: user.isActive === false ? 'SUSPENDED' : 'ACTIVE', lastLoginAt: user.lastLoginAt } : row.user };
}
function platformEmployeeView(state: MockState, row: Row): Row {
  const view = employeeView(state, row);
  const user = view.user as Row | undefined;
  const company = (state.companies as Row[]).find((item) => item.id === row.companyId);
  return {
    id: row.id,
    employeeId: row.employeeId,
    name: user?.name ?? row.name,
    email: user?.email ?? row.email,
    mobile: row.mobile ?? row.phone ?? user?.mobile ?? user?.phone,
    companyId: company ? { id: company.id, _id: company.id, name: company.name, companyCode: company.companyCode } : undefined,
    department: row.department,
    designation: row.designation,
    employmentType: row.employmentType,
    status: row.status,
    joiningDate: row.joiningDate,
  };
}
function attendanceView(state: MockState, row: Row): Row {
  const employee = state.employees.find((item) => item.id === row.employeeId) as Row | undefined;
  return { ...row, employeeId: employee ? { id: employee.id, employeeId: employee.employeeId, department: employee.department, designation: employee.designation, userId: { name: (employee.user as Row)?.name } } : row.employeeId };
}
function leaveView(state: MockState, row: Row): Row {
  const employee = state.employees.find((item) => item.id === row.employeeId) as Row | undefined;
  return { ...row, employee: employee ? { id: employee.id, employeeId: employee.employeeId, department: employee.department, user: { name: (employee.user as Row)?.name, email: (employee.user as Row)?.email } } : undefined };
}
function payslipView(state: MockState, row: Row): Row {
  const employee = state.employees.find((item) => item.id === row.employeeId) as Row | undefined;
  return { ...row, employee: employee ? { id: employee.id, employeeId: employee.employeeId, user: { name: (employee.user as Row)?.name } } : undefined };
}
function expenseView(state: MockState, row: Row): Row {
  const employee = state.employees.find((item) => item.id === row.employeeId) as Row | undefined;
  return { ...row, employee: employee ? { id: employee.id, employeeId: employee.employeeId, user: { name: (employee.user as Row)?.name } } : undefined };
}
function provisionVerifiedRegistration(draft: MockState, registration: Row) {
  if (registration.companyId) return (draft.companies as Row[]).find((item) => item.id === registration.companyId);
  if (registration.acquisition !== 'ONLINE_PURCHASE' || registration.status !== 'PAID') throw new Error('A successful online checkout is required before provisioning.');
  const version = (draft.planVersions as Row[]).find((item) => item.id === registration.planVersionId);
  const plan = (draft.plans as Row[]).find((item) => item.id === version?.planId);
  if (!version || !plan) throw new Error('Published registration plan is missing.');
  const createdAt = new Date().toISOString();
  const companyId = id('company');
  const durationDays = registration.billingCycle === 'Annual' ? 365 : 30;
  const periodEnd = new Date(Date.now() + Math.max(1, durationDays) * 86_400_000).toISOString();
  const company = { id: companyId, companyCode: `WEB-${String(draft.companies.length + 1).padStart(3, '0')}`, name: registration.companyName, legalName: registration.companyName, displayName: registration.companyName, email: registration.companyEmail ?? registration.adminEmail, industry: null, phone: null, address: null, timezone: 'Asia/Kolkata', currency: 'INR', plan: plan.type, status: 'ACTIVE', maxUsers: version.limits.employees, userCount: 1, planExpiry: periodEnd, createdAt };
  draft.companies.unshift(company);
  const adminId = id('user');
  draft.users.unshift({ id: adminId, name: registration.adminName, email: registration.adminEmail, role: 'COMPANY_ADMIN', companyId, isActive: true, createdAt, lastLoginAt: null } as MockUser);
  const templates = (draft.roleDefinitions as Row[]).filter((item) => item.companyId === 'company_northstar' && item.kind !== 'CUSTOM');
  const clonedRoles = templates.map((template) => ({ ...structuredClone(template), id: `${template.key.toLowerCase()}_${companyId}`, companyId, revision: 1 }));
  draft.roleDefinitions.push(...clonedRoles);
  const adminRole = clonedRoles.find((item) => item.key === 'COMPANY_ADMIN');
  draft.roleAssignments.push({ id: id('assignment'), companyId, userId: adminId, roleDefinitionId: adminRole.id, scopeType: 'COMPANY', scopeId: companyId, isPrimary: true, createdAt });
  const subscriptionId = id('subscription');
  draft.subscriptions.push({ id: subscriptionId, companyId, planId: plan.id, planVersionId: version.id, plan: plan.type, billingCycle: registration.billingCycle ?? 'Monthly', amount: registration.billingCycle === 'Annual' ? version.pricing.annual : version.pricing.monthly, startDate: createdAt, endDate: periodEnd, trialEndsAt: null, currentPeriodEnd: periodEnd, status: 'ACTIVE', isActive: true });
  draft.onboardings.push({ companyId, status: 'NOT_STARTED', steps: ['company-profile', 'first-branch', 'organization', 'roles', 'shifts-holidays', 'attendance-policy', 'leave-policy', 'workflows', 'payroll', 'expenses', 'employees', 'invitations'].map((key) => ({ key, status: 'NOT_STARTED' })) });
  const invoice = { id: id('invoice'), companyId, subscriptionId, invoiceNumber: `INV-${new Date().getFullYear()}-${String(draft.invoices.length + 1).padStart(5, '0')}`, status: 'PAID', amount: registration.billingCycle === 'Annual' ? version.pricing.annual : version.pricing.monthly, currency: version.currency, issuedAt: createdAt, paidAt: createdAt };
  draft.invoices.unshift(invoice);
  const payment = (draft.payments as Row[]).find((item) => item.registrationId === registration.registrationId); if (payment) payment.companyId = companyId;
  Object.assign(registration, { companyId, adminUserId: adminId, status: 'PROVISIONED', emailVerified: true, verifiedAt: createdAt });
  appendAudit(draft, { actorId: adminId, companyId, action: 'ONLINE_COMPANY_PROVISIONED', entityType: 'COMPANY', entityId: companyId, newValue: { acquisition: registration.acquisition, planVersionId: version.id }, description: `${registration.companyName} provisioned after email verification` });
  return company;
}
const resolver: HttpResponseResolver = async ({ request }) => {
  const url = new URL(request.url);
  const marker = '/api/v2';
  const markerIndex = url.pathname.indexOf(marker);
  if (markerIndex < 0) return;
  await delay(60);
  const path = url.pathname.slice(markerIndex + marker.length) || '/';
  const method = request.method.toUpperCase();
  const state = await getMockState();
  const currentUser = state.users.find((item) => item.id === state.currentUserId) || null;

  if (path === '/demo/accounts' && method === 'GET') return ok({ accounts: demoAccounts });
  if (path === '/demo/reset' && method === 'POST') {
    await resetMockState();
    return ok({ resetAt: new Date().toISOString() });
  }

  if (path === '/auth/login' && method === 'POST') {
    const body = await bodyOf(request);
    const user = state.users.find((item) => item.email.toLowerCase() === String(body.email || '').toLowerCase());
    if (!user || body.password !== MOCK_PASSWORD) return fail(401, 'INVALID_CREDENTIALS', 'Use one of the displayed demo accounts and the demo password.');
    if (!user.isActive) return fail(403, 'ACCOUNT_SUSPENDED', 'This demo account is suspended.');
    await updateMockState((draft) => { draft.currentUserId = user.id; });
    const company = user.companyId ? state.companies.find((item) => item.id === user.companyId) as Row : null;
    return ok({ user: { ...user, company: company ? { id: company.id, name: company.name, companyCode: company.companyCode } : null }, csrfToken: state.csrfToken });
  }
  if (path === '/auth/session' && method === 'GET') {
    if (!currentUser) return fail(401, 'UNAUTHENTICATED', 'No active session.');
    const company = currentUser.companyId ? state.companies.find((item) => item.id === currentUser.companyId) as Row : null;
    return ok({ user: { ...currentUser, company: company ? { id: company.id, name: company.name, companyCode: company.companyCode } : null }, csrfToken: state.csrfToken });
  }
  if ((path === '/auth/logout' || path === '/auth/session') && ['POST', 'DELETE'].includes(method)) {
    await updateMockState((draft) => { draft.currentUserId = null; });
    return ok(null);
  }
  if (path === '/auth/refresh' && method === 'POST') return currentUser ? ok({ csrfToken: state.csrfToken }) : fail(401, 'UNAUTHENTICATED', 'Session expired.');
  if (path === '/auth/forgot-password' && method === 'POST') return ok({ message: 'If the account exists, a reset link has been generated for this demo.' });
  if (path === '/auth/reset-password' && method === 'POST') return ok({ message: 'Demo password reset completed.' });
  if (path === '/auth/accept-invitation' && method === 'POST') return ok({ message: 'Invitation accepted.' });
  if (path.startsWith('/auth/change-password') && method === 'POST') return ok({ message: 'Password changed for this demo session.' });
  if (path === '/auth/security/sessions' && method === 'GET') return ok({ sessions: [{ _id: 'session_current', device: 'Chrome on Windows', ip: '127.0.0.1', lastSeenAt: new Date().toISOString(), current: true }] });
  if (path.startsWith('/auth/security/') && ['POST', 'DELETE'].includes(method)) return ok({ message: 'Session access updated.' });
  if (path === '/auth/2fa/status' && method === 'GET') return ok({ enabled: !!currentUser?.twoFactorEnabled, enrollmentRequired: false });
  if (path === '/auth/2fa/setup' && method === 'POST') return ok({ secret: 'JBSWY3DPEHPK3PXP', otpauthUrl: 'otpauth://totp/Vook:demo', qrCodeDataUrl: '' });
  if (path === '/auth/2fa/verify' && method === 'POST') {
    if (currentUser) await updateMockState((draft) => { const user = draft.users.find((item) => item.id === currentUser.id); if (user) user.twoFactorEnabled = true; });
    return ok({ enabled: true });
  }
  if (path === '/auth/2fa/disable' && method === 'POST') {
    if (currentUser) await updateMockState((draft) => { const user = draft.users.find((item) => item.id === currentUser.id); if (user) user.twoFactorEnabled = false; });
    return ok({ enabled: false });
  }
  const publicRequest = path.startsWith('/onboarding') || (path === '/plans' && method === 'GET');
  if (!currentUser && !publicRequest) return fail(401, 'UNAUTHENTICATED', 'Sign in with a demo account.');
  if (currentUser) {
    const role = currentUser.role;
    const superAdminOnly = path === '/broadcasts' || path.startsWith('/broadcasts/') || path === '/settings/platform'
      || (path.startsWith('/companies') && path !== '/companies/options')
      || (path.startsWith('/subscriptions') && path !== '/subscription')
      || (path.startsWith('/payments') && path !== '/payments/mine' && role !== 'FINANCE')
      || (path.startsWith('/plans') && method !== 'GET')
      || path.startsWith('/entitlement-overrides')
      || path.startsWith('/integrations')
      || (path.startsWith('/module-catalog') && method !== 'GET');
    if (superAdminOnly && role !== 'SUPER_ADMIN') return fail(403, 'FORBIDDEN', 'This operation requires Super Admin access.');
    if (path.startsWith('/users') && !['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(role)) return fail(403, 'FORBIDDEN', 'User administration is not available for this role.');
    if ((path.startsWith('/role-definitions') || path.startsWith('/role-assignments') || path.startsWith('/role-permissions')) && role !== 'COMPANY_ADMIN') return fail(403, 'FORBIDDEN', 'Only the Company Admin can configure tenant roles and scopes.');
    if (path.startsWith('/employees') && role === 'EMPLOYEE') return fail(403, 'FORBIDDEN', 'Employee directory access is not available for this role.');
    if (role !== 'SUPER_ADMIN' && currentUser.companyId) {
      const moduleRules: Array<[RegExp, string]> = [
        [/^\/employees/, 'EMPLOYEE_MANAGEMENT'], [/^\/departments|^\/designations|^\/offices|^\/teams/, 'ORGANIZATION'],
        [/^\/attendance-verification-policy/, 'ATTENDANCE'], [/^\/attendance-integrations/, 'ATTENDANCE'], [/^\/attendance/, 'ATTENDANCE'], [/^\/shifts/, 'SHIFT_MANAGEMENT'], [/^\/leave-requests/, 'LEAVE_MANAGEMENT'],
        [/^\/approvals|^\/workflows/, 'APPROVALS'], [/^\/salaries|^\/payroll-runs/, 'PAYROLL'], [/^\/payslips/, 'PAYSLIPS'],
        [/^\/expenses/, 'EXPENSE_MANAGEMENT'], [/^\/documents|^\/files\/documents/, 'DOCUMENTS'], [/^\/reports/, 'REPORTS_ANALYTICS'],
      ];
      const rule = moduleRules.find(([pattern]) => pattern.test(path));
      if (rule) {
        const subscription = subscriptionAccess(state, currentUser.companyId);
        if (subscription?.readOnly) return fail(403, 'TENANT_INACTIVE', 'Operational access is locked until the subscription is restored.', { subscriptionState: subscription.state });
        const entitlement = effectiveEntitlements(state, currentUser.companyId);
        if (!entitlement.modules.some((item) => item.key === rule[1] && item.enabled)) return fail(403, 'ENTITLEMENT_REQUIRED', 'This module is not included in the company subscription.', { module: rule[1] });
        const userPermissions = effectivePermissions(state, currentUser);
        const action = method === 'GET' ? 'VIEW' : method === 'POST' ? 'CREATE' : 'EDIT';
        const domainAction = path.includes('/actions') || (/^\/(approvals|expenses)\/[^/]+$/.test(path) && method === 'PATCH') ? null : path.includes('/finalize') ? 'FINALIZE' : path === '/payroll-runs' && method === 'POST' ? 'PROCESS' : action;
        if (domainAction && !userPermissions.includes('*') && !userPermissions.includes(`${rule[1]}.${domainAction}`)) return fail(403, 'PERMISSION_DENIED', 'Your role does not grant this action.', { permission: `${rule[1]}.${domainAction}` });
      }
    }
  }

  if (path === '/access' && method === 'GET' && currentUser) return ok(accessSnapshot(state, currentUser));

  if (path === '/companies/options' && method === 'GET') return ok(state.companies.map((item) => ({ id: item.id, name: item.name, companyCode: item.companyCode })));
  if (path === '/companies' && method === 'GET') {
    const search = (url.searchParams.get('search') || '').toLowerCase();
    const status = url.searchParams.get('status');
    const rows = (state.companies as Row[]).filter((item) => (!search || String(item.name).toLowerCase().includes(search)) && (!status || status === 'ALL' || item.status === status));
    const result = page(rows, url);
    const stats = { total: state.companies.length, active: rows.filter((item) => item.status === 'ACTIVE').length, trial: rows.filter((item) => item.status === 'TRIAL').length, expiringSoon: rows.filter((item) => item.status === 'TRIAL').length };
    return ok({ companies: result.rows, pagination: result.pagination, stats });
  }
  if (path === '/companies' && method === 'POST') return fail(405, 'ONLINE_SIGNUP_REQUIRED', 'Companies are created through online signup after successful checkout.');
  const companyMatch = path.match(/^\/companies\/([^/]+)$/);
  if (companyMatch) {
    const found = state.companies.find((item) => item.id === companyMatch[1]) as Row | undefined;
    if (!found) return fail(404, 'NOT_FOUND', 'Company not found.');
    if (method === 'GET') return ok(found);
    if (['PUT', 'PATCH'].includes(method)) { const body = await bodyOf(request); const updated = await updateMockState((draft) => { const row = draft.companies.find((item) => item.id === companyMatch[1]) as Row; Object.assign(row, body); return row; }); return ok(updated); }
    if (method === 'DELETE') { await updateMockState((draft) => { draft.companies = draft.companies.filter((item) => item.id !== companyMatch[1]); }); return ok(null); }
  }

  if (path === '/company' && method === 'GET') return ok(companyFor(state, currentUser, url));
  if (path === '/company' && method === 'PATCH') { const body = await bodyOf(request); const company = companyFor(state, currentUser, url); const updated = await updateMockState((draft) => { const row = draft.companies.find((item) => item.id === company?.id) as Row; Object.assign(row, body); return row; }); return ok(updated); }
  if (path === '/dashboard' && method === 'GET') {
    const company = companyFor(state, currentUser, url); const employees = state.employees.filter((item) => item.companyId === company?.id) as Row[];
    const departments = state.departments.filter((item) => item.companyId === company?.id); const employeeIds = new Set(employees.map((item) => item.id));
    const deptBreakdown = departments.map((item) => ({ department: item.name, count: employees.filter((employee) => employee.department === item.name).length }));
    const roleDistribution = state.users.filter((item) => item.companyId === company?.id).reduce<Record<string, number>>((acc, user) => ({ ...acc, [user.role]: (acc[user.role] || 0) + 1 }), {});
    return ok({ stats: { totalEmployees: employees.length, activeEmployees: employees.filter((item) => item.status === 'ACTIVE').length, departments: departments.length, pendingLeaves: state.leaves.filter((item) => employeeIds.has(item.employeeId) && item.status === 'PENDING').length, pendingExpenses: state.expenses.filter((item) => employeeIds.has(item.employeeId) && ['PENDING', 'SUBMITTED', 'MANAGER_APPROVED'].includes(String(item.status))).length, payslipsProcessed: state.payslips.filter((item) => employeeIds.has(item.employeeId) && ['PROCESSED', 'PUBLISHED', 'PAID'].includes(String(item.status))).length, totalUsers: state.users.filter((item) => item.companyId === company?.id).length }, roleDistribution, deptBreakdown, onboarding: (state.onboardings as Row[]).find((item) => item.companyId === company?.id) ?? state.onboarding, subscription: subscriptionAccess(state, company?.id), limitUsage: { employees: employees.length, employeeLimit: effectiveEntitlements(state, company?.id).limits.employees } });
  }

  if (path === '/users' && method === 'GET') { const company = companyFor(state, currentUser, url); const rows = state.users.filter((item) => currentUser?.role === 'SUPER_ADMIN' ? true : item.companyId === company?.id).map((user) => ({ ...user, employee: state.employees.find((item) => item.userId === user.id) || null, accountStatus: user.isActive ? 'ACTIVE' : 'SUSPENDED' })); const result = page(rows, url); return ok({ users: result.rows, pagination: result.pagination }); }
  if (path === '/users' && method === 'POST') { const body = await bodyOf(request); if (!body.email || !body.name || !body.role) return fail(422, 'VALIDATION_ERROR', 'Name, email and role are required.'); const created = await updateMockState((draft) => { const user = { id: id('user'), name: body.name, email: body.email, role: body.role, companyId: currentUser?.companyId, isActive: true, createdAt: new Date().toISOString(), lastLoginAt: null } as MockUser; draft.users.unshift(user); return { ...user, employee: null, accountStatus: 'INVITED', invitationSent: true }; }); return ok(created, 201); }
  const userMatch = path.match(/^\/users\/([^/]+)$/);
  if (userMatch && ['PATCH', 'DELETE'].includes(method)) { if (method === 'DELETE') { await updateMockState((draft) => { draft.users = draft.users.filter((item) => item.id !== userMatch[1]); }); return ok(null); } const body = await bodyOf(request); const updated = await updateMockState((draft) => { const row = draft.users.find((item) => item.id === userMatch[1]); if (row) Object.assign(row, body); return row; }); return ok(updated); }
  if (/^\/users\/[^/]+\/revoke-sessions$/.test(path) && method === 'POST') return ok({ revoked: true });

  if (path === '/employees' && method === 'GET') { const company = companyFor(state, currentUser, url); const search = (url.searchParams.get('search') || '').toLowerCase(); const requestedCompany = url.searchParams.get('companyId'); const requestedStatus = url.searchParams.get('status'); const visibleRows = (state.employees as Row[]).filter((item) => { const user = (item.user as Row) ?? {}; const inScope = currentUser?.role === 'SUPER_ADMIN' ? (!requestedCompany || item.companyId === requestedCompany) : item.companyId === company?.id && recordWithinScope(state, currentUser, item, 'EMPLOYEE_MANAGEMENT.VIEW'); const matchesStatus = !requestedStatus || requestedStatus === 'ALL' || String(item.status).toUpperCase() === requestedStatus.toUpperCase(); const matchesSearch = !search || [user.name, user.email, item.employeeId, item.mobile, item.phone, item.department, item.designation].some((value) => String(value ?? '').toLowerCase().includes(search)); return inScope && matchesStatus && matchesSearch; }); const rows = visibleRows.map((item) => currentUser?.role === 'SUPER_ADMIN' ? platformEmployeeView(state, item) : employeeView(state, item)); const result = page(rows, url); return ok({ employees: result.rows, companies: state.companies.map((item) => ({ id: item.id, _id: item.id, name: item.name, companyCode: item.companyCode })), privacy: currentUser?.role === 'SUPER_ADMIN' ? 'Work contact and employment-directory fields only. Salary, banking, documents and identity records are excluded.' : 'ROLE_SCOPED', pagination: result.pagination, stats: { total: rows.length, active: rows.filter((item) => item.status === 'ACTIVE').length, inactive: rows.filter((item) => item.status !== 'ACTIVE').length, departments: new Set(rows.map((item) => item.department)).size } }); }
  if (path === '/employees' && method === 'POST') { const body = await bodyOf(request); if (!body.name && !(body.user as Row)?.name) return fail(422, 'VALIDATION_ERROR', 'Employee name is required.'); const company = companyFor(state, currentUser, url); const limit = Number(effectiveEntitlements(state, company?.id).limits.employees || 0); const count = (state.employees as Row[]).filter((item) => item.companyId === company?.id && item.status !== 'EXITED').length; if (limit && count >= limit) return fail(409, 'EMPLOYEE_LIMIT_REACHED', 'The employee limit for this subscription has been reached.', { limit, current: count }); const created = await updateMockState((draft) => { const name = body.name || (body.user as Row)?.name; const row = { id: id('employee'), employeeId: `NS-${String(draft.employees.length + 1).padStart(4, '0')}`, companyId: company?.id, branchId: body.branchId ?? null, departmentId: body.departmentId ?? null, department: body.department || null, designation: body.designation || null, employmentType: body.employmentType || 'Permanent', status: 'ONBOARDING', joiningDate: body.joiningDate || new Date().toISOString().slice(0, 10), annualCtc: body.annualCtc || null, version: 1, user: { id: null, name, email: body.email || '', role: 'EMPLOYEE', accountStatus: 'NOT_CREATED' }, ...body }; draft.employees.unshift(row); appendAudit(draft, { actorId: currentUser?.id, companyId: company?.id, action: 'EMPLOYEE_CREATED', entityType: 'EMPLOYEE', entityId: row.id, newValue: row }); return row; }); return ok(created, 201); }
  const employeeMatch = path.match(/^\/employees\/([^/]+)(?:\/(actions|account))?$/);
  if (employeeMatch) { const found = state.employees.find((item) => item.id === employeeMatch[1]) as Row | undefined; if (!found) return fail(404, 'NOT_FOUND', 'Employee not found.'); if (currentUser?.role !== 'SUPER_ADMIN' && !recordWithinScope(state, currentUser, found, method === 'GET' ? 'EMPLOYEE_MANAGEMENT.VIEW' : 'EMPLOYEE_MANAGEMENT.EDIT')) return fail(403, 'SCOPE_DENIED', 'This employee is outside your assigned organizational scope.'); if (method === 'GET') return ok(employeeView(state, found)); const body = await bodyOf(request); const updated = await updateMockState((draft) => { const row = draft.employees.find((item) => item.id === employeeMatch[1]) as Row; const before = structuredClone(row); if (employeeMatch[2] === 'actions') { const action = String(body.action || '').toUpperCase(); const transitions: Record<string, string> = { ACTIVATE: 'ACTIVE', DEACTIVATE: 'SUSPENDED', SUSPEND: 'SUSPENDED', RESIGN: 'RESIGNATION', START_NOTICE: 'NOTICE_PERIOD', EXIT: 'EXITED', TRANSFER: 'TRANSFER' }; row.status = transitions[action] ?? row.status; if (action === 'EXIT' && row.userId) { const user = draft.users.find((item) => item.id === row.userId); if (user) user.isActive = false; } } else if (employeeMatch[2] === 'account') (row.user as Row).accountStatus = 'INVITED'; else Object.assign(row, body); row.version = Number(row.version || 0) + 1; appendAudit(draft, { actorId: currentUser?.id, companyId: row.companyId, action: 'EMPLOYEE_UPDATED', entityType: 'EMPLOYEE', entityId: row.id, oldValue: before, newValue: row }); return employeeView(draft, row); }); return ok(updated); }
  if (path === '/employees/import' && method === 'POST') { const body = await bodyOf(request); return ok({ imported: Array.isArray(body.rows) ? body.rows.length : 0, failed: 0, errors: [] }); }
  if (path === '/departments/summary' && method === 'GET') return ok(state.departments.map((item) => ({ name: item.name, count: item.total })));
  if (path === '/departments' && method === 'GET') return ok(state.departments);
  if (path === '/departments' && method === 'POST') { const body = await bodyOf(request); const created = await updateMockState((draft) => { const row = { id: id('dept'), companyId: currentUser?.companyId, isActive: true, total: 0, active: 0, branchIds: [], ...body }; draft.departments.push(row); return row; }); return ok(created, 201); }
  const deptMatch = path.match(/^\/departments\/([^/]+)$/);
  if (deptMatch && method === 'PATCH') { const body = await bodyOf(request); const updated = await updateMockState((draft) => { const row = draft.departments.find((item) => item.id === deptMatch[1]) as Row; Object.assign(row, body); return row; }); return ok(updated); }
  if (path === '/designations' && method === 'GET') return ok(state.designations);
  if (path === '/designations' && method === 'POST') { const body = await bodyOf(request); const created = await updateMockState((draft) => { const row = { id: id('designation'), _id: id('designation'), companyId: currentUser?.companyId, isActive: true, branchIds: [], ...body }; draft.designations.push(row); return row; }); return ok(created, 201); }
  const designationMatch = path.match(/^\/designations\/([^/]+)$/); if (designationMatch && method === 'PATCH') { const body = await bodyOf(request); const updated = await updateMockState((draft) => { const row = draft.designations.find((item) => item.id === designationMatch[1] || item._id === designationMatch[1]) as Row; Object.assign(row, body); return row; }); return ok(updated); }
  if ((path === '/offices' || path === '/branches') && method === 'GET') { const company = companyFor(state, currentUser, url); return ok((state.offices as Row[]).filter((item) => item.companyId === company?.id)); }
  if (path === '/branches' && method === 'POST') { const body = await bodyOf(request); const company = companyFor(state, currentUser, url); const limit = Number(effectiveEntitlements(state, company?.id).limits.branches || 0); const count = (state.offices as Row[]).filter((item) => item.companyId === company?.id && item.isActive !== false).length; if (limit && count >= limit) return fail(409, 'BRANCH_LIMIT_REACHED', 'The branch limit for this subscription has been reached.', { limit, current: count }); if (!body.name || !body.code) return fail(422, 'VALIDATION_ERROR', 'Branch name and code are required.'); const created = await updateMockState((draft) => { const branch = { id: id('branch'), _id: id('branch'), companyId: company?.id, isActive: true, geofenceRadiusMeters: 250, ...body }; draft.offices.push(branch); appendAudit(draft, { actorId: currentUser?.id, companyId: company?.id, action: 'BRANCH_CREATED', entityType: 'BRANCH', entityId: branch.id, newValue: branch }); return branch; }); return ok(created, 201); }
  const branchMatch = path.match(/^\/branches\/([^/]+)$/); if (branchMatch && method === 'PATCH') { const found = (state.offices as Row[]).find((item) => item.id === branchMatch[1]); if (!found) return fail(404, 'NOT_FOUND', 'Branch not found.'); if (!recordWithinScope(state, currentUser, found, 'ORGANIZATION.EDIT')) return fail(403, 'SCOPE_DENIED', 'This branch is outside your scope.'); const body = await bodyOf(request); const updated = await updateMockState((draft) => { const branch = (draft.offices as Row[]).find((item) => item.id === found.id); const before = structuredClone(branch); Object.assign(branch, body); appendAudit(draft, { actorId: currentUser?.id, companyId: branch.companyId, action: 'BRANCH_UPDATED', entityType: 'BRANCH', entityId: branch.id, oldValue: before, newValue: branch }); return branch; }); return ok(updated); }
  if (path === '/teams' && method === 'GET') { const company = companyFor(state, currentUser, url); return ok((state.teams as Row[]).filter((item) => item.companyId === company?.id)); }
  if (path === '/teams' && method === 'POST') { const body = await bodyOf(request); const company = companyFor(state, currentUser, url); if (!body.name) return fail(422, 'VALIDATION_ERROR', 'Team name is required.'); const created = await updateMockState((draft) => { const team = { id: id('team'), companyId: company?.id, employeeIds: [], ...body }; draft.teams.push(team); appendAudit(draft, { actorId: currentUser?.id, companyId: company?.id, action: 'TEAM_CREATED', entityType: 'TEAM', entityId: team.id, newValue: team }); return team; }); return ok(created, 201); }
  const teamMatch = path.match(/^\/teams\/([^/]+)$/); if (teamMatch && method === 'PATCH') { const found = (state.teams as Row[]).find((item) => item.id === teamMatch[1]); if (!found) return fail(404, 'NOT_FOUND', 'Team not found.'); if (!recordWithinScope(state, currentUser, found, 'ORGANIZATION.EDIT')) return fail(403, 'SCOPE_DENIED', 'This team is outside your scope.'); const body = await bodyOf(request); const updated = await updateMockState((draft) => { const team = (draft.teams as Row[]).find((item) => item.id === found.id); const before = structuredClone(team); Object.assign(team, body); appendAudit(draft, { actorId: currentUser?.id, companyId: team.companyId, action: 'TEAM_UPDATED', entityType: 'TEAM', entityId: team.id, oldValue: before, newValue: team }); return team; }); return ok(updated); }
  if (path === '/reporting-lines' && method === 'GET') { const company = companyFor(state, currentUser, url); return ok((state.reportingLines as Row[]).filter((item) => item.companyId === company?.id)); }
  if (path === '/reporting-lines' && method === 'POST') { const body = await bodyOf(request); const company = companyFor(state, currentUser, url); if (!body.employeeId) return fail(422, 'VALIDATION_ERROR', 'Employee is required.'); if (!(state.employees as Row[]).some((item) => item.id === body.employeeId && item.companyId === company?.id)) return fail(403, 'SCOPE_DENIED', 'Employee must belong to this company.'); const created = await updateMockState((draft) => { const line = { id: id('reporting'), companyId: company?.id, effectiveFrom: new Date().toISOString().slice(0, 10), ...body }; draft.reportingLines.push(line); appendAudit(draft, { actorId: currentUser?.id, companyId: company?.id, action: 'REPORTING_LINE_CREATED', entityType: 'REPORTING_LINE', entityId: line.id, newValue: line }); return line; }); return ok(created, 201); }

  if (path === '/attendance/summary' || (path === '/attendance' && method === 'GET' && !url.searchParams.has('page') && !url.searchParams.has('limit'))) { const rows = state.attendance as Row[]; const employees = state.employees as Row[]; const present = rows.filter((item) => item.date === new Date().toISOString().slice(0, 10) && item.status !== 'Absent').length; return ok({ stats: { totalWorkforce: employees.length, perm: employees.filter((item) => item.employmentType === 'Permanent').length, cont: employees.filter((item) => item.employmentType === 'Contract').length, presentToday: present, presentPct: Math.round(present / employees.length * 100), absent: employees.length - present, absentPct: Math.round((employees.length - present) / employees.length * 100), lateArrivals: rows.filter((item) => item.status === 'Late').length, avgDelay: 18 }, departments: state.departments.map((dept) => ({ department: dept.name, total: dept.total, present: Math.max(0, Number(dept.active) - 1), percentage: 94 })) }); }
  if (path === '/attendance' && method === 'GET') { const result = page((state.attendance as Row[]).map((item) => attendanceView(state, item)), url); return ok({ records: result.rows, pagination: result.pagination }); }
  if (path === '/attendance' && method === 'POST') { const body = await bodyOf(request); const created = await updateMockState((draft) => { const row = { id: id('attendance'), companyId: currentUser?.companyId, source: 'MANUAL', ...body }; draft.attendance.unshift(row); return attendanceView(draft, row); }); return ok(created, 201); }
  if (path === '/attendance/mine' && method === 'GET') { const employee = state.employees.find((item) => item.userId === currentUser?.id) as Row | undefined; const records = (state.attendance as Row[]).filter((item) => item.employeeId === employee?.id).map((item) => ({ date: item.date, day: new Date(item.date).toLocaleDateString('en', { weekday: 'short' }), status: item.status, checkIn: item.checkIn || '--', checkOut: item.checkOut || '--', hours: item.checkOut ? '9h 06m' : '--', ot: item.checkOut ? '0h 06m' : '--' })); return ok({ records, stats: { present: records.filter((item) => item.status === 'Present').length, late: records.filter((item) => item.status === 'Late').length, absent: records.filter((item) => item.status === 'Absent').length, totalHours: records.filter((item) => item.checkOut !== '--').length * 9, workingDays: records.length } }); }
  if (path === '/attendance/mine/today' && method === 'GET') { const employee = state.employees.find((item) => item.userId === currentUser?.id) as Row | undefined; const record = state.attendance.find((item) => item.employeeId === employee?.id && item.date === new Date().toISOString().slice(0, 10)); return ok({ record: record || null }); }
  if ((path === '/attendance/mine/check-in' || path === '/attendance/mine/check-out') && method === 'POST') { const body = await bodyOf(request); const verification = (state.attendancePolicy as Row).verification ?? {}; if (verification.gpsRequired && (!Number.isFinite(Number(body.latitude)) || !Number.isFinite(Number(body.longitude)))) return fail(422, 'LOCATION_REQUIRED', 'Location access is required by the company attendance policy.'); if (body.simulateOutsideGeofence) return fail(403, 'OUTSIDE_GEOFENCE', 'The current location is outside the assigned branch geofence.'); const employee = state.employees.find((item) => item.userId === currentUser?.id) as Row | undefined; if (!employee) return fail(404, 'EMPLOYEE_PROFILE_REQUIRED', 'No employee profile is linked to this account.'); const updated = await updateMockState((draft) => { const occurredAt = new Date(); let row = draft.attendance.find((item) => item.employeeId === employee?.id && item.date === occurredAt.toISOString().slice(0, 10)) as Row | undefined; if (!row) { row = { id: id('attendance'), companyId: currentUser?.companyId, employeeId: employee?.id, branchId: employee.branchId, departmentId: employee.departmentId, date: occurredAt.toISOString().slice(0, 10), checkIn: null, checkOut: null, status: 'Present', source: 'WEB' }; draft.attendance.unshift(row); } const checkingIn = path.endsWith('check-in'); if (checkingIn && row.checkIn) return row; if (!checkingIn && !row.checkIn) return row; const time = occurredAt.toTimeString().slice(0, 5); if (checkingIn) { row.checkIn = time; const [hours, minutes] = time.split(':').map(Number); const [startHour, startMinute] = String((draft.attendancePolicy as Row).standardStart ?? '09:00').split(':').map(Number); row.status = hours * 60 + minutes > startHour * 60 + startMinute + Number((draft.attendancePolicy as Row).graceMinutes ?? 0) ? 'Late' : 'Present'; } else row.checkOut = time; draft.attendanceEvents.unshift({ id: id('attendance_event'), companyId: currentUser?.companyId, employeeId: employee.id, attendanceId: row.id, type: checkingIn ? 'CHECK_IN' : 'CHECK_OUT', occurredAt: occurredAt.toISOString(), source: 'WEB', location: { latitude: Number(body.latitude), longitude: Number(body.longitude), accuracyMeters: Number(body.accuracyMeters ?? 0) }, verification: { gps: 'VERIFIED', geofence: 'SIMULATED_INSIDE', device: verification.deviceRequired ? 'VERIFIED' : 'OPTIONAL', ip: verification.ipRequired ? 'VERIFIED' : 'OPTIONAL' } }); appendAudit(draft, { actorId: currentUser?.id, companyId: currentUser?.companyId, action: checkingIn ? 'ATTENDANCE_CHECK_IN' : 'ATTENDANCE_CHECK_OUT', entityType: 'ATTENDANCE', entityId: row.id, newValue: { time, source: 'WEB' } }); return row; }); if (!path.endsWith('check-in') && !updated.checkIn) return fail(409, 'CHECK_IN_REQUIRED', 'Check in before checking out.'); return ok({ message: path.endsWith('check-in') ? 'Checked in.' : 'Checked out.', record: updated }); }
  if (path === '/attendance-policy' && method === 'GET') return ok(state.attendancePolicy);
  if (path === '/attendance-policy' && method === 'PUT') { const body = await bodyOf(request); await updateMockState((draft) => { const before = structuredClone(draft.attendancePolicy); draft.attendancePolicy = { ...draft.attendancePolicy, ...body, verification: { ...(draft.attendancePolicy as Row).verification, ...(body.verification ?? {}) } }; appendAudit(draft, { actorId: currentUser?.id, companyId: currentUser?.companyId, action: 'ATTENDANCE_POLICY_UPDATED', entityType: 'ATTENDANCE_POLICY', entityId: currentUser?.companyId ?? 'company', oldValue: before, newValue: draft.attendancePolicy }); }); return ok({ ...state.attendancePolicy, ...body }); }

  if ((path === '/attendance-regularizations' || path === '/attendance-regularizations/mine') && method === 'GET') { const employee = (state.employees as Row[]).find((item) => item.userId === currentUser?.id); const rows = (state.attendanceRegularizations as Row[]).filter((item) => path.endsWith('/mine') ? item.employeeId === employee?.id : recordWithinScope(state, currentUser, item, 'ATTENDANCE.VIEW')); return ok({ regularizations: rows }); }
  if (path === '/attendance-regularizations/mine' && method === 'POST') { const body = await bodyOf(request); const employee = (state.employees as Row[]).find((item) => item.userId === currentUser?.id); if (!employee || !body.date || !body.reason || (!body.requestedCheckIn && !body.requestedCheckOut)) return fail(422, 'VALIDATION_ERROR', 'Date, reason, and a requested punch time are required.'); if ((state.attendanceRegularizations as Row[]).some((item) => item.employeeId === employee.id && item.date === body.date && item.status === 'PENDING')) return fail(409, 'REGULARIZATION_EXISTS', 'A pending regularization already exists for this date.'); const created = await updateMockState((draft) => { const requestRow = { id: id('regularization'), companyId: currentUser?.companyId, employeeId: employee.id, branchId: employee.branchId, departmentId: employee.departmentId, date: body.date, requestedCheckIn: body.requestedCheckIn ?? null, requestedCheckOut: body.requestedCheckOut ?? null, reason: body.reason, status: 'PENDING', approvalStage: 'SUPERVISOR_RECOMMENDATION', history: [], createdAt: new Date().toISOString() }; draft.attendanceRegularizations.unshift(requestRow); appendAudit(draft, { actorId: currentUser?.id, companyId: currentUser?.companyId, action: 'ATTENDANCE_REGULARIZATION_REQUESTED', entityType: 'ATTENDANCE_REGULARIZATION', entityId: requestRow.id, newValue: requestRow }); return requestRow; }); return ok(created, 201); }
  const regularizationAction = path.match(/^\/attendance-regularizations\/([^/]+)\/actions$/); if (regularizationAction && method === 'POST') { const body = await bodyOf(request); const found = (state.attendanceRegularizations as Row[]).find((item) => item.id === regularizationAction[1]); if (!found) return fail(404, 'NOT_FOUND', 'Attendance regularization not found.'); const expected: Record<string, string> = { SUPERVISOR_RECOMMENDATION: 'SUPERVISOR', MANAGER_APPROVAL: 'MANAGER', HR_COMPLETION: 'HR' }; const expectedRole = expected[found.approvalStage]; if (currentUser?.role !== expectedRole && currentUser?.role !== 'COMPANY_ADMIN') return fail(409, 'WORKFLOW_STAGE_MISMATCH', `This stage requires ${expectedRole}.`); if (!recordWithinScope(state, currentUser, found, 'ATTENDANCE.APPROVE') && currentUser?.role !== 'COMPANY_ADMIN') return fail(403, 'SCOPE_DENIED', 'This regularization is outside your scope.'); const decision = String(body.action).toUpperCase(); const updated = await updateMockState((draft) => { const item = (draft.attendanceRegularizations as Row[]).find((row) => row.id === found.id); const before = structuredClone(item); if (decision === 'REJECT') { item.status = 'REJECTED'; item.approvalStage = 'COMPLETED'; } else if (currentUser?.role === 'SUPERVISOR') item.approvalStage = 'MANAGER_APPROVAL'; else if (currentUser?.role === 'MANAGER') item.approvalStage = 'HR_COMPLETION'; else { item.status = 'APPROVED'; item.approvalStage = 'COMPLETED'; const attendance = (draft.attendance as Row[]).find((row) => row.employeeId === item.employeeId && row.date === item.date); if (attendance) { if (item.requestedCheckIn) attendance.checkIn = item.requestedCheckIn; if (item.requestedCheckOut) attendance.checkOut = item.requestedCheckOut; attendance.regularized = true; } } item.history.push({ actorId: currentUser?.id, role: currentUser?.role, action: decision, comment: body.comment ?? null, at: new Date().toISOString() }); appendAudit(draft, { actorId: currentUser?.id, companyId: item.companyId, action: `ATTENDANCE_REGULARIZATION_${decision}`, entityType: 'ATTENDANCE_REGULARIZATION', entityId: item.id, oldValue: before, newValue: item }); return item; }); return ok(updated); }
  if (path === '/leave-requests' && method === 'GET') { const rows = (state.leaves as Row[]).filter((item) => recordWithinScope(state, currentUser, item, 'LEAVE_MANAGEMENT.VIEW')).map((item) => leaveView(state, item)); const result = page(rows, url); return ok({ leaves: result.rows, pagination: result.pagination, stats: { total: rows.length, pending: rows.filter((item) => item.status === 'PENDING').length, approved: rows.filter((item) => item.status === 'APPROVED').length, rejected: rows.filter((item) => item.status === 'REJECTED').length } }); }
  if (path === '/leave-requests/mine' && method === 'GET') { const employee = state.employees.find((item) => item.userId === currentUser?.id) as Row | undefined; const leaves = state.leaves.filter((item) => item.employeeId === employee?.id); return ok({ leaves, stats: { pending: leaves.filter((item) => item.status === 'PENDING').length, approved: leaves.filter((item) => item.status === 'APPROVED').length }, balance: [{ type: 'Casual', total: 12, used: 3, remaining: 9 }, { type: 'Sick', total: 10, used: 2, remaining: 8 }, { type: 'Earned', total: 18, used: 5, remaining: 13 }] }); }
  if (path === '/leave-requests/mine' && method === 'POST') { const body = await bodyOf(request); const employee = state.employees.find((item) => item.userId === currentUser?.id) as Row | undefined; if (!body.startDate || !body.endDate || !body.leaveType) return fail(422, 'VALIDATION_ERROR', 'Leave type, start date, and end date are required.'); const days = Math.max(1, Math.floor((new Date(body.endDate).getTime() - new Date(body.startDate).getTime()) / 86_400_000) + 1); const created = await updateMockState((draft) => { const leave = { id: id('leave'), companyId: currentUser?.companyId, employeeId: employee?.id, days, status: 'PENDING', approvalStage: 'SUPERVISOR_RECOMMENDATION', version: 1, createdAt: new Date().toISOString(), ...body }; draft.leaves.unshift(leave); draft.approvals.unshift({ id: id('approval'), companyId: leave.companyId, employeeId: leave.employeeId, entityType: 'LEAVE', entityId: leave.id, type: 'Leave', details: `${leave.leaveType} leave · ${leave.days} days`, date: leave.startDate, priority: 'Medium', status: 'PENDING', currentStage: 'SUPERVISOR_RECOMMENDATION', history: [], createdAt: leave.createdAt }); appendAudit(draft, { actorId: currentUser?.id, companyId: currentUser?.companyId, action: 'LEAVE_REQUESTED', entityType: 'LEAVE_REQUEST', entityId: leave.id, newValue: leave }); return leave; }); return ok(created, 201); }
  const leaveMatch = path.match(/^\/leave-requests\/([^/]+)(?:\/actions)?$/); if (leaveMatch && ['PATCH', 'POST'].includes(method)) { const body = await bodyOf(request); const found = (state.leaves as Row[]).find((item) => item.id === leaveMatch[1]); if (!found) return fail(404, 'NOT_FOUND', 'Leave request not found.'); const stageRole: Record<string, string> = { SUPERVISOR_RECOMMENDATION: 'SUPERVISOR', MANAGER_APPROVAL: 'MANAGER', HR_COMPLETION: 'HR' }; const expectedRole = stageRole[found.approvalStage ?? 'SUPERVISOR_RECOMMENDATION']; if (currentUser?.role !== expectedRole && currentUser?.role !== 'COMPANY_ADMIN') return fail(409, 'WORKFLOW_STAGE_MISMATCH', `This stage requires ${expectedRole}.`, { currentStage: found.approvalStage, expectedRole }); if (!recordWithinScope(state, currentUser, found, 'LEAVE_MANAGEMENT.APPROVE') && !recordWithinScope(state, currentUser, found, 'LEAVE_MANAGEMENT.REJECT')) return fail(403, 'SCOPE_DENIED', 'This request is outside your approval scope.'); const decision = String(body.status || body.action || '').toUpperCase(); const needed = decision.includes('REJECT') ? 'REJECT' : 'APPROVE'; const userPermissions = effectivePermissions(state, currentUser); if (!userPermissions.includes('*') && !userPermissions.includes(`LEAVE_MANAGEMENT.${needed}`)) return fail(403, 'PERMISSION_DENIED', 'Your role does not grant this leave decision.'); const updated = await updateMockState((draft) => { const leave = (draft.leaves as Row[]).find((item) => item.id === leaveMatch[1]); const before = structuredClone(leave); const approval = (draft.approvals as Row[]).find((item) => item.entityId === leave.id); if (needed === 'REJECT') { leave.status = 'REJECTED'; leave.approvalStage = 'COMPLETED'; } else if (currentUser?.role === 'SUPERVISOR') { leave.status = 'PENDING'; leave.approvalStage = 'MANAGER_APPROVAL'; } else if (currentUser?.role === 'MANAGER') { leave.status = 'PENDING'; leave.approvalStage = 'HR_COMPLETION'; } else { leave.status = 'APPROVED'; leave.approvalStage = 'COMPLETED'; } leave.version = Number(leave.version || 0) + 1; if (approval) { approval.status = leave.status; approval.currentStage = leave.approvalStage; approval.history = [...(approval.history ?? []), { actorId: currentUser?.id, role: currentUser?.role, action: needed, comment: body.comment ?? null, at: new Date().toISOString() }]; } const employee = (draft.employees as Row[]).find((item) => item.id === leave.employeeId); if (employee?.userId) draft.notifications.unshift({ id: id('notification'), userId: employee.userId, type: 'LEAVE', title: `Leave ${leave.status.toLowerCase()}`, message: leave.approvalStage === 'COMPLETED' ? `Your leave request is ${leave.status.toLowerCase()}.` : `Your leave request moved to ${leave.approvalStage.replaceAll('_', ' ').toLowerCase()}.`, isRead: false, data: { leaveId: leave.id }, createdAt: new Date().toISOString() }); appendAudit(draft, { actorId: currentUser?.id, companyId: leave.companyId, action: `LEAVE_${needed}`, entityType: 'LEAVE_REQUEST', entityId: leave.id, oldValue: before, newValue: leave }); return leave; }); return ok(updated); }
  if (path === '/approvals' && method === 'GET') { const rows = (state.approvals as Row[]).filter((item) => recordWithinScope(state, currentUser, item, 'APPROVALS.VIEW')).map((item) => ({ ...item, employee: leaveView(state, { employeeId: item.employeeId }).employee })); const result = page(rows, url); return ok({ approvals: result.rows, pagination: result.pagination, stats: { pending: rows.filter((item) => item.status === 'PENDING').length, approvedToday: rows.filter((item) => item.status === 'APPROVED').length, rejected: rows.filter((item) => item.status === 'REJECTED').length, escalated: rows.filter((item) => item.escalatedAt).length } }); }
  const stagedApprovalMatch = path.match(/^\/approvals\/([^/]+)$/); if (stagedApprovalMatch && method === 'PATCH') { const body = await bodyOf(request); const found = (state.approvals as Row[]).find((item) => item.id === stagedApprovalMatch[1]); const decision = String(body.status ?? body.action).toUpperCase().includes('REJECT') ? 'REJECT' : 'APPROVE'; if (found?.entityType === 'LEAVE') { const leave = (state.leaves as Row[]).find((item) => item.id === found.entityId); const required: Record<string, string> = { SUPERVISOR_RECOMMENDATION: 'SUPERVISOR', MANAGER_APPROVAL: 'MANAGER', HR_COMPLETION: 'HR' }; const expectedRole = required[leave?.approvalStage ?? found.currentStage]; if (currentUser?.role !== expectedRole && currentUser?.role !== 'COMPANY_ADMIN') return fail(409, 'WORKFLOW_STAGE_MISMATCH', `This approval stage requires ${expectedRole}.`); if (!recordWithinScope(state, currentUser, leave, `APPROVALS.${decision}`)) return fail(403, 'SCOPE_DENIED', 'This approval is outside your organizational scope.'); const updated = await updateMockState((draft) => { const requestRow = (draft.leaves as Row[]).find((item) => item.id === found.entityId); const approval = (draft.approvals as Row[]).find((item) => item.id === found.id); const before = structuredClone(requestRow); if (decision === 'REJECT') { requestRow.status = 'REJECTED'; requestRow.approvalStage = 'COMPLETED'; } else if (currentUser?.role === 'SUPERVISOR') requestRow.approvalStage = 'MANAGER_APPROVAL'; else if (currentUser?.role === 'MANAGER') requestRow.approvalStage = 'HR_COMPLETION'; else { requestRow.status = 'APPROVED'; requestRow.approvalStage = 'COMPLETED'; } approval.status = requestRow.status; approval.currentStage = requestRow.approvalStage; approval.history = [...(approval.history ?? []), { actorId: currentUser?.id, role: currentUser?.role, action: decision, comment: body.comment ?? null, at: new Date().toISOString() }]; appendAudit(draft, { actorId: currentUser?.id, companyId: requestRow.companyId, action: `LEAVE_${decision}`, entityType: 'LEAVE_REQUEST', entityId: requestRow.id, oldValue: before, newValue: requestRow }); return approval; }); return ok(updated); } }
  const approvalMatch = path.match(/^\/approvals\/([^/]+)$/); if (approvalMatch && method === 'PATCH') { const body = await bodyOf(request); const found = (state.approvals as Row[]).find((item) => item.id === approvalMatch[1]); if (!found) return fail(404, 'NOT_FOUND', 'Approval not found.'); const action = String(body.status ?? body.action).toUpperCase().includes('REJECT') ? 'REJECT' : 'APPROVE'; const userPermissions = effectivePermissions(state, currentUser); if (!userPermissions.includes('*') && !userPermissions.includes(`APPROVALS.${action}`)) return fail(403, 'PERMISSION_DENIED', 'Your role does not grant this approval decision.'); if (!recordWithinScope(state, currentUser, found, `APPROVALS.${action}`)) return fail(403, 'SCOPE_DENIED', 'This approval is outside your scope.'); const updated = await updateMockState((draft) => { const approval = (draft.approvals as Row[]).find((item) => item.id === approvalMatch[1]); const before = structuredClone(approval); approval.status = action === 'REJECT' ? 'REJECTED' : 'APPROVED'; approval.history = [...(approval.history ?? []), { actorId: currentUser?.id, role: currentUser?.role, action, comment: body.comment ?? null, at: new Date().toISOString() }]; appendAudit(draft, { actorId: currentUser?.id, companyId: approval.companyId, action: `APPROVAL_${action}`, entityType: 'APPROVAL', entityId: approval.id, oldValue: before, newValue: approval }); return approval; }); return ok(updated); }

  if (path === '/salaries' && method === 'GET') { const rows = (state.salaries as Row[]).map((salary) => { const employee = state.employees.find((item) => item.id === salary.employeeId) as Row; return { ...salary, employeeId: employee.employeeId, name: (employee.user as Row).name, department: employee.department, designation: employee.designation, employmentType: employee.employmentType }; }); const result = page(rows, url); return ok({ results: result.rows, pagination: result.pagination }); }
  if (path === '/salaries' && method === 'POST') { const body = await bodyOf(request); if (!body.employeeId || !body.effectiveFrom || Number(body.annualCtc) < 0) return fail(422, 'VALIDATION_ERROR', 'Employee, annual CTC, and effective date are required.'); const activeVersion = (state.salaryHistory as Row[]).filter((item) => item.employeeId === body.employeeId && !item.effectiveTo).sort((a, b) => Number(b.version) - Number(a.version))[0]; if (activeVersion && new Date(activeVersion.effectiveFrom) >= new Date(body.effectiveFrom)) return fail(409, 'SALARY_EFFECTIVE_DATE_CONFLICT', 'Salary effective date must be after the active version.'); const saved = await updateMockState((draft) => { const existing = draft.salaries.find((item) => item.employeeId === body.employeeId) as Row | undefined; const before = existing ? structuredClone(existing) : null; const effectiveFrom = new Date(body.effectiveFrom); const previous = (draft.salaryHistory as Row[]).filter((item) => item.employeeId === body.employeeId && !item.effectiveTo).sort((a, b) => Number(b.version) - Number(a.version))[0]; if (previous) previous.effectiveTo = new Date(effectiveFrom.getTime() - 86_400_000).toISOString().slice(0, 10); const salary = existing ?? { id: id('salary'), employeeId: body.employeeId }; Object.assign(salary, body, { lastRevised: new Date().toISOString() }); if (!existing) draft.salaries.push(salary); const version = { ...structuredClone(salary), id: id('salary_version'), salaryId: salary.id, version: Number(previous?.version ?? 0) + 1, effectiveTo: null, createdAt: new Date().toISOString() }; draft.salaryHistory.push(version); appendAudit(draft, { actorId: currentUser?.id, companyId: currentUser?.companyId, action: 'SALARY_VERSION_CREATED', entityType: 'SALARY', entityId: salary.id, oldValue: before, newValue: version }); return salary; }); return ok(saved); }
  if ((path === '/payslips' || path === '/payslips/mine') && method === 'GET') { const employee = state.employees.find((item) => item.userId === currentUser?.id) as Row | undefined; const rows = (state.payslips as Row[]).filter((item) => path === '/payslips' || item.employeeId === employee?.id); if (path.endsWith('/mine')) return ok(rows); const result = page(rows.map((item) => payslipView(state, item)), url); return ok({ payslips: result.rows, pagination: result.pagination }); }
  const payslipDownload = path.match(/^\/payslips(?:\/mine)?\/([^/]+)\/download$/); if (payslipDownload && method === 'GET') return new HttpResponse(new Blob([`VOOK demo payslip ${payslipDownload[1]}\nThis is not a tax document.`], { type: 'application/pdf' }), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${payslipDownload[1]}.pdf"` } });
  const payslipAction = path.match(/^\/payslips\/([^/]+)\/(pay|recalculate)$/); if (payslipAction && method === 'POST') { const found = (state.payslips as Row[]).find((item) => item.id === payslipAction[1]); if (!found) return fail(404, 'NOT_FOUND', 'Payslip not found.'); if (payslipAction[2] === 'recalculate' && ['PUBLISHED', 'PAID'].includes(found.status)) return fail(409, 'PAYSLIP_IMMUTABLE', 'Published historical payslips cannot be recalculated.'); const updated = await updateMockState((draft) => { const payslip = (draft.payslips as Row[]).find((item) => item.id === payslipAction[1]); const before = structuredClone(payslip); if (payslipAction[2] === 'pay') { payslip.paymentStatus = 'PAID'; payslip.paidAt = new Date().toISOString(); } appendAudit(draft, { actorId: currentUser?.id, companyId: payslip.companyId, action: payslipAction[2] === 'pay' ? 'PAYSLIP_PAID' : 'PAYSLIP_RECALCULATED', entityType: 'PAYSLIP', entityId: payslip.id, oldValue: before, newValue: payslip }); return payslipView(draft, payslip); }); return ok(updated); }
  if (path === '/payroll-runs' && method === 'GET') { const company = companyFor(state, currentUser, url); return ok((state.payrollRuns as Row[]).filter((item) => item.companyId === company?.id)); }
  if (path === '/payroll-runs' && method === 'POST') { const body = await bodyOf(request); if (currentUser?.role !== 'FINANCE') return fail(403, 'PAYROLL_PREPARER_REQUIRED', 'Finance owns payroll preparation and calculation.'); if ((state.payrollRuns as Row[]).some((item) => item.companyId === currentUser?.companyId && item.month === Number(body.month) && item.year === Number(body.year) && item.status !== 'CANCELLED')) return fail(409, 'PAYROLL_PERIOD_EXISTS', 'A payroll run already exists for this period.'); const created = await updateMockState((draft) => { const payslips = (draft.payslips as Row[]).filter((item) => item.companyId === currentUser?.companyId && item.month === Number(body.month) && item.year === Number(body.year)); const run = { id: id('payroll_run'), companyId: currentUser?.companyId, month: Number(body.month), year: Number(body.year), status: 'CALCULATED', preparedBy: currentUser?.id, approvedBy: null, finalizedAt: null, publishedAt: null, payslipIds: payslips.map((item) => item.id), totalNetMinor: payslips.reduce((sum, item) => sum + Math.round(Number(item.netPay ?? 0) * 100), 0), currency: 'INR', createdAt: new Date().toISOString() }; draft.payrollRuns.unshift(run); appendAudit(draft, { actorId: currentUser?.id, companyId: currentUser?.companyId, action: 'PAYROLL_CALCULATED', entityType: 'PAYROLL_RUN', entityId: run.id, newValue: run }); return { message: 'Payroll calculated and ready for review.', period: `${body.month}/${body.year}`, month: body.month, year: body.year, created: state.employees.filter((item) => item.companyId === currentUser?.companyId).length, skipped: 0, runId: run.id, status: run.status }; }); return ok(created, 201); }
  const payrollAction = path.match(/^\/payroll-runs\/([^/]+)\/(review|approve|finalize|publish)$/); if (payrollAction && method === 'POST') { const run = (state.payrollRuns as Row[]).find((item) => item.id === payrollAction[1]); if (!run) return fail(404, 'NOT_FOUND', 'Payroll run not found.'); const transitions: Record<string, { from: string[]; to: string }> = { review: { from: ['CALCULATED'], to: 'UNDER_REVIEW' }, approve: { from: ['UNDER_REVIEW'], to: 'APPROVED' }, finalize: { from: ['APPROVED'], to: 'FINALIZED' }, publish: { from: ['FINALIZED'], to: 'PUBLISHED' } }; const transition = transitions[payrollAction[2]]; if (!transition.from.includes(run.status)) return fail(409, 'INVALID_PAYROLL_TRANSITION', `Payroll cannot move from ${run.status} to ${transition.to}.`); if (payrollAction[2] === 'review' && currentUser?.role !== 'FINANCE') return fail(403, 'PAYROLL_PREPARER_REQUIRED', 'Finance must review calculated payroll.'); if (['approve', 'finalize', 'publish'].includes(payrollAction[2]) && currentUser?.role !== 'COMPANY_ADMIN') return fail(403, 'PERMISSION_DENIED', 'Company Admin authorization is required for this payroll transition.'); const updated = await updateMockState((draft) => { const payroll = (draft.payrollRuns as Row[]).find((item) => item.id === run.id); const before = structuredClone(payroll); payroll.status = transition.to; if (payrollAction[2] === 'approve') payroll.approvedBy = currentUser?.id; if (payrollAction[2] === 'finalize') payroll.finalizedAt = new Date().toISOString(); if (payrollAction[2] === 'publish') { payroll.publishedAt = new Date().toISOString(); (draft.payslips as Row[]).filter((item) => payroll.payslipIds.includes(item.id)).forEach((item) => { item.status = 'PUBLISHED'; const employee = (draft.employees as Row[]).find((employeeRow) => employeeRow.id === item.employeeId); if (employee?.userId) draft.notifications.unshift({ id: id('notification'), userId: employee.userId, type: 'PAYROLL', title: 'Payslip published', message: `Your payslip for ${payroll.month}/${payroll.year} is available.`, isRead: false, data: { payslipId: item.id }, createdAt: new Date().toISOString() }); }); } appendAudit(draft, { actorId: currentUser?.id, companyId: payroll.companyId, action: `PAYROLL_${transition.to}`, entityType: 'PAYROLL_RUN', entityId: payroll.id, oldValue: before, newValue: payroll }); return payroll; }); return ok(updated); }

  if ((path === '/expenses' || path === '/expenses/mine') && method === 'GET') { const employee = state.employees.find((item) => item.userId === currentUser?.id) as Row | undefined; const rows = (state.expenses as Row[]).filter((item) => path === '/expenses' || item.employeeId === employee?.id); const stats = { pending: rows.filter((item) => item.status === 'PENDING').length, approved: rows.filter((item) => item.status === 'APPROVED').length, rejected: rows.filter((item) => item.status === 'REJECTED').length, total: rows.reduce((sum, item) => sum + Number(item.amount), 0) }; if (path.endsWith('/mine')) return ok({ expenses: rows, stats }); const result = page(rows.map((item) => expenseView(state, item)), url); return ok({ expenses: result.rows, pagination: result.pagination, stats }); }
  if (path === '/expenses/mine' && method === 'POST') { const body = await bodyOf(request); const employee = state.employees.find((item) => item.userId === currentUser?.id) as Row | undefined; if (!body.category || Number(body.amount) <= 0) return fail(422, 'VALIDATION_ERROR', 'Expense category and a positive amount are required.'); const created = await updateMockState((draft) => { const expense = { id: id('expense'), companyId: currentUser?.companyId, employeeId: employee?.id, status: 'SUBMITTED', approvalStage: 'MANAGER_APPROVAL', createdAt: new Date().toISOString(), ...body }; draft.expenses.unshift(expense); draft.approvals.unshift({ id: id('approval'), companyId: expense.companyId, employeeId: expense.employeeId, entityType: 'EXPENSE', entityId: expense.id, type: 'Expense', details: `${expense.category} · ₹${expense.amount}`, status: 'PENDING', currentStage: 'MANAGER_APPROVAL', history: [], createdAt: expense.createdAt }); appendAudit(draft, { actorId: currentUser?.id, companyId: currentUser?.companyId, action: 'EXPENSE_SUBMITTED', entityType: 'EXPENSE', entityId: expense.id, newValue: expense }); return expense; }); return ok(created, 201); }
  const expenseStageMatch = path.match(/^\/expenses\/([^/]+)$/); if (expenseStageMatch && method === 'PATCH') { const expense = (state.expenses as Row[]).find((item) => item.id === expenseStageMatch[1]); if (expense) { const expectedRole = expense.approvalStage === 'MANAGER_APPROVAL' || !expense.approvalStage ? 'MANAGER' : 'FINANCE'; if (currentUser?.role !== expectedRole && currentUser?.role !== 'COMPANY_ADMIN') return fail(409, 'WORKFLOW_STAGE_MISMATCH', `This expense stage requires ${expectedRole}.`, { currentStage: expense.approvalStage, expectedRole }); } }
  const expenseMatch = path.match(/^\/expenses\/([^/]+)$/); if (expenseMatch && method === 'PATCH') { const body = await bodyOf(request); const found = (state.expenses as Row[]).find((item) => item.id === expenseMatch[1]); if (!found) return fail(404, 'NOT_FOUND', 'Expense not found.'); const decision = String(body.status ?? body.action).toUpperCase(); const action = decision.includes('REJECT') ? 'REJECT' : 'APPROVE'; const perms = effectivePermissions(state, currentUser); if (!perms.includes('*') && !perms.includes(`EXPENSE_MANAGEMENT.${action}`) && decision !== 'PAID') return fail(403, 'PERMISSION_DENIED', 'Your role does not grant this expense decision.'); if (!recordWithinScope(state, currentUser, found, `EXPENSE_MANAGEMENT.${action}`)) return fail(403, 'SCOPE_DENIED', 'This expense is outside your scope.'); const updated = await updateMockState((draft) => { const expense = (draft.expenses as Row[]).find((item) => item.id === expenseMatch[1]); const before = structuredClone(expense); if (action === 'REJECT') { expense.status = 'REJECTED'; expense.approvalStage = 'COMPLETED'; } else if (currentUser?.role === 'MANAGER') { expense.status = 'MANAGER_APPROVED'; expense.approvalStage = 'FINANCE_APPROVAL'; } else if (decision === 'PAID') { expense.status = 'PAID'; expense.approvalStage = 'COMPLETED'; expense.paidAt = new Date().toISOString(); } else { expense.status = 'FINANCE_APPROVED'; expense.approvalStage = 'REIMBURSEMENT'; } const approval = (draft.approvals as Row[]).find((item) => item.entityId === expense.id); if (approval) { approval.status = expense.approvalStage === 'COMPLETED' ? expense.status : 'PENDING'; approval.currentStage = expense.approvalStage; approval.history = [...(approval.history ?? []), { actorId: currentUser?.id, role: currentUser?.role, action, comment: body.comment ?? null, at: new Date().toISOString() }]; } appendAudit(draft, { actorId: currentUser?.id, companyId: expense.companyId, action: `EXPENSE_${expense.status}`, entityType: 'EXPENSE', entityId: expense.id, oldValue: before, newValue: expense }); return expense; }); return ok(updated); }

  if ((path === '/documents' || path === '/documents/mine') && method === 'GET') { const result = page(state.documents as Row[], url); return ok({ documents: result.rows, pagination: result.pagination }); }
  if (path === '/files/documents' || path === '/files/receipts') { const body = await bodyOf(request); const file = Object.values(body).find((value) => value instanceof Blob) as Blob | undefined; const key = id('file'); if (file) await putMockFile(key, file); return ok({ fileUrl: `/files/${key}`, fileSize: file ? `${Math.ceil(file.size / 1024)} KB` : '0 KB', name: file instanceof File ? file.name : 'demo-file' }, 201); }
  if (path === '/documents' && method === 'POST') { const body = await bodyOf(request); const created = await updateMockState((draft) => { const row = { id: id('document'), companyId: currentUser?.companyId, createdAt: new Date().toISOString(), ...body }; draft.documents.unshift(row); return row; }); return ok(created, 201); }
  const documentMatch = path.match(/^\/documents\/([^/]+)$/); if (documentMatch && method === 'DELETE') { await updateMockState((draft) => { draft.documents = draft.documents.filter((item) => item.id !== documentMatch[1]); }); return ok(null); }
  const fileMatch = path.match(/^\/files\/([^/]+)$/); if (fileMatch && method === 'GET') { const stored = await getMockFile(fileMatch[1]); const content = stored || new Blob([`VOOK demo document ${fileMatch[1]}`], { type: 'application/pdf' }); return new HttpResponse(content, { headers: { 'Content-Type': content.type || 'application/octet-stream', 'Content-Disposition': `attachment; filename="${fileMatch[1]}.pdf"` } }); }

  if (path === '/plans' && method === 'GET') return ok(state.plans);
  if (path === '/module-catalog' && method === 'GET') return ok(state.modules);
  const planVersionMatch = path.match(/^\/plan-versions\/([^/]+)$/); if (planVersionMatch && method === 'GET') { const version = (state.planVersions as Row[]).find((item) => item.id === planVersionMatch[1]); return version ? ok(version) : fail(404, 'NOT_FOUND', 'Plan version not found.'); }
  if (path === '/plans' && method === 'POST') {
    const body = await bodyOf(request);
    if (!body.name || !body.type || Number(body.price) < 0 || Number(body.maxUsers) < 1) return fail(422, 'VALIDATION_ERROR', 'Name, code, valid pricing, and employee limit are required.');
    if ((state.plans as Row[]).some((item) => item.type === String(body.type).toUpperCase())) return fail(409, 'PLAN_CODE_IN_USE', 'Plan code must be unique.');
    const selectable = new Set((state.modules as Row[]).filter((item) => item.status === 'ACTIVE' && item.planSelectable).map((item) => item.id));
    const requested = (body.moduleIds ?? []) as string[];
    if (requested.some((moduleId) => !selectable.has(moduleId) && !(state.modules as Row[]).some((item) => item.id === moduleId && item.isCore))) return fail(422, 'INVALID_MODULE', 'One or more selected modules cannot be added to a plan.');
    const coreIds = (state.modules as Row[]).filter((item) => item.isCore).map((item) => item.id);
    const moduleIds = [...new Set([...coreIds, ...requested])];
    const created = await updateMockState((draft) => {
      const createdAt = new Date().toISOString();
      const planId = id('plan');
      const planDraft = { baseVersionId: null, name: body.name, pricing: { monthly: Number(body.price), annual: Number(body.annualPrice ?? Number(body.price) * 10) }, trial: { enabled: false, days: 0 }, moduleIds, limits: { employees: Number(body.maxUsers), branches: Number(body.maxBranches ?? 2), storageGB: Number(body.storageGB ?? 5), apiRequests: Number(body.apiRequests ?? 10000) }, features: body.features ?? [], revision: 1, updatedBy: currentUser?.id, updatedAt: createdAt };
      const plan = { id: planId, name: body.name, type: String(body.type).toUpperCase(), status: 'DRAFT', price: planDraft.pricing.monthly, annualPrice: planDraft.pricing.annual, maxUsers: planDraft.limits.employees, maxBranches: planDraft.limits.branches, storageGB: planDraft.limits.storageGB, apiRequests: planDraft.limits.apiRequests, trialEnabled: planDraft.trial.enabled, defaultTrialDays: planDraft.trial.days, moduleIds, features: planDraft.features, currentVersionId: null, draft: planDraft, draftRevision: 1, hasUnpublishedChanges: true, versionCount: 0, activeSubscriptionCount: 0, createdAt };
      draft.plans.push(plan);
      appendAudit(draft, { actorId: currentUser?.id, action: 'PLAN_DRAFT_CREATED', entityType: 'PLAN', entityId: planId, newValue: planDraft });
      return plan;
    });
    return ok(created, 201);
  }
  const planMatch = path.match(/^\/plans\/([^/]+)(?:\/(publish|discard-draft))?$/);
  if (planMatch) {
    const found = state.plans.find((item) => item.id === planMatch[1]) as Row | undefined;
    if (!found) return fail(404, 'NOT_FOUND', 'Plan not found.');
    if (method === 'GET') return ok({ plan: found, versions: (state.planVersions as Row[]).filter((item) => item.planId === found.id).sort((a, b) => b.version - a.version) });
    if (method === 'DELETE') {
      const activeCount = (state.subscriptions as Row[]).filter((item) => item.planId === found.id && !['CANCELLED'].includes(item.status)).length;
      if (activeCount > 0) return fail(409, 'PLAN_IN_USE', 'Plan has active or retained subscriptions.', { activeCount });
      await updateMockState((draft) => { draft.plans = draft.plans.filter((item) => item.id !== planMatch[1]); draft.planVersions = draft.planVersions.filter((item) => item.planId !== planMatch[1]); });
      return ok(null);
    }
    const body = await bodyOf(request);
    if (planMatch[2] === 'publish' && method === 'POST') {
      if (!found.draft) return fail(409, 'NO_DRAFT', 'There are no unpublished changes to publish.');
      if (Number(body.draftRevision) !== Number(found.draftRevision)) return fail(409, 'STALE_DRAFT', 'The plan draft changed. Reload before publishing.');
      const published = await updateMockState((draft) => {
        const plan = (draft.plans as Row[]).find((item) => item.id === found.id) as Row;
        const source = plan.draft as Row;
        const version = { id: id('plan_version'), planId: plan.id, version: (draft.planVersions as Row[]).filter((item) => item.planId === plan.id).length + 1, name: source.name, type: plan.type, currency: 'INR', pricing: source.pricing, trial: source.trial, moduleIds: source.moduleIds, limits: source.limits, features: source.features, publishedAt: new Date().toISOString(), publishedBy: currentUser?.id, reason: body.reason };
        draft.planVersions.push(version);
        Object.assign(plan, { name: source.name, price: source.pricing.monthly, annualPrice: source.pricing.annual, maxUsers: source.limits.employees, maxBranches: source.limits.branches, storageGB: source.limits.storageGB, apiRequests: source.limits.apiRequests, trialEnabled: source.trial.enabled, defaultTrialDays: source.trial.days, moduleIds: source.moduleIds, features: source.features, currentVersionId: version, draft: null, status: 'PUBLISHED', hasUnpublishedChanges: false, versionCount: version.version });
        appendAudit(draft, { actorId: currentUser?.id, action: 'PLAN_VERSION_PUBLISHED', entityType: 'PLAN_VERSION', entityId: version.id, newValue: version, description: `${plan.name} version ${version.version} published` });
        return version;
      });
      return ok(published);
    }
    if (planMatch[2] === 'discard-draft' && method === 'POST') {
      const updated = await updateMockState((draft) => {
        const plan = (draft.plans as Row[]).find((item) => item.id === found.id) as Row;
        plan.draft = null; plan.hasUnpublishedChanges = false; plan.draftRevision = Number(plan.draftRevision ?? 0) + 1;
        appendAudit(draft, { actorId: currentUser?.id, action: 'PLAN_DRAFT_DISCARDED', entityType: 'PLAN', entityId: plan.id, oldValue: found.draft, newValue: null, description: body.reason });
        return plan;
      });
      return ok(updated);
    }
    if (method === 'PUT') {
      if (Number(body.draftRevision) !== Number(found.draftRevision)) return fail(409, 'STALE_DRAFT', 'The plan draft changed. Reload before saving.');
      const selectable = new Set((state.modules as Row[]).filter((item) => item.status === 'ACTIVE' && (item.planSelectable || item.isCore)).map((item) => item.id));
      if ((body.moduleIds ?? found.moduleIds).some((moduleId: string) => !selectable.has(typeof moduleId === 'string' ? moduleId : moduleId.id))) return fail(422, 'INVALID_MODULE', 'One or more modules cannot be selected.');
      const updated = await updateMockState((draft) => {
        const plan = (draft.plans as Row[]).find((item) => item.id === found.id) as Row;
        const coreIds = (draft.modules as Row[]).filter((item) => item.isCore).map((item) => item.id);
        const moduleIds = [...new Set([...coreIds, ...(body.moduleIds ?? plan.moduleIds).map((item: string | Row) => typeof item === 'string' ? item : item.id)])];
        const revision = Number(plan.draftRevision ?? 0) + 1;
        const current = plan.draft ?? plan.currentVersionId ?? {};
        const draftRecord = { baseVersionId: plan.currentVersionId?.id ?? null, name: body.name ?? current.name ?? plan.name, pricing: { monthly: Number(body.price ?? current.pricing?.monthly ?? plan.price), annual: Number(body.annualPrice ?? current.pricing?.annual ?? plan.annualPrice) }, trial: { enabled: false, days: 0 }, moduleIds, limits: { employees: Number(body.maxUsers ?? current.limits?.employees ?? plan.maxUsers), branches: Number(body.maxBranches ?? current.limits?.branches ?? plan.maxBranches), storageGB: Number(body.storageGB ?? current.limits?.storageGB ?? plan.storageGB), apiRequests: Number(body.apiRequests ?? current.limits?.apiRequests ?? plan.apiRequests ?? 10000) }, features: body.features ?? current.features ?? plan.features, revision, updatedBy: currentUser?.id, updatedAt: new Date().toISOString() };
        Object.assign(plan, { name: draftRecord.name, price: draftRecord.pricing.monthly, annualPrice: draftRecord.pricing.annual, maxUsers: draftRecord.limits.employees, maxBranches: draftRecord.limits.branches, storageGB: draftRecord.limits.storageGB, apiRequests: draftRecord.limits.apiRequests, trialEnabled: draftRecord.trial.enabled, defaultTrialDays: draftRecord.trial.days, moduleIds, features: draftRecord.features, draft: draftRecord, draftRevision: revision, hasUnpublishedChanges: true });
        appendAudit(draft, { actorId: currentUser?.id, action: 'PLAN_DRAFT_UPDATED', entityType: 'PLAN', entityId: plan.id, oldValue: found.draft, newValue: draftRecord });
        return plan;
      });
      return ok(updated);
    }
  }
  if (path === '/subscriptions' && method === 'GET') {
    const search = (url.searchParams.get('search') ?? '').toLowerCase();
    const requestedPlan = url.searchParams.get('plan'); const requestedStatus = url.searchParams.get('status'); const requestedBilling = url.searchParams.get('billingCycle');
    const allRows = (state.subscriptions as Row[]).map((item) => ({ ...item, company: state.companies.find((company) => company.id === item.companyId), planVersion: (state.planVersions as Row[]).find((version) => version.id === item.planVersionId) }));
    const rows = allRows.filter((item) => (!search || String(item.company?.name).toLowerCase().includes(search)) && (!requestedPlan || requestedPlan === 'ALL' || item.plan === requestedPlan) && (!requestedStatus || requestedStatus === 'ALL' || item.status === requestedStatus) && (!requestedBilling || requestedBilling === 'ALL' || item.billingCycle === requestedBilling));
    const result = page(rows, url);
    return ok({ subscriptions: result.rows, pagination: result.pagination, stats: { monthlyRevenue: allRows.filter((item) => item.status === 'ACTIVE').reduce((sum, item) => sum + Number(item.billingCycle === 'Annual' ? item.amount / 10 : item.amount), 0), active: allRows.filter((item) => item.status === 'ACTIVE').length, trial: allRows.filter((item) => item.status === 'TRIAL').length, pastDue: allRows.filter((item) => item.status === 'PAST_DUE').length, suspended: allRows.filter((item) => item.status === 'SUSPENDED').length, expiringSoon: allRows.filter((item) => ['TRIAL', 'ACTIVE'].includes(item.status) && new Date(item.endDate).getTime() < Date.now() + 30 * 86_400_000).length } });
  }
  if (path === '/subscriptions' && method === 'POST') return fail(405, 'ONLINE_CHECKOUT_REQUIRED', 'Subscriptions are created and renewed only through online checkout.');
  const subscriptionAction = path.match(/^\/subscriptions\/([^/]+)\/(extend-trial|change-plan|migrate|suspend|reactivate|cancel|renew|retry-payment)$/);
  if (subscriptionAction && method === 'POST') {
    const action = subscriptionAction[2];
    if (!['suspend', 'cancel'].includes(action)) return fail(405, 'ONLINE_CHECKOUT_REQUIRED', 'Subscription access changes require customer checkout.');
    const body = await bodyOf(request); const existing = (state.subscriptions as Row[]).find((item) => item.id === subscriptionAction[1]);
    if (!existing) return fail(404, 'NOT_FOUND', 'Subscription not found.');
    const updated = await updateMockState((draft) => {
      const subscription = (draft.subscriptions as Row[]).find((item) => item.id === subscriptionAction[1]); const before = structuredClone(subscription);
      if (action === 'suspend') { subscription.status = 'SUSPENDED'; subscription.isActive = false; subscription.suspensionReason = body.reason; }
      if (action === 'cancel') { subscription.cancelAtPeriodEnd = true; subscription.cancellationReason = body.reason; }
      appendAudit(draft, { actorId: currentUser?.id, companyId: subscription.companyId, action: `SUBSCRIPTION_${action.replace('-', '_').toUpperCase()}`, entityType: 'SUBSCRIPTION', entityId: subscription.id, oldValue: before, newValue: subscription, description: body.reason });
      return subscription;
    });
    return ok(updated);
  }
  if (path === '/entitlement-overrides' && method === 'GET') { const companyId = url.searchParams.get('companyId'); return ok((state.entitlementOverrides as Row[]).filter((item) => !companyId || item.companyId === companyId)); }
  if (path === '/entitlement-overrides' && method === 'POST') { const body = await bodyOf(request); if (!body.companyId || !body.effect || !body.reason) return fail(422, 'VALIDATION_ERROR', 'Company, effect, and reason are required.'); if (!['GRANT', 'DENY', 'SET_LIMIT'].includes(body.effect)) return fail(422, 'VALIDATION_ERROR', 'Invalid override effect.'); if (body.effect === 'SET_LIMIT' && (!body.limitKey || !Number.isFinite(Number(body.limitValue)))) return fail(422, 'VALIDATION_ERROR', 'A limit key and numeric limit value are required.'); const module = body.moduleId ? (state.modules as Row[]).find((item) => item.id === body.moduleId) : null; if (body.effect === 'DENY' && module?.isCore) return fail(409, 'CORE_MODULE_REQUIRED', 'Core modules cannot be denied.'); const snapshot = effectiveEntitlements(state, body.companyId); const oldValue = body.limitKey ? snapshot.limits[body.limitKey] : snapshot.modules.find((item) => item.id === body.moduleId)?.isEnabled; const newValue = body.effect === 'SET_LIMIT' ? Number(body.limitValue) : body.effect === 'GRANT'; const created = await updateMockState((draft) => { const override = { id: id('override'), createdAt: new Date().toISOString(), createdBy: currentUser?.id, expiresAt: null, oldValue, newValue, ...body, limitValue: body.limitValue === undefined ? undefined : Number(body.limitValue) }; draft.entitlementOverrides.push(override); appendAudit(draft, { actorId: currentUser?.id, companyId: body.companyId, action: `ENTITLEMENT_${body.effect}`, entityType: 'ENTITLEMENT_OVERRIDE', entityId: override.id, oldValue, newValue: override, description: body.reason }); return override; }); return ok(created, 201); }
  const overrideMatch = path.match(/^\/entitlement-overrides\/([^/]+)$/); if (overrideMatch && method === 'DELETE') { const found = (state.entitlementOverrides as Row[]).find((item) => item.id === overrideMatch[1]); if (!found) return fail(404, 'NOT_FOUND', 'Entitlement override not found.'); await updateMockState((draft) => { draft.entitlementOverrides = draft.entitlementOverrides.filter((item) => item.id !== found.id); appendAudit(draft, { actorId: currentUser?.id, companyId: found.companyId, action: 'ENTITLEMENT_OVERRIDE_REVOKED', entityType: 'ENTITLEMENT_OVERRIDE', entityId: found.id, oldValue: found }); }); return ok(null); }
  if (path === '/reports/revenue-trend' && method === 'GET') return ok(['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'].map((month, index) => ({ month, revenue: 180000 + index * 22000 })));
  if (path === '/subscription' && method === 'GET') { const company = companyFor(state, currentUser, url); return ok({ subscription: subscriptionFor(state, company?.id), status: subscriptionAccess(state, company?.id), entitlements: effectiveEntitlements(state, company?.id) }); }
  if (path === '/subscription/checkout' && method === 'POST') {
    const body = await bodyOf(request);
    if (body.provider && body.provider !== 'RAZORPAY') return fail(422, 'UNSUPPORTED_PAYMENT_PROVIDER', 'Online subscription checkout currently accepts Razorpay only.');
    const company = companyFor(state, currentUser, url);
    const version = (state.planVersions as Row[]).find((item) => item.id === body.planVersionId);
    if (!version) return fail(422, 'PUBLISHED_PLAN_REQUIRED', 'Choose a valid published plan version.');
    const payment = await updateMockState((draft) => {
      const paymentId = id('payment');
      const orderId = id('order');
      const amount = body.billingCycle === 'Annual' ? version.pricing.annual : version.pricing.monthly;
      draft.payments.unshift({ id: paymentId, companyId: company?.id, amount, currency: version.currency, source: 'RAZORPAY', status: 'PAID', reference: orderId, createdAt: new Date().toISOString() });
      return { paymentId, orderId, amount, currency: version.currency, keyId: 'mock_provider_key', provider: 'RAZORPAY', message: 'Mock checkout completed successfully.' };
    });
    return ok(payment, 201);
  }
  if (path === '/entitlements' && method === 'GET') { const company = companyFor(state, currentUser, url); return ok(effectiveEntitlements(state, company?.id)); }

  if (path === '/modules' && method === 'GET') { const companyId = url.searchParams.get('companyId'); if (!companyId) return ok({ modules: state.modules.map((item) => ({ ...item, isEnabled: null, enabled: null })) }); return ok({ modules: effectiveEntitlements(state, companyId).modules }); }
  if (path === '/modules/companies' && method === 'GET') return ok(state.companies.map((item) => ({ id: item.id, name: item.name, plan: item.plan })));
  if (path === '/modules/permissions' && method === 'GET') return ok({ permissions: state.modules.flatMap((module) => (module.actions as string[]).map((action) => ({ module: module.key, permission: `${module.key}.${action}`, isGranted: true }))) });
  if (path === '/modules/toggle' && method === 'PUT') { const body = await bodyOf(request); const module = (state.modules as Row[]).find((item) => item.id === body.moduleId); const company = (state.companies as Row[]).find((item) => item.id === body.companyId); if (!module || !company) return fail(404, 'NOT_FOUND', 'Company or module not found.'); if (module.isCore && body.isEnabled === false) return fail(409, 'CORE_MODULE_REQUIRED', 'Core modules cannot be denied.'); if (!body.reason) return fail(422, 'VALIDATION_ERROR', 'A reason is required for a company entitlement override.'); const oldValue = effectiveEntitlements(state, body.companyId).modules.find((item) => item.id === body.moduleId)?.isEnabled; const saved = await updateMockState((draft) => { draft.entitlementOverrides = (draft.entitlementOverrides as Row[]).filter((item) => !(item.companyId === body.companyId && item.moduleId === body.moduleId)); const override = { id: id('override'), companyId: body.companyId, moduleId: body.moduleId, effect: body.isEnabled ? 'GRANT' : 'DENY', oldValue, newValue: Boolean(body.isEnabled), reason: body.reason, expiresAt: body.expiresAt ?? null, createdBy: currentUser?.id, createdAt: new Date().toISOString() }; draft.entitlementOverrides.push(override); appendAudit(draft, { actorId: currentUser?.id, companyId: body.companyId, action: `ENTITLEMENT_${override.effect}`, entityType: 'MODULE', entityId: body.moduleId, oldValue, newValue: override, description: body.reason }); return override; }); return ok(saved); }
  if (path === '/modules/permissions' && method === 'PUT') return ok({ updated: true, ...(await bodyOf(request)) });

  if (path === '/role-definitions' && method === 'GET') { const company = companyFor(state, currentUser, url); return ok((state.roleDefinitions as Row[]).filter((item) => item.companyId === company?.id)); }
  if (path === '/role-definitions' && method === 'POST') { const body = await bodyOf(request); const company = companyFor(state, currentUser, url); if (!company || !body.name) return fail(422, 'VALIDATION_ERROR', 'Role name is required.'); const duplicate = (state.roleDefinitions as Row[]).some((item) => item.companyId === company.id && String(item.name).toLowerCase() === String(body.name).toLowerCase()); if (duplicate) return fail(409, 'ROLE_NAME_IN_USE', 'A role with this name already exists.'); const requested = (body.permissions ?? []) as string[]; const allowed = enabledPermissionKeys(state, company.id); if (requested.some((permission) => !allowed.has(permission))) return fail(403, 'ENTITLEMENT_REQUIRED', 'Custom roles can only use actions from entitled modules.'); const created = await updateMockState((draft) => { const definition = { id: id('role'), companyId: company.id, key: String(body.key ?? body.name).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_'), name: body.name, description: body.description ?? '', kind: 'CUSTOM', locked: false, permissions: requested, revision: 1, createdAt: new Date().toISOString() }; draft.roleDefinitions.push(definition); appendAudit(draft, { actorId: currentUser?.id, companyId: company.id, action: 'ROLE_CREATED', entityType: 'ROLE_DEFINITION', entityId: definition.id, newValue: definition }); return definition; }); return ok(created, 201); }
  const roleDefinitionMatch = path.match(/^\/role-definitions\/([^/]+)(?:\/permissions)?$/);
  if (roleDefinitionMatch) { const definition = (state.roleDefinitions as Row[]).find((item) => item.id === roleDefinitionMatch[1]); if (!definition) return fail(404, 'NOT_FOUND', 'Role definition not found.'); if (definition.companyId !== currentUser?.companyId) return fail(403, 'SCOPE_DENIED', 'This role belongs to another company.'); if (method === 'PUT' || method === 'PATCH') { const body = await bodyOf(request); if (definition.locked) return fail(409, 'SYSTEM_ROLE_LOCKED', 'The Company Admin role cannot be changed.'); const requested = (body.permissions ?? definition.permissions) as string[]; const allowed = enabledPermissionKeys(state, definition.companyId); const previouslyStored = new Set(definition.permissions as string[]); if (requested.some((permission) => !allowed.has(permission) && !previouslyStored.has(permission))) return fail(403, 'ENTITLEMENT_REQUIRED', 'New permissions must belong to entitled modules; previously stored permissions remain dormant.'); const updated = await updateMockState((draft) => { const role = (draft.roleDefinitions as Row[]).find((item) => item.id === definition.id); const before = structuredClone(role); Object.assign(role, { ...(body.name ? { name: body.name } : {}), ...(body.description !== undefined ? { description: body.description } : {}), permissions: requested, revision: Number(role.revision ?? 0) + 1 }); appendAudit(draft, { actorId: currentUser?.id, companyId: role.companyId, action: 'ROLE_UPDATED', entityType: 'ROLE_DEFINITION', entityId: role.id, oldValue: before, newValue: role }); return role; }); return ok(updated); } if (method === 'DELETE') { if (definition.kind !== 'CUSTOM') return fail(409, 'TEMPLATE_ROLE_REQUIRED', 'Standard role templates cannot be deleted.'); const count = (state.roleAssignments as Row[]).filter((item) => item.roleDefinitionId === definition.id).length; if (count) return fail(409, 'ROLE_IN_USE', 'Remove role assignments before deleting this role.', { assignmentCount: count }); await updateMockState((draft) => { draft.roleDefinitions = draft.roleDefinitions.filter((item) => item.id !== definition.id); appendAudit(draft, { actorId: currentUser?.id, companyId: definition.companyId, action: 'ROLE_DELETED', entityType: 'ROLE_DEFINITION', entityId: definition.id, oldValue: definition }); }); return ok(null); } }

  if (path === '/role-permissions' && method === 'GET') { const company = companyFor(state, currentUser, url); const definitions = (state.roleDefinitions as Row[]).filter((item) => item.companyId === company?.id); return ok(definitions.flatMap((definition) => (definition.permissions as string[]).map((permission) => ({ roleId: definition.id, role: definition.key, module: permission.split('.')[0], permission, isGranted: true })))); }
  if (path === '/role-permissions' && method === 'PUT') { const body = await bodyOf(request); const company = companyFor(state, currentUser, url); const definition = (state.roleDefinitions as Row[]).find((item) => item.companyId === company?.id && (item.id === body.roleDefinitionId || item.key === body.role)); if (!definition) return fail(404, 'NOT_FOUND', 'Role definition not found.'); if (definition.locked) return fail(409, 'SYSTEM_ROLE_LOCKED', 'The Company Admin role cannot be changed.'); const requested = Array.isArray(body.permissions) ? body.permissions : Object.entries(body.permissions ?? {}).filter(([, granted]) => granted).map(([permission]) => permission); const allowed = enabledPermissionKeys(state, company.id); if (requested.some((permission: string) => !allowed.has(permission))) return fail(403, 'ENTITLEMENT_REQUIRED', 'Permissions must belong to entitled modules.'); const updated = await updateMockState((draft) => { const role = (draft.roleDefinitions as Row[]).find((item) => item.id === definition.id); const before = structuredClone(role); role.permissions = requested; role.revision = Number(role.revision ?? 0) + 1; appendAudit(draft, { actorId: currentUser?.id, companyId: company.id, action: 'ROLE_PERMISSION_UPDATED', entityType: 'ROLE_DEFINITION', entityId: role.id, oldValue: before, newValue: role }); return role; }); return ok(updated); }
  if (path === '/role-assignments' && method === 'GET') { const company = companyFor(state, currentUser, url); return ok((state.roleAssignments as Row[]).filter((item) => item.companyId === company?.id).map((item) => roleAssignmentView(state, item))); }
  if (path === '/role-assignments' && method === 'POST') { const body = await bodyOf(request); const company = companyFor(state, currentUser, url); const user = state.users.find((item) => item.id === body.userId); const definition = (state.roleDefinitions as Row[]).find((item) => item.id === body.roleDefinitionId || (item.companyId === company?.id && item.key === body.role)); if (!company || !user || user.companyId !== company.id || !definition || definition.companyId !== company.id) return fail(422, 'INVALID_ASSIGNMENT', 'Select a user and role from this company.'); if (['BRANCH', 'DEPARTMENT', 'TEAM'].includes(body.scopeType) && !body.scopeId) return fail(422, 'SCOPE_REQUIRED', 'Select a scope record.'); const collection = body.scopeType === 'BRANCH' ? state.offices : body.scopeType === 'DEPARTMENT' ? state.departments : body.scopeType === 'TEAM' ? state.teams : []; if (collection.length && body.scopeId && !(collection as Row[]).some((item) => item.id === body.scopeId && item.companyId === company.id)) return fail(403, 'SCOPE_DENIED', 'The selected scope does not belong to this company.'); if ((state.roleAssignments as Row[]).some((item) => item.userId === user.id && item.roleDefinitionId === definition.id && item.scopeType === body.scopeType && item.scopeId === (body.scopeId || (body.scopeType === 'COMPANY' ? company.id : null)))) return fail(409, 'ASSIGNMENT_EXISTS', 'This scoped role assignment already exists.'); const created = await updateMockState((draft) => { const assignment = { id: id('assignment'), companyId: company.id, userId: user.id, roleDefinitionId: definition.id, scopeType: body.scopeType ?? 'COMPANY', scopeId: body.scopeId || (body.scopeType === 'COMPANY' ? company.id : body.scopeType === 'SELF' ? (draft.employees as Row[]).find((item) => item.userId === user.id)?.id : null), isPrimary: false, createdAt: new Date().toISOString() }; draft.roleAssignments.push(assignment); appendAudit(draft, { actorId: currentUser?.id, companyId: company.id, action: 'ROLE_ASSIGNED', entityType: 'ROLE_ASSIGNMENT', entityId: assignment.id, newValue: assignment }); return roleAssignmentView(draft, assignment); }); return ok(created, 201); }
  const assignmentMatch = path.match(/^\/role-assignments\/([^/]+)$/); if (assignmentMatch && method === 'DELETE') { const assignment = (state.roleAssignments as Row[]).find((item) => item.id === assignmentMatch[1]); if (!assignment) return fail(404, 'NOT_FOUND', 'Role assignment not found.'); if (assignment.companyId !== currentUser?.companyId) return fail(403, 'SCOPE_DENIED', 'This assignment belongs to another company.'); if (assignment.isPrimary) return fail(409, 'PRIMARY_ASSIGNMENT_REQUIRED', 'Primary role assignments cannot be removed.'); await updateMockState((draft) => { draft.roleAssignments = draft.roleAssignments.filter((item) => item.id !== assignment.id); appendAudit(draft, { actorId: currentUser?.id, companyId: assignment.companyId, action: 'ROLE_UNASSIGNED', entityType: 'ROLE_ASSIGNMENT', entityId: assignment.id, oldValue: assignment }); }); return ok(null); }
  if (path === '/workflows' && method === 'GET') return ok(state.workflows);
  const workflowMatch = path.match(/^\/workflows\/([^/]+)$/); if (workflowMatch && method === 'PUT') { const body = await bodyOf(request); const saved = await updateMockState((draft) => { const existing = draft.workflows.find((item) => item.type === workflowMatch[1]) as Row; Object.assign(existing, body); return existing; }); return ok(saved); }

  const reportExportMatch = path.match(/^\/reports\/([^/]+)\/export$/); if (reportExportMatch && method === 'POST') { const visibleEmployees = (state.employees as Row[]).filter((item) => recordWithinScope(state, currentUser, item)); const csv = `report,scope,records\n${reportExportMatch[1]},${currentUser?.role},${visibleEmployees.length}\n`; return new HttpResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${reportExportMatch[1]}-report.csv"` } }); }
  if (path.startsWith('/reports/') && method === 'GET') { const type = path.split('/').pop(); const employees = (state.employees as Row[]).filter((item) => recordWithinScope(state, currentUser, item)); const employeeIds = new Set(employees.map((item) => item.id)); const attendance = (state.attendance as Row[]).filter((item) => employeeIds.has(item.employeeId)); const leaves = (state.leaves as Row[]).filter((item) => employeeIds.has(item.employeeId)); const payslips = (state.payslips as Row[]).filter((item) => employeeIds.has(item.employeeId)); if (type === 'workforce') return ok({ summary: { total: employees.length, active: employees.filter((item) => item.status === 'ACTIVE').length, inactive: employees.filter((item) => item.status !== 'ACTIVE').length }, byDepartment: [...new Set(employees.map((item) => item.department))].map((department) => ({ department, count: employees.filter((item) => item.department === department).length, active: employees.filter((item) => item.department === department && item.status === 'ACTIVE').length })), byEmploymentType: ['Permanent', 'Contract'].map((employmentType) => ({ type: employmentType, count: employees.filter((item) => item.employmentType === employmentType).length })), recentJoinees: employees.slice(0, 5).map((item) => ({ employeeId: item.employeeId, name: (item.user as Row).name, department: item.department, designation: item.designation, joiningDate: item.joiningDate, status: item.status })) }); if (type === 'leave') return ok({ total: leaves.length, byStatus: ['PENDING', 'APPROVED', 'REJECTED'].map((status) => ({ status, count: leaves.filter((item) => item.status === status).length })), byType: ['Casual', 'Sick', 'Earned'].map((leaveType) => ({ type: leaveType, count: leaves.filter((item) => item.leaveType === leaveType).length })) }); if (type === 'payroll') return ok({ summary: { totalNet: payslips.reduce((sum, item) => sum + Number(item.netPay), 0), totalGross: payslips.reduce((sum, item) => sum + Number(item.grossSalary), 0), totalDeductions: payslips.reduce((sum, item) => sum + Number(item.totalDeductions), 0), count: payslips.length }, byMonth: [{ label: 'Sep', net: payslips.reduce((sum, item) => sum + Number(item.netPay), 0), count: payslips.length }], recent: payslips.slice(0, 5).map((item) => ({ id: item.id, employeeName: (payslipView(state, item).employee as Row)?.user.name, month: item.month, year: item.year, netSalary: item.netPay, status: item.status })) }); if (type === 'attendance') return ok({ period: { year: new Date().getFullYear(), month: new Date().getMonth() + 1 }, totalRecords: attendance.length, totalEmployees: employees.length, byStatus: { Present: attendance.filter((item) => item.status === 'Present').length, Late: attendance.filter((item) => item.status === 'Late').length, Absent: attendance.filter((item) => item.status === 'Absent').length, Leave: 0, Holiday: 0 } }); }

  if (path === '/notifications' && method === 'GET') {
    const ownedRows = state.notifications.filter((item) => item.userId === currentUser?.id);
    const unreadCount = ownedRows.filter((item) => !item.isRead && !item.readAt).length;
    const status = url.searchParams.get('status');
    const rows = status === 'unread' ? ownedRows.filter((item) => !item.isRead && !item.readAt) : ownedRows;
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 50)));
    const requestedCursor = Number(url.searchParams.get('cursor') || 0);
    const start = Number.isFinite(requestedCursor) && requestedCursor > 0 ? Math.floor(requestedCursor) : 0;
    const pageRows = rows.slice(start, start + limit);
    const nextCursor = start + pageRows.length < rows.length ? String(start + pageRows.length) : null;
    return ok({
      items: pageRows,
      notifications: pageRows,
      nextCursor,
      unreadCount,
      unread: unreadCount,
      pagination: { total: rows.length, page: Math.floor(start / limit) + 1, limit, totalPages: Math.max(1, Math.ceil(rows.length / limit)) },
    });
  }
  if (path === '/notifications/read' && method === 'PATCH') {
    const body = await bodyOf(request);
    if (!Array.isArray(body.ids) || !body.ids.length || body.ids.some((value: unknown) => typeof value !== 'string')) return fail(422, 'VALIDATION_ERROR', 'At least one valid notification id is required.');
    const ids = [...new Set(body.ids as string[])];
    const ownedIds = new Set(state.notifications.filter((item) => item.userId === currentUser?.id).map((item) => item.id));
    if (ids.some((notificationId) => !ownedIds.has(notificationId))) return fail(404, 'NOT_FOUND', 'Notification not found.');
    await updateMockState((draft) => { draft.notifications.forEach((item: Row) => { if (ids.includes(item.id) && item.userId === currentUser?.id) item.isRead = true; }); });
    return ok(null);
  }
  if (path === '/notifications/read-all' && method === 'PATCH') { await updateMockState((draft) => { draft.notifications.forEach((item: Row) => { if (item.userId === currentUser?.id) item.isRead = true; }); }); return ok(null); }
  const notificationRead = path.match(/^\/notifications\/([^/]+)\/read$/); if (notificationRead && method === 'PATCH') { const row = state.notifications.find((item) => item.id === notificationRead[1]); if (!row || row.userId !== currentUser?.id) return fail(404, 'NOT_FOUND', 'Notification not found.'); await updateMockState((draft) => { const ownedRow = draft.notifications.find((item) => item.id === notificationRead[1] && item.userId === currentUser?.id) as Row | undefined; if (ownedRow) ownedRow.isRead = true; }); return ok(null); }
  if (path === '/notifications/preferences' && method === 'GET') return ok({ preferences: { email: true, inApp: true, payroll: true, leave: true, support: true } });
  if (path === '/notifications/preferences' && method === 'PUT') return ok(await bodyOf(request));

  if (path === '/support-tickets' && method === 'GET') { const visible = currentUser?.role === 'SUPER_ADMIN' ? state.tickets : state.tickets.filter((item) => item.companyId === currentUser?.companyId); const rows = (visible as Row[]).map((item) => ({ ...item, user: state.users.find((user) => user.id === item.userId), company: state.companies.find((company) => company.id === item.companyId) })); const result = page(rows, url); return ok({ tickets: result.rows, pagination: result.pagination, stats: { total: rows.length, open: rows.filter((item) => item.status === 'PENDING').length, inProgress: rows.filter((item) => item.status === 'IN_PROGRESS').length, resolved: rows.filter((item) => item.status === 'RESOLVED').length } }); }
  if (path === '/support-tickets' && method === 'POST') { const body = await bodyOf(request); const created = await updateMockState((draft) => { const row = { id: id('ticket'), ticketNo: `SUP-${1040 + draft.tickets.length}`, companyId: body.companyId || currentUser?.companyId, userId: currentUser?.id, status: 'PENDING', priority: 'MEDIUM', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...body }; draft.tickets.unshift(row); return row; }); return ok(created, 201); }
  const ticketMatch = path.match(/^\/support-tickets\/([^/]+)(?:\/comments)?$/); if (ticketMatch) { const ticket = state.tickets.find((item) => item.id === ticketMatch[1]) as Row | undefined; if (!ticket) return fail(404, 'NOT_FOUND', 'Support ticket not found.'); if (path.endsWith('/comments') && method === 'GET') { const comments = state.comments.filter((item) => item.ticketId === ticketMatch[1]).sort((left, right) => new Date(String(left.createdAt)).getTime() - new Date(String(right.createdAt)).getTime()); return ok({ comments, hasMore: false, nextCursor: null, readCursors: [] }); } if (path.endsWith('/comments') && method === 'POST') { const body = await bodyOf(request); const comment = await updateMockState((draft) => { const row = { id: id('comment'), ticketId: ticketMatch[1], body: body.body, clientMessageId: body.clientMessageId, isInternal: false, createdAt: new Date().toISOString(), authorId: { id: currentUser?.id, name: currentUser?.name, role: currentUser?.role } }; draft.comments.push(row); return row; }); return ok(comment, 201); } if (method === 'GET') return ok({ ...ticket, user: state.users.find((user) => user.id === ticket.userId), company: state.companies.find((company) => company.id === ticket.companyId) }); if (method === 'PATCH') { const body = await bodyOf(request); const updated = await updateMockState((draft) => { const row = draft.tickets.find((item) => item.id === ticketMatch[1]) as Row; Object.assign(row, body, { updatedAt: new Date().toISOString() }); return row; }); return ok(updated); } }

  if (path === '/activity-events' && method === 'GET') { const rows = (state.activity as Row[]).map((item) => ({ ...item, user: state.users.find((user) => user.id === item.userId) || null })); const result = page(rows, url); return ok({ logs: result.rows, activity: result.rows, pagination: result.pagination, stats: { total: rows.length, success: rows.filter((item) => item.status === 'SUCCESS').length, failed: rows.filter((item) => item.status === 'FAILED').length } }); }
  if (path === '/audit-events' && method === 'GET') { const visible = currentUser?.role === 'SUPER_ADMIN' ? state.audit : (state.audit as Row[]).filter((item) => item.companyId === currentUser?.companyId); const result = page(visible as Row[], url); return ok({ logs: result.rows, pagination: result.pagination }); }
  if (path === '/search' && method === 'GET') { const query = (url.searchParams.get('q') || '').toLowerCase(); return ok({ query, companies: (state.companies as Row[]).filter((item) => String(item.name).toLowerCase().includes(query)).slice(0, 5).map((item) => ({ id: item.id, title: item.name, subtitle: item.companyCode, path: `/companies` })), employees: (state.employees as Row[]).filter((item) => String((item.user as Row).name).toLowerCase().includes(query)).slice(0, 5).map((item) => ({ id: item.id, title: (item.user as Row).name, subtitle: item.employeeId, path: `/hr/employees` })), tickets: [], documents: [] }); }

  if (path === '/payments' && method === 'GET') { const source = url.searchParams.get('source'); const status = url.searchParams.get('status'); const rows = (state.payments as Row[]).filter((item) => (!source || source === 'ALL' || item.source === source) && (!status || status === 'ALL' || item.status === status)).map((item) => ({ ...item, company: state.companies.find((company) => company.id === item.companyId) })); const result = page(rows, url); return ok({ payments: result.rows, pagination: result.pagination }); }
  if (path === '/payments/mine' && method === 'GET') return ok(state.payments.filter((item) => item.companyId === currentUser?.companyId));
  if (path === '/payments/offline' && method === 'POST') return fail(405, 'ONLINE_PAYMENT_REQUIRED', 'Payments must be collected through online checkout.');
  if (path === '/invoices' && method === 'GET') { const rows = currentUser?.role === 'SUPER_ADMIN' ? state.invoices : (state.invoices as Row[]).filter((item) => item.companyId === currentUser?.companyId); return ok(rows); }
  const invoiceDownloadMatch = path.match(/^\/invoices\/([^/]+)\/download$/); if (invoiceDownloadMatch && method === 'GET') { const invoice = (state.invoices as Row[]).find((item) => item.id === invoiceDownloadMatch[1]); if (!invoice) return fail(404, 'NOT_FOUND', 'Invoice not found.'); if (currentUser?.role !== 'SUPER_ADMIN' && invoice.companyId !== currentUser?.companyId) return fail(403, 'SCOPE_DENIED', 'Invoice belongs to another company.'); const invoiceNumber = invoice.invoiceNumber ?? invoice.number; const content = new Blob([`VOOK INVOICE\n${invoiceNumber}\n${invoice.currency} ${invoice.amount ?? invoice.amountMinor / 100}`], { type: 'application/pdf' }); return new HttpResponse(content, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${invoiceNumber}.pdf"` } }); }
  const paymentMatch = path.match(/^\/payments\/([^/]+)$/); if (paymentMatch && method === 'PATCH') return fail(405, 'PAYMENT_HISTORY_READ_ONLY', 'Payment records are immutable and reflect the online payment provider.');

  if (path === '/integrations' && method === 'GET') return ok((state.integrations as Row[]).map(integrationView));
  const integrationMatch = path.match(/^\/integrations\/([^/]+)(?:\/(test|activate|disable))?$/);
  if (integrationMatch && ['PUT', 'POST'].includes(method)) {
    const body = await bodyOf(request);
    const providerKey = integrationMatch[1].toUpperCase();
    const existing = (state.integrations as Row[]).find((item) => String(item.providerKey ?? item.key).toUpperCase() === providerKey);
    if (integrationMatch[2] === 'activate' && !existing?.lastTestedAt) return fail(409, 'INTEGRATION_NOT_TESTED', 'Test the pending integration configuration before activation.');
    const updated = await updateMockState((draft) => {
      let row = (draft.integrations as Row[]).find((item) => String(item.providerKey ?? item.key).toUpperCase() === providerKey);
      if (!row) {
        row = { id: id('integration'), providerKey, status: 'NOT_CONFIGURED', publicConfig: {}, secretConfigured: false, pendingConfiguration: false };
        draft.integrations.push(row);
      }
      const before = structuredClone(row);
      if (!integrationMatch[2]) {
        row.providerKey = providerKey;
        row.publicConfig = { ...(row.publicConfig as Row ?? {}), ...(body.publicConfig ?? {}) };
        row.secretConfigured = Boolean(row.secretConfigured || Object.values(body.secrets ?? {}).some(Boolean));
        row.pendingConfiguration = true;
        if (row.status !== 'ACTIVE') row.status = 'DRAFT';
      }
      if (integrationMatch[2] === 'test') {
        row.lastTestedAt = new Date().toISOString();
        row.lastErrorCode = null;
      }
      if (integrationMatch[2] === 'activate') {
        row.status = 'ACTIVE';
        row.pendingConfiguration = false;
      }
      if (integrationMatch[2] === 'disable') row.status = 'NOT_CONFIGURED';
      appendAudit(draft, { actorId: currentUser?.id, action: `INTEGRATION_${integrationMatch[2]?.toUpperCase() ?? 'SAVED'}`, entityType: 'INTEGRATION', entityId: providerKey, oldValue: before, newValue: integrationView(row), description: body.reason });
      return integrationView(row);
    });
    return ok(updated);
  }
  if (path === '/attendance-integrations' && method === 'GET') {
    const verification = (state.attendancePolicy as Row).verification ?? {};
    return ok({ policy: {
      verificationMethods: { gps: verification.gpsRequired, geofence: verification.geofenceRequired, device: verification.deviceRequired, face: verification.selfieRequired, biometric: verification.biometricEnabled },
      requireAnyVerification: true,
      minimumGpsAccuracyMeters: (state.attendancePolicy as Row).minimumGpsAccuracyMeters ?? 100,
      allowRemoteAttendance: (state.attendancePolicy as Row).allowRemoteAttendance ?? false,
    } });
  }
  if (path === '/attendance-verification-policy' && method === 'PUT') { const body = await bodyOf(request); const saved = await updateMockState((draft) => { const before = structuredClone(draft.attendancePolicy); const methods = (body.verificationMethods ?? {}) as Row; draft.attendancePolicy = { ...draft.attendancePolicy, minimumGpsAccuracyMeters: body.minimumGpsAccuracyMeters, allowRemoteAttendance: body.allowRemoteAttendance, verification: { gpsRequired: methods.gps !== false, geofenceRequired: methods.geofence !== false, deviceRequired: Boolean(methods.device), ipRequired: false, selfieRequired: Boolean(methods.face), biometricEnabled: Boolean(methods.biometric) } }; appendAudit(draft, { actorId: currentUser?.id, companyId: currentUser?.companyId, action: 'ATTENDANCE_POLICY_UPDATED', entityType: 'ATTENDANCE_POLICY', entityId: currentUser?.companyId ?? 'platform', oldValue: before, newValue: draft.attendancePolicy, description: body.reason }); return draft.attendancePolicy; }); return ok(saved); }

  if (path === '/settings/platform' && method === 'GET') return ok(state.settings);
  if (path === '/settings/platform' && method === 'PUT') { const body = await bodyOf(request); await updateMockState((draft) => { draft.settings = { ...draft.settings, ...body }; }); return ok(body); }
  if (path === '/profile' && method === 'GET') { const employee = state.employees.find((item) => item.userId === currentUser?.id); return ok({ ...currentUser, employee }); }
  if ((path === '/profile' || path === '/auth/session') && method === 'PATCH') { const body = await bodyOf(request); const updated = await updateMockState((draft) => { const row = draft.users.find((item) => item.id === currentUser?.id); if (row) Object.assign(row, body); return row; }); return ok(updated); }
  if (path === '/onboarding/plans' && method === 'GET') return ok(state.plans);
  if (path === '/onboarding/trial' && method === 'POST') return fail(410, 'ONLINE_CHECKOUT_REQUIRED', 'Signup requires an online subscription purchase; free trials are unavailable.');
  if (path === '/onboarding/checkout' && method === 'POST') {
    const body = await bodyOf(request);
    const admin = (body.admin ?? {}) as Row;
    const company = (body.company ?? {}) as Row;
    const adminEmail = body.adminEmail ?? body.email ?? admin.email;
    if (!company.name || !admin.name || !adminEmail) return fail(422, 'VALIDATION_ERROR', 'Company name, administrator name, and email are required.');
    if (body.provider && body.provider !== 'RAZORPAY') return fail(422, 'UNSUPPORTED_PAYMENT_PROVIDER', 'Online signup currently accepts Razorpay checkout only.');
    const plan = (state.plans as Row[]).find((item) => item.id === body.planId || item.type === body.plan);
    const version = (state.planVersions as Row[]).find((item) => item.id === (body.planVersionId ?? plan?.currentVersionId?.id));
    if (!version) return fail(422, 'PUBLISHED_PLAN_REQUIRED', 'Select a published plan before checkout.');
    const result = await updateMockState((draft) => {
      const registrationId = id('registration');
      const orderId = id('order');
      const provider = 'RAZORPAY';
      const status = body.simulateFailure ? 'FAILED' : 'PAID';
      const row = { id: registrationId, registrationId, acquisition: 'ONLINE_PURCHASE', companyName: company.name, companyEmail: company.email, adminName: admin.name, adminEmail, planId: version.planId, planVersionId: version.id, billingCycle: body.billingCycle ?? 'Monthly', provider, orderId, status, emailVerified: false, createdAt: new Date().toISOString() };
      draft.registrations.push(row);
      draft.payments.unshift({ id: id('payment'), companyId: null, registrationId, amount: row.billingCycle === 'Annual' ? version.pricing.annual : version.pricing.monthly, currency: version.currency, source: provider, status, reference: orderId, createdAt: new Date().toISOString() });
      return { registrationId, orderId, amount: row.billingCycle === 'Annual' ? version.pricing.annual : version.pricing.monthly, currency: version.currency, keyId: 'mock_provider_key', provider, status: row.status };
    });
    return ok(result, 201);
  }
  const checkoutStatus = path.match(/^\/onboarding\/checkout\/([^/]+)$/); if (checkoutStatus && method === 'GET') { const registration = (state.registrations as Row[]).find((item) => item.registrationId === checkoutStatus[1]); return registration ? ok({ status: registration.status, provider: registration.provider }) : fail(404, 'NOT_FOUND', 'Registration not found.'); }
  if (/^\/onboarding\/checkout\/[^/]+\/resend-verification$/.test(path) && method === 'POST') return ok({ message: 'Verification sent.' });
  if (path === '/onboarding/verify-email' && method === 'POST') {
    const body = await bodyOf(request);
    const registration = (state.registrations as Row[]).find((item) => item.registrationId === body.registrationId || item.registrationId === body.token || item.verificationToken === body.token);
    if (!registration) return fail(404, 'INVALID_VERIFICATION', 'This verification link is invalid or expired.');
    if (registration.acquisition !== 'ONLINE_PURCHASE' || !['PAID', 'PROVISIONED'].includes(registration.status)) return fail(409, 'PAYMENT_REQUIRED', 'A successful online checkout is required before this registration can be verified.');
    const result = await updateMockState((draft) => {
      const stored = (draft.registrations as Row[]).find((item) => item.registrationId === registration.registrationId);
      const company = provisionVerifiedRegistration(draft, stored);
      return { verified: true, companyId: company?.id, adminEmail: stored.adminEmail, demoPassword: MOCK_PASSWORD };
    });
    return ok(result);
  }
  if (path === '/onboarding' && method === 'GET') { const company = companyFor(state, currentUser, url); const onboarding = (state.onboardings as Row[]).find((item) => item.companyId === company?.id) ?? state.onboarding; return ok({ onboarding, company, firstBranch: (state.offices as Row[]).find((item) => item.companyId === company?.id) ?? null, entitlements: effectiveEntitlements(state, company?.id) }); }
  const onboardingStep = path.match(/^\/onboarding\/([^/]+)$/); if (onboardingStep && method === 'PATCH') { const body = await bodyOf(request); const company = companyFor(state, currentUser, url); const updated = await updateMockState((draft) => { let onboarding = (draft.onboardings as Row[]).find((item) => item.companyId === company?.id); if (!onboarding) { onboarding = { companyId: company?.id, status: 'NOT_STARTED', steps: [] }; draft.onboardings.push(onboarding); } const steps = onboarding.steps as Row[]; let step = steps.find((item) => item.key === onboardingStep[1]); if (!step) { step = { key: onboardingStep[1], status: 'NOT_STARTED' }; steps.push(step); } Object.assign(step, body, body.status === 'COMPLETED' ? { completedAt: new Date().toISOString() } : {}); if (onboardingStep[1] === 'company-profile' && body.data) Object.assign((draft.companies as Row[]).find((item) => item.id === company?.id), body.data); if (onboardingStep[1] === 'first-branch' && body.data && !(draft.offices as Row[]).some((item) => item.companyId === company?.id)) draft.offices.push({ id: id('office'), _id: id('office'), companyId: company?.id, isActive: true, ...body.data }); const done = steps.filter((item) => ['COMPLETED', 'SKIPPED'].includes(item.status)).length; onboarding.status = done === steps.length ? 'COMPLETED' : done ? 'IN_PROGRESS' : 'NOT_STARTED'; appendAudit(draft, { actorId: currentUser?.id, companyId: company?.id, action: 'ONBOARDING_STEP_UPDATED', entityType: 'ONBOARDING', entityId: onboardingStep[1], newValue: step }); return onboarding; }); return ok(updated); }

  if (path === '/broadcasts' && method === 'GET') return ok([]);
  if (path === '/broadcasts' && method === 'POST') return ok({ id: id('broadcast'), status: 'SENT', recipients: state.users.filter((user) => user.isActive).length, ...(await bodyOf(request)), createdAt: new Date().toISOString() }, 201);

  return fail(501, 'MOCK_NOT_IMPLEMENTED', `No mock handler exists for ${method} ${path}.`);
};

export const handlers = [http.all(/.*\/api\/v2(?:\/.*)?$/, resolver)];
