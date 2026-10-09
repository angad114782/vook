import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACCOUNTS, boot, loginAs } from './helpers.ts';

let ctx: Awaited<ReturnType<typeof boot>>;
beforeAll(async () => { ctx = await boot(); });
afterAll(async () => { await ctx.stop(); });

describe('salary + payslips', () => {
  it('lists salaries (payroll roles only) and versions a revision without overwriting history', async () => {
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    expect((await emp.agent.get('/api/v2/salaries')).status).toBe(403);
    const fin = await loginAs(ctx.app, ACCOUNTS.finance);
    const list = (await fin.agent.get('/api/v2/salaries?limit=50')).body.data;
    expect(list.results.length).toBeGreaterThan(0);
    const row = list.results[0];
    const early = await fin.agent.post('/api/v2/salaries').send({ employeeId: row.employeeRef, annualCtc: 1_500_000, effectiveFrom: '2000-01-01' });
    expect(early.body.error.code).toBe('SALARY_EFFECTIVE_DATE_CONFLICT');
    const next = await fin.agent.post('/api/v2/salaries').send({ employeeId: row.employeeRef, annualCtc: 1_500_000, effectiveFrom: '2099-01-01' });
    expect(next.status).toBe(200);
    const { coll } = await import('../src/db/mongo.ts');
    const versions = await coll('salaryHistory').find({ employeeId: row.employeeRef }).sort({ version: 1 }).toArray();
    expect(versions.length).toBeGreaterThanOrEqual(2);
    expect(versions[versions.length - 2]!.effectiveTo).toBe('2098-12-31');
  });

  it('employees see only their own published payslips, and can download a real PDF', async () => {
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    const mine = (await emp.agent.get('/api/v2/payslips/mine')).body.data;
    expect(Array.isArray(mine)).toBe(true);
    expect(mine.every((p: { status: string }) => ['PUBLISHED', 'PAID'].includes(p.status))).toBe(true);
    if (mine.length) {
      const pdf = await emp.agent.get(`/api/v2/payslips/mine/${mine[0].id}/download`).buffer(true).parse((res, cb) => { const chunks: Buffer[] = []; res.on('data', (c: Buffer) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))); });
      expect(pdf.status).toBe(200);
      expect(pdf.headers['content-type']).toContain('application/pdf');
      expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    }
    const fin = await loginAs(ctx.app, ACCOUNTS.finance);
    const others = (await fin.agent.get('/api/v2/payslips?limit=50')).body.data.payslips;
    const foreign = others.find((p: { employeeId: string; status: string }) => p.employeeId !== 'employee_5' && ['PUBLISHED', 'PAID'].includes(p.status));
    if (foreign) expect((await emp.agent.get(`/api/v2/payslips/${foreign.id}/download`)).status).toBe(403);
  });

  it('only published payslips can be paid; paid is idempotent', async () => {
    const fin = await loginAs(ctx.app, ACCOUNTS.finance);
    const slips = (await fin.agent.get('/api/v2/payslips?limit=100')).body.data.payslips;
    const draft = slips.find((p: { status: string }) => p.status === 'DRAFT');
    const published = slips.find((p: { status: string }) => p.status === 'PUBLISHED');
    expect((await fin.agent.post(`/api/v2/payslips/${draft.id}/pay`)).body.error.code).toBe('PAYSLIP_NOT_PUBLISHED');
    const paid = await fin.agent.post(`/api/v2/payslips/${published.id}/pay`);
    expect(paid.body.data.status).toBe('PAID');
    expect((await fin.agent.post(`/api/v2/payslips/${published.id}/pay`)).status).toBe(200);
    expect((await fin.agent.post(`/api/v2/payslips/${published.id}/recalculate`)).body.error.code).toBe('PAYSLIP_IMMUTABLE');
  });
});

describe('payroll run', () => {
  it('needs a locked period, then runs Finance prepare → review → Admin approve → finalize → publish with maker–checker', async () => {
    const fin = await loginAs(ctx.app, ACCOUNTS.finance);
    const now = new Date();
    const month = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth(); // previous month
    const year = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
    const unlocked = await fin.agent.post('/api/v2/payroll-runs').send({ month, year });
    expect(unlocked.body.error.code).toBe('ATTENDANCE_PERIOD_NOT_LOCKED');
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    expect((await hr.agent.post('/api/v2/attendance-periods/lock').send({ month, year })).status).toBe(200);
    const created = await fin.agent.post('/api/v2/payroll-runs').send({ month, year });
    expect(created.status).toBe(201);
    const runId = created.body.data.runId;
    expect((await fin.agent.post('/api/v2/payroll-runs').send({ month, year })).body.error.code).toBe('PAYROLL_PERIOD_EXISTS');
    const runs = (await fin.agent.get('/api/v2/payroll-runs')).body.data;
    const run = runs.find((r: { id: string }) => r.id === runId);
    expect(run.employeeCount).toBeGreaterThan(0);
    expect(run.totalNetMinor).toBeGreaterThan(0);
    expect(run.permittedActions).toContain('review');

    const step = (agent: typeof fin.agent, name: string, version: number, reason = 'checked') => agent.post(`/api/v2/payroll-runs/${runId}/${name}`).send({ version, reason });
    expect((await step(fin.agent, 'review', 1, '')).body.error.code).toBe('AUDIT_REASON_REQUIRED');
    expect((await step(fin.agent, 'review', 9)).body.error.code).toBe('VERSION_CONFLICT');
    expect((await step(fin.agent, 'approve', 1)).body.error.code).toBe('INVALID_PAYROLL_TRANSITION');
    const reviewed = await step(fin.agent, 'review', 1);
    expect(reviewed.body.data.status).toBe('UNDER_REVIEW');
    expect((await step(fin.agent, 'approve', 2)).status).toBe(403); // finance lacks approve
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    expect((await step(admin.agent, 'approve', 2)).body.data.status).toBe('APPROVED');
    expect((await step(admin.agent, 'finalize', 3)).body.data.status).toBe('FINALIZED');
    expect((await step(admin.agent, 'publish', 4)).body.data.status).toBe('PUBLISHED');
    const { coll } = await import('../src/db/mongo.ts');
    expect(await coll('payslips').countDocuments({ runId, status: 'PUBLISHED' })).toBe(run.employeeCount);
    expect((await step(admin.agent, 'publish', 5)).body.error.code).toBe('INVALID_PAYROLL_TRANSITION');
    expect(await coll('notifications').countDocuments({ type: 'PAYROLL' })).toBeGreaterThan(0);
  });

  it('refuses to prepare payroll when someone has no salary', async () => {
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    await hr.agent.post('/api/v2/employees').send({ name: 'No Salary', mobile: '9555555555' });
    await hr.agent.post('/api/v2/attendance-periods/lock').send({ month: 1, year: 2030 });
    const fin = await loginAs(ctx.app, ACCOUNTS.finance);
    const res = await fin.agent.post('/api/v2/payroll-runs').send({ month: 1, year: 2030 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PAYROLL_PREFLIGHT_FAILED');
    expect(res.body.error.details.some((d: { name: string }) => d.name === 'No Salary')).toBe(true);
  });

  it('compliance settings use optimistic locking', async () => {
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    const cfg = (await admin.agent.get('/api/v2/payroll-compliance')).body.data;
    const saved = await admin.agent.put('/api/v2/payroll-compliance').send({ ...cfg, version: cfg.version, pf: { ...cfg.pf, employeeRate: 10 } });
    expect(saved.body.data.version).toBe(cfg.version + 1);
    expect((await admin.agent.put('/api/v2/payroll-compliance').send({ version: cfg.version })).body.error.code).toBe('VERSION_CONFLICT');
  });
});

describe('expenses', () => {
  it('walks Employee → Manager → Finance → paid, blocks wrong roles and self-approval', async () => {
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    expect((await emp.agent.post('/api/v2/expenses/mine').send({ category: 'Travel', amount: -5 })).status).toBe(422);
    const created = await emp.agent.post('/api/v2/expenses/mine').send({ category: 'Travel', amount: 1250.5, description: 'Cab' });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    const fin = await loginAs(ctx.app, ACCOUNTS.finance);
    expect((await fin.agent.patch(`/api/v2/expenses/${id}`).send({ status: 'APPROVED' })).body.error.code).toBe('WORKFLOW_STAGE_MISMATCH');
    expect([403, 409]).toContain((await emp.agent.patch(`/api/v2/expenses/${id}`).send({ status: 'APPROVED' })).status);
    const mgr = await loginAs(ctx.app, ACCOUNTS.manager);
    expect((await mgr.agent.patch(`/api/v2/expenses/${id}`).send({ status: 'APPROVED' })).body.data.status).toBe('MANAGER_APPROVED');
    expect((await fin.agent.patch(`/api/v2/expenses/${id}`).send({ status: 'PAID' })).body.error.code).toBe('NOT_READY_TO_PAY');
    expect((await fin.agent.patch(`/api/v2/expenses/${id}`).send({ status: 'APPROVED' })).body.data.status).toBe('FINANCE_APPROVED');
    expect((await fin.agent.patch(`/api/v2/expenses/${id}`).send({ status: 'PAID' })).body.data.status).toBe('PAID');
    expect((await fin.agent.patch(`/api/v2/expenses/${id}`).send({ status: 'REJECTED' })).body.error.code).toBe('ALREADY_DECIDED');
    const mine = (await emp.agent.get('/api/v2/expenses/mine')).body.data;
    expect(mine.expenses.find((e: { id: string }) => e.id === id).status).toBe('PAID');
    const list = (await fin.agent.get('/api/v2/expenses?status=COMPLETED')).body.data;
    expect(list.expenses.some((e: { id: string }) => e.id === id)).toBe(true);
  });
});

describe('files + documents', () => {
  it('validates uploads by type and content, serves them only to authorised people', async () => {
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    const bad = await emp.agent.post('/api/v2/files/receipts').attach('receipt', Buffer.from('MZ-not-a-pdf'), 'evil.pdf');
    expect(bad.body.error.code).toBe('FILE_CONTENT_MISMATCH');
    const exe = await emp.agent.post('/api/v2/files/receipts').attach('receipt', Buffer.from('x'), 'run.exe');
    expect(exe.body.error.code).toBe('FILE_TYPE_NOT_ALLOWED');
    const good = await emp.agent.post('/api/v2/files/receipts').attach('receipt', Buffer.from('%PDF-1.4 test'), 'bill.pdf');
    expect(good.status).toBe(201);
    const exp = await emp.agent.post('/api/v2/expenses/mine').send({ category: 'Meals', amount: 300, receiptUrl: good.body.data.fileUrl });
    expect(exp.status).toBe(201);
    expect((await emp.agent.get(good.body.data.fileUrl.replace('/files', '/api/v2/files'))).status).toBe(200);
    const sup = await loginAs(ctx.app, ACCOUNTS.supervisor);
    expect((await sup.agent.post('/api/v2/expenses/mine').send({ category: 'Meals', amount: 10, receiptUrl: good.body.data.fileUrl })).status).toBe(403);
    expect((await request(ctx.app).get(good.body.data.fileUrl.replace('/files', '/api/v2/files'))).status).toBe(401);
  });

  it('seeded documents download as real files; delete needs permission', async () => {
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    const docs = (await emp.agent.get('/api/v2/documents/mine')).body.data.documents;
    expect(docs.length).toBeGreaterThan(0);
    const file = await emp.agent.get(docs[0].fileUrl.replace('/files', '/api/v2/files'));
    expect(file.status).toBe(200);
    expect((await emp.agent.delete(`/api/v2/documents/${docs[0].id}`)).status).toBe(403);
    const hr = await loginAs(ctx.app, ACCOUNTS.hr);
    const made = await hr.agent.post('/api/v2/documents').send({ name: 'Policy X', category: 'HR Policy', visibility: 'HR', fileUrl: '/files/not-mine' });
    expect(made.body.error.code).toBe('FILE_NOT_FOUND');
  });
});
