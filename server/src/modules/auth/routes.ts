import { VOOK_LOGINS } from '../../seed/accounts.ts';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { z } from 'zod';
import { coll } from '../../db/mongo.ts';
import { byId, findOne, insert, patch, type Row } from '../../db/repo.ts';
import { assertHuman, botMode, issueChallenge } from '../../lib/botguard.ts';
import { clientIp, ipMatches, looksLikeEmail, mobileKeyOf } from '../../lib/ip.ts';
import { availableChannels, sendOtp } from '../../lib/messaging.ts';
import { platformSettings } from '../../lib/settings.ts';
import { blockFor, blockedMs, hit } from '../../lib/throttle.ts';
import { nowIso } from '../../lib/serialize.ts';
import { appendAudit } from '../../domain/access.ts';
import { AppError, forbidden, unauthenticated } from '../../lib/errors.ts';
import { me, ok, parse, reqMeta } from '../../lib/http.ts';
import { sendMail } from '../../lib/mail.ts';
import { hashPassword, passwordProblem, verifyPassword } from '../../lib/password.ts';
import { newSecret, otpauthUrl, verifyTotp } from '../../lib/totp.ts';
import { clearSessionCookie, createSession, forgetSession, forgetUserSessions, requireAuth } from '../../middleware/session.ts';
import { env } from '../../config/env.ts';

export const authRouter = Router();

const sha = (v: string) => createHash('sha256').update(v).digest('hex');
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000, limit: 40, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}:${String(req.body?.identifier ?? req.body?.email ?? '').toLowerCase()}`,
  handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many sign-in attempts. Please wait a few minutes and try again.')),
});

const publicUser = async (user: Row) => {
  const { passwordHash, totpSecret, pendingTotpSecret, failedLogins, lockedUntil, emailLower, mobileKey, ...safe } = user;
  const company = user.companyId ? await byId('companies', user.companyId) : null;
  return { ...safe, twoFactorEnabled: Boolean(user.twoFactorEnabled), company: company ? { id: company.id, name: company.name, companyCode: company.companyCode } : null };
};

// A constant dummy hash keeps unknown-account and wrong-password attempts equally slow (no account enumeration).
let dummyHash: Promise<string> | undefined;
const dummy = () => (dummyHash ??= hashPassword('not-a-real-password'));
const noStore = (res: import('express').Response) => res.setHeader('Cache-Control', 'no-store');

// ── Network protection shared by every sign-in route ───────────────────
/** Denied networks and temporarily blocked addresses are turned away before any credential is looked at. */
async function networkGate(req: import('express').Request): Promise<string> {
  const ip = clientIp(req);
  const denied = ((await platformSettings()).security?.blockedIps ?? []) as string[];
  if (denied.length && ipMatches(ip, denied)) throw new AppError(403, 'IP_BLOCKED', 'Sign-in is not available from this network. Please contact your administrator.');
  const ms = await blockedMs(`ip:${ip}`);
  if (ms > 0) throw new AppError(429, 'IP_TEMPORARILY_BLOCKED', `Too many failed attempts from your network. Please try again in ${Math.ceil(ms / 60_000)} minute${ms > 60_000 ? 's' : ''}.`, { retryAfterSeconds: Math.ceil(ms / 1000) });
  return ip;
}
/** 20 failures in 15 minutes blocks the address for 30 min; repeat offenders get 4 h, then 24 h. */
async function recordFailure(ip: string) {
  if ((await hit(`fail:ip:${ip}`, 15 * 60_000)) < 20) return;
  const strikes = await hit(`strike:ip:${ip}`, 24 * 3_600_000);
  await blockFor(`ip:${ip}`, strikes >= 3 ? 24 * 3_600_000 : strikes === 2 ? 4 * 3_600_000 : 30 * 60_000);
}

async function completeLogin(req: import('express').Request, res: import('express').Response, user: Row, ip: string, method: 'PASSWORD' | 'OTP', totp?: string) {
  if (user.isActive === false) throw new AppError(403, 'ACCOUNT_SUSPENDED', 'This account is suspended. Please contact your admin.');
  if (user.twoFactorEnabled && user.totpSecret) {
    if (!totp) throw new AppError(401, 'TWO_FACTOR_REQUIRED', 'Enter the 6-digit code from your authenticator app.');
    if (!verifyTotp(user.totpSecret, totp)) { await recordFailure(ip); throw new AppError(401, 'INVALID_OTP', 'That code is not correct. Please try again.'); }
  }
  if (user.role === 'SUPER_ADMIN') {
    const allowed = ((await platformSettings()).security?.adminAllowedIps ?? []) as string[];
    if (allowed.length && !ipMatches(ip, allowed)) {
      await appendAudit({ actorId: user.id, companyId: null, action: 'LOGIN_BLOCKED_IP', entityType: 'USER', entityId: user.id, ...reqMeta(req) });
      throw new AppError(403, 'ADMIN_IP_NOT_ALLOWED', 'Admin sign-in is only allowed from approved networks.');
    }
  }
  const updated = (await patch('users', { _id: user.id }, { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date().toISOString(), lastLoginIp: ip })) as Row;
  const { csrfToken } = await createSession(req, res, user.id);
  await appendAudit({ actorId: user.id, companyId: user.companyId, action: method === 'OTP' ? 'LOGIN_OTP' : 'LOGIN', entityType: 'USER', entityId: user.id, ...reqMeta(req) });
  noStore(res);
  ok(res, { user: await publicUser(updated), csrfToken });
}

const proofFields = { botProof: z.any().optional(), website: z.string().max(200).optional(), captchaToken: z.string().max(4000).optional() };
const sha16 = (v: string) => sha(v).slice(0, 24);

// What the sign-in screen may offer, and the puzzle that proves a person is behind it.
authRouter.get('/auth/login-options', async (_req, res) => {
  noStore(res);
  const channels = await availableChannels();
  ok(res, { password: true, otp: { enabled: channels.length > 0, channels, codeLength: 6, resendAfterSeconds: 30, expiresInSeconds: env.OTP_TTL_MINUTES * 60 }, botGuard: { enabled: botMode() === 'on', turnstileSiteKey: env.TURNSTILE_SECRET ? env.TURNSTILE_SITE_KEY ?? null : null } });
});

authRouter.get('/auth/challenge', async (req, res) => {
  noStore(res);
  const ip = clientIp(req);
  if (botMode() === 'off') return ok(res, { enabled: false });
  if ((await hit(`chal:ip:${ip}`, 60_000)) > 40) throw new AppError(429, 'RATE_LIMITED', 'Too many requests. Please wait a moment.');
  ok(res, { enabled: true, ...(await issueChallenge(ip)) });
});

authRouter.post('/auth/login', loginLimiter, async (req, res) => {
  const body = parse(z.object({ identifier: z.string().trim().min(3).max(200).optional(), email: z.string().trim().min(3).max(200).optional(), password: z.string().min(1).max(200), otp: z.string().optional(), ...proofFields }), req.body);
  const identifier = body.identifier ?? body.email;
  if (!identifier) throw new AppError(422, 'VALIDATION_ERROR', 'Enter your email or mobile number.');
  const ip = await networkGate(req);
  await assertHuman(req.body, ip);
  if ((await hit(`login:id:${sha16(identifier.toLowerCase())}`, 15 * 60_000)) > 15) throw new AppError(429, 'RATE_LIMITED', 'Too many attempts for this account. Please wait a few minutes.');
  const mobileKey = looksLikeEmail(identifier) ? undefined : mobileKeyOf(identifier);
  const user = looksLikeEmail(identifier) ? await findOne('users', { emailLower: identifier.toLowerCase() }) : mobileKey ? await findOne('users', { mobileKey }) : null;
  if (user?.lockedUntil && new Date(user.lockedUntil) > new Date()) throw new AppError(429, 'ACCOUNT_LOCKED', 'Too many wrong passwords. Try again in a few minutes, or reset your password.');
  const valid = await verifyPassword(body.password, user?.passwordHash ?? (await dummy()));
  if (!user || !valid) {
    await recordFailure(ip);
    if (user) {
      const failed = (user.failedLogins ?? 0) + 1;
      await patch('users', { _id: user.id }, failed >= MAX_FAILED ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() } : { failedLogins: failed });
    }
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email, mobile number or password is not correct.');
  }
  await completeLogin(req, res, user, ip, 'PASSWORD', body.otp);
});

// ── One-click sign-in for developers (this computer only) ──────────────
// Three independent locks: development mode, the connection really comes from this machine (not through a proxy or tunnel),
// and the address being used is localhost. Anywhere else these routes answer as if they did not exist.
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
function localDevOnly(req: import('express').Request) {
  const host = String(req.headers.host ?? '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  const viaProxy = Boolean(req.headers['x-forwarded-for'] || req.headers['x-forwarded-host'] || req.headers.forwarded || req.headers['x-real-ip']);
  const ok = env.NODE_ENV === 'development' && env.DEV_QUICK_LOGIN === 'on' && LOOPBACK.has(req.socket.remoteAddress ?? '') && !viaProxy && ['localhost', '127.0.0.1', '::1'].includes(host);
  if (!ok) throw new AppError(404, 'NOT_FOUND', 'Not found.');
}

authRouter.get('/auth/dev-accounts', async (req, res) => {
  localDevOnly(req);
  const rows = await Promise.all(Object.values(VOOK_LOGINS).map((email) => findOne('users', { emailLower: email })));
  noStore(res);
  ok(res, { accounts: rows.filter(Boolean).map((u) => ({ role: u!.role, name: u!.name, email: u!.email })) });
});

authRouter.post('/auth/dev-login', async (req, res) => {
  localDevOnly(req);
  const { role } = parse(z.object({ role: z.enum(['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR', 'FINANCE', 'MANAGER', 'SUPERVISOR', 'EMPLOYEE']) }), req.body);
  const user = (await Promise.all(Object.values(VOOK_LOGINS).map((email) => findOne('users', { emailLower: email })))).find((u) => u?.role === role);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'No sample account for this role. Seed the database first.');
  await completeLogin(req, res, { ...user, twoFactorEnabled: false }, req.socket.remoteAddress ?? 'local', 'PASSWORD');
});

// ── Mobile OTP sign-in (WhatsApp / SMS) ────────────────────────────────
const otpKey = () => createHmac('sha256', env.SECRETS_KEY ? Buffer.from(env.SECRETS_KEY, 'base64') : 'vook-dev-only-secrets-key').update('otp-v1').digest();
const otpHash = (mobileKey: string, code: string) => createHmac('sha256', otpKey()).update(`${mobileKey}:${code}`).digest('hex');
const GENERIC_OTP_REPLY = 'If this mobile number is registered, we have sent a 6-digit code.';
const mobileOrThrow = (v: unknown) => mobileKeyOf(v) ?? (() => { throw new AppError(422, 'INVALID_MOBILE', 'Enter a valid 10-digit mobile number.'); })();

authRouter.post('/auth/otp/request', async (req, res) => {
  noStore(res);
  const body = parse(z.object({ mobile: z.string().trim().min(1).max(20), channel: z.enum(['WHATSAPP', 'SMS']).default('WHATSAPP'), ...proofFields }), req.body);
  const ip = await networkGate(req);
  if ((await hit(`otp:req:ip:${ip}`, 3_600_000)) > 15) throw new AppError(429, 'RATE_LIMITED', 'Too many code requests from your network. Please try again in a while.');
  await assertHuman(req.body, ip);
  const mobileKey = mobileOrThrow(body.mobile);
  // Same limits for every number, registered or not, so this cannot be used to find who has an account or to pump SMS to strangers.
  if ((await hit(`otp:req:mobile:${mobileKey}`, 3_600_000)) > 5) throw new AppError(429, 'RATE_LIMITED', 'Too many codes asked for this number. Please try again in an hour, or sign in with your password.');
  if ((await hit(`otp:cool:${mobileKey}`, 30_000)) > 1) throw new AppError(429, 'OTP_COOLDOWN', 'Please wait 30 seconds before asking for another code.', { retryAfterSeconds: 30 });
  if (!(await availableChannels()).includes(body.channel)) throw new AppError(422, 'CHANNEL_UNAVAILABLE', 'That way of getting a code is not available. Choose another or use your password.');
  const user = await findOne('users', { mobileKey });
  let devOtp: string | undefined;
  if (user && user.isActive !== false) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await coll('otpCodes').deleteMany({ mobileKey }); // only the newest code works
    await insert('otpCodes', { mobileKey, userId: user.id, channel: body.channel, codeHash: otpHash(mobileKey, code), attempts: 0, createdAt: nowIso(), expireAt: new Date(Date.now() + env.OTP_TTL_MINUTES * 60_000) }, 'otp');
    try { await sendOtp({ channel: body.channel, mobileKey, code }); } catch (err) { if (err instanceof AppError) throw err; /* provider hiccup: answer the same way so nothing leaks */ }
    if (env.NODE_ENV === 'development') devOtp = code;
  }
  ok(res, { message: GENERIC_OTP_REPLY, channel: body.channel, expiresInSeconds: env.OTP_TTL_MINUTES * 60, resendAfterSeconds: 30, ...(devOtp ? { devOtp } : {}) });
});

authRouter.post('/auth/otp/verify', async (req, res) => {
  noStore(res);
  const body = parse(z.object({ mobile: z.string().trim().min(1).max(20), code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.'), totp: z.string().optional() }), req.body);
  const ip = await networkGate(req);
  if ((await hit(`otp:verify:ip:${ip}`, 15 * 60_000)) > 30) throw new AppError(429, 'RATE_LIMITED', 'Too many attempts. Please wait a few minutes.');
  const mobileKey = mobileOrThrow(body.mobile);
  const bad = async () => { await recordFailure(ip); return new AppError(401, 'INVALID_OTP', 'That code is not correct or has expired. Please try again or ask for a new code.'); };
  const record = await findOne('otpCodes', { mobileKey });
  if (!record || new Date(record.expireAt) < new Date()) throw await bad();
  const tries = await coll('otpCodes').findOneAndUpdate({ _id: record.id }, { $inc: { attempts: 1 } }, { returnDocument: 'after' });
  if (!tries || tries.attempts > 5) { await coll('otpCodes').deleteOne({ _id: record.id }); throw await bad(); } // five guesses per code, then it is dead
  const given = Buffer.from(otpHash(mobileKey, body.code)), want = Buffer.from(record.codeHash);
  if (given.length !== want.length || !timingSafeEqual(given, want)) throw await bad();
  const user = await byId('users', record.userId);
  if (!user || user.isActive === false) throw await bad();
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) throw new AppError(429, 'ACCOUNT_LOCKED', 'Too many wrong passwords on this account. Try again in a few minutes.');
  if (user.twoFactorEnabled && user.totpSecret && !body.totp) throw new AppError(401, 'TWO_FACTOR_REQUIRED', 'Enter the 6-digit code from your authenticator app.'); // keeps the SMS code valid for the retry
  await completeLogin(req, res, user, ip, 'OTP', body.totp);
  await coll('otpCodes').deleteOne({ _id: record.id }); // one use only
});

authRouter.get('/auth/session', async (req, res) => {
  const user = req.ctx.user;
  if (!user) throw unauthenticated('No active session.');
  ok(res, { user: await publicUser((await byId('users', user.id)) as Row), csrfToken: req.ctx.session!.csrfToken });
});

export const updateSelf = async (req: import('express').Request, res: import('express').Response) => {
  const user = me(req);
  const body = parse(z.object({ name: z.string().trim().min(1).max(120).optional(), email: z.string().trim().email().max(200).optional(), avatar: z.string().max(400_000).nullable().optional() }), req.body);
  const set: Row = { ...body };
  if (body.email) {
    set.emailLower = body.email.toLowerCase();
    const taken = await findOne('users', { emailLower: set.emailLower, _id: { $ne: user.id } });
    if (taken) throw new AppError(409, 'EMAIL_IN_USE', 'Another account already uses this email.');
  }
  const updated = (await patch('users', { _id: user.id }, set)) as Row;
  forgetSession(req.ctx.sid);
  ok(res, await publicUser(updated));
};
authRouter.patch('/auth/session', requireAuth, updateSelf);

const endSession = async (req: import('express').Request, res: import('express').Response) => {
  if (req.ctx.sid) { await coll('sessions').deleteOne({ _id: req.ctx.sid }); forgetSession(req.ctx.sid); }
  clearSessionCookie(res);
  ok(res, null);
};
authRouter.post('/auth/logout', endSession);
authRouter.delete('/auth/session', endSession);

// Rotates the session id so a leaked cookie has a short useful life.
authRouter.post('/auth/refresh', async (req, res) => {
  const user = req.ctx.user;
  if (!user) throw unauthenticated('Your session has ended. Please sign in again.');
  const origin = req.headers.origin;
  if (origin && origin !== env.CORS_ORIGIN) throw forbidden('This request came from an unexpected place.', 'BAD_ORIGIN');
  await coll('sessions').deleteOne({ _id: req.ctx.sid });
  forgetSession(req.ctx.sid);
  const { csrfToken } = await createSession(req, res, user.id);
  ok(res, { csrfToken });
});

authRouter.post('/auth/forgot-password', rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false, handler: (_q, _s, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many requests. Please wait a few minutes.')) }), async (req, res) => {
  const { email } = parse(z.object({ email: z.string().trim().email().max(200), ...proofFields }), req.body);
  const ip = await networkGate(req);
  await assertHuman(req.body, ip);
  const user = await findOne('users', { emailLower: email.toLowerCase() });
  let devResetLink: string | undefined;
  // At most 3 reset emails per address per hour, so nobody can use this form to flood an inbox. Same answer either way.
  const allowed = (await hit(`forgot:${sha16(email.toLowerCase())}`, 3_600_000)) <= 3;
  if (user && user.isActive !== false && allowed) {
    const token = randomBytes(32).toString('base64url');
    await insert('authTokens', { id: sha(token), userId: user.id, type: 'RESET', expiresAt: new Date(Date.now() + 3_600_000).toISOString() }, 'token');
    const link = `${env.CORS_ORIGIN.split(',')[0]!.trim()}/reset-password?token=${token}`;
    await sendMail({ to: user.email, subject: 'Reset your Vook password', text: 'Use the link to choose a new password. It works for one hour.', link });
    // Local development has no mail server, so hand the link back. Never in production or tests (it would reveal which emails exist).
    if (env.NODE_ENV === 'development') devResetLink = link;
  }
  ok(res, { message: 'If that email has an account, we have sent a link to reset the password.', ...(devResetLink ? { devResetLink } : {}) });
});

async function consumeToken(token: string, type: 'RESET' | 'INVITE') {
  const row = await findOne('authTokens', { _id: sha(token), type });
  if (!row || row.usedAt || new Date(row.expiresAt) < new Date()) throw new AppError(400, 'LINK_EXPIRED', 'This link has expired or was already used. Please ask for a new one.');
  return row;
}
const finishPasswordSet = async (userId: string, password: string, tokenId: string) => {
  const problem = passwordProblem(password);
  if (problem) throw new AppError(422, 'WEAK_PASSWORD', problem);
  await patch('users', { _id: userId }, { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null, passwordChangedAt: new Date().toISOString() });
  await patch('authTokens', { _id: tokenId }, { usedAt: new Date().toISOString() });
  await coll('sessions').deleteMany({ userId });
  forgetUserSessions();
};

authRouter.post('/auth/reset-password', async (req, res) => {
  const { token, newPassword } = parse(z.object({ token: z.string().min(10), newPassword: z.string() }), req.body);
  const row = await consumeToken(token, 'RESET');
  await finishPasswordSet(row.userId, newPassword, row.id);
  ok(res, { message: 'Your password has been changed. You can sign in now.' });
});

authRouter.post('/auth/accept-invitation', async (req, res) => {
  const { token, password } = parse(z.object({ token: z.string().min(10), password: z.string() }), req.body);
  const row = await consumeToken(token, 'INVITE');
  await finishPasswordSet(row.userId, password, row.id);
  await patch('users', { _id: row.userId }, { isActive: true, accountStatus: 'ACTIVE' });
  ok(res, { message: 'Your account is ready. You can sign in now.' });
});

authRouter.post('/auth/change-password', requireAuth, async (req, res) => {
  const user = me(req);
  const { currentPassword, newPassword } = parse(z.object({ currentPassword: z.string().min(1), newPassword: z.string() }), req.body);
  const full = (await byId('users', user.id)) as Row;
  if (!(await verifyPassword(currentPassword, full.passwordHash))) throw new AppError(422, 'WRONG_PASSWORD', 'Your current password is not correct.');
  const problem = passwordProblem(newPassword);
  if (problem) throw new AppError(422, 'WEAK_PASSWORD', problem);
  await patch('users', { _id: user.id }, { passwordHash: await hashPassword(newPassword), passwordChangedAt: new Date().toISOString() });
  // Sign out other devices; keep this one.
  await coll('sessions').deleteMany({ userId: user.id, _id: { $ne: req.ctx.sid } });
  forgetUserSessions();
  await appendAudit({ actorId: user.id, companyId: user.companyId, action: 'PASSWORD_CHANGED', entityType: 'USER', entityId: user.id, ...reqMeta(req) });
  ok(res, { message: 'Password changed.' });
});

authRouter.get('/auth/security/sessions', requireAuth, async (req, res) => {
  const user = me(req);
  const sessions = (await coll('sessions').find({ userId: user.id }).sort({ lastSeenAt: -1 }).limit(50).toArray()).map((s) => ({
    _id: s._id, id: s._id, device: String(s.userAgent || 'Unknown device'), ip: s.ip, lastSeenAt: s.lastSeenAt, createdAt: s.createdAt, current: s._id === req.ctx.sid,
  }));
  ok(res, { sessions });
});

authRouter.delete('/auth/security/sessions/:id', requireAuth, async (req, res) => {
  const user = me(req);
  const id = String(req.params.id);
  await coll('sessions').deleteOne({ _id: id, userId: user.id });
  forgetUserSessions();
  if (id === req.ctx.sid) clearSessionCookie(res);
  ok(res, { message: 'Session signed out.' });
});

authRouter.post('/auth/security/revoke-all', requireAuth, async (req, res) => {
  const user = me(req);
  await coll('sessions').deleteMany({ userId: user.id });
  forgetUserSessions();
  clearSessionCookie(res);
  await appendAudit({ actorId: user.id, companyId: user.companyId, action: 'SESSIONS_REVOKED', entityType: 'USER', entityId: user.id, ...reqMeta(req) });
  ok(res, { message: 'Signed out everywhere.' });
});

authRouter.get('/auth/2fa/status', requireAuth, async (req, res) => {
  const user = (await byId('users', me(req).id)) as Row;
  ok(res, { enabled: Boolean(user.twoFactorEnabled), enrollmentRequired: user.role === 'SUPER_ADMIN' && !user.twoFactorEnabled });
});

authRouter.post('/auth/2fa/setup', requireAuth, async (req, res) => {
  const user = me(req);
  const secret = newSecret();
  await patch('users', { _id: user.id }, { pendingTotpSecret: secret });
  ok(res, { secret, otpauthUrl: otpauthUrl(user.email, secret), qrCodeDataUrl: '' });
});

authRouter.post('/auth/2fa/verify', requireAuth, async (req, res) => {
  const user = me(req);
  const { otp } = parse(z.object({ otp: z.string() }), req.body);
  const full = (await byId('users', user.id)) as Row;
  const secret = full.pendingTotpSecret ?? full.totpSecret;
  if (!secret || !verifyTotp(secret, otp)) throw new AppError(422, 'INVALID_OTP', 'That code is not correct. Please try again.');
  await patch('users', { _id: user.id }, { twoFactorEnabled: true, totpSecret: secret, pendingTotpSecret: null });
  forgetSession(req.ctx.sid);
  await appendAudit({ actorId: user.id, companyId: user.companyId, action: 'TWO_FACTOR_ENABLED', entityType: 'USER', entityId: user.id, ...reqMeta(req) });
  ok(res, { enabled: true });
});

authRouter.post('/auth/2fa/disable', requireAuth, async (req, res) => {
  const user = me(req);
  const full = (await byId('users', user.id)) as Row;
  if (full.twoFactorEnabled && full.totpSecret) {
    const { otp } = parse(z.object({ otp: z.string().optional() }), req.body);
    if (otp !== undefined && !verifyTotp(full.totpSecret, otp)) throw new AppError(422, 'INVALID_OTP', 'That code is not correct. Please try again.');
  }
  await patch('users', { _id: user.id }, { twoFactorEnabled: false, totpSecret: null, pendingTotpSecret: null });
  forgetSession(req.ctx.sid);
  await appendAudit({ actorId: user.id, companyId: user.companyId, action: 'TWO_FACTOR_DISABLED', entityType: 'USER', entityId: user.id, ...reqMeta(req) });
  ok(res, { enabled: false });
});

