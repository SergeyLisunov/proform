'use client'

import { useEffect, useState, useCallback } from 'react'
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

export function useUser() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)

  const fetchUser = useCallback(async () => {
    const supabase = createClient()
    // Prefer the locally-stored session (`getSession`, no network round-trip)
    // and fall back to `getUser` (a network call to /auth/v1/user) only if it's
    // not cached. `getUser` transiently returns null on a flaky connection,
    // which would otherwise bounce an authenticated user to /auth/login. RLS
    // still enforces real auth on every DB call, so trusting the stored
    // session id here is safe.
    const { data: { session } } = await supabase.auth.getSession()
    const authUserId = session?.user?.id ?? (await supabase.auth.getUser()).data.user?.id ?? null
    if (!authUserId) { setLoading(false); return }
    const { data } = await supabase
      .from('users')
      .select('id, name, email, role, auth_id')
      .eq('auth_id', authUserId)
      .single()
    const userRow = data as Pick<UserRow, 'id' | 'name' | 'email' | 'role' | 'auth_id'> | null
    if (userRow) {
      // Count active parent_links — cheap (one indexed lookup) and lets the
      // sidebar conditionally render "Дети" without an extra round-trip there.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: childCount } = await (supabase as any)
        .from('parent_links')
        .select('id', { count: 'exact', head: true })
        .eq('parent_id', userRow.id)
        .eq('status', 'active')
      setUser({
        id: userRow.id, authId: authUserId, name: userRow.name, email: userRow.email,
        role: userRow.role as UserRole,
        childCount: childCount ?? 0,
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchUser() }, [fetchUser])

  const switchRole = useCallback(async (newRole: UserRole) => {
    if (!user) return
    setSwitching(true)
    const supabase = createClient()
    const payload: UserUpdate = { role: newRole }
    const { error } = await (supabase.from('users') as any).update(payload).eq('id', user.id)
    if (!error) {
      setUser(prev => prev ? { ...prev, role: newRole } : null)
      // Hard reload so all server components & layouts re-render with new role
      window.location.href = '/dashboard'
    }
    setSwitching(false)
  }, [user])

  return { user, loading, switching, switchRole }
}
