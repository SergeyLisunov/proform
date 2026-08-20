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

  /**
   * Раньше здесь считались строки исходника с `isPublicAppPage` — проверка
   * реализации, а не поведения: она осталась зелёной, пока /pricing,
   * /legal/privacy и /legal/terms уходили на форму входа. Само правило для
   * анонима теперь проверяется по списку путей в public-routes.test.ts.
   *
   * За этим тестом остаётся второй гейт — онбординговый, для уже вошедших:
   * он живёт в middleware отдельным условием, и публичные страницы обязан
   * пропускать, иначе пользователь с незавершённым онбордингом не откроет
   * ни тарифы, ни политику конфиденциальности.
   */
  it('онбординговый гейт пропускает публичные страницы и юридические документы', () => {
    const src = readFileSync(join(process.cwd(), 'lib', 'supabase', 'middleware.ts'), 'utf8')
    const onboardingGate = src
      .split('\n')
      .find(l => l.includes('if (user &&') && l.includes('isOnboardingRoute'))
    expect(onboardingGate, 'онбординговый гейт не найден — проверку нужно обновить').toBeDefined()
    expect(onboardingGate).toContain('isPublicAppPage')
    expect(onboardingGate).toContain('isLegalRoute')
  })

  it('анонимный гейт делегирует правило единой функции', () => {
    const src = readFileSync(join(process.cwd(), 'lib', 'supabase', 'middleware.ts'), 'utf8')
    // Дублирование правила в middleware — как раз то, из-за чего расхождение
    // накопилось незаметно. Источник должен остаться один.
    expect(src).toContain('isAnonymousAllowed(pathname)')
  })

  it('разделы кабинета публичными не объявлены', () => {
    for (const slug of ['dashboard', 'settings', 'athletes', 'org', 'admin', 'diary']) {
      expect(PUBLIC_APP_SLUGS.has(slug), `/${slug} не должен быть публичным`).toBe(false)
    }
  })
})
