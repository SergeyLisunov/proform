'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types/database'

export interface AppUser {
  id: string
  authId: string
  name: string
  email: string
  role: UserRole
}

export function useUser() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)

  const fetchUser = useCallback(async () => {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { setLoading(false); return }
    const { data } = await supabase
      .from('users')
      .select('id, name, email, role, auth_id')
      .eq('auth_id', authUser.id)
      .single()
    if (data) {
      setUser({ id: data.id, authId: authUser.id, name: data.name, email: data.email, role: data.role as UserRole })
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchUser() }, [fetchUser])

  const switchRole = useCallback(async (newRole: UserRole) => {
    if (!user) return
    setSwitching(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', user.id)
    if (!error) {
      setUser(prev => prev ? { ...prev, role: newRole } : null)
      // Hard reload so all server components & layouts re-render with new role
      window.location.href = '/dashboard'
    }
    setSwitching(false)
  }, [user])

  return { user, loading, switching, switchRole }
}
