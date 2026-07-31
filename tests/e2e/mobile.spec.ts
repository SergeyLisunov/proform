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

    test('AI-виджет виден и не выходит за экран', async ({ page }) => {
      await page.goto(screen.path)
      const widget = page.locator('button[aria-label="AI-помощник"]')
      // Ждём явно: виджет появляется после загрузки сессии и capabilities.
      // Раньше здесь стоял короткий таймаут + skip — проверка молча
      // пропускалась и не доказывала ничего.
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
