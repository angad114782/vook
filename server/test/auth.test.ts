import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACCOUNTS, boot, DEMO_PASSWORD, loginAs } from './helpers.ts';

let ctx: Awaited<ReturnType<typeof boot>>;
beforeAll(async () => { ctx = await boot(); });
afterAll(async () => { await ctx.stop(); });

describe('auth', () => {
  it('rejects wrong credentials with a plain message and no hint which part was wrong', async () => {
    const wrongPassword = await request(ctx.app).post('/api/v2/auth/login').send({ email: ACCOUNTS.hr, password: 'nope-nope1' });
    const unknownUser = await request(ctx.app).post('/api/v2/auth/login').send({ email: 'ghost@example.com', password: 'nope-nope1' });
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownUser.body.error.message);
    expect(wrongPassword.body.error.requestId).toBeTruthy();
  });

  it('signs in, sets an HttpOnly cookie, hides secrets and hydrates the session', async () => {
    const agent = request.agent(ctx.app);
    const res = await agent.post('/api/v2/auth/login').send({ email: ACCOUNTS.companyAdmin, password: DEMO_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']?.[0]).toMatch(/HttpOnly/i);
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.user.company.id).toBe('company_northstar');
    const session = await agent.get('/api/v2/auth/session');
    expect(session.status).toBe(200);
    expect(session.body.data.csrfToken).toBe(res.body.data.csrfToken);
  });

  it('requires a session and a CSRF token for unsafe requests', async () => {
    expect((await request(ctx.app).get('/api/v2/access')).status).toBe(401);
    const { agent } = await loginAs(ctx.app, ACCOUNTS.hr);
    const noCsrf = await request.agent(ctx.app); // fresh agent without the header
    await noCsrf.post('/api/v2/auth/login').send({ email: ACCOUNTS.hr, password: DEMO_PASSWORD });
    const blocked = await noCsrf.post('/api/v2/auth/security/revoke-all');
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('CSRF_INVALID');
    expect((await agent.get('/api/v2/access')).status).toBe(200);
  });

  it('logout ends the session', async () => {
    const { agent } = await loginAs(ctx.app, ACCOUNTS.employee);
    expect((await agent.post('/api/v2/auth/logout')).status).toBe(200);
    expect((await agent.get('/api/v2/auth/session')).status).toBe(401);
  });

  it('locks the account after repeated wrong passwords', async () => {
    for (let i = 0; i < 5; i++) await request(ctx.app).post('/api/v2/auth/login').send({ email: ACCOUNTS.supervisor, password: 'wrong-pass1' });
    const locked = await request(ctx.app).post('/api/v2/auth/login').send({ email: ACCOUNTS.supervisor, password: DEMO_PASSWORD });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  it('changes password, signs out other devices and enforces strength', async () => {
    const first = await loginAs(ctx.app, ACCOUNTS.finance);
    const second = await loginAs(ctx.app, ACCOUNTS.finance);
    const weak = await first.agent.post('/api/v2/auth/change-password').send({ currentPassword: DEMO_PASSWORD, newPassword: 'short' });
    expect(weak.status).toBe(422);
    const wrong = await first.agent.post('/api/v2/auth/change-password').send({ currentPassword: 'incorrect1', newPassword: 'NewPassw0rd!' });
    expect(wrong.body.error.code).toBe('WRONG_PASSWORD');
    const done = await first.agent.post('/api/v2/auth/change-password').send({ currentPassword: DEMO_PASSWORD, newPassword: 'NewPassw0rd!' });
    expect(done.status).toBe(200);
    expect((await second.agent.get('/api/v2/auth/session')).status).toBe(401);
    expect((await first.agent.get('/api/v2/auth/session')).status).toBe(200);
    await loginAs(ctx.app, ACCOUNTS.finance, 'NewPassw0rd!');
  });

  it('reset-password flow works once and the link then dies', async () => {
    await request(ctx.app).post('/api/v2/auth/forgot-password').send({ email: ACCOUNTS.manager });
    const { coll } = await import('../src/db/mongo.ts');
    const mail = await coll('mailOutbox').findOne({ to: ACCOUNTS.manager });
    const token = new URL(mail!.link).searchParams.get('token')!;
    const reset = await request(ctx.app).post('/api/v2/auth/reset-password').send({ token, newPassword: 'FreshPass1!' });
    expect(reset.status).toBe(200);
    expect((await request(ctx.app).post('/api/v2/auth/reset-password').send({ token, newPassword: 'AnotherPass1!' })).status).toBe(400);
    await loginAs(ctx.app, ACCOUNTS.manager, 'FreshPass1!');
  });

  it('forgot-password never reveals whether an email exists', async () => {
    const a = await request(ctx.app).post('/api/v2/auth/forgot-password').send({ email: 'ghost@example.com' });
    const b = await request(ctx.app).post('/api/v2/auth/forgot-password').send({ email: ACCOUNTS.hr });
    expect(a.status).toBe(200);
    expect(a.body.data.message).toBe(b.body.data.message);
  });

  it('two-factor: enable, then login needs the code', async () => {
    const { totpAt } = await import('../src/lib/totp.ts');
    const { agent } = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    const setup = await agent.post('/api/v2/auth/2fa/setup');
    expect((await agent.post('/api/v2/auth/2fa/verify').send({ otp: '000000' })).status).toBe(422);
    expect((await agent.post('/api/v2/auth/2fa/verify').send({ otp: totpAt(setup.body.data.secret) })).status).toBe(200);
    const noOtp = await request(ctx.app).post('/api/v2/auth/login').send({ email: ACCOUNTS.superAdmin, password: DEMO_PASSWORD });
    expect(noOtp.body.error.code).toBe('TWO_FACTOR_REQUIRED');
    const withOtp = await request(ctx.app).post('/api/v2/auth/login').send({ email: ACCOUNTS.superAdmin, password: DEMO_PASSWORD, otp: totpAt(setup.body.data.secret) });
    expect(withOtp.status).toBe(200);
  });

  it('health endpoints are public', async () => {
    expect((await request(ctx.app).get('/health')).body.status).toBe('ok');
    expect((await request(ctx.app).get('/ready')).status).toBe(200);
  });
});
