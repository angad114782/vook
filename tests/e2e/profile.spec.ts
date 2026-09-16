import { expect, test } from '@playwright/test';

test('employee can open Profile from the account menu and manage account security', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'EMPLOYEE', exact: true }).click();
  await expect(page).toHaveURL(/\/employee\/dashboard$/);

  const accountMenu = page.locator('details.ca-user-menu');
  await accountMenu.locator('summary').click();
  await expect(accountMenu.getByRole('link', { name: 'Profile', exact: true })).toBeVisible();
  await accountMenu.getByRole('link', { name: 'Profile', exact: true }).click();
  await expect(page).toHaveURL(/\/employee\/profile$/);
  await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from('profile-photo') });
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByText('Profile updated successfully.')).toBeVisible();
  await expect(page.locator('.profile-avatar-frame img')).toHaveAttribute('alt', 'Dev Patel profile');

  const passwordFields = page.locator('.profile-form__grid--password .profile-field input');
  await passwordFields.nth(0).fill('Demo@123');
  await passwordFields.nth(1).fill('Demo@1234');
  await passwordFields.nth(2).fill('Demo@1234');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(page.getByText('Password updated successfully.')).toBeVisible();

  await page.getByRole('button', { name: 'Set up 2FA', exact: true }).click();
  await page.getByLabel(/Verification code/).fill('123456');
  await page.getByRole('button', { name: 'Verify and enable', exact: true }).click();
  await expect(page.getByText('Two-factor authentication is enabled.')).toBeVisible();
});
