import { expect, test } from '@playwright/test';

test('account dropdown closes when clicking outside it', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'EMPLOYEE', exact: true }).click();

  const userMenu = page.locator('.ca-user-menu');
  const popover = userMenu.locator('.ca-user-menu__popover');

  await userMenu.locator('summary').click();
  await expect(popover).toBeVisible();

  await page.locator('.app-layout-content').click({ position: { x: 280, y: 120 } });
  await expect(popover).toBeHidden();
});
