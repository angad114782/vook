import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACCOUNTS, boot, DEMO_PASSWORD, loginAs } from './helpers.ts';

let ctx: Awaited<ReturnType<typeof boot>>;
beforeAll(async () => { ctx = await boot(); });
afterAll(async () => { await ctx.stop(); });

const HR_MOBILE = '+91 90000 10001';
const post = (path: string, body: object, ip?: string) => { const r = request(ctx.app).post(`/api/v2${path}`); if (ip) r.set('X-Forwarded-For', ip); return r.send(body); };
const lastCode = async (mobileDigits: string) => {
  const { devMessages } = await import('../src/lib/messaging.ts');
  return devMessages.find((m) => m.to === mobileDigits)?.code;
};

describe('mobile + password', () => {
  it('signs in with the mobile number in any common format, and keeps the same safe errors', async () => {
    for (const mobile of [HR_MOBILE, '9000010001', '+919000010001', '090000 10001']) {
      const res = await post('/auth/login', { identifier: mobile, password: DEMO_PASSWORD });
      expect(res.status, mobile).toBe(200);
      expect(res.body.data.user.role).toBe('HR');
      expect(res.headers['cache-control']).toContain('no-store');
    }
    const wrong = await post('/auth/login', { identifier: HR_MOBILE, password: 'not-it-1' });
    const unknown = await post('/auth/login', { identifier: '9999999999', password: 'not-it-1' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message); // no hint whether the number exists
  });

  it('email login still works through the old field name', async () => {
    expect((await post('/auth/login', { email: ACCOUNTS.hr, password: DEMO_PASSWORD })).status).toBe(200);
  });

  it('one mobile number belongs to one person', async () => {
    const admin = await loginAs(ctx.app, ACCOUNTS.companyAdmin);
    const taken = await admin.agent.post('/api/v2/users').send({ name: 'Copycat', email: 'copy@example.com', role: 'HR', mobile: HR_MOBILE });
    expect(taken.body.error.code).toBe('MOBILE_IN_USE');
    expect((await admin.agent.post('/api/v2/users').send({ name: 'Bad Number', email: 'bad@example.com', role: 'HR', mobile: '123' })).body.error.code).toBe('INVALID_MOBILE');
    const ok = await admin.agent.post('/api/v2/users').send({ name: 'Fresh Person', email: 'fresh@example.com', role: 'HR', mobile: '98765 11111' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.mobileKey).toBeUndefined();
  });
});

describe('mobile OTP sign-in', () => {
  it('offers the available ways to get a code', async () => {
    const options = (await request(ctx.app).get('/api/v2/auth/login-options')).body.data;
    expect(options.password).toBe(true);
    expect(options.otp.enabled).toBe(true);
    expect(options.otp.channels).toEqual(expect.arrayContaining(['WHATSAPP', 'SMS']));
  });

  it('sends a code, signs in once with it, and the code dies afterwards', async () => {
    const asked = await post('/auth/otp/request', { mobile: '9000010002', channel: 'SMS' });
    expect(asked.status).toBe(200);
    expect(asked.body.data.devOtp).toBeUndefined(); // codes are never in the response outside local development
    const code = (await lastCode('9000010002'))!;
    expect(code).toMatch(/^\d{6}$/);
    const wrong = await post('/auth/otp/verify', { mobile: '9000010002', code: code === '000000' ? '111111' : '000000' });
    expect(wrong.body.error.code).toBe('INVALID_OTP');
    const good = await post('/auth/otp/verify', { mobile: '+91 90000 10002', code });
    expect(good.status).toBe(200);
    expect(good.body.data.user.role).toBe('FINANCE');
    expect(good.headers['set-cookie']?.[0]).toMatch(/HttpOnly/i);
    expect((await post('/auth/otp/verify', { mobile: '9000010002', code })).body.error.code).toBe('INVALID_OTP');
  });

  it('answers the same for unknown numbers, sends nothing, and enforces cool-down and hourly limits', async () => {
    const { devMessages } = await import('../src/lib/messaging.ts');
    const before = devMessages.length;
    const stranger = await post('/auth/otp/request', { mobile: '9111122222', channel: 'WHATSAPP' });
    const known = await post('/auth/otp/request', { mobile: '9000010003', channel: 'WHATSAPP' });
    expect(stranger.status).toBe(200);
    expect(stranger.body.data.message).toBe(known.body.data.message);
    expect(devMessages.length - before).toBe(1); // only the registered number got a message
    const again = await post('/auth/otp/request', { mobile: '9000010003', channel: 'WHATSAPP' });
    expect(again.status).toBe(429);
    expect(again.body.error.code).toBe('OTP_COOLDOWN');
    expect((await post('/auth/otp/request', { mobile: '12345', channel: 'SMS' })).body.error.code).toBe('INVALID_MOBILE');
  });

  it('allows five guesses per code, then the code is dead even if the right one is entered', async () => {
    await post('/auth/otp/request', { mobile: '9000010004', channel: 'SMS' }, '198.51.100.20');
    const code = (await lastCode('9000010004'))!;
    const wrongCode = code === '123456' ? '654321' : '123456';
    for (let i = 0; i < 5; i++) expect((await post('/auth/otp/verify', { mobile: '9000010004', code: wrongCode }, '198.51.100.21')).body.error.code).toBe('INVALID_OTP');
    expect((await post('/auth/otp/verify', { mobile: '9000010004', code }, '198.51.100.22')).body.error.code).toBe('INVALID_OTP');
  });

  it('asks for the authenticator code too when the account has two-step sign-in', async () => {
    const { totpAt, newSecret } = await import('../src/lib/totp.ts');
    const { coll } = await import('../src/db/mongo.ts');
    const secret = newSecret();
    await coll('users').updateOne({ mobileKey: '9000010005' }, { $set: { twoFactorEnabled: true, totpSecret: secret } });
    await post('/auth/otp/request', { mobile: '9000010005', channel: 'SMS' });
    const code = (await lastCode('9000010005'))!;
    const first = await post('/auth/otp/verify', { mobile: '9000010005', code });
    expect(first.body.error.code).toBe('TWO_FACTOR_REQUIRED');
    const second = await post('/auth/otp/verify', { mobile: '9000010005', code, totp: totpAt(secret) }); // same SMS code is still valid for the retry
    expect(second.status).toBe(200);
  });
});

describe('network protection', () => {
  it('blocks an address after repeated failures, even for correct passwords, without affecting others', async () => {
    const attacker = '198.51.100.99';
    for (let i = 0; i < 20; i++) await post('/auth/login', { identifier: `ghost${i}@example.com`, password: 'wrong-pass1' }, attacker);
    const blocked = await post('/auth/login', { identifier: ACCOUNTS.hr, password: DEMO_PASSWORD }, attacker);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('IP_TEMPORARILY_BLOCKED');
    expect((await post('/auth/otp/request', { mobile: '9000010001', channel: 'SMS' }, attacker)).status).toBe(429);
    expect((await post('/auth/login', { identifier: ACCOUNTS.hr, password: DEMO_PASSWORD }, '198.51.100.100')).status).toBe(200);
  });

  it('platform admin can deny networks and limit admin sign-in to approved ones, but cannot lock themselves out', async () => {
    const sa = await loginAs(ctx.app, ACCOUNTS.superAdmin);
    const own = (await sa.agent.get('/api/v2/auth/session')) && '127.0.0.1';
    expect((await sa.agent.put('/api/v2/settings/platform').send({ security: { blockedIps: [own] } })).body.error.code).toBe('WOULD_LOCK_OUT');
    expect((await sa.agent.put('/api/v2/settings/platform').send({ security: { adminAllowedIps: ['203.0.113.5'] } })).body.error.code).toBe('WOULD_LOCK_OUT');
    expect((await sa.agent.put('/api/v2/settings/platform').send({ security: { blockedIps: ['not an ip'] } })).status).toBe(422);
    expect((await sa.agent.put('/api/v2/settings/platform').send({ security: { blockedIps: ['203.0.113.0/24'], adminAllowedIps: [own] } })).status).toBe(200);
    const denied = await post('/auth/login', { identifier: ACCOUNTS.hr, password: DEMO_PASSWORD }, '203.0.113.77');
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('IP_BLOCKED');
    const elsewhere = await post('/auth/login', { identifier: ACCOUNTS.superAdmin, password: DEMO_PASSWORD }, '198.51.100.150');
    expect(elsewhere.body.error.code).toBe('ADMIN_IP_NOT_ALLOWED');
    expect((await post('/auth/login', { identifier: ACCOUNTS.manager, password: DEMO_PASSWORD }, '198.51.100.150')).status).toBe(200); // ordinary users are not limited by the admin list
    await sa.agent.put('/api/v2/settings/platform').send({ security: { blockedIps: [], adminAllowedIps: [] } });
    expect((await post('/auth/login', { identifier: ACCOUNTS.superAdmin, password: DEMO_PASSWORD }, '198.51.100.150')).status).toBe(200);
  });

  it('limits password-reset emails per address', async () => {
    const { coll } = await import('../src/db/mongo.ts');
    for (let i = 0; i < 5; i++) await post('/auth/forgot-password', { email: ACCOUNTS.manager }, `198.51.100.${30 + i}`);
    expect(await coll('mailOutbox').countDocuments({ to: ACCOUNTS.manager })).toBe(3);
  });
});
