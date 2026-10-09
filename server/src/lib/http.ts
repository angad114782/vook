import type { Request, Response } from 'express';
import type { AuthUser } from '../domain/access.ts';
import { AppError, badRequest } from './errors.ts';
import type { ZodType } from 'zod';

export interface Ctx { requestId: string; ip: string; user?: AuthUser; sid?: string; session?: Record<string, any> }

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { ctx: Ctx } }
}

export const ok = (res: Response, data: unknown, status = 200, meta?: unknown) => res.status(status).json(meta ? { data, meta } : { data });

export const me = (req: Request): AuthUser => {
  if (!req.ctx.user) throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  return req.ctx.user;
};

/** Tenant is always derived from the session. Only Super Admins may target another company via ?companyId. */
export function companyIdFor(req: Request): string {
  const user = me(req);
  const requested = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
  const id = user.role === 'SUPER_ADMIN' ? requested ?? user.companyId : user.companyId;
  if (!id) throw badRequest('Choose a company first.');
  return id;
}

/** Validate untrusted input with zod and return only the allow-listed fields (blocks mass assignment). */
export function parse<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input ?? {});
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    throw badRequest(issues[0] ? `${issues[0].field ? `${issues[0].field}: ` : ''}${issues[0].message}` : 'Some details need fixing.', { issues });
  }
  return result.data;
}

export const reqMeta = (req: Request) => ({ ip: req.ctx.ip, device: String(req.headers['user-agent'] ?? '').slice(0, 200), requestId: req.ctx.requestId });
