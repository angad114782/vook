/**
 * Temporary compatibility translator for the existing feature clients.
 * Every outgoing request uses the resource-oriented v2 wire contract; feature
 * components can be migrated independently without changing the backend API.
 */
export function toV2ResourcePath(input: string): string {
  let path = input.startsWith('/') ? input : `/${input}`;

  const exact: Record<string, string> = {
    '/auth/me': '/auth/session',
    '/auth/access': '/access',
    '/company-admin/dashboard': '/dashboard',
    '/company-admin/company': '/company',
    '/company-admin/modules': '/entitlements',
    '/company-admin/subscription': '/subscription',
    '/company-admin/activity': '/activity-events',
    '/company-admin/role-permissions': '/role-permissions',
    '/company-admin/workflows': '/workflows',
    '/hr/employees/departments': '/departments/summary',
    '/hr/attendance/records': '/attendance',
    '/hr/attendance-policy': '/attendance-policy',
    '/hr/payroll/salary': '/salaries',
    '/hr/payroll/payslips': '/payslips',
    '/hr/payroll/run': '/payroll-runs',
    '/finance/attendance': '/attendance/summary',
    '/finance/employees': '/employees',
    '/finance/salary': '/salaries',
    '/finance/payslips': '/payslips',
    '/finance/payroll/run': '/payroll-runs',
    '/finance/expenses': '/expenses',
    '/employee/profile': '/profile',
    '/employee/attendance': '/attendance/mine',
    '/employee/attendance/today': '/attendance/mine/today',
    '/employee/attendance/checkin': '/attendance/mine/check-in',
    '/employee/attendance/checkout': '/attendance/mine/check-out',
    '/employee/leaves': '/leave-requests/mine',
    '/employee/payslips': '/payslips/mine',
    '/employee/expenses': '/expenses/mine',
    '/employee/expenses/upload': '/files/receipts',
    '/employee/documents': '/documents/mine',
    '/subscriptions/revenue-trend': '/reports/revenue-trend',
    '/subscriptions/plans': '/plans',
    '/subscriptions/plans/modules/catalog': '/module-catalog',
    '/support': '/support-tickets',
    '/support/companies': '/companies/options',
    '/activity': '/activity-events',
    '/activity/companies': '/companies/options',
    '/audit': '/audit-events',
    '/hr/offices': '/offices',
    '/hr/documents': '/documents',
    '/hr/documents/upload': '/files/documents',
  };
  if (exact[path]) return exact[path];

  const prefixes: Array<[RegExp, string]> = [
    [/^\/company-admin\/users/, '/users'],
    [/^\/company-admin\/departments/, '/departments'],
    [/^\/company-admin\/designations/, '/designations'],
    [/^\/company-admin\/employees/, '/employees'],
    [/^\/company-admin\/onboarding/, '/onboarding'],
    [/^\/company-admin\/subscription/, '/subscription'],
    [/^\/company-admin\/role-assignments/, '/role-assignments'],
    [/^\/company-admin\/role-permissions/, '/role-permissions'],
    [/^\/company-admin\/workflows/, '/workflows'],
    [/^\/company-admin\/reports/, '/reports'],
    [/^\/platform\/broadcasts/, '/broadcasts'],
    [/^\/platform\/employees/, '/employees'],
    [/^\/platform\/users/, '/users'],
    [/^\/hr\/employees/, '/employees'],
    [/^\/hr\/attendance/, '/attendance'],
    [/^\/hr\/shifts/, '/shifts'],
    [/^\/hr\/leaves/, '/leave-requests'],
    [/^\/hr\/approvals/, '/approvals'],
    [/^\/hr\/payroll\/salary/, '/salaries'],
    [/^\/hr\/payroll\/payslips/, '/payslips'],
    [/^\/hr\/payroll\/runs/, '/payroll-runs'],
    [/^\/hr\/reports/, '/reports'],
    [/^\/hr\/documents/, '/documents'],
    [/^\/finance\/payroll\/payslips/, '/payslips'],
    [/^\/finance\/expenses/, '/expenses'],
    [/^\/finance\/reports/, '/reports'],
    [/^\/finance\/payslips/, '/payslips'],
    [/^\/employee\/payslips/, '/payslips/mine'],
    [/^\/subscriptions\/plans/, '/plans'],
    [/^\/subscriptions/, '/subscriptions'],
    [/^\/support/, '/support-tickets'],
  ];
  for (const [pattern, replacement] of prefixes) {
    if (pattern.test(path)) return path.replace(pattern, replacement);
  }
  return path;
}
