import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8080',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: process.env.CHROMIUM_BIN ? { executablePath: process.env.CHROMIUM_BIN } : undefined,
      },
    },
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        launchOptions: process.env.CHROMIUM_BIN ? { executablePath: process.env.CHROMIUM_BIN } : undefined,
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'bun run dev',
        url: 'http://localhost:8080',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});