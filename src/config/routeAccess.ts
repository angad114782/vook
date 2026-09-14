export interface RouteAccessRule {
  module?: string;
  permission?: string;
  recovery?: boolean;
}

/** Shared navigation and direct-route access metadata for every tenant portal. */
export const routeAccess: Record<string, RouteAccessRule> = {
  '/company-admin/dashboard': { module: 'Dashboard', permission: 'DASHBOARD.VIEW' },
  '/company-admin/workforce': { module: 'Employee Management', permission: 'EMPLOYEE_MANAGEMENT.VIEW' },
  '/company-admin/attendance': { module: 'Attendance', permission: 'ATTENDANCE.VIEW' },
  '/company-admin/departments': { module: 'Organization', permission: 'ORGANIZATION.VIEW' },
  '/company-admin/approvals': { module: 'Approvals', permission: 'APPROVALS.VIEW' },
  '/company-admin/payroll/overview': { module: 'Payroll', permission: 'PAYROLL.VIEW' },
  '/company-admin/reports': { module: 'Reports & Analytics', permission: 'REPORTS_ANALYTICS.VIEW' },
  '/company-admin/attendance-integrations': { module: 'Attendance Integrations', permission: 'ATTENDANCE_INTEGRATIONS.VIEW' },
  '/company-admin/users': { module: 'Employee Management', permission: 'EMPLOYEE_MANAGEMENT.VIEW' },
  '/company-admin/settings/roles': { module: 'Roles & Permissions', permission: 'ROLES_PERMISSIONS.VIEW' },
  '/company-admin/settings/workflows': { module: 'Approvals', permission: 'APPROVALS.CONFIGURE' },
  '/company-admin/plan': { recovery: true },
  '/company-admin/account-security': { recovery: true },
  '/company-admin/support': { recovery: true },

  '/hr/employees': { module: 'Employee Management', permission: 'EMPLOYEE_MANAGEMENT.VIEW' },
  '/hr/attendance': { module: 'Attendance', permission: 'ATTENDANCE.VIEW' },
  '/hr/leaves': { module: 'Leave Management', permission: 'LEAVE_MANAGEMENT.VIEW' },
  '/hr/approvals': { module: 'Approvals', permission: 'APPROVALS.VIEW' },
  '/hr/payroll': { module: 'Payroll', permission: 'PAYROLL.VIEW' },
  '/hr/documents': { module: 'Documents', permission: 'DOCUMENTS.VIEW' },

  '/finance/payroll': { module: 'Payroll', permission: 'PAYROLL.VIEW' },
  '/finance/salary-structure': { module: 'Payroll', permission: 'PAYROLL.VIEW' },
  '/finance/payslips': { module: 'Payslips', permission: 'PAYSLIPS.VIEW' },
  '/finance/expenses': { module: 'Expense Management', permission: 'EXPENSE_MANAGEMENT.VIEW' },
  '/finance/reports': { module: 'Reports & Analytics', permission: 'REPORTS_ANALYTICS.VIEW' },

  '/manager/workforce': { module: 'Employee Management', permission: 'EMPLOYEE_MANAGEMENT.VIEW' },
  '/manager/approvals': { module: 'Approvals', permission: 'APPROVALS.VIEW' },
  '/manager/attendance': { module: 'Attendance', permission: 'ATTENDANCE.VIEW' },
  '/manager/reports': { module: 'Reports & Analytics', permission: 'REPORTS_ANALYTICS.VIEW' },

  '/supervisor/workforce': { module: 'Employee Management', permission: 'EMPLOYEE_MANAGEMENT.VIEW' },
  '/supervisor/attendance': { module: 'Attendance', permission: 'ATTENDANCE.VIEW' },
  '/supervisor/shifts': { module: 'Shift Management', permission: 'SHIFT_MANAGEMENT.VIEW' },
  '/supervisor/approvals': { module: 'Approvals', permission: 'APPROVALS.VIEW' },

  '/employee/attendance': { module: 'Attendance', permission: 'ATTENDANCE.VIEW' },
  '/employee/leaves': { module: 'Leave Management', permission: 'LEAVE_MANAGEMENT.VIEW' },
  '/employee/payslips': { module: 'Payslips', permission: 'PAYSLIPS.VIEW' },
  '/employee/expenses': { module: 'Expense Management', permission: 'EXPENSE_MANAGEMENT.VIEW' },
  '/employee/documents': { module: 'Documents', permission: 'DOCUMENTS.VIEW' },
};

export interface RouteAccessReader {
  can(permission: string): boolean;
  moduleEnabled(module: string): boolean;
  data?: { subscription?: { state?: string } | null };
}

export function routeVisible(access: RouteAccessReader, path: string): boolean {
  const rule = routeAccess[path];
  if (!rule) return true;
  const restricted = ['PAST_DUE', 'SUSPENDED', 'CANCELLED'].includes(access.data?.subscription?.state ?? '');
  if (restricted && !rule.recovery) return false;
  if (rule.module && !access.moduleEnabled(rule.module)) return false;
  if (rule.permission && !access.can(rule.permission)) return false;
  return true;
}
