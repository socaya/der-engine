import { defineConfig, devices } from '@playwright/test';

/**
 * Phase 00 Playwright config for the DER admin console.
 *
 * The dev server is started via Vite preview on build output. Running Playwright
 * requires `npm run test:e2e:install` once to download Chromium — if that has not
 * been run the gate report records E2E as NOT RUN rather than claiming a pass.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-tablet',
      use: { ...devices['iPad (gen 7)'] },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
