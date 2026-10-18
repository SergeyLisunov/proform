import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Объединение одновременных загрузок пользователя.
 *
 * В каркасе кабинета одновременно монтируется около восьми экземпляров
 * useUser, и каждый делал свои запросы в users и parent_links. Проверяем,
 * что одновременные вызовы делят один запрос, а последующие — делают свежий.
 */
const usersQueries = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'auth-1' } } } }),
      getUser: async () => ({ data: { user: { id: 'auth-1' } } }),
    },
    from: (table: string) => {
      if (table === 'users') {
        usersQueries()
        return {
          select: () => ({ eq: () => ({ single: async () => ({
            data: { id: 'u-1', name: 'Тест', email: 't@x', role: 'coach', auth_id: 'auth-1' },
          }) }) }),
        }
      }
      // parent_links
      return { select: () => ({ eq: () => ({ eq: async () => ({ count: 2 }) }) }) }
    },
  }),
}))

beforeEach(() => { usersQueries.mockClear() })

describe('loadAppUser', () => {
  it('одновременные вызовы делят один запрос', async () => {
    const { loadAppUser } = await import('./useUser')
    const results = await Promise.all([loadAppUser(), loadAppUser(), loadAppUser(), loadAppUser()])
    expect(usersQueries).toHaveBeenCalledTimes(1)
    for (const u of results) expect(u?.id).toBe('u-1')
  })

  it('после завершения следующий вызов делает свежий запрос — это не кэш', async () => {
    const { loadAppUser } = await import('./useUser')
    await loadAppUser()
    await loadAppUser()
    expect(usersQueries).toHaveBeenCalledTimes(2)
  })

  it('собирает пользователя целиком, включая число детей', async () => {
    const { loadAppUser } = await import('./useUser')
    const u = await loadAppUser()
    expect(u).toEqual({
      id: 'u-1', authId: 'auth-1', name: 'Тест', email: 't@x', role: 'coach', childCount: 2,
    })
  })
})
