import type { MockState, MockUser } from './seed';

export type MockRow = Record<string, any>;

const nowActive = (value: MockRow, now = new Date()) =>
  !value.expiresAt || new Date(value.expiresAt).getTime() > now.getTime();

export function subscriptionFor(state: MockState, companyId: string | null | undefined): MockRow | undefined {
  if (!companyId) return undefined;
  return (state.subscriptions as MockRow[]).find((item) => item.companyId === companyId);
}

export function planVersionFor(state: MockState, versionId: string | null | undefined): MockRow | undefined {
  if (!versionId) return undefined;
  return (state.planVersions as MockRow[]).find((item) => item.id === versionId);
}

export function effectiveEntitlements(state: MockState, companyId: string | null | undefined, now = new Date()) {
  const subscription = subscriptionFor(state, companyId);
  const version = planVersionFor(state, subscription?.planVersionId)
    ?? planVersionFor(
      state,
      (state.plans as MockRow[]).find((item) => item.id === subscription?.planId)?.currentVersionId,
    );
  const plan = (state.plans as MockRow[]).find((item) => item.id === (version?.planId ?? subscription?.planId));
  const includedIds = new Set<string>((version?.moduleIds ?? []).map((item: string | MockRow) => typeof item === 'string' ? item : item.id));
  const overrides = (state.entitlementOverrides as MockRow[])
    .filter((item) => item.companyId === companyId && nowActive(item, now));

  const modules: MockRow[] = (state.modules as MockRow[]).map((module): MockRow => {
    const moduleOverride = [...overrides].reverse().find((item) => item.moduleId === module.id && ['GRANT', 'DENY'].includes(item.effect));
    const planEnabled = Boolean(module.isCore) || includedIds.has(module.id);
    const enabled = moduleOverride ? moduleOverride.effect === 'GRANT' : planEnabled;
    const source = moduleOverride
      ? moduleOverride.effect === 'GRANT' ? 'OVERRIDE_GRANT' : 'OVERRIDE_DENY'
      : planEnabled ? 'PLAN' : 'NOT_INCLUDED';
    return {
      ...module,
      module: { id: module.id, name: module.name, description: module.description },
      enabled,
      isEnabled: enabled,
      source,
    };
  });

  const baseLimits: MockRow = { employees: 0, branches: 0, storageGB: 0, apiRequests: 0, ...(version?.limits ?? {}) };
  for (const limitOverride of overrides.filter((item) => item.effect === 'SET_LIMIT' && item.limitKey)) {
    baseLimits[limitOverride.limitKey] = Number(limitOverride.limitValue);
  }

  return {
    plan: {
      id: plan?.id ?? null,
      versionId: version?.id ?? null,
      version: version?.version ?? null,
      code: plan?.type ?? version?.type ?? subscription?.plan ?? null,
      name: plan?.name ?? version?.name ?? subscription?.plan ?? null,
    },
    modules,
    limits: baseLimits,
    overrides,
  };
}

export function subscriptionAccess(state: MockState, companyId: string | null | undefined, now = new Date()) {
  const subscription = subscriptionFor(state, companyId);
  if (!subscription) return null;
  const end = subscription.trialEndsAt ?? subscription.currentPeriodEnd ?? subscription.endDate;
  const daysRemaining = end ? Math.max(0, Math.ceil((new Date(end).getTime() - now.getTime()) / 86_400_000)) : null;
  return {
    state: subscription.status ?? 'UNKNOWN',
    plan: subscription.plan ?? null,
    planVersionId: subscription.planVersionId ?? null,
    trialEndsAt: subscription.trialEndsAt ?? null,
    currentPeriodEnd: subscription.currentPeriodEnd ?? subscription.endDate ?? null,
    gracePeriodEnd: subscription.graceEndsAt ?? null,
    daysRemaining,
    readOnly: ['PAST_DUE', 'SUSPENDED', 'CANCELLED'].includes(subscription.status),
  };
}

export function assignmentsFor(state: MockState, user: MockUser): MockRow[] {
  return (state.roleAssignments as MockRow[]).filter((item) => item.userId === user.id && item.companyId === user.companyId);
}

export function roleAssignmentView(state: MockState, assignment: MockRow) {
  const user = state.users.find((item) => item.id === assignment.userId);
  const definition = (state.roleDefinitions as MockRow[]).find((item) => item.id === assignment.roleDefinitionId);
  return {
    ...assignment,
    _id: assignment.id,
    userId: user ? { id: user.id, _id: user.id, name: user.name, email: user.email } : assignment.userId,
    roleDefinition: definition,
    role: definition?.key ?? assignment.role,
    roleName: definition?.name ?? assignment.role,
    permissions: definition?.permissions ?? [],
  };
}

export function effectivePermissions(state: MockState, user: MockUser): string[] {
  if (user.role === 'SUPER_ADMIN') return ['*'];
  const entitlement = effectiveEntitlements(state, user.companyId);
  const enabledKeys = new Set(entitlement.modules.filter((item) => item.enabled).map((item) => item.key));
  const assignments = assignmentsFor(state, user);
  const definitions = (state.roleDefinitions as MockRow[]).filter((definition) =>
    assignments.some((assignment) => assignment.roleDefinitionId === definition.id),
  );
  if (definitions.some((definition) => definition.key === 'COMPANY_ADMIN')) return ['*'];
  return [...new Set(definitions.flatMap((definition) => definition.permissions as string[]))]
    .filter((permission) => enabledKeys.has(permission.split('.')[0]));
}

export function accessSnapshot(state: MockState, user: MockUser) {
  if (user.role === 'SUPER_ADMIN') {
    return { role: user.role, permissions: ['*'], modules: (state.modules as MockRow[]).map((item) => ({ name: item.name, key: item.key, isEnabled: true, source: 'PLATFORM' })), roles: [], limits: null, subscription: null };
  }
  const entitlements = effectiveEntitlements(state, user.companyId);
  return {
    role: user.role,
    permissions: effectivePermissions(state, user),
    modules: entitlements.modules.map((item) => ({ name: item.name, key: item.key, isEnabled: item.enabled, source: item.source })),
    roles: assignmentsFor(state, user).map((assignment) => {
      const definition = (state.roleDefinitions as MockRow[]).find((item) => item.id === assignment.roleDefinitionId);
      return { role: definition?.key ?? assignment.role, roleDefinitionId: definition?.id, name: definition?.name, scopeType: assignment.scopeType, scopeId: assignment.scopeId, permissions: definition?.permissions ?? [] };
    }),
    limits: entitlements.limits,
    subscription: subscriptionAccess(state, user.companyId),
  };
}

function employeeForRecord(state: MockState, record: MockRow): MockRow | undefined {
  if (record.employeeId) return (state.employees as MockRow[]).find((item) => item.id === (typeof record.employeeId === 'string' ? record.employeeId : record.employeeId.id));
  if (record.userId) return (state.employees as MockRow[]).find((item) => item.userId === record.userId);
  if (record.id && String(record.id).startsWith('employee_')) return record;
  return undefined;
}

export function recordWithinScope(state: MockState, user: MockUser, record: MockRow, permission?: string): boolean {
  if (user.role === 'SUPER_ADMIN') return true;
  if (record.companyId && record.companyId !== user.companyId) return false;
  const assignments = assignmentsFor(state, user).filter((assignment) => {
    if (!permission) return true;
    const definition = (state.roleDefinitions as MockRow[]).find((item) => item.id === assignment.roleDefinitionId);
    return definition?.key === 'COMPANY_ADMIN' || (definition?.permissions as string[] | undefined)?.includes(permission);
  });
  if (!assignments.length) return false;
  const employee = employeeForRecord(state, record);
  return assignments.some((assignment) => {
    if (assignment.scopeType === 'COMPANY') return true;
    if (assignment.scopeType === 'SELF') return employee?.userId === user.id || employee?.id === assignment.scopeId;
    if (assignment.scopeType === 'BRANCH') return (record.branchId ?? employee?.branchId) === assignment.scopeId;
    if (assignment.scopeType === 'DEPARTMENT') return (record.departmentId ?? employee?.departmentId) === assignment.scopeId;
    if (assignment.scopeType === 'TEAM') {
      const team = (state.teams as MockRow[]).find((item) => item.id === assignment.scopeId);
      return Boolean(employee && team?.employeeIds?.includes(employee.id));
    }
    return false;
  });
}

export function appendAudit(state: MockState, input: { actorId?: string | null; companyId?: string | null; action: string; entityType: string; entityId: string; oldValue?: unknown; newValue?: unknown; description?: string }) {
  const createdAt = new Date().toISOString();
  const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  state.audit.unshift({ id, ...input, actorId: input.actorId ?? null, companyId: input.companyId ?? null, oldValue: input.oldValue ?? null, newValue: input.newValue ?? null, ip: '127.0.0.1', device: 'Mock browser session', requestId: `mock_${Date.now()}`, createdAt });
  state.activity.unshift({ id: `activity_${id}`, companyId: input.companyId ?? null, userId: input.actorId ?? null, action: input.action, module: input.entityType, status: 'SUCCESS', description: input.description ?? input.action.replaceAll('_', ' ').toLowerCase(), createdAt });
}

export function enabledPermissionKeys(state: MockState, companyId: string) {
  return new Set(effectiveEntitlements(state, companyId).modules
    .filter((module) => module.enabled)
    .flatMap((module) => (module.actions as string[]).map((action) => `${module.key}.${action}`)));
}
