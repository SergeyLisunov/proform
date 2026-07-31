import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RESERVED_TOP_LEVEL_SLUGS, PUBLIC_APP_SLUGS } from './reserved-slugs'

/**
 * Регрессия к P1 «публичные страницы ушли за логин».
 *
 * Причина дефекта: список зарезервированных слогов начали использовать как
 * признак «требует авторизации». Это два разных свойства: /about и /contacts
 * — маршруты приложения (значит зарезервированы), но открыты анонимно, на
 * них ведут ссылки с лендинга и из политики конфиденциальности.
 */
describe('публичные разделы приложения не требуют авторизации', () => {
  it('каждый публичный слог остаётся зарезервированным (не путается с клубом)', () => {
    for (const slug of PUBLIC_APP_SLUGS) {
      expect(RESERVED_TOP_LEVEL_SLUGS.has(slug), `${slug} должен быть в RESERVED`).toBe(true)
    }
  })

  it('маркетинговые страницы объявлены публичными', () => {
    for (const slug of ['about', 'contacts']) {
      expect(PUBLIC_APP_SLUGS.has(slug), `/${slug} — публичная страница`).toBe(true)
    }
  })

  it('middleware учитывает публичные страницы в ОБОИХ гейтах (auth и onboarding)', () => {
    const src = readFileSync(join(process.cwd(), 'lib', 'supabase', 'middleware.ts'), 'utf8')
    expect(src).toContain('PUBLIC_APP_SLUGS')
    const gateLines = src.split('\n').filter(l => l.includes('isPublicAppPage') && l.includes('if ('))
    expect(gateLines.length, 'оба гейта должны пропускать публичные страницы').toBe(2)
  })

  it('разделы кабинета публичными не объявлены', () => {
    for (const slug of ['dashboard', 'settings', 'athletes', 'org', 'admin', 'diary']) {
      expect(PUBLIC_APP_SLUGS.has(slug), `/${slug} не должен быть публичным`).toBe(false)
    }
  })
})
