import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/smoke',
  fullyParallel: false,
  workers: 1,
  globalSetup: './tests/smoke/global-setup.ts',
  use: { baseURL: 'http://127.0.0.1:4180', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
