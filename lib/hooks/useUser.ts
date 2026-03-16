'use client'

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user: authUser } }) => {
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
    })
  }, [])

  return { user, loading }
}
