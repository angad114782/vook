import { describe, expect, it } from 'vitest';
import { accessSnapshot, effectiveEntitlements, effectivePermissions, recordWithinScope } from './domain';
import { createMockSeed } from './seed';

const now = new Date('2026-09-14T09:00:00.000Z');

describe('connected mock business model', () => {
  it('pins subscriptions to immutable versions and applies active overrides last', () => {
    const state = createMockSeed(now);
    const subscription = state.subscriptions.find((item) => item.companyId === 'company_orbit')!;
    const version = state.planVersions.find((item) => item.id === subscription.planVersionId)!;
    expect(version.planId).toBe(subscription.planId);

    const entitlement = effectiveEntitlements(state, 'company_orbit', now);
    expect(entitlement.plan.versionId).toBe(subscription.planVersionId);
    expect(entitlement.limits.employees).toBe(175);
    expect(entitlement.modules.find((item) => item.id === 'module_reports')?.source).toBe('OVERRIDE_GRANT');
  });

  it('always includes core modules in every published plan version', () => {
    const state = createMockSeed(now);
    const coreIds = state.modules.filter((item) => item.isCore).map((item) => item.id);
    expect(state.planVersions.every((version) => coreIds.every((id) => (version.moduleIds as string[]).includes(String(id))))).toBe(true);
  });

  it('unions multiple role assignments while retaining record scope', () => {
    const state = createMockSeed(now);
    const manager = state.users.find((item) => item.role === 'MANAGER')!;
    const permissions = effectivePermissions(state, manager);
    expect(permissions).toContain('APPROVALS.APPROVE');
    expect(state.roleAssignments.filter((item) => item.userId === manager.id).length).toBeGreaterThan(1);

    const inside = state.employees.find((item) => item.departmentId === 'dept_ops')!;
    const outside = state.employees.find((item) => item.departmentId === 'dept_hr')!;
    expect(recordWithinScope(state, manager, inside, 'EMPLOYEE_MANAGEMENT.VIEW')).toBe(true);
    expect(recordWithinScope(state, manager, outside, 'EMPLOYEE_MANAGEMENT.VIEW')).toBe(false);
  });

  it('keeps permissions dormant when an entitlement is removed', () => {
    const state = createMockSeed(now);
    const employee = state.users.find((item) => item.role === 'EMPLOYEE')!;
    state.entitlementOverrides.push({ id: 'deny_docs', companyId: employee.companyId, moduleId: 'module_documents', effect: 'DENY', reason: 'Test', createdAt: now.toISOString() });
    const role = state.roleDefinitions.find((item) => item.key === 'EMPLOYEE')!;
    expect((role.permissions as string[])).toContain('DOCUMENTS.VIEW');
    expect(effectivePermissions(state, employee)).not.toContain('DOCUMENTS.VIEW');
    expect(accessSnapshot(state, employee).modules.find((item) => item.key === 'DOCUMENTS')?.isEnabled).toBe(false);
  });
});
