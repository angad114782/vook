import { expect, test } from '@playwright/test';

const currentMockUser = (page: import('@playwright/test').Page) => page.evaluate(() => new Promise<string | null>((resolve, reject) => {
  const request = indexedDB.open('vook-mock-v2', 4);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const get = request.result.transaction('state').objectStore('state').get('application');
    get.onerror = () => reject(get.error);
    get.onsuccess = () => resolve(get.result?.currentUserId ?? null);
  };
}));

test('mock session persists through a full reload', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'EMPLOYEE', exact: true }).click();
  await expect(page).toHaveURL(/\/employee\/dashboard$/);
  expect(await currentMockUser(page)).toBe('user_employee');
  await page.reload();
  expect(await currentMockUser(page)).toBe('user_employee');
  await expect(page).toHaveURL(/\/employee\/dashboard$/);
});
