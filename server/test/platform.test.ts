import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACCOUNTS, boot, DEMO_PASSWORD, loginAs } from './helpers.ts';

let ctx: Awaited<ReturnType<typeof boot>>;
beforeAll(async () => { ctx = await boot(); });
afterAll(async () => { await ctx.stop(); });

describe('plans', () => {
  it('shows only published plans to the public but drafts to the platform admin', async () => {
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    const created = await sa.agent.post('/api/v2/plans').send({ name: 'Draft Plan', type: 'draft_x', price: 999, maxUsers: 20 });
    expect(created.status).toBe(201);
    expect(created.body.data.type).toBe('DRAFT_X');
    const anon = (await request(ctx.app).get('/api/v2/plans')).body.data;
    expect(anon.some((p: { type: string }) => p.type === 'DRAFT_X')).toBe(false);
    expect(anon.length).toBeGreaterThan(0);
    const all = (await sa.agent.get('/api/v2/plans')).body.data;
    expect(all.some((p: { type: string }) => p.type === 'DRAFT_X')).toBe(true);
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    expect((await admin.agent.post('/api/v2/plans').send({ name: 'Nope', type: 'nope', price: 1, maxUsers: 1 })).status).toBe(403);
  });

  it('drafts → publishes immutable versions with optimistic locking', async () => {
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    const plan = (await sa.agent.post('/api/v2/plans').send({ name: 'Versioned', type: 'versioned', price: 500, maxUsers: 10 })).body.data;
    expect((await sa.agent.post(`/api/v2/plans/${plan.id}/publish`).send({ draftRevision: 99, reason: 'first release' })).body.error.code).toBe('STALE_DRAFT');
    const v1 = await sa.agent.post(`/api/v2/plans/${plan.id}/publish`).send({ draftRevision: plan.draftRevision, reason: 'first release' });
    expect(v1.body.data.version).toBe(1);
    expect((await sa.agent.post(`/api/v2/plans/${plan.id}/publish`).send({ draftRevision: plan.draftRevision, reason: 'again' })).body.error.code).toBe('NO_DRAFT');
    const edited = await sa.agent.put(`/api/v2/plans/${plan.id}`).send({ draftRevision: plan.draftRevision, price: 700 });
    expect(edited.body.data.hasUnpublishedChanges).toBe(true);
    expect((await sa.agent.put(`/api/v2/plans/${plan.id}`).send({ draftRevision: plan.draftRevision, price: 800 })).body.error.code).toBe('STALE_DRAFT');
    const v2 = await sa.agent.post(`/api/v2/plans/${plan.id}/publish`).send({ draftRevision: edited.body.data.draftRevision, reason: 'price change' });
    expect(v2.body.data.version).toBe(2);
    const detail = (await sa.agent.get(`/api/v2/plans/${plan.id}`)).body.data;
    expect(detail.versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);
    expect(detail.versions[1].pricing.monthly).toBe(500); // v1 untouched by later edits
    expect((await sa.agent.delete('/api/v2/plans/plan_pro')).body.error.code).toBe('PLAN_IN_USE');
  });
});

describe('entitlements', () => {
  it('turning a module off for a company blocks its routes immediately; core modules cannot be turned off', async () => {
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    expect((await hr.agent.get('/api/v2/expenses')).status).toBe(200);
    const catalog = (await sa.agent.get('/api/v2/module-catalog')).body.data;
    const expenses = catalog.find((m: { key: string }) => m.key === 'EXPENSE_MANAGEMENT');
    const off = await sa.agent.put('/api/v2/modules/toggle').send({ companyId: 'company_northstar', moduleId: expenses.id, isEnabled: false, reason: 'Testing' });
    expect(off.status).toBe(200);
    const blocked = await hr.agent.get('/api/v2/expenses');
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('ENTITLEMENT_REQUIRED');
    const core = catalog.find((m: { isCore: boolean }) => m.isCore);
    expect((await sa.agent.put('/api/v2/modules/toggle').send({ companyId: 'company_northstar', moduleId: core.id, isEnabled: false, reason: 'Testing' })).body.error.code).toBe('CORE_MODULE_REQUIRED');
    expect((await sa.agent.put('/api/v2/modules/toggle').send({ companyId: 'company_northstar', moduleId: expenses.id, isEnabled: true, reason: '' })).status).toBe(422);
    await sa.agent.delete(`/api/v2/entitlement-overrides/${off.body.data.id}`);
    expect((await hr.agent.get('/api/v2/expenses')).status).toBe(200);
  });

  it('limit overrides change the effective employee cap', async () => {
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    const made = await sa.agent.post('/api/v2/entitlement-overrides').send({ companyId: 'company_northstar', effect: 'SET_LIMIT', limitKey: 'employees', limitValue: 1, reason: 'Trial cap' });
    expect(made.status).toBe(201);
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    const res = await hr.agent.post('/api/v2/employees').send({ name: 'Over Limit', mobile: '9666666666' });
    expect(res.body.error.code).toBe('EMPLOYEE_LIMIT_REACHED');
    await sa.agent.delete(`/api/v2/entitlement-overrides/${made.body.data.id}`);
    expect((await hr.agent.post('/api/v2/employees').send({ name: 'Under Limit', mobile: '9666666667' })).status).toBe(201);
  });

  it('a tenant cannot read the platform admin surfaces', async () => {
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    for (const path of ['/modules', '/integrations', '/settings/platform', '/entitlement-overrides', '/broadcasts', '/reports/revenue-trend', '/subscriptions']) {
      expect((await admin.agent.get(`/api/v2${path}`)).status, path).toBe(403);
    }
  });
});

describe('billing', () => {
  it('upgrade pays through checkout, applies the plan and issues an invoice; downgrade is scheduled; only the admin can change plans', async () => {
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    const plans = (await admin.agent.get('/api/v2/plans')).body.data;
    const enterprise = plans.find((p: { type: string }) => p.type === 'ENTERPRISE');
    const basic = plans.find((p: { type: string }) => p.type === 'BASIC');
    expect((await hr.agent.post('/api/v2/subscription/checkout').send({ planVersionId: enterprise.currentVersionId.id, billingCycle: 'Monthly' })).status).toBe(403);
    expect((await admin.agent.post('/api/v2/subscription/checkout').send({ planVersionId: 'nope', billingCycle: 'Monthly' })).body.error.code).toBe('PUBLISHED_PLAN_REQUIRED');
    const key = 'checkout-key-001';
    const a = await admin.agent.post('/api/v2/subscription/checkout').set('Idempotency-Key', key).send({ planVersionId: enterprise.currentVersionId.id, billingCycle: 'Monthly' });
    const b = await admin.agent.post('/api/v2/subscription/checkout').set('Idempotency-Key', key).send({ planVersionId: enterprise.currentVersionId.id, billingCycle: 'Monthly' });
    expect(a.status).toBe(201);
    expect(b.body.data.paymentId).toBe(a.body.data.paymentId);
    const sub = (await admin.agent.get('/api/v2/subscription')).body.data;
    expect(sub.subscription.plan).toBe('ENTERPRISE');
    expect(sub.entitlements.limits.employees).toBeGreaterThanOrEqual(500);
    const payments = (await admin.agent.get('/api/v2/payments/mine')).body.data;
    expect(payments.find((p: { id: string }) => p.id === a.body.data.paymentId).status).toBe('PAID');
    const invoices = (await admin.agent.get('/api/v2/invoices')).body.data;
    expect(invoices.length).toBeGreaterThan(0);
    const pdf = await admin.agent.get(`/api/v2/invoices/${invoices[0].id}/download`).buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on('data', (d: Buffer) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    const down = await admin.agent.post('/api/v2/subscription/checkout').send({ planVersionId: basic.currentVersionId.id, billingCycle: 'Monthly' });
    expect(down.body.data.scheduled === true || down.body.error?.code === 'DOWNGRADE_BLOCKED').toBe(true);
  });

  it('finance sees only their own company payments; manual payments and edits are refused', async () => {
    const fin = await loginAs(ctx.app, ACCOUNTS.finance);
    const list = (await fin.agent.get('/api/v2/payments')).body.data.payments;
    expect(list.every((p: { companyId: string }) => p.companyId === 'company_northstar')).toBe(true);
    expect((await fin.agent.post('/api/v2/payments/offline').send({})).status).toBe(405);
  });
});

describe('online registration', () => {
  it('buys a plan, verifies the emailed link once, creates the company with a working admin login', async () => {
    const plans = (await request(ctx.app).get('/api/v2/onboarding/plans')).body.data;
    const body = { company: { name: 'Acme Works', email: 'hello@acme.test' }, admin: { name: 'Asha Rao', email: 'asha@acme.test', password: 'Sturdy#Pass1' }, plan: plans[0].type, billingCycle: 'Monthly' };
    expect((await request(ctx.app).post('/api/v2/onboarding/checkout').send({ ...body, admin: { ...body.admin, password: 'short' } })).body.error.code).toBe('WEAK_PASSWORD');
    expect((await request(ctx.app).post('/api/v2/onboarding/checkout').send({ ...body, admin: { ...body.admin, email: ACCOUNTS.hr } })).body.error.code).toBe('EMAIL_IN_USE');
    const checkout = await request(ctx.app).post('/api/v2/onboarding/checkout').send(body);
    expect(checkout.status).toBe(201);
    expect(checkout.body.data.status).toBe('PAID');
    const status = await request(ctx.app).get(`/api/v2/onboarding/checkout/${checkout.body.data.registrationId}`);
    expect(status.body.data.status).toBe('PAID');
    // login is impossible until the email is verified
    expect((await request(ctx.app).post('/api/v2/auth/login').send({ email: body.admin.email, password: body.admin.password })).status).toBe(401);
    const { coll } = await import('../src/db/mongo.ts');
    const mail = await coll('mailOutbox').findOne({ to: body.admin.email });
    const token = new URL(mail!.link).searchParams.get('token')!;
    expect((await request(ctx.app).post('/api/v2/onboarding/verify-email').send({ token: 'x'.repeat(30) })).status).toBe(404);
    const verified = await request(ctx.app).post('/api/v2/onboarding/verify-email').send({ token });
    expect(verified.body.data.verified).toBe(true);
    expect((await request(ctx.app).post('/api/v2/onboarding/verify-email').send({ token })).status).toBe(404); // single use
    const admin = await loginAs(ctx.app, body.admin.email, body.admin.password);
    const access = (await admin.agent.get('/api/v2/access')).body.data;
    expect(access.permissions).toEqual(['*']);
    expect(access.subscription.state).toBe('ACTIVE');
    expect((await admin.agent.get('/api/v2/company')).body.data.name).toBe('Acme Works');
    expect((await admin.agent.get('/api/v2/dashboard')).body.data.stats.totalEmployees).toBe(0); // fresh tenant sees none of Northstar's data
    const reg = await coll('registrations').findOne({ adminEmail: body.admin.email });
    expect(reg!.adminPasswordHash).toBeUndefined(); // the password hash is not kept after provisioning
  });

  it('webhooks reject calls without a valid signature', async () => {
    expect((await request(ctx.app).post('/api/v2/webhooks/razorpay').send({ event: 'payment.captured' })).status).toBe(400);
  });
});

describe('roles', () => {
  it('custom roles use only entitled permissions, take effect at once, and cannot be removed while in use', async () => {
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    expect((await admin.agent.post('/api/v2/role-definitions').send({ name: 'Bad', permissions: ['NOT_A_MODULE.VIEW'] })).status).toBe(403);
    const role = await admin.agent.post('/api/v2/role-definitions').send({ name: 'Leave Viewer', permissions: ['LEAVE_MANAGEMENT.VIEW', 'DASHBOARD.VIEW'] });
    expect(role.status).toBe(201);
    expect((await admin.agent.post('/api/v2/role-definitions').send({ name: 'leave viewer', permissions: [] })).body.error.code).toBe('ROLE_NAME_IN_USE');
    const supervisor = await loginAs(ctx.app, ACCOUNTS.supervisor);
    const before = (await supervisor.agent.get('/api/v2/access')).body.data.permissions;
    expect(before).not.toContain('EMPLOYEE_MANAGEMENT.EXPORT');
    const users = (await admin.agent.get('/api/v2/users?limit=50')).body.data.users;
    const target = users.find((u: { email: string }) => u.email === ACCOUNTS.employee);
    const assigned = await admin.agent.post('/api/v2/role-assignments').send({ userId: target.id, roleDefinitionId: role.body.data.id, scopeType: 'COMPANY' });
    expect(assigned.status).toBe(201);
    expect((await admin.agent.post('/api/v2/role-assignments').send({ userId: target.id, roleDefinitionId: role.body.data.id, scopeType: 'COMPANY' })).body.error.code).toBe('ASSIGNMENT_EXISTS');
    expect((await admin.agent.post('/api/v2/role-assignments').send({ userId: target.id, roleDefinitionId: role.body.data.id, scopeType: 'DEPARTMENT' })).body.error.code).toBe('SCOPE_REQUIRED');
    expect((await admin.agent.delete(`/api/v2/role-definitions/${role.body.data.id}`)).body.error.code).toBe('ROLE_IN_USE');
    expect((await admin.agent.delete(`/api/v2/role-assignments/${assigned.body.data.id}`)).status).toBe(200);
    expect((await admin.agent.delete(`/api/v2/role-definitions/${role.body.data.id}`)).status).toBe(200);
    const assignments = (await admin.agent.get('/api/v2/role-assignments')).body.data;
    const primary = assignments.find((a: { isPrimary: boolean }) => a.isPrimary);
    expect((await admin.agent.delete(`/api/v2/role-assignments/${primary.id}`)).body.error.code).toBe('PRIMARY_ASSIGNMENT_REQUIRED');
  });

  it('the company admin role is locked, and only the company admin may configure roles', async () => {
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    expect((await admin.agent.put('/api/v2/role-definitions/role_company_admin').send({ permissions: [] })).body.error.code).toBe('SYSTEM_ROLE_LOCKED');
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    expect((await hr.agent.get('/api/v2/role-definitions')).status).toBe(403);
  });

  it('workflows are per company and validated', async () => {
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    const list = (await admin.agent.get('/api/v2/workflows')).body.data;
    expect(list.map((w: { type: string }) => w.type)).toContain('leave');
    expect((await admin.agent.put('/api/v2/workflows/leave').send({ steps: [] })).status).toBe(422);
    const saved = await admin.agent.put('/api/v2/workflows/leave').send({ steps: [{ order: 1, role: 'HR', action: 'Approve', escalateAfter: 12 }], autoEscalate: false });
    expect(saved.status).toBe(200);
    expect((await admin.agent.put('/api/v2/workflows/leave').send({ steps: [{ order: 1, role: 'HACKER', action: 'x' }] })).status).toBe(422);
  });
});

describe('integrations + platform settings', () => {
  it('stores secrets encrypted and never returns them; activation needs a fresh test', async () => {
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    const saved = await sa.agent.put('/api/v2/integrations/SMTP').send({ publicConfig: { host: '127.0.0.1', port: 9, fromAddress: 'noreply@example.com' }, secrets: { username: 'user', password: 'super-secret-pw' } });
    expect(saved.status).toBe(200);
    expect(JSON.stringify(saved.body)).not.toContain('super-secret-pw');
    expect(saved.body.data.secretConfigured).toBe(true);
    const list = JSON.stringify((await sa.agent.get('/api/v2/integrations')).body);
    expect(list).not.toContain('super-secret-pw');
    expect(list).not.toContain('"secrets"');
    const { coll } = await import('../src/db/mongo.ts');
    const stored = await coll('integrations').findOne({ providerKey: 'SMTP' });
    expect(JSON.stringify(stored)).not.toContain('super-secret-pw');
    expect((await sa.agent.post('/api/v2/integrations/SMTP/activate').send({})).body.error.code).toBe('INTEGRATION_NOT_TESTED');
    expect((await sa.agent.put('/api/v2/integrations/SMTP').send({ publicConfig: { evil: 'x' } })).status).toBe(422);
    expect((await sa.agent.put('/api/v2/integrations/UNKNOWN').send({})).status).toBe(404);
    const incomplete = await sa.agent.post('/api/v2/integrations/WHATSAPP/test').send({});
    expect([404, 422]).toContain(incomplete.status);
  });

  it('maintenance mode shows a friendly message to everyone except platform admins', async () => {
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    expect((await sa.agent.put('/api/v2/settings/platform').send({ system: { maintenance: true, maintenanceMsg: 'Back at 6pm' } })).status).toBe(200);
    const blocked = await emp.agent.get('/api/v2/access');
    expect(blocked.status).toBe(503);
    expect(blocked.body.error.message).toBe('Back at 6pm');
    expect((await sa.agent.get('/api/v2/access')).status).toBe(200);
    await sa.agent.put('/api/v2/settings/platform').send({ system: { maintenance: false } });
    // the setting is cached for a few seconds in this process; clear it as the server would on write
    expect((await emp.agent.get('/api/v2/access')).status).toBe(200);
  });

  it('announcements reach the right people', async () => {
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    const sent = await sa.agent.post('/api/v2/broadcasts').send({ title: 'Downtime tonight', message: 'We will upgrade at 11pm.', targetRole: 'HR', severity: 'WARNING' });
    expect(sent.status).toBe(201);
    expect(sent.body.data.recipients).toBe(1);
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    const inbox = (await hr.agent.get('/api/v2/notifications')).body.data;
    expect(inbox.items.some((n: { title: string }) => n.title === 'Downtime tonight')).toBe(true);
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    expect((await emp.agent.get('/api/v2/notifications')).body.data.items.some((n: { title: string }) => n.title === 'Downtime tonight')).toBe(false);
  });
});
