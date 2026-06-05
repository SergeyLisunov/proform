'use client'

/**
 * useEffectiveRole — резолвит EffectiveRole для целей навигации.
 *
 * Этап 2 sidebar-rebuild roadmap'а. Поверх useUser() добавляет lookup в
 * org_members.member_role для активной организации. Текущая модель — один
 * owner = одна org (#167), активная org резолвится как: одна org_members
 * запись со статусом 'active' и member_role ∈ ('org_owner','org_admin').
 *
 * Возвращает:
 *   - effectiveRole — что использовать для рендера sidebar/permissions.
 *     В порядке приоритета: scoped (org_owner|org_admin) → global (users.role).
 *   - globalRole — оригинальная users.role.
 *   - scopedOrgRole — null если юзер не управляет ни одной org.
 *   - loading — true пока useUser ещё резолвит.
 *
 * Backward compat: если scopedOrgRole='org_owner' но SIDEBAR_CONFIG ещё не
 * содержит пунктов специфично для org_owner — filter-функция fallback'ит
 * к матчингу 'organization' (см. getRoleMatchSet в lib/sidebar/config.ts).
 *
 * НЕ ЛОМАЕТ существующее поведение: текущие org-владельцы (users.role=
 * 'organization' + org_members.member_role='org_owner') получают тот же
 * sidebar что и раньше — но через явный effectiveRole путь.
 */
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/lib/hooks/useUser'
import type { EffectiveRole, GlobalRole, ScopedOrgRole } from '@/lib/sidebar/config'

function sb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export interface EffectiveRoleState {
  loading:        boolean
  globalRole:     GlobalRole | undefined
  scopedOrgRole:  ScopedOrgRole | null
  effectiveRole:  EffectiveRole | undefined
}

export function useEffectiveRole(): EffectiveRoleState {
  const { user, loading: userLoading } = useUser()
  const [scopedOrgRole, setScopedOrgRole] = useState<ScopedOrgRole | null>(null)
  const [scopedLoading, setScopedLoading] = useState(true)

  useEffect(() => {
    if (userLoading) return
    if (!user) { setScopedOrgRole(null); setScopedLoading(false); return }

    let cancelled = false
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rows } = await (sb() as any)
        .from('org_members')
        .select('member_role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .in('member_role', ['org_owner', 'org_admin'])
        .limit(1)

      if (cancelled) return
      const first = (rows ?? [])[0] as { member_role: ScopedOrgRole } | undefined
      setScopedOrgRole(first?.member_role ?? null)
      setScopedLoading(false)
    })()

    return () => { cancelled = true }
  }, [user, userLoading])

  const globalRole = user?.role as GlobalRole | undefined
  const effectiveRole: EffectiveRole | undefined = scopedOrgRole ?? globalRole

  return {
    loading: userLoading || scopedLoading,
    globalRole,
    scopedOrgRole,
    effectiveRole,
  }
}
