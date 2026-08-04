import { test, expect } from '@playwright/test'
import { statePath } from './accounts'

/**
 * Мобильный проход (iPhone 13) по ключевым ролевым экранам.
 * Проверяем то, что реально ломается на узком экране: горизонтальный
 * скролл страницы и перекрытие контента плавающим AI-виджетом.
 */

const SCREENS: Array<{ role: 'coach-alpha1' | 'athlete-alpha1' | 'owner-alpha'; path: string }> = [
  { role: 'coach-alpha1', path: '/dashboard' },
  { role: 'coach-alpha1', path: '/athletes' },
  { role: 'athlete-alpha1', path: '/athlete/dashboard' },
  { role: 'athlete-alpha1', path: '/diary' },
  { role: 'owner-alpha', path: '/org/members' },
]

for (const screen of SCREENS) {
  test.describe(`${screen.role} @ ${screen.path}`, () => {
    test.use({ storageState: statePath(screen.role) })

    test('страница не скроллится горизонтально', async ({ page }) => {
      await page.goto(screen.path)
      await page.waitForTimeout(1200)
      const overflow = await page.evaluate(() => {
        const el = document.documentElement
        return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }
      })
      // допускаем 2px на субпиксельное округление
      expect(
        overflow.scrollWidth - overflow.clientWidth,
        `${screen.path}: горизонтальный скролл (${overflow.scrollWidth} > ${overflow.clientWidth})`
      ).toBeLessThanOrEqual(2)
    })

    test('AI-виджет виден и не выходит за экран', async ({ page, request }) => {
      // Пропуск ТОЛЬКО когда сервер сам сказал, что ассистент недоступен
      // (в локальном окружении обычно нет ключа провайдера). Это не то же
      // самое, что прежний вариант «подождать чуть-чуть и пропустить, если
      // не нашли» — тот молча зеленел при настоящей поломке. Здесь причина
      // берётся у сервера и видна в отчёте.
      const res = await request.get('/api/assistant/capabilities')
      const caps = res.ok()
        ? ((await res.json().catch(() => ({}))) as {
            capabilities?: { available?: boolean; unavailableReason?: string }
          }).capabilities
        : undefined
      test.skip(
        caps?.available !== true,
        `AI недоступен в этом окружении: ${caps?.unavailableReason ?? `capabilities → HTTP ${res.status()}`}`,
      )

      await page.goto(screen.path)
      const widget = page.locator('button[aria-label="AI-помощник"]')
      // Ждём явно: виджет появляется после загрузки сессии и capabilities.
      await expect(widget).toBeVisible({ timeout: 20_000 })

      const box = await widget.boundingBox()
      expect(box, 'кнопка помощника должна иметь размеры').not.toBeNull()
      const viewport = page.viewportSize()!
      // Кнопка обязана оставаться в пределах экрана.
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)
    })
  })
}
