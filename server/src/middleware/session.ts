import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';
import { env } from '../config/env.ts';
import { coll } from '../db/mongo.ts';
import { out, type Row } from '../db/repo.ts';
import { TtlCache } from '../lib/cache.ts';
import { AppError } from '../lib/errors.ts';
import type { AuthUser } from '../domain/access.ts';

export const COOKIE = 'vook_sid';
const sha = (v: string) => createHash('sha256').update(v).digest('hex');
const ttlMs = () => env.SESSION_TTL_HOURS * 3_600_000;

const sessionCache = new TtlCache<{ session: Row; user: Row } | null>(5_000, 10_000);
export const forgetSession = (sid?: string) => { if (sid) sessionCache.deleteWhere((k) => k === sid); };
export const forgetUserSessions = () => sessionCache.clear();

const cookieOptions = () => ({ httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'lax' as const, path: '/', maxAge: ttlMs() });

export async function createSession(req: Request, res: Response, userId: string) {
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const csrfToken = randomBytes(24).toString('base64url');
  const session = { _id: sha(token), userId, csrfToken, createdAt: now, lastSeenAt: now, expiresAt: new Date(now.getTime() + ttlMs()), ip: req.ctx.ip, userAgent: String(req.headers['user-agent'] ?? '').slice(0, 200) };
  await coll('sessions').insertOne(session);
  res.cookie(COOKIE, token, cookieOptions());
  return { sid: session._id, csrfToken };
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
}

export const sidFromRequest = (req: Request): string | undefined => {
  const token = req.cookies?.[COOKIE];
  return typeof token === 'string' && token.length >= 20 ? sha(token) : undefined;
};

/** Loads the session + user for the request cookie (if any) onto req.ctx. Does not reject. */
export const loadSession: RequestHandler = async (req, _res, next) => {
  const sid = sidFromRequest(req);
  if (!sid) return next();
  const found = await sessionCache.wrap(sid, async () => {
    const session = await coll('sessions').findOne({ _id: sid });
    if (!session || session.expiresAt.getTime() < Date.now()) return null;
    const user = await coll('users').findOne({ _id: session.userId }, { projection: { passwordHash: 0, totpSecret: 0, pendingTotpSecret: 0 } });
    if (!user || user.isActive === false) return null;
    return { session: out(session as Row), user: out(user as Row) };
  });
  if (found) {
    req.ctx.sid = sid;
    req.ctx.session = found.session;
    req.ctx.user = found.user as AuthUser;
    // Sliding expiry, written at most every 5 minutes per session so reads stay cheap.
    if (Date.now() - new Date(found.session.lastSeenAt).getTime() > 300_000) {
      const now = new Date();
      found.session.lastSeenAt = now;
      void coll('sessions').updateOne({ _id: sid }, { $set: { lastSeenAt: now, expiresAt: new Date(now.getTime() + ttlMs()) } });
    }
  }
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.ctx.user) return next(new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.'));
  next();
};

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** Double-submit style CSRF: unsafe requests must echo the token issued with the session. */
// Pre-login endpoints cannot carry a token yet; /auth/refresh is protected by the session cookie plus an Origin check.
const CSRF_EXEMPT = new Set(['/auth/login', '/auth/dev-login', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password', '/auth/accept-invitation']);
export const csrfGuard: RequestHandler = (req, _res, next) => {
  if (!UNSAFE.has(req.method) || !req.ctx.session || CSRF_EXEMPT.has(req.path)) return next();
  const sent = req.headers['x-csrf-token'];
  if (typeof sent !== 'string' || sent !== req.ctx.session.csrfToken) {
    return next(new AppError(403, 'CSRF_INVALID', 'Your session needs a refresh. Please reload the page and try again.'));
  }
  next();
};

export const requestContext: RequestHandler = (req, res, next) => {
  const id = randomUUID();
  req.ctx = { requestId: id, ip: req.ip ?? '' };
  res.setHeader('X-Request-Id', id);
  next();
};
