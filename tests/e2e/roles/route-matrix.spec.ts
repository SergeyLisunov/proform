import { test, expect, type Page } from '@playwright/test'
import { statePath } from '../accounts'

/**
 * Матрица маршрутов по ролям: каждая роль обходит свои экраны кабинета.
 *
 * Проверяем на каждой странице:
 *   - HTTP < 500 и не выкинуло на /auth/login (роль имеет доступ);
 *   - не отрисовался error boundary Next.js;
 *   - в консоли нет ошибок страницы (сетевые 401/403 от опциональных
 *     виджетов не считаем — они ожидаемы для части ролей).
 */

type Route = { path: string; label: string }

const COMMON: Route[] = [
  { path: '/dashboard', label: 'Дашборд' },
  { path: '/calendar', label: 'Календарь' },
  { path: '/messages', label: 'Сообщения' },
  { path: '/notifications', label: 'Уведомления' },
  { path: '/settings', label: 'Настройки' },
  { path: '/connections', label: 'Связи' },
  { path: '/notes', label: 'Заметки' },
]

const BY_ROLE: Record<string, Route[]> = {
  'coach-alpha1': [
    ...COMMON,
    { path: '/athletes', label: 'Мои спортсмены' },
    { path: '/coach/plans', label: 'Планы тренера' },
    { path: '/coach/services', label: 'Услуги тренера' },
    { path: '/templates', label: 'Шаблоны' },
    { path: '/insights', label: 'Инсайты' },
  ],
  'doctor-alpha': [
    ...COMMON,
    { path: '/doctor/inquiries', label: 'Запросы врача' },
    { path: '/doctor/clearances', label: 'Допуски' },
    { path: '/doctor/reports', label: 'Отчёты врача' },
    { path: '/injuries', label: 'Травмы' },
  ],
  'athlete-alpha1': [
    ...COMMON,
    { path: '/athlete/dashboard', label: 'Кабинет спортсмена' },
    { path: '/athlete/goals', label: 'Цели' },
    { path: '/athlete/progress', label: 'Прогресс' },
    { path: '/diary', label: 'Дневник' },
    { path: '/records', label: 'Рекорды' },
  ],
  'owner-alpha': [
    ...COMMON,
    { path: '/org', label: 'Организация' },
    { path: '/org/members', label: 'Участники' },
    { path: '/org/coaches', label: 'Тренеры' },
    { path: '/org/athletes', label: 'Спортсмены клуба' },
    { path: '/org/teams', label: 'Команды' },
    { path: '/org/wall', label: 'Стена клуба' },
  ],
  'platform-owner': [
    { path: '/admin', label: 'Админка' },
    { path: '/admin/crm', label: 'CRM' },
    { path: '/admin/leads', label: 'Лиды' },
    { path: '/admin/orgs', label: 'Организации' },
    { path: '/admin/commerce', label: 'Коммерция' },
    { path: '/admin/onboarding-funnel', label: 'Воронка онбординга' },
  ],
}

/** Ошибки консоли, не относящиеся к дефектам страницы. */
function isNoise(text: string): boolean {
  return /Failed to load resource.*40[13]|net::ERR_|Download the React DevTools|hydrat/i.test(text)
}

async function visit(page: Page, path: string) {
  const consoleErrors: string[] = []
  page.on('console', m => {
    if (m.type() === 'error' && !isNoise(m.text())) consoleErrors.push(m.text())
  })
  const res = await page.goto(path, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(700) // дать клиентским запросам отрисовать состояние
  return { status: res?.status() ?? 0, url: page.url(), consoleErrors }
}

for (const [role, routes] of Object.entries(BY_ROLE)) {
  test.describe(`маршруты роли ${role}`, () => {
    test.use({ storageState: statePath(role as never) })

    for (const route of routes) {
      test(`${role}: ${route.path} (${route.label})`, async ({ page }) => {
        const r = await visit(page, route.path)

        expect(r.status, `${route.path} вернул ${r.status}`).toBeLessThan(500)
        expect(r.url, `${route.path} выкинул на логин — роль потеряла доступ`).not.toContain('/auth/login')

        const body = await page.locator('body').innerText()
        expect(body, `${route.path}: отрисовался error boundary`).not.toMatch(
          /Application error|Unhandled Runtime Error|Internal Server Error/i
        )
        expect(r.consoleErrors, `${route.path}: ошибки в консоли`).toEqual([])
      })
    }
  })
}
