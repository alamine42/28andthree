import { defineConfig, devices } from '@playwright/test';

// Sandbox-specific Playwright config. Boots the app with
// NEXT_PUBLIC_SANDBOX_MODE=1 and points the suite at tests/e2e/sandbox.
// Run with: pnpm playwright test -c playwright.sandbox.config.ts
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001';

export default defineConfig({
  testDir: './tests/e2e/sandbox',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'pnpm dev:sandbox',
        url: baseURL,
        env: { PORT: '3001', NEXT_PUBLIC_SANDBOX_MODE: '1' },
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
