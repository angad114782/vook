import { describe, expect, it } from 'vitest';
import { createMockSeed, demoAccounts, MOCK_PASSWORD } from './seed';

describe('central mock seed', () => {
  it('provides every supported role and multiple companies', () => {
    const state = createMockSeed(new Date('2026-09-14T09:00:00.000Z'));
    expect(new Set(state.users.map((user) => user.role))).toEqual(new Set(['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR', 'FINANCE', 'MANAGER', 'SUPERVISOR', 'EMPLOYEE']));
    expect(state.companies.length).toBeGreaterThan(2);
    expect(demoAccounts.every((account) => account.password === MOCK_PASSWORD)).toBe(true);
  });

  it('keeps tenant records referentially coherent', () => {
    const state = createMockSeed(new Date('2026-09-14T09:00:00.000Z'));
    const companyIds = new Set(state.companies.map((company) => company.id));
    const employeeIds = new Set(state.employees.map((employee) => employee.id));
    expect(state.users.filter((user) => user.companyId).every((user) => companyIds.has(user.companyId))).toBe(true);
    expect(state.leaves.every((leave) => employeeIds.has(leave.employeeId))).toBe(true);
    expect(state.payslips.every((payslip) => employeeIds.has(payslip.employeeId))).toBe(true);
    expect(state.subscriptions.every((subscription) => state.planVersions.some((version) => version.id === subscription.planVersionId))).toBe(true);
    expect(state.roleAssignments.every((assignment) => state.roleDefinitions.some((role) => role.id === assignment.roleDefinitionId))).toBe(true);
    expect(state.onboardings[0].steps).toHaveLength(12);
  });

  it('seeds document-aligned policies and lifecycles', () => {
    const state = createMockSeed(new Date('2026-09-14T09:00:00.000Z'));
    expect((state.attendancePolicy.verification as Record<string, boolean>)).toMatchObject({ gpsRequired: true, geofenceRequired: true, deviceRequired: false, biometricEnabled: false });
    expect(state.plans.every((plan) => plan.defaultTrialDays === 5)).toBe(true);
    expect(state.payrollRuns.some((run) => ['DRAFT', 'CALCULATED', 'UNDER_REVIEW', 'APPROVED', 'FINALIZED', 'PUBLISHED'].includes(String(run.status)))).toBe(true);
  });
});
