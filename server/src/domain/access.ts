import { TtlCache } from '../lib/cache.ts';
import { byId, find, findOne, insert, type Row } from '../db/repo.ts';
import { newId } from '../lib/ids.ts';

export interface AuthUser extends Row { id: string; role: string; companyId: string | null }

// Short TTL keeps permission checks off the database on hot paths; writers call invalidate*() for instant effect in this process.
const entitlementCache = new TtlCache<Awaited<ReturnType<typeof loadEntitlements>>>(20_000);
const permissionCache = new TtlCache<string[]>(20_000);
const moduleCatalogCache = new TtlCache<Row[]>(60_000, 4);

export const invalidateTenant = (companyId?: string | null) => {
  if (companyId) entitlementCache.deleteWhere((k) => k === companyId);
  permissionCache.clear();
};
export const invalidateModuleCatalog = () => { moduleCatalogCache.clear(); entitlementCache.clear(); permissionCache.clear(); };

const moduleCatalog = () => moduleCatalogCache.wrap('all', () => find('modules', {}, { sort: { name: 1 } }));

const nowActive = (row: Row, now = new Date()) => !row.expiresAt || new Date(row.expiresAt).getTime() > now.getTime();

async function loadEntitlements(companyId: string | null | undefined) {
  const subscription = companyId ? await findOne('subscriptions', { companyId }) : null;
  const plan = subscription?.planId ? await byId('plans', subscription.planId) : null;
  const version = (await byId('planVersions', subscription?.planVersionId)) ?? (await byId('planVersions', plan?.currentVersionId));
  const planDoc = plan ?? (version?.planId ? await byId('plans', version.planId) : null);
  const includedIds = new Set<string>((version?.moduleIds ?? []).map((m: string | Row) => (typeof m === 'string' ? m : m.id)));
  const overrides = companyId ? (await find('entitlementOverrides', { companyId })).filter((o) => nowActive(o)) : [];
  const modules = (await moduleCatalog()).map((module): Row => {
    const override = [...overrides].reverse().find((o) => o.moduleId === module.id && ['GRANT', 'DENY'].includes(o.effect));
    const planEnabled = Boolean(module.isCore) || includedIds.has(module.id);
    const enabled = override ? override.effect === 'GRANT' : planEnabled;
    const source = override ? (override.effect === 'GRANT' ? 'OVERRIDE_GRANT' : 'OVERRIDE_DENY') : planEnabled ? 'PLAN' : 'NOT_INCLUDED';
    return { ...module, module: { id: module.id, name: module.name, description: module.description }, enabled, isEnabled: enabled, source };
  });
  const limits: Row = { employees: 0, branches: 0, storageGB: 0, apiRequests: 0, ...(version?.limits ?? {}) };
  for (const o of overrides.filter((x) => x.effect === 'SET_LIMIT' && x.limitKey)) limits[o.limitKey] = Number(o.limitValue);
  return {
    subscription,
    plan: {
      id: planDoc?.id ?? null, versionId: version?.id ?? null, version: version?.version ?? null,
      code: planDoc?.type ?? version?.type ?? subscription?.plan ?? null,
      name: planDoc?.name ?? version?.name ?? subscription?.plan ?? null,
    },
    modules, limits, overrides,
  };
}

export const effectiveEntitlements = (companyId: string | null | undefined) =>
  companyId ? entitlementCache.wrap(companyId, () => loadEntitlements(companyId)) : loadEntitlements(null);

export function subscriptionAccess(subscription: Row | null | undefined, now = new Date()) {
  if (!subscription) return null;
  const end = subscription.trialEndsAt ?? subscription.currentPeriodEnd ?? subscription.endDate;
  const daysRemaining = end ? Math.max(0, Math.ceil((new Date(end).getTime() - now.getTime()) / 86_400_000)) : null;
  return {
    state: subscription.status ?? 'UNKNOWN', plan: subscription.plan ?? null, planVersionId: subscription.planVersionId ?? null,
    trialEndsAt: subscription.trialEndsAt ?? null, currentPeriodEnd: subscription.currentPeriodEnd ?? subscription.endDate ?? null,
    gracePeriodEnd: subscription.graceEndsAt ?? null, daysRemaining,
    readOnly: ['PAST_DUE', 'SUSPENDED', 'CANCELLED'].includes(subscription.status),
  };
}

export const assignmentsFor = (user: AuthUser) => find('roleAssignments', { userId: user.id, companyId: user.companyId });

export async function effectivePermissions(user: AuthUser): Promise<string[]> {
  if (user.role === 'SUPER_ADMIN') return ['*'];
  return permissionCache.wrap(user.id, async () => {
    const [ent, assignments] = await Promise.all([effectiveEntitlements(user.companyId), assignmentsFor(user)]);
    const enabledKeys = new Set(ent.modules.filter((m) => m.enabled).map((m) => m.key));
    const ids = assignments.map((a) => a.roleDefinitionId);
    const definitions = ids.length ? await find('roleDefinitions', { _id: { $in: ids } }) : [];
    if (definitions.some((d) => d.key === 'COMPANY_ADMIN')) return ['*'];
    return [...new Set(definitions.flatMap((d) => d.permissions as string[]))].filter((p) => enabledKeys.has(p.split('.')[0]!));
  });
}

export async function accessSnapshot(user: AuthUser) {
  if (user.role === 'SUPER_ADMIN') {
    const modules = await moduleCatalog();
    return { role: user.role, permissions: ['*'], modules: modules.map((m) => ({ name: m.name, key: m.key, isEnabled: true, source: 'PLATFORM' })), roles: [], limits: null, subscription: null };
  }
  const [ent, permissions, assignments] = await Promise.all([effectiveEntitlements(user.companyId), effectivePermissions(user), assignmentsFor(user)]);
  const ids = assignments.map((a) => a.roleDefinitionId);
  const definitions = ids.length ? await find('roleDefinitions', { _id: { $in: ids } }) : [];
  return {
    role: user.role, permissions,
    modules: ent.modules.map((m) => ({ name: m.name, key: m.key, isEnabled: m.enabled, source: m.source })),
    roles: assignments.map((a) => {
      const d = definitions.find((x) => x.id === a.roleDefinitionId);
      return { role: d?.key ?? a.role, roleDefinitionId: d?.id, name: d?.name, scopeType: a.scopeType, scopeId: a.scopeId, permissions: d?.permissions ?? [] };
    }),
    limits: ent.limits, subscription: subscriptionAccess(ent.subscription),
  };
}

export const can = (permissions: string[], permission: string) => permissions.includes('*') || permissions.includes(permission);

/** Assignments that grant `permission` (company admins grant everything). */
async function grantingAssignments(user: AuthUser, permission?: string) {
  const assignments = await assignmentsFor(user);
  if (!permission) return assignments;
  const ids = assignments.map((a) => a.roleDefinitionId);
  const defs = ids.length ? await find('roleDefinitions', { _id: { $in: ids } }) : [];
  return assignments.filter((a) => {
    const d = defs.find((x) => x.id === a.roleDefinitionId);
    return d?.key === 'COMPANY_ADMIN' || (d?.permissions as string[] | undefined)?.includes(permission);
  });
}

/**
 * Employee ids the user may see for `permission`.
 * `null` means company-wide (no restriction); otherwise a bounded list. Used to filter list queries in one round trip.
 */
export async function allowedEmployeeIds(user: AuthUser, permission?: string): Promise<string[] | null> {
  if (user.role === 'SUPER_ADMIN') return null;
  const assignments = await grantingAssignments(user, permission);
  if (!assignments.length) return [];
  if (assignments.some((a) => a.scopeType === 'COMPANY')) return null;
  const or: Row[] = [];
  for (const a of assignments) {
    if (a.scopeType === 'SELF') or.push({ userId: user.id });
    else if (a.scopeType === 'BRANCH') or.push({ branchId: a.scopeId });
    else if (a.scopeType === 'DEPARTMENT') or.push({ departmentId: a.scopeId });
    else if (a.scopeType === 'TEAM') {
      const team = await byId('teams', a.scopeId);
      if (team?.employeeIds?.length) or.push({ _id: { $in: team.employeeIds } });
    }
  }
  if (!or.length) return [];
  const rows = await find('employees', { companyId: user.companyId, $or: or }, { projection: { _id: 1 }, limit: 5000 });
  return rows.map((r) => r.id);
}

export async function employeeForRecord(record: Row): Promise<Row | null> {
  if (record.employeeId) return byId('employees', typeof record.employeeId === 'string' ? record.employeeId : record.employeeId.id);
  if (record.userId) return findOne('employees', { userId: record.userId });
  if (record.employeeCode !== undefined || (record.id && String(record.id).startsWith('employee_'))) return record;
  return null;
}

export async function recordWithinScope(user: AuthUser, record: Row, permission?: string): Promise<boolean> {
  if (user.role === 'SUPER_ADMIN') return true;
  if (record.companyId && record.companyId !== user.companyId) return false;
  const assignments = await grantingAssignments(user, permission);
  if (!assignments.length) return false;
  if (assignments.some((a) => a.scopeType === 'COMPANY')) return true;
  const employee = await employeeForRecord(record);
  for (const a of assignments) {
    if (a.scopeType === 'SELF' && (employee?.userId === user.id || employee?.id === a.scopeId)) return true;
    if (a.scopeType === 'BRANCH' && (record.branchId ?? employee?.branchId) === a.scopeId) return true;
    if (a.scopeType === 'DEPARTMENT' && (record.departmentId ?? employee?.departmentId) === a.scopeId) return true;
    if (a.scopeType === 'TEAM') {
      const team = await byId('teams', a.scopeId);
      if (employee && team?.employeeIds?.includes(employee.id)) return true;
    }
  }
  return false;
}

export async function appendAudit(input: { actorId?: string | null; companyId?: string | null; action: string; entityType: string; entityId: string; oldValue?: unknown; newValue?: unknown; reason?: string | null; description?: string; ip?: string; device?: string; requestId?: string }) {
  const createdAt = new Date().toISOString();
  const id = newId('audit');
  const { description, ...rest } = input;
  await Promise.all([
    insert('audit', { id, ...rest, actorId: input.actorId ?? null, companyId: input.companyId ?? null, oldValue: input.oldValue ?? null, newValue: input.newValue ?? null, ip: input.ip ?? null, device: input.device ?? null, requestId: input.requestId ?? null, createdAt }),
    insert('activity', { id: `activity_${id}`, companyId: input.companyId ?? null, userId: input.actorId ?? null, action: input.action, module: input.entityType, status: 'SUCCESS', description: description ?? input.action.replaceAll('_', ' ').toLowerCase(), createdAt }),
  ]);
}

export async function enabledPermissionKeys(companyId: string) {
  const ent = await effectiveEntitlements(companyId);
  return new Set(ent.modules.filter((m) => m.enabled).flatMap((m) => (m.actions as string[]).map((a) => `${m.key}.${a}`)));
}
