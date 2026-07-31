import { describe, expect, it } from 'vitest'
import { isAssistantPublicPath } from './FloatingAssistant'
import { SIDEBAR_CONFIG, PARENT_FAMILY_SECTION } from '@/lib/sidebar/config'

describe('isAssistantPublicPath — виджет не существует на публичных страницах', () => {
  it('публичные страницы: true', () => {
    for (const p of [
      '/', '/auth/login', '/auth/register', '/auth/reset',
      '/legal/privacy', '/demo/ai-assistant', '/tools/acwr',
      '/invite/abc123', '/p/some-athlete', '/pricing',
      'volna-club', // публичная страница клуба (одиночный slug)
      // публичные разделы приложения: зарезервированы, но открыты анонимно
      '/about', '/contacts', '/directory',
    ].map(x => (x.startsWith('/') ? x : `/${x}`))) {
      expect(isAssistantPublicPath(p), p).toBe(true)
    }
  })

  it('авторизованные страницы кабинета: false', () => {
    for (const p of [
      '/dashboard', '/calendar', '/athletes', '/messages', '/settings',
      '/assistant', '/channels', '/profile/123', '/athlete/dashboard',
      '/doctor/clearances', '/org/members', '/workouts', '/ai',
      '/settings/notifications',
      // ревью-находка: разделы, которые пропускал старый хардкод
      '/templates', '/notes', '/challenges', '/competitions', '/streaks',
      '/notifications', '/connections', '/search', '/share',
    ]) {
      expect(isAssistantPublicPath(p), p).toBe(false)
    }
  })

  it('КАЖДЫЙ href сайдбара — не «публичный»: новый раздел без записи в RESERVED_TOP_LEVEL_SLUGS уронит этот тест', () => {
    const hrefs = [
      ...SIDEBAR_CONFIG.flatMap(s => s.items.map(i => i.href)),
      ...PARENT_FAMILY_SECTION.items.map(i => i.href),
    ].filter(h => h.startsWith('/'))
    expect(hrefs.length).toBeGreaterThan(10)
    for (const href of hrefs) {
      expect(isAssistantPublicPath(href), href).toBe(false)
    }
  })
})

describe('сайдбар — пункт AI-помощника удалён', () => {
  it('ни один пункт навигации не ведёт на /assistant', () => {
    const allItems = [
      ...SIDEBAR_CONFIG.flatMap(s => s.items),
      ...PARENT_FAMILY_SECTION.items,
    ]
    expect(allItems.some(i => i.href === '/assistant')).toBe(false)
    expect(allItems.some(i => i.label === 'AI-помощник')).toBe(false)
  })
})
