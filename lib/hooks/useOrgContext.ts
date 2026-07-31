'use client'

/**
 * useOrgContext — клиентский резолвер org-контекста (P1, org_admin).
 *
 * Зачем: клиентские страницы `/org/*` делали две ошибки сразу —
 *   1) гейт `user.role !== 'organization'` (глобальная роль, которой у
 *      org_admin нет);
 *   2) `orgId = user.id` — верно только для аккаунта-организации, где
 *      `organizations.id = users.id`; у org_admin это чужой id.
 * Хук отдаёт готовые `canManage` + `orgId` + профиль клуба, чтобы страницы
 * не резолвили ничего вручную.
 *
 * Почему не надстройка над `useEffectiveRole`: тот хук намеренно
 * навигационный — он отдаёт роль, но не `org_id`, и берёт `.limit(1)` без
 * приоритета. Взять роль оттуда, а org_id отдельным запросом — значит
 * получить пару, которая может разъехаться у пользователя, владеющего одним
 * клубом и админящего другой. Поэтому здесь один запрос членств и общий с
 * сервером чистый резолвер `lib/org/resolve-org-context.ts`.
 */
import { useEffect, useState } from 'react'
import { useUser } from '@/lib/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { CLUB_MANAGER_MEMBER_ROLES, type GlobalRole, type ScopedOrgRole } from '@/lib/permissions'
import { resolveOrgContext, type OrgMembershipRow } from '@/lib/org/resolve-org-context'
import type { Organization } from '@/types/org.types'

export interface OrgContextState {
  /** true пока не резолвлены и пользователь, и членство, и профиль клуба. */
  loading:       boolean
  /** `users.id` (НЕ auth_id) — нужен страницам как author_id публикаций. */
  userId:        string | null
  globalRole:    GlobalRole | undefined
  scopedOrgRole: ScopedOrgRole | null
  /** `organizations.id` управляемого клуба. */
  orgId:         string | null
  canManage:     boolean
  /** Владелец: только он делегирует права (см. canAssignOrgAdmin). */
  isOwner:       boolean
  /** Профиль клуба — грузится здесь же, чтобы каждая страница не повторяла запрос. */
  org:           Organization | null
}

const EMPTY: OrgContextState = {
  loading: true, userId: null, globalRole: undefined, scopedOrgRole: null,
  orgId: null, canManage: false, isOwner: false, org: null,
}

export function useOrgContext(): OrgContextState {
  const { user, loading: userLoading } = useUser()
  const [state, setState] = useState<OrgContextState>(EMPTY)

  useEffect(() => {
    if (userLoading) return
    if (!user) { setState({ ...EMPTY, loading: false }); return }

    let cancelled = false
    void (async () => {
      const sb = createClient()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rows } = await (sb as any)
        .from('org_members')
        .select('org_id, member_role, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .in('member_role', CLUB_MANAGER_MEMBER_ROLES)
      if (cancelled) return

      const ctx = resolveOrgContext(
        user.id,
        user.role as GlobalRole,
        (rows ?? []) as OrgMembershipRow[],
      )

      let org: Organization | null = null
      if (ctx.orgId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: orgRow } = await (sb as any)
          .from('organizations')
          .select('id, org_name, org_slug, sport_type, city, is_verified, created_at')
          .eq('id', ctx.orgId)
          .maybeSingle()
        if (cancelled) return
        if (orgRow) {
          org = {
            id:          orgRow.id,
            org_name:    orgRow.org_name,
            org_slug:    orgRow.org_slug,
            sport_type:  (orgRow.sport_type as Organization['sport_type']) ?? null,
            city:        orgRow.city ?? null,
            is_verified: orgRow.is_verified ?? false,
            created_at:  orgRow.created_at,
          }
        }
      }

      setState({ loading: false, org, ...ctx })
    })()

    return () => { cancelled = true }
  }, [user, userLoading])

  return state
}
