import { expect, test } from '@playwright/test';

test('production build boots, hydrates MSW, and opens a role portal cleanly', async ({ page }) => {
  const failures: string[] = [];

  await page.goto('/login');
  await expect(page.getByText(/Demo mode/)).toBeVisible();

  // An anonymous session probe intentionally returns 401 while the login page
  // hydrates. Start portal error capture after that expected exchange.
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => failures.push(`page: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) failures.push(`http ${response.status()}: ${response.url()}`);
  });

  await page.getByRole('button', { name: 'COMPANY ADMIN', exact: true }).click();
  await expect(page).toHaveURL(/\/company-admin\/dashboard$/);
  await expect(page.locator('body')).not.toContainText('MOCK_NOT_IMPLEMENTED');
  await page.waitForLoadState('networkidle');

  expect(failures).toEqual([]);
});
