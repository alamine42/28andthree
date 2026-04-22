import { defineConfig, devices } from '@playwright/test';

// Sandbox Playwright config. `pnpm dev:sandbox` wraps `next dev` with
// portless, which binds port 443 behind a trusted local CA and routes
// https://sandbox.localhost to a random 4000-4999 port. Baseurl is
// stable regardless of which port Next picks.
//
// Run with: pnpm playwright test -c playwright.sandbox.config.ts
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://sandbox.localhost';

export default defineConfig({
  testDir: './tests/e2e/sandbox',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    // portless's CA is trusted at the OS level, so Chromium usually
    // accepts it. On a clean machine where `portless trust` hasn't
    // run, flip this to true to skip the cert check.
    ignoreHTTPSErrors: process.env.PLAYWRIGHT_IGNORE_HTTPS === '1',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'pnpm dev:sandbox',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
        ignoreHTTPSErrors: process.env.PLAYWRIGHT_IGNORE_HTTPS === '1',
      },
});
