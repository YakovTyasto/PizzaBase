import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.PORT ?? 3100)
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`

/**
 * End-to-end configuration.
 *
 * The suite runs against demo mode on purpose: no Supabase project, no
 * account and no API keys, which is exactly the state a first-time reader of
 * the README is in. `DEMO_MODE=true` is forced so a stray `.env.local` cannot
 * change what the tests exercise.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Honour a preinstalled Chromium (CI images often ship one that does not
    // match this Playwright release's expected build number). Left unset
    // locally so `npx playwright install` works as normal.
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : undefined,
  },

  projects: [
    {
      name: 'mobile',
      // 390 px is the iPhone width the layout is designed against. The device
      // descriptor defaults to WebKit; Chromium is pinned so the suite runs on
      // images that ship only one browser. Swap to WebKit locally for a true
      // Safari check.
      use: { ...devices['iPhone 14'], browserName: 'chromium' },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npx next start -p ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          DEMO_MODE: 'true',
          NEXT_PUBLIC_DEMO_MODE: 'true',
        },
      },
})
