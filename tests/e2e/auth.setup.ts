import { test as setup, expect } from '@playwright/test'
import { mkdirSync, readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Ролевой вход через НАСТОЯЩУЮ форму /auth/login — не подделка cookie.
 * Сохраняет storageState для каждой QA-роли; ролевые spec'и подхватывают
 * их через проекты в playwright.config.ts.
 *
 * Пароль: QA_PASSWORD либо файл ~/sporteo-qa-accounts.txt (chmod 600).
 * В репозиторий учётные данные не попадают, .auth/ в .gitignore.
 */

import { ROLE_ACCOUNTS, AUTH_DIR, statePath, type RoleKey } from './accounts'

/**
 * Сколько ждать ухода с /auth/login. 45 с вместо прежних 20 с: 20 с объективно
 * не покрывали холодный старт серверной функции — POST входа, обмен на сессию
 * Supabase и редирект через middleware. Из-за этого исправные учётки падали по
 * таймауту, а через минуту логинились с HTTP 200.
 *
 * Критерий успеха НЕ ослаблен: страница обязана уйти с /auth/login, иначе тест
 * падает — и падает на всех трёх попытках, если вход сломан по-настоящему.
 * Медленный, но состоявшийся вход не повод красить прогон; невход остаётся
 * невходом.
 */
const LOGIN_REDIRECT_TIMEOUT_MS = 45_000

function qaPassword(): string {
  if (process.env.QA_PASSWORD) return process.env.QA_PASSWORD
  const file = process.env.QA_ACCOUNTS_FILE || join(homedir(), 'sporteo-qa-accounts.txt')
  if (!existsSync(file)) throw new Error(`Нет файла с QA-паролем: ${file}. Задайте QA_PASSWORD.`)
  const m = /Sporteo-QA-[A-Za-z0-9]+/.exec(readFileSync(file, 'utf8'))
  if (!m) throw new Error(`Пароль не найден в ${file}`)
  return m[0]
}

for (const [role, email] of Object.entries(ROLE_ACCOUNTS)) {
  setup(`вход: ${role}`, async ({ page }) => {
    mkdirSync(AUTH_DIR, { recursive: true })

    await page.goto('/auth/login')
    await page.locator('input[type="email"]').first().fill(email)
    await page.locator('input[type="password"]').first().fill(qaPassword())
    await page.locator('button[type="submit"]').first().click()

    // Успешный вход уводит с /auth/* (на /dashboard или ролевую домашнюю).
    await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: LOGIN_REDIRECT_TIMEOUT_MS })

    await page.context().storageState({ path: statePath(role as RoleKey) })
  })
}
