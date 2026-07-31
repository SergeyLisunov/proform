import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import type { Organization, OrgMember, MemberStatus, OrgMemberRole } from '@/types/org.types'

type UserRow             = Database['public']['Tables']['users']['Row']
type OrgRow              = Database['public']['Tables']['organizations']['Row']
type OrgMemberInsert     = Database['public']['Tables']['org_members']['Insert']
type OrgMemberUpdate     = Database['public']['Tables']['org_members']['Update']
type OrgMemberRow        = Database['public']['Tables']['org_members']['Row']
type OrganizationUpdate  = Database['public']['Tables']['organizations']['Update']

// ─── shape narrowing ──────────────────────────────────────────────────────
// The Organization domain type is a public-facing subset of the DB row —
// no user_id (column doesn't exist in DB), and a couple of fields stay
// nullable to match runtime reality.

function rowToOrganization(row: OrgRow): Organization {
  return {
    id:          row.id,
    org_name:    row.org_name,
    org_slug:    row.org_slug,
    sport_type:  (row.sport_type as Organization['sport_type']) ?? null,
    city:        row.city,
    is_verified: row.is_verified ?? false,
    created_at:  row.created_at,
  }
}

function rowToOrgMember(row: OrgMemberRow & { user?: { name: string; email: string } }): OrgMember {
  return {
    id:          row.id,
    org_id:      row.org_id,
    user_id:     row.user_id,
    member_role: row.member_role as OrgMemberRole,
    status:      row.status as MemberStatus,
    joined_at:   row.joined_at,
    user:        row.user,
  }
}

// ─── reads ────────────────────────────────────────────────────────────────

/**
 * "My organisation" = the org where I'm an active member with the
 * `coach` role (de-facto admin in the current product). The previous
 * implementation queried `organizations.user_id` which doesn't exist
 * — every call returned null and the org dashboard appeared empty for
 * legitimately-onboarded users.
 */
export async function getMyOrg(): Promise<Organization | null> {
  const supabase = createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return null

  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authData.user.id)
    .single()
  const userRecord = userData as Pick<UserRow, 'id'> | null
  if (!userRecord) return null

  // Find an active org_members row for this user. Coach takes precedence
  // over athlete if the user is somehow in both.
  const { data: memberRows } = await supabase
    .from('org_members')
    .select('org_id, member_role')
    .eq('user_id', userRecord.id)
    .eq('status', 'active')
  const members = (memberRows ?? []) as Pick<OrgMemberRow, 'org_id' | 'member_role'>[]
  if (members.length === 0) return null

  const preferred = members.find(m => m.member_role === 'coach') ?? members[0]

  const { data: orgData } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', preferred.org_id)
    .single()
  if (!orgData) return null

  return rowToOrganization(orgData as OrgRow)
}

export async function getOrgBySlug(slug: string): Promise<Organization | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('organizations')
    .select('*')
    .eq('org_slug', slug)
    .single()

  return data ? rowToOrganization(data as OrgRow) : null
}

export async function getOrgMembers(orgId: string): Promise<OrgMember[]> {
  const supabase = createClient()
  // FK hint required: org_members has TWO FKs to users (user_id and
  // invited_by). Without `!org_members_user_id_fkey` PostgREST raises
  // "more than one relationship was found".
  const { data } = await supabase
    .from('org_members')
    .select('*, user:users!org_members_user_id_fkey(name, email)')
    .eq('org_id', orgId)
    .order('joined_at', { ascending: false })

  return ((data ?? []) as unknown as Array<OrgMemberRow & { user?: { name: string; email: string } }>)
    .map(rowToOrgMember)
}

/**
 * Полный список организаций для админ-модерации.
 *
 * Возвращает ошибку отдельным полем, а не глотает её: до миграции 107 на
 * organizations не было admin-политики RLS, запрос отдавал только
 * верифицированные строки — и экран /admin/orgs честно рисовал «Ожидают: 0».
 * Пустой ответ и сбой выглядели одинаково, поэтому мёртвый сценарий
 * модерации никак себя не проявлял.
 */
export async function getAllOrgs(): Promise<{ orgs: Organization[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('[org.service.getAllOrgs]', error.message)
    return { orgs: [], error: error.message }
  }

  return { orgs: ((data ?? []) as OrgRow[]).map(rowToOrganization), error: null }
}

export async function getOrgStats(orgId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('org_members')
    .select('member_role, status')
    .eq('org_id', orgId)
    .neq('status', 'suspended')
  const memberRows = (data ?? []) as Pick<OrgMemberRow, 'member_role' | 'status'>[]

  const total    = memberRows.length
  const coaches  = memberRows.filter((m) => m.member_role === 'coach').length
  const athletes = memberRows.filter((m) => m.member_role === 'athlete').length

  return { total, coaches, athletes }
}

// ─── writes ───────────────────────────────────────────────────────────────

export async function inviteMember(
  orgId: string,
  email: string,
  role: OrgMemberRole,
): Promise<{ error?: string }> {
  const supabase = createClient()
  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single()
  const userRecord = userData as Pick<UserRow, 'id'> | null

  if (!userRecord) return { error: 'Пользователь с таким email не найден' }

  // DB column is `member_role`, NOT `role`. Previous code passed `role`
  // and the insert silently dropped it because of `(sb as any)`.
  const payload: OrgMemberInsert = {
    org_id:      orgId,
    user_id:     userRecord.id,
    member_role: role,
    status:      'pending',
  }
  const { error } = await supabase.from('org_members').insert(payload)

  return error ? { error: error.message } : {}
}

export async function updateMemberStatus(
  memberId: string,
  status: MemberStatus,
): Promise<void> {
  const supabase = createClient()
  const payload: OrgMemberUpdate = { status }
  await supabase.from('org_members').update(payload).eq('id', memberId)
}

/**
 * Верификация организации админом. RLS-политика organizations_admin_update
 * (миграция 107) — единственное, что реально разрешает эту запись.
 *
 * `.select('id')` здесь не для данных, а для проверки факта записи: когда
 * строку отсекает RLS, PostgREST отвечает успехом с нулём затронутых строк,
 * а не ошибкой. Прежняя версия игнорировала и то и другое, возвращала void —
 * и UI ставил галочку «Проверено» на организацию, которая в базе осталась
 * неверифицированной (обман до первой перезагрузки страницы).
 */
export async function verifyOrg(orgId: string): Promise<{ ok: boolean; error: string | null }> {
  const supabase = createClient()
  const payload: OrganizationUpdate = { is_verified: true }
  const { data, error } = await supabase
    .from('organizations')
    .update(payload)
    .eq('id', orgId)
    .select('id')
    .maybeSingle()

  if (error) {
    console.warn('[org.service.verifyOrg]', error.message)
    return { ok: false, error: error.message }
  }
  if (!data) {
    return { ok: false, error: 'Организация не обновлена — недостаточно прав' }
  }

  return { ok: true, error: null }
}
