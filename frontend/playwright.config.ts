import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir:   './e2e',
  fullyParallel: false,   // tests share state (registered users etc)
  forbidOnly: !!process.env.CI,
  retries:   process.env.CI ? 1 : 0,
  workers:   1,
  reporter:  process.env.CI ? 'github' : 'list',

  use: {
    baseURL:     process.env.BASE_URL ?? 'http://localhost:5173',
    trace:       'on-first-retry',
    screenshot:  'only-on-failure',
    video:       'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use:  { ...devices['Desktop Chrome'] },
    },
  ],

  // Start the dev server automatically when running locally
  webServer: process.env.CI ? undefined : {
    command:           'npm run dev',
    url:               'http://localhost:5173',
    reuseExistingServer: true,
    timeout:           30_000,
  },
})
