import { Router } from 'express';
import { z } from 'zod';
import { coll } from '../../db/mongo.ts';
import { byId, count, escapeRegex, find, findOne, findPage, insert, remove, type Row } from '../../db/repo.ts';
import { appendAudit, effectiveEntitlements, invalidateModuleCatalog, invalidateTenant, subscriptionAccess } from '../../domain/access.ts';
import { AppError, notFound } from '../../lib/errors.ts';
import { companyIdFor, me, ok, parse, reqMeta } from '../../lib/http.ts';
import { nowIso } from '../../lib/serialize.ts';

export const planRouter = Router();

// ── Module catalog ─────────────────────────────────────────────────────
planRouter.get('/module-catalog', async (_req, res) => ok(res, await find('modules', {}, { sort: { sortOrder: 1 } })));

// ── Plans (draft → immutable published versions) ───────────────────────
export async function planViews(plans: Row[]) {
  const versionIds = plans.map((p) => p.currentVersionId).filter(Boolean);
  const [versions, versionCounts, subCounts] = await Promise.all([
    versionIds.length ? find('planVersions', { _id: { $in: versionIds } }) : [],
    coll('planVersions').aggregate([{ $group: { _id: '$planId', n: { $sum: 1 } } }]).toArray(),
    coll('subscriptions').aggregate([{ $match: { status: { $ne: 'CANCELLED' } } }, { $group: { _id: '$planId', n: { $sum: 1 } } }]).toArray(),
  ]);
  const vBy = new Map(versions.map((v) => [v.id, v]));
  const vc = new Map(versionCounts.map((x) => [x._id as string, x.n as number]));
  const sc = new Map(subCounts.map((x) => [x._id as string, x.n as number]));
  return plans.map((p) => ({ ...p, currentVersionId: p.currentVersionId ? vBy.get(p.currentVersionId) : undefined, versionCount: vc.get(p.id) ?? 0, activeSubscriptionCount: sc.get(p.id) ?? 0, hasUnpublishedChanges: Boolean(p.draft) }));
}

planRouter.get('/plans', async (_req, res) => ok(res, await planViews(await find('plans', {}, { sort: { price: 1 } }))));

planRouter.get('/plan-versions/:id', async (req, res) => {
  const version = await byId('planVersions', String(req.params.id));
  if (!version) throw notFound('Plan version');
  ok(res, version);
});

const planFields = z.object({
  name: z.string().trim().min(1).max(80), type: z.string().trim().regex(/^[A-Za-z0-9_]{2,24}$/, 'Plan code can only use letters, numbers and underscores.'),
  price: z.coerce.number().min(0).max(10_000_000), annualPrice: z.coerce.number().min(0).max(100_000_000).optional(), maxUsers: z.coerce.number().int().min(1).max(1_000_000),
  maxBranches: z.coerce.number().int().min(1).max(10_000).optional(), storageGB: z.coerce.number().min(0).max(100_000).optional(), apiRequests: z.coerce.number().int().min(0).optional(),
  moduleIds: z.array(z.union([z.string(), z.object({ id: z.string() }).transform((m) => m.id)])).max(200).optional(), features: z.array(z.string().max(120)).max(30).optional(),
  trialEnabled: z.any().optional(), defaultTrialDays: z.any().optional(),
});

async function resolveModuleIds(requested: string[]) {
  const modules = await find('modules', {});
  const coreIds = modules.filter((m) => m.isCore).map((m) => m.id);
  const selectable = new Set(modules.filter((m) => m.status === 'ACTIVE' && (m.planSelectable || m.isCore)).map((m) => m.id));
  if (requested.some((id) => !selectable.has(id))) throw new AppError(422, 'INVALID_MODULE', 'One or more modules cannot be added to a plan.');
  return [...new Set([...coreIds, ...requested])];
}

planRouter.post('/plans', async (req, res) => {
  const user = me(req);
  const body = parse(planFields, req.body);
  const code = body.type.toUpperCase();
  if (await findOne('plans', { type: code })) throw new AppError(409, 'PLAN_CODE_IN_USE', 'Another plan already uses this code.');
  const moduleIds = await resolveModuleIds((body.moduleIds ?? []) as string[]);
  const createdAt = nowIso();
  const draft = { baseVersionId: null, name: body.name, pricing: { monthly: body.price, annual: body.annualPrice ?? body.price * 10 }, trial: { enabled: false, days: 0 }, moduleIds, limits: { employees: body.maxUsers, branches: body.maxBranches ?? 2, storageGB: body.storageGB ?? 5, apiRequests: body.apiRequests ?? 10_000 }, features: body.features ?? [], revision: 1, updatedBy: user.id, updatedAt: createdAt };
  const plan = await insert('plans', { name: body.name, type: code, status: 'DRAFT', price: draft.pricing.monthly, annualPrice: draft.pricing.annual, maxUsers: draft.limits.employees, maxBranches: draft.limits.branches, storageGB: draft.limits.storageGB, apiRequests: draft.limits.apiRequests, trialEnabled: false, defaultTrialDays: 0, moduleIds, features: draft.features, currentVersionId: null, draft, draftRevision: 1, createdAt }, 'plan');
  await appendAudit({ actorId: user.id, action: 'PLAN_DRAFT_CREATED', entityType: 'PLAN', entityId: plan.id, newValue: draft, ...reqMeta(req) });
  ok(res, (await planViews([plan]))[0], 201);
});

planRouter.get('/plans/:id', async (req, res) => {
  const plan = await byId('plans', String(req.params.id));
  if (!plan) throw notFound('Plan');
  ok(res, { plan: (await planViews([plan]))[0], versions: await find('planVersions', { planId: plan.id }, { sort: { version: -1 } }) });
});

planRouter.put('/plans/:id', async (req, res) => {
  const user = me(req);
  const found = await byId('plans', String(req.params.id));
  if (!found) throw notFound('Plan');
  const body = parse(planFields.partial().extend({ draftRevision: z.number().int() }), req.body);
  if (body.draftRevision !== Number(found.draftRevision)) throw new AppError(409, 'STALE_DRAFT', 'Someone else changed this plan. Reload before saving.');
  const current: Row = found.draft ?? (found.currentVersionId ? (await byId('planVersions', found.currentVersionId)) ?? {} : {});
  const moduleIds = await resolveModuleIds(((body.moduleIds ?? current.moduleIds ?? found.moduleIds) as Array<string | Row>).map((m) => (typeof m === 'string' ? m : m.id)));
  const revision = Number(found.draftRevision ?? 0) + 1;
  const draft = {
    baseVersionId: found.currentVersionId ?? null, name: body.name ?? current.name ?? found.name,
    pricing: { monthly: body.price ?? current.pricing?.monthly ?? found.price, annual: body.annualPrice ?? current.pricing?.annual ?? found.annualPrice },
    trial: { enabled: false, days: 0 }, moduleIds,
    limits: { employees: body.maxUsers ?? current.limits?.employees ?? found.maxUsers, branches: body.maxBranches ?? current.limits?.branches ?? found.maxBranches, storageGB: body.storageGB ?? current.limits?.storageGB ?? found.storageGB, apiRequests: body.apiRequests ?? current.limits?.apiRequests ?? found.apiRequests ?? 10_000 },
    features: body.features ?? current.features ?? found.features, revision, updatedBy: user.id, updatedAt: nowIso(),
  };
  const updated = await coll('plans').findOneAndUpdate({ _id: found.id, draftRevision: found.draftRevision }, { $set: { name: draft.name, price: draft.pricing.monthly, annualPrice: draft.pricing.annual, maxUsers: draft.limits.employees, maxBranches: draft.limits.branches, storageGB: draft.limits.storageGB, apiRequests: draft.limits.apiRequests, moduleIds, features: draft.features, draft, draftRevision: revision } }, { returnDocument: 'after' });
  if (!updated) throw new AppError(409, 'STALE_DRAFT', 'Someone else changed this plan. Reload before saving.');
  await appendAudit({ actorId: user.id, action: 'PLAN_DRAFT_UPDATED', entityType: 'PLAN', entityId: found.id, oldValue: found.draft, newValue: draft, ...reqMeta(req) });
  ok(res, (await planViews([{ id: updated._id, ...updated }]))[0]);
});

planRouter.post('/plans/:id/publish', async (req, res) => {
  const user = me(req);
  const found = await byId('plans', String(req.params.id));
  if (!found) throw notFound('Plan');
  const body = parse(z.object({ draftRevision: z.number().int(), reason: z.string().trim().min(3, 'Add a short reason for this release.').max(300) }), req.body);
  if (!found.draft) throw new AppError(409, 'NO_DRAFT', 'There are no unpublished changes to publish.');
  if (body.draftRevision !== Number(found.draftRevision)) throw new AppError(409, 'STALE_DRAFT', 'The plan draft changed. Reload before publishing.');
  const source = found.draft;
  const last = (await find('planVersions', { planId: found.id }, { sort: { version: -1 }, limit: 1 }))[0];
  // Versions are immutable once written; the unique (planId, version) index makes a concurrent publish fail instead of overwrite.
  const version = await insert('planVersions', { planId: found.id, version: Number(last?.version ?? 0) + 1, name: source.name, type: found.type, currency: 'INR', pricing: source.pricing, trial: source.trial, moduleIds: source.moduleIds, limits: source.limits, features: source.features, publishedAt: nowIso(), publishedBy: user.id, reason: body.reason, createdAt: nowIso() }, 'plan_version');
  await coll('plans').updateOne({ _id: found.id }, { $set: { name: source.name, price: source.pricing.monthly, annualPrice: source.pricing.annual, maxUsers: source.limits.employees, maxBranches: source.limits.branches, storageGB: source.limits.storageGB, apiRequests: source.limits.apiRequests, moduleIds: source.moduleIds, features: source.features, currentVersionId: version.id, draft: null, status: 'PUBLISHED' } });
  await appendAudit({ actorId: user.id, action: 'PLAN_VERSION_PUBLISHED', entityType: 'PLAN_VERSION', entityId: version.id, newValue: version, description: `${found.name} version ${version.version} published`, ...reqMeta(req) });
  ok(res, version);
});

planRouter.post('/plans/:id/discard-draft', async (req, res) => {
  const user = me(req);
  const found = await byId('plans', String(req.params.id));
  if (!found) throw notFound('Plan');
  const body = parse(z.object({ draftRevision: z.number().int().optional(), reason: z.string().max(300).optional() }), req.body);
  if (body.draftRevision !== undefined && body.draftRevision !== Number(found.draftRevision)) throw new AppError(409, 'STALE_DRAFT', 'The plan draft changed. Reload before discarding.');
  const base = found.currentVersionId ? await byId('planVersions', found.currentVersionId) : null;
  const set: Row = { draft: null, draftRevision: Number(found.draftRevision ?? 0) + 1 };
  if (base) Object.assign(set, { name: base.name, price: base.pricing.monthly, annualPrice: base.pricing.annual, maxUsers: base.limits.employees, maxBranches: base.limits.branches, storageGB: base.limits.storageGB, moduleIds: base.moduleIds, features: base.features });
  const updated = await coll('plans').findOneAndUpdate({ _id: found.id }, { $set: set }, { returnDocument: 'after' });
  await appendAudit({ actorId: user.id, action: 'PLAN_DRAFT_DISCARDED', entityType: 'PLAN', entityId: found.id, oldValue: found.draft, newValue: null, description: body.reason, ...reqMeta(req) });
  ok(res, (await planViews([{ id: updated!._id, ...updated }]))[0]);
});

planRouter.delete('/plans/:id', async (req, res) => {
  const user = me(req);
  const found = await byId('plans', String(req.params.id));
  if (!found) throw notFound('Plan');
  const used = await count('subscriptions', { planId: found.id, status: { $ne: 'CANCELLED' } });
  if (used) throw new AppError(409, 'PLAN_IN_USE', 'Companies are still subscribed to this plan. Move them to another plan first.', { activeCount: used });
  await Promise.all([remove('plans', { _id: found.id }), remove('planVersions', { planId: found.id })]);
  await appendAudit({ actorId: user.id, action: 'PLAN_DELETED', entityType: 'PLAN', entityId: found.id, oldValue: { name: found.name }, ...reqMeta(req) });
  ok(res, null);
});

// ── Subscriptions (platform) ───────────────────────────────────────────
planRouter.get('/subscriptions', async (req, res) => {
  const filter: Row = {};
  for (const key of ['plan', 'status', 'billingCycle'] as const) { const v = String(req.query[key] ?? ''); if (v && v !== 'ALL') filter[key] = v; }
  const search = String(req.query.search ?? '').trim();
  if (search) {
    const ids = (await find('companies', { name: { $regex: escapeRegex(search), $options: 'i' } }, { projection: { _id: 1 }, limit: 500 })).map((c) => c.id);
    filter.companyId = { $in: ids };
  }
  const { rows, pagination } = await findPage('subscriptions', filter, req.query, { endDate: 1, _id: 1 });
  const [companies, versions, all] = await Promise.all([
    rows.length ? find('companies', { _id: { $in: rows.map((r) => r.companyId) } }) : [], rows.length ? find('planVersions', { _id: { $in: rows.map((r) => r.planVersionId).filter(Boolean) } }) : [],
    find('subscriptions', {}, { projection: { status: 1, billingCycle: 1, amount: 1, endDate: 1 } }),
  ]);
  const cBy = new Map(companies.map((c) => [c.id, c])), vBy = new Map(versions.map((v) => [v.id, v]));
  const soon = Date.now() + 30 * 86_400_000;
  const active = all.filter((s) => s.status === 'ACTIVE');
  ok(res, {
    subscriptions: rows.map((s) => ({ ...s, company: cBy.get(s.companyId), planVersion: vBy.get(s.planVersionId) })), pagination,
    stats: { monthlyRevenue: Math.round(active.reduce((sum, s) => sum + (s.billingCycle === 'Annual' ? Number(s.amount) / 12 : Number(s.amount)), 0)), active: active.length, trial: all.filter((s) => s.status === 'TRIAL').length, pastDue: all.filter((s) => s.status === 'PAST_DUE').length, suspended: all.filter((s) => s.status === 'SUSPENDED').length, expiringSoon: all.filter((s) => ['TRIAL', 'ACTIVE'].includes(s.status) && new Date(s.endDate).getTime() < soon).length },
  });
});

planRouter.post('/subscriptions', () => { throw new AppError(405, 'ONLINE_CHECKOUT_REQUIRED', 'Subscriptions are created and renewed only through online checkout.'); });

for (const action of ['suspend', 'cancel', 'reactivate'] as const) {
  planRouter.post(`/subscriptions/:id/${action}`, async (req, res) => {
    const user = me(req);
    const body = parse(z.object({ reason: z.string().trim().min(3, 'Please add a reason.').max(300) }), req.body);
    const existing = await byId('subscriptions', String(req.params.id));
    if (!existing) throw notFound('Subscription');
    const set: Row = action === 'suspend' ? { status: 'SUSPENDED', isActive: false, suspensionReason: body.reason }
      : action === 'cancel' ? { cancelAtPeriodEnd: true, cancellationReason: body.reason }
      : { status: 'ACTIVE', isActive: true, suspensionReason: null };
    if (action === 'reactivate' && existing.status !== 'SUSPENDED') throw new AppError(409, 'NOT_SUSPENDED', 'Only suspended subscriptions can be reactivated.');
    const updated = await coll('subscriptions').findOneAndUpdate({ _id: existing.id }, { $set: set }, { returnDocument: 'after' });
    invalidateTenant(existing.companyId);
    await appendAudit({ actorId: user.id, companyId: existing.companyId, action: `SUBSCRIPTION_${action.toUpperCase()}`, entityType: 'SUBSCRIPTION', entityId: existing.id, oldValue: { status: existing.status }, newValue: set, description: body.reason, ...reqMeta(req) });
    ok(res, { id: updated!._id, ...updated });
  });
}
for (const action of ['extend-trial', 'change-plan', 'migrate', 'renew', 'retry-payment']) {
  planRouter.post(`/subscriptions/:id/${action}`, () => { throw new AppError(405, 'ONLINE_CHECKOUT_REQUIRED', 'Subscription access changes require customer checkout.'); });
}

planRouter.get('/reports/revenue-trend', async (_req, res) => {
  const since = new Date(); since.setUTCMonth(since.getUTCMonth() - 5, 1); since.setUTCHours(0, 0, 0, 0);
  const rows = await coll('payments').aggregate([{ $match: { status: 'PAID', createdAt: { $gte: since.toISOString() } } }, { $group: { _id: { $substr: ['$createdAt', 0, 7] }, revenue: { $sum: '$amount' } } }, { $sort: { _id: 1 } }]).toArray();
  const by = new Map(rows.map((r) => [r._id as string, r.revenue as number]));
  const out = [];
  for (let i = 0; i < 6; i++) { const d = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + i, 1)); const key = d.toISOString().slice(0, 7); out.push({ month: d.toLocaleString('en', { month: 'short', timeZone: 'UTC' }), revenue: by.get(key) ?? 0 }); }
  ok(res, out);
});

// ── Entitlement overrides (Super Admin) ────────────────────────────────
planRouter.get('/entitlement-overrides', async (req, res) => {
  const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
  ok(res, await find('entitlementOverrides', companyId ? { companyId } : {}, { sort: { createdAt: -1 }, limit: 500 }));
});

planRouter.post('/entitlement-overrides', async (req, res) => {
  const user = me(req);
  const body = parse(z.object({
    companyId: z.string().min(1), effect: z.enum(['GRANT', 'DENY', 'SET_LIMIT']), moduleId: z.string().optional(), limitKey: z.enum(['employees', 'branches', 'storageGB', 'apiRequests']).optional(),
    limitValue: z.coerce.number().min(0).optional(), reason: z.string().trim().min(3, 'A reason is required.').max(300), expiresAt: z.string().nullish(),
  }), req.body);
  if (!(await byId('companies', body.companyId))) throw notFound('Company');
  if (body.effect === 'SET_LIMIT' && (!body.limitKey || body.limitValue === undefined)) throw new AppError(422, 'VALIDATION_ERROR', 'Choose a limit and enter its value.');
  if (body.effect !== 'SET_LIMIT' && !body.moduleId) throw new AppError(422, 'VALIDATION_ERROR', 'Choose a module.');
  const module = body.moduleId ? await byId('modules', body.moduleId) : null;
  if (body.moduleId && !module) throw notFound('Module');
  if (body.effect === 'DENY' && module?.isCore) throw new AppError(409, 'CORE_MODULE_REQUIRED', 'Core modules cannot be turned off.');
  const snapshot = await effectiveEntitlements(body.companyId);
  const oldValue = body.limitKey ? snapshot.limits[body.limitKey] : snapshot.modules.find((m) => m.id === body.moduleId)?.isEnabled;
  const newValue = body.effect === 'SET_LIMIT' ? body.limitValue : body.effect === 'GRANT';
  const override = await insert('entitlementOverrides', { ...body, expiresAt: body.expiresAt ?? null, oldValue, newValue, createdBy: user.id, createdAt: nowIso() }, 'override');
  invalidateTenant(body.companyId);
  await appendAudit({ actorId: user.id, companyId: body.companyId, action: `ENTITLEMENT_${body.effect}`, entityType: 'ENTITLEMENT_OVERRIDE', entityId: override.id, oldValue, newValue: override, description: body.reason, ...reqMeta(req) });
  ok(res, override, 201);
});

planRouter.delete('/entitlement-overrides/:id', async (req, res) => {
  const user = me(req);
  const found = await byId('entitlementOverrides', String(req.params.id));
  if (!found) throw notFound('Entitlement override');
  await remove('entitlementOverrides', { _id: found.id });
  invalidateTenant(found.companyId);
  await appendAudit({ actorId: user.id, companyId: found.companyId, action: 'ENTITLEMENT_OVERRIDE_REVOKED', entityType: 'ENTITLEMENT_OVERRIDE', entityId: found.id, oldValue: found, ...reqMeta(req) });
  ok(res, null);
});

// ── Tenant views of their own plan ─────────────────────────────────────
planRouter.get('/subscription', async (req, res) => {
  const companyId = companyIdFor(req);
  const ent = await effectiveEntitlements(companyId);
  ok(res, { subscription: ent.subscription, status: subscriptionAccess(ent.subscription), entitlements: ent });
});
planRouter.get('/entitlements', async (req, res) => ok(res, await effectiveEntitlements(companyIdFor(req))));

// ── Modules (platform admin) ───────────────────────────────────────────
planRouter.get('/modules', async (req, res) => {
  const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
  if (!companyId) return ok(res, { modules: (await find('modules', {}, { sort: { sortOrder: 1 } })).map((m) => ({ ...m, isEnabled: null, enabled: null })) });
  ok(res, { modules: (await effectiveEntitlements(companyId)).modules });
});
planRouter.get('/modules/companies', async (_req, res) => ok(res, (await find('companies', {}, { projection: { name: 1, plan: 1 }, sort: { name: 1 }, limit: 1000 })).map((c) => ({ id: c.id, name: c.name, plan: c.plan }))));

planRouter.put('/modules/toggle', async (req, res) => {
  const user = me(req);
  const body = parse(z.object({ companyId: z.string(), moduleId: z.string(), isEnabled: z.boolean(), reason: z.string().trim().min(3, 'A reason is required for this change.').max(300), expiresAt: z.string().nullish() }), req.body);
  const [module, company] = await Promise.all([byId('modules', body.moduleId), byId('companies', body.companyId)]);
  if (!module || !company) throw notFound('Company or module');
  if (module.isCore && !body.isEnabled) throw new AppError(409, 'CORE_MODULE_REQUIRED', 'Core modules cannot be turned off.');
  const oldValue = (await effectiveEntitlements(body.companyId)).modules.find((m) => m.id === body.moduleId)?.isEnabled;
  await remove('entitlementOverrides', { companyId: body.companyId, moduleId: body.moduleId });
  const override = await insert('entitlementOverrides', { companyId: body.companyId, moduleId: body.moduleId, effect: body.isEnabled ? 'GRANT' : 'DENY', oldValue, newValue: body.isEnabled, reason: body.reason, expiresAt: body.expiresAt ?? null, createdBy: user.id, createdAt: nowIso() }, 'override');
  invalidateTenant(body.companyId);
  await appendAudit({ actorId: user.id, companyId: body.companyId, action: `ENTITLEMENT_${override.effect}`, entityType: 'MODULE', entityId: body.moduleId, oldValue, newValue: override, description: body.reason, ...reqMeta(req) });
  ok(res, override);
});

// Role templates the Super Admin edits; new companies are provisioned from them.
planRouter.get('/modules/permissions', async (req, res) => {
  const roleKey = typeof req.query.role === 'string' ? req.query.role : 'COMPANY_ADMIN';
  const [modules, template] = await Promise.all([find('modules', {}, { sort: { sortOrder: 1 } }), findOne('roleDefinitions', { companyId: 'platform', key: roleKey })]);
  const granted = new Set<string>(template?.permissions ?? []);
  const all = roleKey === 'COMPANY_ADMIN';
  ok(res, { role: template?.key ?? null, permissions: Object.fromEntries(modules.map((m) => [m.key, (m.actions as string[]).map((a) => ({ permission: `${m.key}.${a}`, isGranted: all || granted.has(`${m.key}.${a}`) }))])) });
});

planRouter.put('/modules/permissions', async (req, res) => {
  const user = me(req);
  const body = parse(z.object({ role: z.string().min(1), permission: z.string().regex(/^[A-Z_]+\.[A-Z_]+$/), isGranted: z.boolean() }), req.body);
  const template = await findOne('roleDefinitions', { companyId: 'platform', key: body.role });
  if (!template) throw notFound('Role template');
  if (template.locked) throw new AppError(409, 'SYSTEM_ROLE_LOCKED', 'The Company Admin role always has every permission.');
  const [moduleKey, action] = body.permission.split('.');
  const module = await findOne('modules', { key: moduleKey });
  if (!module || !(module.actions as string[]).includes(action!)) throw new AppError(422, 'VALIDATION_ERROR', 'That permission does not exist.');
  const next = new Set<string>(template.permissions);
  if (body.isGranted) next.add(body.permission); else next.delete(body.permission);
  await coll('roleDefinitions').updateOne({ _id: template.id }, { $set: { permissions: [...next] }, $inc: { revision: 1 } });
  invalidateModuleCatalog();
  await appendAudit({ actorId: user.id, action: 'ROLE_TEMPLATE_UPDATED', entityType: 'ROLE_TEMPLATE', entityId: template.id, newValue: { permission: body.permission, isGranted: body.isGranted }, ...reqMeta(req) });
  ok(res, { updated: true });
});
