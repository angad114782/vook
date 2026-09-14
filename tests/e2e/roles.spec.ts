import { expect, test } from '@playwright/test';

const roles = [
  ['SUPER ADMIN', '/dashboard'],
  ['COMPANY ADMIN', '/company-admin/dashboard'],
  ['HR', '/hr/dashboard'],
  ['FINANCE', '/finance/dashboard'],
  ['MANAGER', '/manager/dashboard'],
  ['SUPERVISOR', '/supervisor/dashboard'],
  ['EMPLOYEE', '/employee/dashboard'],
] as const;

for (const [role, path] of roles) {
  test(`${role} demo login`, async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: role, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path.replaceAll('/', '\\/')}$`));
    await expect(page.locator('body')).not.toContainText('MOCK_NOT_IMPLEMENTED');
  });
}

test('demo data reset survives reload', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Reset data' }).click();
  await expect(page.getByText('Demo mode · choose a role')).toBeVisible();
});
