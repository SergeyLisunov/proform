import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E.
 *
 * ПО УМОЛЧАНИЮ ПРОГОН ЛОКАЛЬНЫЙ: Playwright сам поднимает dev-сервер и бьёт
 * в него. Так и было задумано, но какое-то время ролевые сценарии гоняли
 * против прод-URL — локальный dev не отдавал интерактивный клиент
 * (Next 16 блокировал dev-ресурсы для origin 127.0.0.1, см. DECISIONS D-02).
 * Причина устранена `allowedDevOrigins` в next.config.mjs, и зависимость от
 * прод-приложения больше не нужна.
 *
 * Режимы:
 *   npm run test:e2e                     — локально, dev-сервер поднимется сам
 *   PLAYWRIGHT_BASE_URL=https://…        — против уже запущенного адреса
 *                                          (прод-смоук, preview-деплой, CI)
 *
 * Честная оговорка про «нагрузку на прод»: локальный прогон снимает нагрузку
 * с прод-ПРИЛОЖЕНИЯ, но входы всё равно идут в настоящий Supabase Auth —
 * отдельной тестовой базы у проекта нет (BLOCKERS B-01). Поэтому у проекта
 * setup остаются ретраи и пониженная параллельность.
 *
 * Почему dev, а не production-сборка: в next.config.mjs включён
 * `output: 'standalone'`, а с ним `next start` НЕ РАБОТАЕТ — Next отвечает
 * 404 на маршруты приложения и пишет об этом в лог. Прод-подобный прогон
 * требует `node .next/standalone/server.js` с предварительным копированием
 * `.next/static` и `public` внутрь standalone — это отдельный шаг, и
 * навешивать его на каждый E2E-прогон неоправданно.
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
    // Ретраи/воркеры/таймаут заданы точечно на уровне проекта, а не глобально:
    // ложное падение setup роняет весь прогон (roles и mobile помечаются
    // skipped и выглядят как регрессия продукта), тогда как те же послабления
    // для ролевых spec'ов маскировали бы настоящие поломки.
    {
      name: 'setup',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /auth\.setup\.ts/,
      // 3 попытки. Настоящая поломка входа (неверный пароль, удалённая учётка,
      // сломанный редирект после логина) воспроизводится стабильно и переживёт
      // все три; разовая заминка авторизации — нет. Проверка по существу не
      // ослаблена: критерий успеха на каждой попытке прежний.
      retries: 2,
      // 2 воркера вместо умолчания (половина логических ядер — на рабочей
      // машине это 5). Все 10 QA-аккаунтов идут в один и тот же эндпоинт
      // Supabase Auth, и залп из пяти одновременных password-grant'ов упирался
      // в задержки авторизации — особенно когда прогон стартует сразу за
      // предыдущим (mobile следом за roles). Двух хватает, чтобы набор не
      // растянулся, и мало, чтобы не бить по авторизации пачкой.
      workers: 2,
      // 90 с на тест вместо глобальных 30 с. В бюджет входят холодный старт
      // серверной функции на /auth/login, сам POST входа и ожидание редиректа
      // (45 с, см. auth.setup.ts) — в 30 с одно только ожидание не помещалось.
      timeout: 90_000,
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

  // Поднимаем локальный сервер, только если адрес не задан извне.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- -p ${PORT}`,
        url: BASE_URL,
        // 180 с вместо 120: dev-сервер компилирует страницы по требованию, и
        // холодный старт первой авторизованной страницы заметно дольше, чем
        // отдача уже собранного бандла.
        timeout: 180_000,
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
      },
})
