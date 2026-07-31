import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E smoke config.
 * - Local: `npm run test:e2e` spins up `next dev` and hits it.
 * - CI: expects the app to already be running at BASE_URL.
 */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000)
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Публичные (неавторизованные) проверки — безопасны и против прод-URL.
    {
      name: 'public',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /smoke\.spec\.ts/,
    },
    // Ролевой вход через настоящую форму; готовит storageState для ролей.
    {
      name: 'setup',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /auth\.setup\.ts/,
    },
    // Ролевые сценарии: каждый файл сам выбирает нужный storageState.
    {
      name: 'roles',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /roles\/.*\.spec\.ts/,
      dependencies: ['setup'],
    },
    // Мобильный проход по ключевым ролевым экранам.
    // Pixel 5, а не iPhone: профили Apple тянут WebKit, которого нет в
    // CI-образе (ставится только chromium) — прогон падал на запуске браузера.
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
      testMatch: /mobile\.spec\.ts/,
      dependencies: ['setup'],
    },
  ],

  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- -p ${PORT}`,
        url: BASE_URL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
})
