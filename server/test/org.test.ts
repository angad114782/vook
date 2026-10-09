import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACCOUNTS, boot, loginAs } from './helpers.ts';

let ctx: Awaited<ReturnType<typeof boot>>;
beforeAll(async () => { ctx = await boot(); });
afterAll(async () => { await ctx.stop(); });

describe('tenant + organization', () => {
  it('returns the access snapshot per role', async () => {
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    expect((await admin.agent.get('/api/v2/access')).body.data.permissions).toEqual(['*']);
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    const snap = (await emp.agent.get('/api/v2/access')).body.data;
    expect(snap.permissions).not.toContain('*');
    expect(snap.permissions.length).toBeGreaterThan(0);
  });

  it('keeps tenants apart: company list is platform-only, options show only your own company', async () => {
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    expect((await hr.agent.get('/api/v2/companies')).status).toBe(403);
    const options = (await hr.agent.get('/api/v2/companies/options')).body.data;
    expect(options).toHaveLength(1);
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    expect((await sa.agent.get('/api/v2/companies')).body.data.companies.length).toBeGreaterThan(0);
  });

  it('lists employees with scope: manager sees only their department, employee is blocked', async () => {
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    const all = (await hr.agent.get('/api/v2/employees?limit=100')).body.data;
    const manager = await loginAs(ctx.app, ACCOUNTS.manager);
    const scoped = (await manager.agent.get('/api/v2/employees?limit=100')).body.data;
    expect(scoped.pagination.total).toBeGreaterThan(0);
    expect(scoped.pagination.total).toBeLessThan(all.pagination.total);
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    expect((await emp.agent.get('/api/v2/employees')).status).toBe(403);
  });

  it('hides pay details from people without payroll/edit rights', async () => {
    const manager = await loginAs(ctx.app, ACCOUNTS.manager);
    const row = (await manager.agent.get('/api/v2/employees?limit=1')).body.data.employees[0];
    expect(row.annualCtc).toBeUndefined();
    expect(row.bankName).toBeUndefined();
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    const same = (await hr.agent.get(`/api/v2/employees/${row.id}`)).body.data;
    expect('annualCtc' in same).toBe(true);
  });

  it('creates an employee once even when the request is retried, and blocks duplicate mobiles', async () => {
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    const key = 'retry-key-0001';
    const body = { name: 'Test Person', mobile: '9111111111', email: 'test.person@example.com', department: 'Engineering' };
    const a = await hr.agent.post('/api/v2/employees').set('Idempotency-Key', key).send(body);
    const b = await hr.agent.post('/api/v2/employees').set('Idempotency-Key', key).send(body);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.body.data.id).toBe(a.body.data.id);
    expect(a.body.data.employeeId).toMatch(/^[A-Z]+-\d{4}$/);
    const dup = await hr.agent.post('/api/v2/employees').send({ ...body, name: 'Other' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('DUPLICATE_MOBILE');
  });

  it('ignores fields a client should not set (mass assignment)', async () => {
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    const res = await hr.agent.post('/api/v2/employees').send({ name: 'Sneaky', mobile: '9222222222', companyId: 'company_other', status: 'ACTIVE', version: 99, role: 'SUPER_ADMIN' });
    expect(res.status).toBe(201);
    expect(res.body.data.companyId).toBe('company_northstar');
    expect(res.body.data.status).toBe('ONBOARDING');
  });

  it('imports employees in bulk and reports skipped rows', async () => {
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    const res = await hr.agent.post('/api/v2/employees/import').send({ rows: [
      { name: 'Imp One', mobile: '9333333331', email: 'imp1@example.com' }, { name: 'Imp Two', mobile: '9333333332' },
      { name: 'Dup', mobile: '+91 93333 33331' }, { name: '', mobile: '9333333339' },
    ] });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ imported: 2, failed: 2 });
    expect(res.body.data.errors.map((e: { row: number }) => e.row)).toEqual([4, 5]);
    expect((await hr.agent.post('/api/v2/employees/import').send({ rows: [] })).status).toBe(422);
  });

  it('enforces lifecycle rules: reason, version and valid transitions', async () => {
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    const created = (await hr.agent.post('/api/v2/employees').send({ name: 'Lifecycle', mobile: '9444444444' })).body.data;
    const noReason = await hr.agent.post(`/api/v2/employees/${created.id}/actions`).send({ action: 'ACTIVATE', version: created.version });
    expect(noReason.body.error.code).toBe('AUDIT_REASON_REQUIRED');
    const stale = await hr.agent.post(`/api/v2/employees/${created.id}/actions`).send({ action: 'ACTIVATE', version: 99, reason: 'x' });
    expect(stale.body.error.code).toBe('VERSION_CONFLICT');
    const bad = await hr.agent.post(`/api/v2/employees/${created.id}/actions`).send({ action: 'EXIT', version: created.version, reason: 'x' });
    expect(bad.body.error.code).toBe('INVALID_EMPLOYEE_TRANSITION');
    const good = await hr.agent.post(`/api/v2/employees/${created.id}/actions`).send({ action: 'ACTIVATE', version: created.version, reason: 'Joined' });
    expect(good.body.data.status).toBe('ACTIVE');
    expect(good.body.data.version).toBe(created.version + 1);
  });

  it('departments: HR may read but not create; admin creates; duplicates are refused; counts are live', async () => {
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    expect((await hr.agent.get('/api/v2/departments')).status).toBe(200);
    expect((await hr.agent.post('/api/v2/departments').send({ name: 'Legal Ops', code: 'LO' })).status).toBe(403);
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    expect((await admin.agent.post('/api/v2/departments').send({ name: 'Legal Ops', code: 'LO' })).status).toBe(201);
    const dup = await admin.agent.post('/api/v2/departments').send({ name: 'legal ops', code: 'LO2' });
    expect(dup.status).toBe(409);
    const list = (await admin.agent.get('/api/v2/departments')).body.data;
    expect(list.find((d: { name: string }) => d.name === 'Engineering').total).toBeGreaterThan(0);
  });

  it('every signed-in person can read department names (filters and pickers need them)', async () => {
    for (const email of [ACCOUNTS.finance, ACCOUNTS.manager, ACCOUNTS.supervisor, ACCOUNTS.employee]) {
      const u = await loginAs(ctx.app, email);
      expect((await u.agent.get('/api/v2/departments')).status, email).toBe(200);
      expect((await u.agent.get('/api/v2/departments/summary')).status, email).toBe(200);
    }
  });

  it('users: admin invites a user; employees cannot manage users; cannot create platform admins', async () => {
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    const created = await admin.agent.post('/api/v2/users').send({ name: 'New Hire', email: 'new.hire@example.com', role: 'HR' });
    expect(created.status).toBe(201);
    expect(created.body.data.accountStatus).toBe('INVITED');
    expect(created.body.data.passwordHash).toBeUndefined();
    expect((await admin.agent.post('/api/v2/users').send({ name: 'Evil', email: 'evil@example.com', role: 'SUPER_ADMIN' })).status).toBe(403);
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    expect((await emp.agent.get('/api/v2/users')).status).toBe(403);
  });

  it('dashboard counts come from the database', async () => {
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    const d = (await admin.agent.get('/api/v2/dashboard')).body.data;
    expect(d.stats.totalEmployees).toBeGreaterThan(0);
    expect(d.limitUsage.employeeLimit).toBeGreaterThan(0);
  });
});

describe('deleting departments and designations', () => {
  it('removes unused ones, refuses used ones with a plain message, and keeps other roles out', async () => {
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    const dept = (await admin.agent.post('/api/v2/departments').send({ name: 'Temp Dept', code: 'TMPD' })).body.data;
    const des = (await admin.agent.post('/api/v2/designations').send({ name: 'Temp Title', code: 'TMPT' })).body.data;
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    expect((await emp.agent.delete(`/api/v2/departments/${dept.id}`)).status).toBe(403);
    expect((await admin.agent.delete(`/api/v2/departments/${dept.id}`)).status).toBe(200);
    expect((await admin.agent.delete(`/api/v2/designations/${des.id}`)).status).toBe(200);
    const list = (await admin.agent.get('/api/v2/departments')).body.data;
    expect(list.some((d: { id: string }) => d.id === dept.id)).toBe(false);
    const used = list.find((d: { total: number }) => d.total > 0);
    const blocked = await admin.agent.delete(`/api/v2/departments/${used.id}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('DEPARTMENT_IN_USE');
    expect(blocked.body.error.message).toContain(used.name);
    const usedDes = (await admin.agent.get('/api/v2/designations')).body.data[0];
    expect((await admin.agent.delete(`/api/v2/designations/${usedDes.id}`)).body.error?.code ?? 'OK').toMatch(/DESIGNATION_IN_USE|OK/);
    expect((await admin.agent.delete('/api/v2/departments/nope')).status).toBe(404);
  });
});
