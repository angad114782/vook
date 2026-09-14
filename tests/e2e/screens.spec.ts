import { expect, test } from '@playwright/test';

const suites = [
  { role: 'SUPER ADMIN', routes: ['/dashboard', '/companies', '/subscriptions', '/plans', '/payments', '/activity', '/modules', '/support', '/settings', '/integrations', '/audit', '/security', '/users-access', '/platform-employees', '/notifications-admin'] },
  { role: 'COMPANY ADMIN', routes: ['/company-admin', '/company-admin/dashboard', '/company-admin/onboarding', '/company-admin/plan', '/company-admin/attendance', '/company-admin/attendance-integrations', '/company-admin/workforce', '/company-admin/payroll/overview', '/company-admin/payroll/run', '/company-admin/payroll/salary-structure', '/company-admin/payroll/payslips', '/company-admin/payroll/reports', '/company-admin/payroll/compliance', '/company-admin/approvals', '/company-admin/reports', '/company-admin/users', '/company-admin/departments', '/company-admin/activity', '/company-admin/modules', '/company-admin/settings/company', '/company-admin/account-security', '/company-admin/settings/roles', '/company-admin/settings/workflows', '/company-admin/support'] },
  { role: 'HR', routes: ['/hr/dashboard', '/hr/employees', '/hr/attendance', '/hr/leaves', '/hr/approvals', '/hr/payroll', '/hr/documents', '/hr/settings'] },
  { role: 'FINANCE', routes: ['/finance/dashboard', '/finance/payroll', '/finance/salary-structure', '/finance/payslips', '/finance/expenses', '/finance/reports', '/finance/settings'] },
  { role: 'MANAGER', routes: ['/manager/dashboard', '/manager/workforce', '/manager/approvals', '/manager/attendance', '/manager/reports', '/manager/settings'] },
  { role: 'SUPERVISOR', routes: ['/supervisor/dashboard', '/supervisor/workforce', '/supervisor/attendance', '/supervisor/shifts', '/supervisor/approvals', '/supervisor/settings'] },
  { role: 'EMPLOYEE', routes: ['/employee/dashboard', '/employee/attendance', '/employee/leaves', '/employee/payslips', '/employee/expenses', '/employee/documents', '/employee/settings'] },
] as const;

for (const suite of suites) {
  test(`${suite.role} screens load without request or render failures`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/login');
    await page.getByRole('button', { name: suite.role, exact: true }).click();
    await expect(page).not.toHaveURL(/\/login$/);
    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(`page: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().includes('favicon')) failures.push(`console: ${message.text()}`);
    });
    for (const route of suite.routes) {
      await page.goto(route);
      await page.waitForTimeout(250);
      await expect(page.locator('body'), route).not.toContainText('Something went wrong');
      await expect(page.locator('body'), route).not.toContainText('MOCK_NOT_IMPLEMENTED');
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });
}
