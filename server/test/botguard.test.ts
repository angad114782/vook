import { createHash } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACCOUNTS, boot, DEMO_PASSWORD } from './helpers.ts';

let ctx: Awaited<ReturnType<typeof boot>>;
beforeAll(async () => { ctx = await boot({ BOT_GUARD: 'on' }); });
afterAll(async () => { await ctx.stop(); });

const post = (path: string, body: object, ip?: string) => { const r = request(ctx.app).post(`/api/v2${path}`); if (ip) r.set('X-Forwarded-For', ip); return r.send(body); };

describe('bot protection', () => {
  const bits = (b: Buffer) => { let n = 0; for (const byte of b) { if (!byte) { n += 8; continue; } n += Math.clz32(byte) - 24; break; } return n; };
  const solve = (token: string, difficulty: number) => { for (let i = 0; ; i++) if (bits(createHash('sha256').update(`${token}:${i}`).digest()) >= difficulty) return i; };
  const proof = async (ip = '203.0.113.200') => {
    const c = (await request(ctx.app).get('/api/v2/auth/challenge').set('X-Forwarded-For', ip)).body.data;
    return { botProof: { token: c.token, counter: solve(c.token, c.difficulty) }, difficulty: c.difficulty };
  };

  it('turns away sign-in attempts that did not solve the puzzle, fill the hidden field, or reuse a solved puzzle', async () => {
    const creds = { identifier: ACCOUNTS.hr, password: DEMO_PASSWORD };
    expect((await post('/auth/login', creds)).body.error.code).toBe('BOT_CHECK_FAILED');
    const ok = await proof();
    expect((await post('/auth/login', { ...creds, botProof: ok.botProof })).status).toBe(200);
    expect((await post('/auth/login', { ...creds, botProof: ok.botProof })).body.error.code).toBe('BOT_CHECK_FAILED'); // single use
    const p2 = await proof();
    expect((await post('/auth/login', { ...creds, botProof: { ...p2.botProof, counter: 'nope' } })).body.error.code).toBe('BOT_CHECK_FAILED');
    const p3 = await proof();
    expect((await post('/auth/login', { ...creds, botProof: { token: p3.botProof.token.replace(/.$/, 'x'), counter: p3.botProof.counter } })).body.error.code).toBe('BOT_CHECK_FAILED'); // tampered signature
    const p4 = await proof();
    expect((await post('/auth/login', { ...creds, botProof: p4.botProof, website: 'http://spam.example' })).body.error.code).toBe('BOT_CHECK_FAILED'); // honeypot
  });

  it('guards the code request and password reset too, and makes the puzzle harder for addresses that keep failing', async () => {
    expect((await post('/auth/otp/request', { mobile: '9000010001', channel: 'SMS' })).body.error.code).toBe('BOT_CHECK_FAILED');
    expect((await post('/auth/forgot-password', { email: ACCOUNTS.hr })).body.error.code).toBe('BOT_CHECK_FAILED');
    const easy = await request(ctx.app).get('/api/v2/auth/challenge').set('X-Forwarded-For', '203.0.113.210');
    expect(easy.body.data.difficulty).toBe(14);
    for (let i = 0; i < 5; i++) { const p = await proof('203.0.113.210'); await post('/auth/login', { identifier: 'nobody@example.com', password: 'wrong-pass1', botProof: p.botProof }, '203.0.113.210'); }
    const hard = await request(ctx.app).get('/api/v2/auth/challenge').set('X-Forwarded-For', '203.0.113.210');
    expect(hard.body.data.difficulty).toBe(18);
    const options = (await request(ctx.app).get('/api/v2/auth/login-options')).body.data;
    expect(options.botGuard.enabled).toBe(true);
  });
});
