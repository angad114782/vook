import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '../config/env.ts';
import { coll } from '../db/mongo.ts';
import { AppError } from './errors.ts';
import { clientIp } from './ip.ts';
import { peek } from './throttle.ts';

/**
 * Bot defence for the forms attackers love (sign-in, OTP, password reset, sign-up).
 *  1. Proof-of-work: the browser must spend a fraction of a second solving a server-signed puzzle before submitting.
 *     One person never notices; a script trying thousands of passwords pays for every single attempt.
 *     The puzzle is single-use, expires in 2 minutes, and gets harder for addresses that have been failing.
 *  2. Honeypot: a hidden form field real people never fill.
 *  3. Optional Cloudflare Turnstile when TURNSTILE_SECRET is set.
 */
const signingKey = () => createHmac('sha256', env.SECRETS_KEY ? Buffer.from(env.SECRETS_KEY, 'base64') : 'vook-dev-only-secrets-key').update('botguard-v1').digest();
const sign = (payload: string) => createHmac('sha256', signingKey()).update(payload).digest('base64url');

export const botMode = (): 'on' | 'off' => (env.BOT_GUARD === 'auto' ? (env.NODE_ENV === 'test' ? 'off' : 'on') : env.BOT_GUARD);
const BASE_DIFFICULTY = 14;      // ≈ 16k hashes ≈ well under a second in a browser
const SUSPICIOUS_DIFFICULTY = 18; // ≈ 260k hashes ≈ a few seconds, for addresses with many recent failures

export async function issueChallenge(ip: string) {
  const difficulty = (await peek(`fail:ip:${ip}`)) >= 5 ? SUSPICIOUS_DIFFICULTY : BASE_DIFFICULTY;
  const expiresAt = Date.now() + 120_000;
  const payload = Buffer.from(JSON.stringify({ n: randomBytes(12).toString('base64url'), exp: expiresAt, d: difficulty })).toString('base64url');
  return { token: `${payload}.${sign(payload)}`, difficulty, expiresAt: new Date(expiresAt).toISOString() };
}

const leadingZeroBits = (buf: Buffer) => { let bits = 0; for (const byte of buf) { if (byte === 0) { bits += 8; continue; } bits += Math.clz32(byte) - 24; break; } return bits; };
const fail = () => new AppError(400, 'BOT_CHECK_FAILED', 'We could not confirm you are a person. Please refresh the page and try again.');

async function verifyProof(proof: unknown) {
  const { token, counter } = (proof ?? {}) as { token?: unknown; counter?: unknown };
  if (typeof token !== 'string' || (typeof counter !== 'number' && typeof counter !== 'string')) throw fail();
  const [payload, signature] = token.split('.');
  if (!payload || !signature) throw fail();
  const expected = Buffer.from(sign(payload)), given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw fail();
  let data: { n: string; exp: number; d: number };
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { throw fail(); }
  if (!data.exp || data.exp < Date.now()) throw fail();
  if (leadingZeroBits(createHash('sha256').update(`${token}:${counter}`).digest()) < data.d) throw fail();
  try { await coll('authThrottle').insertOne({ _id: `pow:${data.n}`, count: 1, expireAt: new Date(data.exp + 60_000) }); } // each puzzle works once
  catch { throw fail(); }
}

async function verifyTurnstile(token: unknown, ip: string) {
  if (!env.TURNSTILE_SECRET) return;
  if (typeof token !== 'string' || !token) throw fail();
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', signal: AbortSignal.timeout(6000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }) });
  const body = (await res.json().catch(() => ({}))) as { success?: boolean };
  if (!body.success) throw fail();
}

/** Throws unless the request carries a valid, unused proof (and passes the honeypot / Turnstile when enabled). */
export async function assertHuman(body: unknown, ip: string) {
  if (botMode() === 'off') return;
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.website === 'string' && b.website.trim() !== '') throw fail(); // honeypot field was filled
  await verifyProof(b.botProof);
  await verifyTurnstile(b.captchaToken, ip);
}

export const botGuard: RequestHandler = async (req, _res, next) => { await assertHuman(req.body, clientIp(req)); next(); };

