import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ACCOUNTS, boot, loginAs } from './helpers.ts';

let ctx: Awaited<ReturnType<typeof boot>>;
beforeAll(async () => { ctx = await boot(); }, 120_000);
afterAll(async () => { await ctx.stop(); });

const body = (over: Record<string, unknown> = {}) => ({ name: 'Sunrise Traders', adminName: 'Meera Joshi', adminEmail: 'meera@sunrise.test', adminMobile: '9876500011', planVersionId: 'plan_basic_v1', billingCycle: 'Monthly', trialDays: 7, ...over });

describe('adding a company by hand', () => {
  it('Super Admin adds a company; its admin can sign in with the one-time password and sees only their own company', async () => {
    const { agent } = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    const res = await agent.post('/api/v2/companies').send(body());
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Sunrise Traders');
    expect(res.body.data.status).toBe('TRIAL');
    expect(res.body.data.companyCode).toMatch(/^CMP-\d{3}$/);
    const password = res.body.data.temporaryPassword as string;
    expect(password.length).toBeGreaterThanOrEqual(12);
    const admin = await loginAs(ctx.app, 'meera@sunrise.test', password);
    expect(admin.user.role).toBe('COMPANY_ADMIN');
    expect(admin.user.companyId).toBe(res.body.data.id);
    const list = await admin.agent.get('/api/v2/departments');
    expect(list.status).toBe(200);
    // the same mobile number cannot be used twice
    const dup = await agent.post('/api/v2/companies').send(body({ name: 'Other Co', adminEmail: 'other@sunrise.test' }));
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('MOBILE_TAKEN');
  });

  it('refuses everyone except the Super Admin, and bad input', async () => {
    const ca = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    expect((await ca.agent.post('/api/v2/companies').send(body({ adminEmail: 'x@y.test', adminMobile: '' }))).status).toBe(403);
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    expect((await sa.agent.post('/api/v2/companies').send(body({ adminEmail: 'not-an-email' }))).status).toBe(422);
    expect((await sa.agent.post('/api/v2/companies').send(body({ adminEmail: 'z@y.test', adminMobile: '', planVersionId: 'nope' }))).status).toBe(422);
    expect((await sa.agent.post('/api/v2/companies').send(body({ adminEmail: 'w@y.test', adminMobile: '', password: 'short1' }))).status).toBe(422);
    expect((await request(ctx.app).post('/api/v2/companies').send(body())).status).toBe(401);
  });
});

describe('a brand-new production database', () => {
  it('gets plans, modules and role templates once, and then a company created in it works end to end', async () => {
    const { coll } = await import('../src/db/mongo.ts');
    const { ensurePlatformBase } = await import('../src/seed/bootstrap.ts');
    for (const name of ['modules', 'plans', 'planVersions']) await coll(name).deleteMany({});
    await coll('roleDefinitions').deleteMany({ companyId: 'platform' });
    expect(await ensurePlatformBase()).toBe(true);
    expect(await ensurePlatformBase()).toBe(false); // runs only once
    expect(await coll('plans').countDocuments({ status: 'PUBLISHED' })).toBe(3);
    expect(await coll('roleDefinitions').countDocuments({ companyId: 'platform' })).toBe(6);
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    const created = await sa.agent.post('/api/v2/companies').send(body({ name: 'Fresh Co', adminEmail: 'fresh@fresh.test', adminMobile: '', planVersionId: 'plan_pro_v1', trialDays: 0, password: 'Fresh-Pass-2026' }));
    expect(created.status).toBe(201);
    expect(created.body.data.temporaryPassword).toBeUndefined();
    const admin = await loginAs(ctx.app, 'fresh@fresh.test', 'Fresh-Pass-2026');
    expect((await admin.agent.get('/api/v2/dashboard')).status).toBe(200);
  });
});
