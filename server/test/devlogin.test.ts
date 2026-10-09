import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { boot } from './helpers.ts';

let ctx: Awaited<ReturnType<typeof boot>>;
beforeAll(async () => {
  ctx = await boot({ NODE_ENV: 'development' });
  const { coll } = await import('../src/db/mongo.ts');
  for (const [from, to] of [['employee@demo.vook.app', 'emp@vook.com'], ['superadmin@demo.vook.app', 'admin@vook.com']]) await coll('users').updateOne({ emailLower: from }, { $set: { email: to, emailLower: to } });
});
afterAll(async () => { await ctx.stop(); });

describe('one-click sign-in on this computer', () => {
  it('lists the sample roles and signs in without a password when asked from this machine', async () => {
    const agent = request.agent(ctx.app); // supertest connects over the loopback address to 127.0.0.1
    const list = await agent.get('/api/v2/auth/dev-accounts');
    expect(list.status).toBe(200);
    expect(list.body.data.accounts.map((a: { role: string }) => a.role)).toEqual(expect.arrayContaining(['SUPER_ADMIN', 'EMPLOYEE']));
    const res = await agent.post('/api/v2/auth/dev-login').send({ role: 'EMPLOYEE' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('EMPLOYEE');
    expect(res.body.data.csrfToken).toBeTruthy();
    expect((await agent.get('/api/v2/auth/session')).status).toBe(200); // the session cookie really works
    expect((await agent.post('/api/v2/auth/dev-login').send({ role: 'NOPE' })).status).toBe(422);
  });

  it('answers “not found” through a proxy or tunnel, or for any address other than localhost', async () => {
    expect((await request(ctx.app).get('/api/v2/auth/dev-accounts').set('X-Forwarded-For', '203.0.113.9')).status).toBe(404);
    expect((await request(ctx.app).post('/api/v2/auth/dev-login').set('X-Forwarded-For', '203.0.113.9').send({ role: 'EMPLOYEE' })).status).toBe(404);
    expect((await request(ctx.app).post('/api/v2/auth/dev-login').set('Host', 'vook.example.com').send({ role: 'EMPLOYEE' })).status).toBe(404);
    expect((await request(ctx.app).post('/api/v2/auth/dev-login').set('Host', 'localhost.evil.com').send({ role: 'EMPLOYEE' })).status).toBe(404);
  });
});
