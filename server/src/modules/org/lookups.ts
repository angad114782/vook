import { Router } from 'express';
import { z } from 'zod';
import { coll } from '../../db/mongo.ts';
import { appendAudit } from '../../domain/access.ts';
import { AppError } from '../../lib/errors.ts';
import { companyIdFor, me, ok, parse, reqMeta } from '../../lib/http.ts';
import { nowIso } from '../../lib/serialize.ts';

/**
 * Pick-lists that used to be fixed in the screens (document categories, expense categories, support topics,
 * employment types, industries). They are plain data: the first time a list is opened the usual choices are added once,
 * after that anyone allowed can add or delete entries and nothing comes back by itself.
 */
export const lookupRouter = Router();

type Spec = { defaults: string[]; manage: string[]; scope: 'company' | 'platform'; inUse?: { collection: string; field: string; companyScoped: boolean } };
const SPECS: Record<string, Spec> = {
  DOCUMENT_CATEGORY: { defaults: ['Safety', 'HR Policy', 'Compliance', 'IT Policy', 'Finance'], manage: ['COMPANY_ADMIN', 'HR'], scope: 'company', inUse: { collection: 'documents', field: 'category', companyScoped: true } },
  EXPENSE_CATEGORY: { defaults: ['Travel', 'Materials', 'Utilities', 'Maintenance', 'Others'], manage: ['COMPANY_ADMIN', 'FINANCE', 'HR'], scope: 'company', inUse: { collection: 'expenses', field: 'category', companyScoped: true } },
  SUPPORT_CATEGORY: { defaults: ['General', 'Attendance Issue', 'Employee Management', 'Leave Management', 'Payroll', 'Documents & Policies', 'Access & Permissions', 'Technical Issue', 'Workforce Shortage Issue', 'Shift Assignment Issue', 'Account', 'Bug report', 'Others'], manage: ['COMPANY_ADMIN', 'HR', 'MANAGER', 'SUPERVISOR', 'FINANCE', 'SUPER_ADMIN'], scope: 'company', inUse: { collection: 'tickets', field: 'category', companyScoped: true } },
  EMPLOYMENT_TYPE: { defaults: ['Permanent', 'Contract', 'Intern', 'Consultant'], manage: ['COMPANY_ADMIN', 'HR'], scope: 'company', inUse: { collection: 'employees', field: 'employmentType', companyScoped: true } },
  INDUSTRY: { defaults: ['Manufacturing', 'IT & Software', 'Retail', 'Healthcare', 'Education', 'Logistics', 'Hospitality', 'Construction', 'Finance', 'Other'], manage: ['COMPANY_ADMIN', 'SUPER_ADMIN'], scope: 'platform', inUse: { collection: 'companies', field: 'industry', companyScoped: false } },
};
const PLATFORM = '__platform__';
const key = (scope: string, type: string, value: string) => `${scope}|${type}|${value.toLowerCase()}`;
const spec = (type: string) => { const s = SPECS[type]; if (!s) throw new AppError(404, 'NOT_FOUND', 'That list does not exist.'); return s; };
const scopeFor = (req: import('express').Request, s: Spec) => (s.scope === 'platform' || me(req).role === 'SUPER_ADMIN' ? PLATFORM : companyIdFor(req));

async function items(scope: string, type: string, s: Spec) {
  const c = coll('lookups');
  const marker = key(scope, type, '__seeded__');
  if (!(await c.findOne({ _id: marker as never }))) {
    try { await c.insertMany([...s.defaults.map((value, i) => ({ _id: key(scope, type, value) as never, scope, type, value, sort: i, createdAt: nowIso() })), { _id: marker as never, scope, type, marker: true } as never], { ordered: false }); }
    catch { /* a parallel request added them first */ }
  }
  return (await c.find({ scope, type, marker: { $ne: true } }).sort({ sort: 1, value: 1 }).toArray()).map((r) => r.value as string);
}

lookupRouter.get('/lookups/:type', async (req, res) => {
  const type = String(req.params.type).toUpperCase();
  const s = spec(type);
  ok(res, { type, items: await items(scopeFor(req, s), type, s), canManage: s.manage.includes(me(req).role) });
});

lookupRouter.post('/lookups/:type', async (req, res) => {
  const user = me(req);
  const type = String(req.params.type).toUpperCase();
  const s = spec(type);
  if (!s.manage.includes(user.role)) throw new AppError(403, 'FORBIDDEN', 'You cannot add to this list.');
  const { value } = parse(z.object({ value: z.string().trim().min(2, 'Enter at least 2 letters.').max(60) }), req.body);
  const scope = scopeFor(req, s);
  const existing = await items(scope, type, s);
  const same = existing.find((v) => v.toLowerCase() === value.toLowerCase());
  if (same) return ok(res, { value: same, existed: true });
  await coll('lookups').insertOne({ _id: key(scope, type, value) as never, scope, type, value, sort: existing.length, createdAt: nowIso() }).catch(() => undefined);
  await appendAudit({ actorId: user.id, companyId: scope === PLATFORM ? null : scope, action: 'LIST_ITEM_ADDED', entityType: 'LIST_ITEM', entityId: key(scope, type, value), newValue: { type, value }, ...reqMeta(req) });
  ok(res, { value }, 201);
});

lookupRouter.delete('/lookups/:type/:value', async (req, res) => {
  const user = me(req);
  const type = String(req.params.type).toUpperCase();
  const s = spec(type);
  if (!s.manage.includes(user.role)) throw new AppError(403, 'FORBIDDEN', 'You cannot delete from this list.');
  const scope = scopeFor(req, s);
  const value = String(req.params.value);
  const found = (await items(scope, type, s)).find((v) => v.toLowerCase() === value.toLowerCase());
  if (!found) throw new AppError(404, 'NOT_FOUND', 'That item is already gone.');
  if (s.inUse) {
    const filter: Record<string, unknown> = { [s.inUse.field]: found };
    if (s.inUse.companyScoped && scope !== PLATFORM) filter.companyId = scope;
    const n = await coll(s.inUse.collection as never).countDocuments(filter as never);
    if (n) throw new AppError(409, 'LIST_ITEM_IN_USE', `“${found}” is used in ${n} ${n === 1 ? 'record' : 'records'}. Change those first, then delete it.`, { count: n });
  }
  await coll('lookups').deleteOne({ _id: key(scope, type, found) as never });
  await appendAudit({ actorId: user.id, companyId: scope === PLATFORM ? null : scope, action: 'LIST_ITEM_DELETED', entityType: 'LIST_ITEM', entityId: key(scope, type, found), oldValue: { type, value: found }, ...reqMeta(req) });
  ok(res, null);
});
