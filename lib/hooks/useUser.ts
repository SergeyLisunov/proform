'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
// Shared with server code via @/types/users — useUser.ts is 'use client'
// and can't be imported from server routes.
import type { UserRole } from '@/types/users'
export type { UserRole }

type UserRow = Database['public']['Tables']['users']['Row']
type UserUpdate = Database['public']['Tables']['users']['Update']

export interface AppUser {
  id: string
  authId: string
  name: string
  email: string
  role: UserRole
  /** Active parent_links rows where this user is the parent. Used to gate
   *  the "Дети" sidebar nav-entry — there is no global `parent` role; being
   *  a parent is a relationship (parent_links), not a role. */
  childCount: number
}

/**
 * Загрузка текущего пользователя с объединением одновременных запросов.
 *
 * ЗАЧЕМ. useUser вызывают 52 файла, и каждый экземпляр хука делал свою
 * загрузку: запрос в users и подсчёт parent_links. Только в каркасе кабинета
 * одновременно монтируется около восьми экземпляров (сайдбар, шапка, нижняя
 * навигация, useEffectiveRole и usePlan в двух местах, счётчик
 * непрочитанного) — это около 16 запросов к базе за одним и тем же
 * пользователем при каждом открытии раздела.
 *
 * Теперь экземпляры, которые начали загрузку, пока предыдущая ещё не
 * завершилась, получают тот же промис. Как только он разрешился, следующий
 * вызов делает свежий запрос — данные не залёживаются: это объединение
 * одновременных запросов, а не кэш.
 */
let inflight: Promise<AppUser | null> | null = null

export function loadAppUser(): Promise<AppUser | null> {
  if (inflight) return inflight
  inflight = fetchAppUser().finally(() => { inflight = null })
  return inflight
}

async function fetchAppUser(): Promise<AppUser | null> {
  const supabase = createClient()
  // Prefer the locally-stored session (`getSession`, no network round-trip)
  // and fall back to `getUser` (a network call to /auth/v1/user) only if it's
  // not cached. `getUser` transiently returns null on a flaky connection,
  // which would otherwise bounce an authenticated user to /auth/login. RLS
  // still enforces real auth on every DB call, so trusting the stored
  // session id here is safe.
  const { data: { session } } = await supabase.auth.getSession()
  const authUserId = session?.user?.id ?? (await supabase.auth.getUser()).data.user?.id ?? null
  if (!authUserId) return null
  const { data } = await supabase
    .from('users')
    .select('id, name, email, role, auth_id')
    .eq('auth_id', authUserId)
    .single()
  const userRow = data as Pick<UserRow, 'id' | 'name' | 'email' | 'role' | 'auth_id'> | null
  if (!userRow) return null
  // Count active parent_links — cheap (one indexed lookup) and lets the
  // sidebar conditionally render "Дети" without an extra round-trip there.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: childCount } = await (supabase as any)
    .from('parent_links')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', userRow.id)
    .eq('status', 'active')
  return {
    id: userRow.id, authId: authUserId, name: userRow.name, email: userRow.email,
    role: userRow.role as UserRole,
    childCount: childCount ?? 0,
  }
}

export function useUser() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching] = useState(false)

  useEffect(() => {
    let mounted = true
    loadAppUser().then(u => {
      if (!mounted) return
      setUser(u)
      setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  // switchRole удалён (P0, ревизия 2026-07-31): функция позволяла пользователю
  // переписать собственный users.role из браузера. Вызовов у неё не было, но
  // сам путь был открыт — RLS-политика users_update_own не ограничивает
  // колонки, поэтому роль менялась успешно (см. миграцию 104 и qa/ralph/
  // rls-probe.mjs, проверка WR-02). Смена роли — только через админ-канал.

  return { user, loading, switching }
}
