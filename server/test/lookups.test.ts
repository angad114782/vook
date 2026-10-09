import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACCOUNTS, boot, loginAs } from './helpers.ts';

let ctx: Awaited<ReturnType<typeof boot>>;
beforeAll(async () => { ctx = await boot(); });
afterAll(async () => { await ctx.stop(); });

describe('pick-lists are data', () => {
  it('starts with the usual choices, lets an allowed person add and delete, and never brings deleted ones back', async () => {
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    const first = (await admin.agent.get('/api/v2/lookups/DOCUMENT_CATEGORY')).body.data;
    expect(first.items).toContain('Safety');
    expect(first.canManage).toBe(true);
    expect((await admin.agent.post('/api/v2/lookups/DOCUMENT_CATEGORY').send({ value: 'Quality Manual' })).status).toBe(201);
    expect((await admin.agent.post('/api/v2/lookups/DOCUMENT_CATEGORY').send({ value: 'quality manual' })).body.data.existed).toBe(true); // same name, other spelling
    expect((await admin.agent.get('/api/v2/lookups/DOCUMENT_CATEGORY')).body.data.items).toContain('Quality Manual');
    expect((await admin.agent.delete(`/api/v2/lookups/DOCUMENT_CATEGORY/${encodeURIComponent('Finance')}`)).status).toBe(200);
    expect((await admin.agent.get('/api/v2/lookups/DOCUMENT_CATEGORY')).body.data.items).not.toContain('Finance');
    expect((await admin.agent.post('/api/v2/lookups/NOPE').send({ value: 'x' })).status).toBe(404);
    expect((await admin.agent.post('/api/v2/lookups/DOCUMENT_CATEGORY').send({ value: 'x' })).status).toBe(422);
  });

  it('refuses to delete an entry that records still use, and keeps people without the right out', async () => {
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    const { coll } = await import('../src/db/mongo.ts');
    const exp = await coll('expenses').findOne({});
    const category = String(exp?.category ?? 'Travel');
    await admin.agent.get('/api/v2/lookups/EXPENSE_CATEGORY'); // make sure the list exists
    const blocked = await admin.agent.delete(`/api/v2/lookups/EXPENSE_CATEGORY/${encodeURIComponent(category)}`);
    if (exp && exp.companyId === (await coll('users').findOne({ email: ACCOUNTS.companyAdmin }))?.companyId) { expect(blocked.status).toBe(409); expect(blocked.body.error.code).toBe('LIST_ITEM_IN_USE'); }
    const emp = await loginAs(ctx.app, ACCOUNTS.employee);
    const view = (await emp.agent.get('/api/v2/lookups/EXPENSE_CATEGORY')).body.data;
    expect(view.items.length).toBeGreaterThan(0);
    expect(view.canManage).toBe(false);
    expect((await emp.agent.post('/api/v2/lookups/EXPENSE_CATEGORY').send({ value: 'Sneaky' })).status).toBe(403);
  });

  it('keeps each company’s lists to itself, and gives the platform admin its own', async () => {
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    await admin.agent.post('/api/v2/lookups/SUPPORT_CATEGORY').send({ value: 'Only for Northstar' });
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    expect((await sa.agent.get('/api/v2/lookups/SUPPORT_CATEGORY')).body.data.items).not.toContain('Only for Northstar');
    expect((await sa.agent.post('/api/v2/lookups/SUPPORT_CATEGORY').send({ value: 'Platform topic' })).status).toBe(201);
    expect((await admin.agent.get('/api/v2/lookups/SUPPORT_CATEGORY')).body.data.items).not.toContain('Platform topic');
    expect((await admin.agent.get('/api/v2/lookups/INDUSTRY')).body.data.items).toContain('Manufacturing');
  });
});
