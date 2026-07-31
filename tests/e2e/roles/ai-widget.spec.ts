import { test, expect } from '@playwright/test'
import { statePath } from '../accounts'

/**
 * Плавающий ролевой AI-помощник (Gemma): где он есть и где его быть не должно.
 * Продуктовое правило — виджет существует только внутри авторизованного
 * кабинета и НЕ рендерится на публичных страницах (не CSS-скрытие).
 */

const WIDGET = 'button[aria-label="AI-помощник"]'

test.describe('AI-виджет у ролей с доступом', () => {
  for (const role of ['coach-alpha1', 'athlete-alpha1', 'doctor-alpha', 'owner-alpha'] as const) {
    test.describe(role, () => {
      test.use({ storageState: statePath(role) })

      test(`${role}: кнопка помощника есть на /dashboard`, async ({ page }) => {
        await page.goto('/dashboard')
        await expect(page.locator(WIDGET)).toBeVisible({ timeout: 15_000 })
      })

      test(`${role}: панель открывается и показывает остаток лимита`, async ({ page }) => {
        await page.goto('/dashboard')
        await page.locator(WIDGET).click()
        const dialog = page.locator('[role="dialog"]')
        await expect(dialog).toBeVisible({ timeout: 10_000 })
        await expect(dialog).toContainText(/запросов|Sporteo AI/i)
      })
    })
  }
})

test.describe('AI-виджет отсутствует на публичных страницах', () => {
  test.use({ storageState: statePath('athlete-alpha1') })

  for (const path of ['/', '/pricing', '/legal/privacy', '/demo/ai-assistant']) {
    test(`нет виджета на ${path}`, async ({ page }) => {
      await page.goto(path)
      await page.waitForTimeout(1200)
      await expect(page.locator(WIDGET)).toHaveCount(0)
    })
  }
})

test.describe('сайдбар больше не содержит пункт AI-помощника', () => {
  test.use({ storageState: statePath('coach-alpha1') })

  test('в навигации нет ссылки /assistant', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForTimeout(800)
    await expect(page.locator('nav a[href="/assistant"]')).toHaveCount(0)
  })
})
