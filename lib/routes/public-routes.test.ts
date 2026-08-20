import { describe, expect, it } from 'vitest'
import { isAnonymousAllowed } from './public-routes'

/**
 * Регрессия к P1 «публичные страницы за формой входа».
 *
 * Дефект найден смоуком на проде: /pricing, /legal/privacy и /legal/terms
 * отвечали 307 на /auth/login. Ролевые E2E его не видели, потому что ходят
 * на эти адреса ПОД АВТОРИЗОВАННОЙ ролью — а для вошедших они открывались.
 * Поэтому проверка ниже описывает правило само по себе, без сессии.
 */

const PUBLIC = [
  '/',
  // Маркетинг: на все три ведут ссылки со страниц, которые читают анонимно.
  '/about', '/contacts', '/pricing',
  // Юридические документы. Их открывает тот, кто решает, соглашаться ли, —
  // то есть человек ещё без аккаунта.
  '/legal/privacy', '/legal/terms',
  // Разделы целиком, вместе с индексом: индекс — тоже публичный адрес.
  '/tools', '/tools/acwr', '/demo', '/demo/ai-assistant',
  '/invite', '/invite/token-123', '/p', '/p/club-volna',
  '/network', '/network/coaches', '/directory',
  // Вход и регистрация — иначе редирект на логин зациклится.
  '/auth/login', '/auth/register', '/auth/reset',
  // API отвечает 401/404 в JSON; редирект превратил бы это в 200 с формой.
  '/api/health', '/api/demo/assistant',
  // Публичная страница клуба: один сегмент, не занятый разделом приложения.
  '/volna', '/sport-club-77',
]

const PRIVATE = [
  '/dashboard', '/diary', '/calendar', '/analytics', '/athletes', '/messages',
  '/settings', '/settings/billing', '/admin', '/admin/users', '/org', '/org/members',
  '/athlete/dashboard', '/coach/athletes', '/doctor/patients', '/assistant',
  '/insights', '/goals', '/records', '/injuries', '/onboarding',
]

describe('isAnonymousAllowed — что открыто без входа', () => {
  for (const path of PUBLIC) {
    it(`${path} открыт анониму`, () => {
      expect(isAnonymousAllowed(path)).toBe(true)
    })
  }
})

describe('isAnonymousAllowed — что закрыто', () => {
  for (const path of PRIVATE) {
    it(`${path} требует входа`, () => {
      expect(isAnonymousAllowed(path)).toBe(false)
    })
  }
})

describe('границы префиксов', () => {
  it('раздел покрывает вложенные пути, но не похожие по началу', () => {
    expect(isAnonymousAllowed('/legal')).toBe(true)
    expect(isAnonymousAllowed('/legal/privacy')).toBe(true)
    // '/legalese' — не раздел /legal, а кандидат в страницы клуба: один
    // сегмент, не зарезервирован. Проверяем, что он проходит ИМЕННО по
    // правилу клубной страницы, а не по совпадению начала строки.
    expect(isAnonymousAllowed('/legalese')).toBe(true)
    // А вложенный путь под незарезервированным сегментом — уже не клубная
    // страница и не публичный раздел.
    expect(isAnonymousAllowed('/legalese/secret')).toBe(false)
  })

  it('зарезервированный раздел не притворяется страницей клуба', () => {
    expect(isAnonymousAllowed('/dashboard')).toBe(false)
    expect(isAnonymousAllowed('/admin')).toBe(false)
  })
})
