/**
 * Org Groups (Teams) service — Sprint W2 Day 10.
 *
 * CRUD над `org_groups` (структура команд внутри организации) и
 * `org_group_members` (M2M атлет-команда). RLS делает enforcement;
 * этот service — UX-shaped wrapper.
 *
 * Used by:
 *   - /org/teams page (org admin manages teams)
 *   - Day 11 Org Dashboard (count athletes per team)
 *   - Day 12 bulk-invite (target a specific team)
 */
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type OrgGroupRow = Database['public']['Tables']['org_groups']['Row']
type OrgGroupInsert = Database['public']['Tables']['org_groups']['Insert']
type OrgGroupUpdate = Database['public']['Tables']['org_groups']['Update']
type OrgGroupMemberRow = Database['public']['Tables']['org_group_members']['Row']

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'pro' | 'recreational'

export const LEVEL_META: Record<SkillLevel, { label: string; color: string; bg: string; border: string }> = {
  beginner:     { label: 'Начинающий',  color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  intermediate: { label: 'Средний',     color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC' },
  advanced:     { label: 'Продвинутый', color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' },
  pro:          { label: 'Pro',         color: '#7C3AED', bg: '#FAF5FF', border: '#E9D5FF' },
  recreational: { label: 'Любитель',    color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0' },
}

export interface OrgGroup {
  id: string
  organization_id: string
  name: string
  description: string | null
  age_min: number | null
  age_max: number | null
  level: SkillLevel | null
  head_coach_id: string | null
  color: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface OrgGroupWithCounts extends OrgGroup {
  athletes_count: number
  head_coach: { id: string; name: string | null; avatar_url: string | null } | null
}

function rowToGroup(r: OrgGroupRow): OrgGroup {
  return {
    id:              r.id,
    organization_id: r.organization_id,
    name:            r.name,
    description:     r.description,
    age_min:         r.age_min,
    age_max:         r.age_max,
    level:           (r.level as SkillLevel | null) ?? null,
    head_coach_id:   r.head_coach_id,
    color:           r.color,
    is_active:       r.is_active,
    created_at:      r.created_at,
    updated_at:      r.updated_at,
  }
}

// ── Reads ──────────────────────────────────────────────────────────────

/** List teams of org with denormalized counts. RLS allows org members. */
export async function listOrgGroups(orgId: string): Promise<OrgGroupWithCounts[]> {
  const sb = createClient()
  const { data: groupsRaw } = await sb
    .from('org_groups')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('name', { ascending: true })
  const groups = ((groupsRaw ?? []) as OrgGroupRow[]).map(rowToGroup)
  if (groups.length === 0) return []

  // Counts in batch
  const groupIds = groups.map(g => g.id)
  const { data: membersRaw } = await sb
    .from('org_group_members')
    .select('group_id')
    .in('group_id', groupIds)
  const counts = new Map<string, number>()
  for (const m of ((membersRaw ?? []) as Array<{ group_id: string }>)) {
    counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1)
  }

  // Head coach details in batch
  const headCoachIds = Array.from(new Set(
    groups.map(g => g.head_coach_id).filter((x): x is string => !!x),
  ))
  const headCoachById = new Map<string, { id: string; name: string | null; avatar_url: string | null }>()
  if (headCoachIds.length > 0) {
    const { data: usersRaw } = await sb
      .from('users')
      .select('id, name, avatar_url')
      .in('id', headCoachIds)
    for (const u of ((usersRaw ?? []) as Array<{ id: string; name: string | null; avatar_url: string | null }>)) {
      headCoachById.set(u.id, u)
    }
  }

  return groups.map(g => ({
    ...g,
    athletes_count: counts.get(g.id) ?? 0,
    head_coach: g.head_coach_id ? headCoachById.get(g.head_coach_id) ?? null : null,
  }))
}

/** Get one group by id with members listed. */
export async function getOrgGroup(groupId: string): Promise<{ group: OrgGroup; members: Array<{ id: string; name: string | null; avatar_url: string | null }> } | null> {
  const sb = createClient()
  const { data: groupRaw } = await sb
    .from('org_groups')
    .select('*')
    .eq('id', groupId)
    .maybeSingle()
  if (!groupRaw) return null
  const group = rowToGroup(groupRaw as OrgGroupRow)

  const { data: membersRaw } = await sb
    .from('org_group_members')
    .select('athlete_id')
    .eq('group_id', groupId)
  const athleteIds = ((membersRaw ?? []) as Array<{ athlete_id: string }>).map(m => m.athlete_id)
  if (athleteIds.length === 0) return { group, members: [] }

  const { data: usersRaw } = await sb
    .from('users')
    .select('id, name, avatar_url')
    .in('id', athleteIds)
  const members = ((usersRaw ?? []) as Array<{ id: string; name: string | null; avatar_url: string | null }>)
  return { group, members }
}

// ── Mutations ──────────────────────────────────────────────────────────

export interface CreateGroupInput {
  organization_id: string
  name: string
  description?: string | null
  age_min?: number | null
  age_max?: number | null
  level?: SkillLevel | null
  head_coach_id?: string | null
  color?: string | null
}

export async function createOrgGroup(input: CreateGroupInput): Promise<OrgGroup | null> {
  const sb = createClient()
  const payload: OrgGroupInsert = {
    organization_id: input.organization_id,
    name:            input.name.trim(),
    description:     input.description?.trim() || null,
    age_min:         input.age_min ?? null,
    age_max:         input.age_max ?? null,
    level:           input.level ?? null,
    head_coach_id:   input.head_coach_id ?? null,
    color:           input.color ?? null,
    is_active:       true,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('org_groups')
    .insert(payload)
    .select()
    .single()
  if (error) {
    console.warn('[createOrgGroup]', error.message)
    return null
  }
  return rowToGroup(data as OrgGroupRow)
}

export async function updateOrgGroup(groupId: string, patch: Partial<OrgGroupUpdate>): Promise<OrgGroup | null> {
  const sb = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('org_groups')
    .update(patch)
    .eq('id', groupId)
    .select()
    .single()
  if (error) {
    console.warn('[updateOrgGroup]', error.message)
    return null
  }
  return rowToGroup(data as OrgGroupRow)
}

/** Soft-archive (sets is_active=false). Use this instead of DELETE to
 * preserve the team in audit history. */
export async function archiveOrgGroup(groupId: string): Promise<boolean> {
  const sb = createClient()
  const { error } = await sb
    .from('org_groups')
    .update({ is_active: false })
    .eq('id', groupId)
  if (error) {
    console.warn('[archiveOrgGroup]', error.message)
    return false
  }
  return true
}

// ── Members ────────────────────────────────────────────────────────────

export async function addAthleteToGroup(groupId: string, athleteId: string): Promise<boolean> {
  const sb = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any).from('org_group_members').insert({
    group_id:   groupId,
    athlete_id: athleteId,
  })
  if (error && error.code !== '23505') { // 23505 = unique violation (already member)
    console.warn('[addAthleteToGroup]', error.message)
    return false
  }
  return true
}

export async function removeAthleteFromGroup(groupId: string, athleteId: string): Promise<boolean> {
  const sb = createClient()
  const { error } = await sb
    .from('org_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('athlete_id', athleteId)
  if (error) {
    console.warn('[removeAthleteFromGroup]', error.message)
    return false
  }
  return true
}

/** List athletes of org NOT yet in any team (helper for "add member" picker). */
export async function listOrgAthletesNotInGroup(orgId: string, groupId: string): Promise<Array<{ id: string; name: string | null }>> {
  const sb = createClient()
  // Athletes of org via org_members
  const { data: membersRaw } = await sb
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('member_role', 'athlete')
    .eq('status', 'active')
  const athleteIds = ((membersRaw ?? []) as Array<{ user_id: string }>).map(m => m.user_id)
  if (athleteIds.length === 0) return []

  const { data: existingRaw } = await sb
    .from('org_group_members')
    .select('athlete_id')
    .eq('group_id', groupId)
  const existing = new Set(((existingRaw ?? []) as Array<{ athlete_id: string }>).map(e => e.athlete_id))
  const remaining = athleteIds.filter(id => !existing.has(id))
  if (remaining.length === 0) return []

  const { data: usersRaw } = await sb
    .from('users')
    .select('id, name')
    .in('id', remaining)
    .order('name', { ascending: true })
  return ((usersRaw ?? []) as Array<{ id: string; name: string | null }>)
}
