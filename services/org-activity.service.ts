/**
 * Org activity feed service — Sprint W7 Day 37 (PR #55).
 *
 * Closes the "Org tier silent" gap. B2B users (organization role)
 * had no way to see what was happening across their roster without
 * navigating per-section. This service aggregates cross-cutting
 * events into a single reverse-chronological feed for /org/activity.
 *
 * Event sources (4 types):
 *   1. member_joined          — org_members row added (status='active')
 *   2. inquiry_created        — doctor_inquiries created about org athlete
 *   3. inquiry_answered       — doctor_inquiries got response
 *   4. recommendation_issued  — recommendations row addressing org athlete
 *
 * Aggregation strategy: roster snapshot then parallel queries per
 * source, merge + sort in JS. Names resolved in a single batch query
 * to avoid N+1. Cap = 50 events; no pagination yet (W8 candidate when
 * volume justifies it).
 *
 * Auth model:
 *   Право и org_id даёт общий резолвер `lib/org/org-context.ts` — управлять
 *   клубом может и аккаунт-организация (`users.role='organization'`, где
 *   `organizations.id = users.id`), и назначенный администратор
 *   (`org_members.member_role='org_admin'`, org_id — ЧУЖОЙ id). RLS на
 *   org_members + дочерних таблицах ограничивает видимость; запросы идут
 *   от имени вызывающего через SSR supabase client.
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgContext } from '@/lib/org/org-context'

export type OrgEventType =
  | 'member_joined'
  | 'inquiry_created'
  | 'inquiry_answered'
  | 'recommendation_issued'

export interface OrgEvent {
  type:        OrgEventType
  timestamp:   string
  actor_id:    string | null
  actor_name:  string | null
  target_id:   string | null         // usually the athlete affected
  target_name: string | null
  entity_id:   string                // FK to source row (inquiry id, recommendation id, etc.)
  /** Human-readable one-line summary in Russian for UI. */
  summary:     string
  /** Extra tone/severity hints for UI accent (red_flag, urgent, etc.). */
  tone?:       'info' | 'warning' | 'critical' | 'success'
}

/** Get list of athlete user_ids who are accepted members of this org. */
async function getOrgAthleteIds(orgId: string): Promise<string[]> {
  const sb = await createClient()
  const { data } = await sb
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .limit(2000)
  return ((data ?? []) as Array<{ user_id: string }>).map(r => r.user_id)
}

/** Batch resolve display names for a list of user_ids. */
async function resolveNames(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map()
  const sb = await createClient()
  const unique = Array.from(new Set(userIds))
  const { data } = await sb
    .from('users')
    .select('id, name')
    .in('id', unique)
  const m = new Map<string, string>()
  for (const u of (data ?? []) as Array<{ id: string; name: string | null }>) {
    if (u.name) m.set(u.id, u.name)
  }
  return m
}

const SINCE_WINDOW_DAYS = 30
const FEED_LIMIT = 50

// ── Admin-client variant for cron iteration (W8 Day 41) ──────────────────

/**
 * Same aggregation as getRecentOrgActivity but works in cron context
 * where there's no authenticated user — pulls activity for an explicit
 * orgId via service-role admin client. Used by /api/cron/org-weekly-digest
 * to iterate across all orgs.
 *
 * Window is parameterizable (digest uses 7d, in-app feed uses 30d).
 */
export async function findActivityForOrg(
  orgId: string,
  windowDays: number = SINCE_WINDOW_DAYS,
  limit: number = FEED_LIMIT,
): Promise<OrgEvent[]> {
  const admin = createAdminClient()
  const since = new Date(Date.now() - windowDays * 24 * 3600 * 1000).toISOString()

  // Roster snapshot
  const { data: memberRows } = await admin
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .limit(2000)
  const athleteIds = ((memberRows ?? []) as Array<{ user_id: string }>).map(r => r.user_id)

  // 4 parallel queries (same as SSR variant)
  const [memberJoins, inquiriesCreated, inquiriesAnswered, recsIssued] = await Promise.all([
    adminFetchMemberJoins(admin, orgId, since),
    athleteIds.length > 0 ? adminFetchInquiriesCreated(admin, athleteIds, since) : Promise.resolve([] as OrgEvent[]),
    athleteIds.length > 0 ? adminFetchInquiriesAnswered(admin, athleteIds, since) : Promise.resolve([] as OrgEvent[]),
    athleteIds.length > 0 ? adminFetchRecsIssued(admin, athleteIds, since) : Promise.resolve([] as OrgEvent[]),
  ])

  const all = [...memberJoins, ...inquiriesCreated, ...inquiriesAnswered, ...recsIssued]
  if (all.length === 0) return []

  // Batch name resolution
  const allUserIds = [
    ...all.map(e => e.actor_id).filter((x): x is string => !!x),
    ...all.map(e => e.target_id).filter((x): x is string => !!x),
  ]
  if (allUserIds.length > 0) {
    const unique = Array.from(new Set(allUserIds))
    const { data } = await admin.from('users').select('id, name').in('id', unique)
    const names = new Map<string, string>()
    for (const u of (data ?? []) as Array<{ id: string; name: string | null }>) {
      if (u.name) names.set(u.id, u.name)
    }
    for (const e of all) {
      if (e.actor_id  && !e.actor_name)  e.actor_name  = names.get(e.actor_id)  ?? null
      if (e.target_id && !e.target_name) e.target_name = names.get(e.target_id) ?? null
    }
  }

  all.sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0))
  return all.slice(0, limit)
}

// Internal per-source fetchers using passed admin client. Mirror SSR variants.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function adminFetchMemberJoins(admin: any, orgId: string, sinceIso: string): Promise<OrgEvent[]> {
  const { data } = await admin
    .from('org_members')
    .select('id, user_id, member_role, status, joined_at, created_at')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .gte('joined_at', sinceIso)
    .order('joined_at', { ascending: false })
    .limit(50)
  const rows = (data ?? []) as Array<{ id: string; user_id: string; member_role: string; joined_at: string; created_at: string }>
  return rows.map(r => ({
    type:        'member_joined' as const,
    timestamp:   r.joined_at ?? r.created_at,
    actor_id:    r.user_id,
    actor_name:  null,
    target_id:   r.user_id,
    target_name: null,
    entity_id:   r.id,
    summary:     `Новый ${r.member_role === 'org_owner' ? 'владелец' : r.member_role === 'org_admin' ? 'администратор' : r.member_role === 'coach' ? 'тренер' : r.member_role === 'doctor' ? 'врач' : r.member_role === 'specialist' ? 'специалист' : 'атлет'} в организации`,
    tone:        'success',
  }))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function adminFetchInquiriesCreated(admin: any, athleteIds: string[], sinceIso: string): Promise<OrgEvent[]> {
  const { data } = await admin
    .from('doctor_inquiries')
    .select('id, coach_id, athlete_id, urgency, question_type, status, created_at')
    .in('athlete_id', athleteIds)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(50)
  const rows = (data ?? []) as Array<{
    id: string; coach_id: string; athlete_id: string
    urgency: 'routine' | 'urgent' | 'red_flag'; question_type: string
    status: string; created_at: string
  }>
  return rows.map(r => ({
    type:        'inquiry_created' as const,
    timestamp:   r.created_at,
    actor_id:    r.coach_id,
    actor_name:  null,
    target_id:   r.athlete_id,
    target_name: null,
    entity_id:   r.id,
    summary:     `Запрос врачу: ${r.question_type.replace(/_/g, ' ')}`,
    tone:        r.urgency === 'red_flag' ? 'critical' : r.urgency === 'urgent' ? 'warning' : 'info',
  }))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function adminFetchInquiriesAnswered(admin: any, athleteIds: string[], sinceIso: string): Promise<OrgEvent[]> {
  const { data } = await admin
    .from('doctor_inquiries')
    .select('id, coach_id, athlete_id, doctor_id, urgency, question_type, status, responded_at')
    .in('athlete_id', athleteIds)
    .eq('status', 'answered')
    .not('responded_at', 'is', null)
    .gte('responded_at', sinceIso)
    .order('responded_at', { ascending: false })
    .limit(50)
  const rows = (data ?? []) as Array<{
    id: string; coach_id: string; athlete_id: string; doctor_id: string | null
    urgency: 'routine' | 'urgent' | 'red_flag'; question_type: string
    status: string; responded_at: string
  }>
  return rows.map(r => ({
    type:        'inquiry_answered' as const,
    timestamp:   r.responded_at,
    actor_id:    r.doctor_id,
    actor_name:  null,
    target_id:   r.athlete_id,
    target_name: null,
    entity_id:   r.id,
    summary:     `Врач ответил на запрос: ${r.question_type.replace(/_/g, ' ')}`,
    tone:        'success',
  }))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function adminFetchRecsIssued(admin: any, athleteIds: string[], sinceIso: string): Promise<OrgEvent[]> {
  const { data } = await admin
    .from('recommendations')
    .select('id, doctor_id, athlete_id, coach_id, category, severity, visibility_level, status, created_at')
    .in('athlete_id', athleteIds)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(50)
  const rows = (data ?? []) as Array<{
    id: string; doctor_id: string; athlete_id: string; coach_id: string | null
    category: string; severity: 'low' | 'moderate' | 'high' | 'critical'
    visibility_level: string; status: string; created_at: string
  }>
  return rows.map(r => ({
    type:        'recommendation_issued' as const,
    timestamp:   r.created_at,
    actor_id:    r.doctor_id,
    actor_name:  null,
    target_id:   r.athlete_id,
    target_name: null,
    entity_id:   r.id,
    summary:     `Рекомендация: ${r.category.replace(/_/g, ' ')} (${r.severity})`,
    tone:        r.severity === 'critical' ? 'critical' : r.severity === 'high' ? 'warning' : 'info',
  }))
}

/**
 * Returns the most recent 50 org-relevant events from the last 30 days
 * (mix of member joins, inquiries, recommendations).
 *
 * Возвращает [] если вызывающий не аутентифицирован или не управляет клубом.
 *
 * Дефект, который здесь чинится: гейт был `me.role !== 'organization'`, то есть
 * по ГЛОБАЛЬНОЙ роли, а org_id брался как `me.id`. У администратора клуба
 * (`org_members.member_role='org_admin'`) глобальной роли 'organization' нет, а
 * его `users.id` — не id клуба; функция молча отдавала пустую ленту. Право и
 * org_id теперь даёт общий резолвер — тот же, что гейтит страницы /org/**,
 * поэтому «вижу пункт меню, но лента пустая» больше не воспроизводится.
 *
 * Сигнатура не изменилась (вызов без аргументов), поэтому вызывающим правка
 * не видна; ветвление на стороне /org/activity стало избыточным.
 */
export async function getRecentOrgActivity(): Promise<OrgEvent[]> {
  const ctx = await getOrgContext()
  if (!ctx || !ctx.canManage || !ctx.orgId) return []

  const orgId = ctx.orgId
  const since = new Date(Date.now() - SINCE_WINDOW_DAYS * 24 * 3600 * 1000).toISOString()

  const athleteIds = await getOrgAthleteIds(orgId)
  if (athleteIds.length === 0) {
    // No roster yet — only member-join events relevant
    const memberJoins = await fetchMemberJoins(orgId, since)
    return memberJoins.slice(0, FEED_LIMIT)
  }

  // Parallel pulls — each query is small thanks to filters.
  const [memberJoins, inquiriesCreated, inquiriesAnswered, recsIssued] = await Promise.all([
    fetchMemberJoins(orgId, since),
    fetchInquiriesCreated(athleteIds, since),
    fetchInquiriesAnswered(athleteIds, since),
    fetchRecsIssued(athleteIds, orgId, since),
  ])

  const all = [...memberJoins, ...inquiriesCreated, ...inquiriesAnswered, ...recsIssued]

  // Resolve names in one batch
  const allUserIds = [
    ...all.map(e => e.actor_id).filter((x): x is string => !!x),
    ...all.map(e => e.target_id).filter((x): x is string => !!x),
  ]
  const names = await resolveNames(allUserIds)

  for (const e of all) {
    if (e.actor_id  && !e.actor_name)  e.actor_name  = names.get(e.actor_id)  ?? null
    if (e.target_id && !e.target_name) e.target_name = names.get(e.target_id) ?? null
  }

  // Reverse chrono + cap
  all.sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0))
  return all.slice(0, FEED_LIMIT)
}

// ── Per-source fetchers ───────────────────────────────────────────────────

async function fetchMemberJoins(orgId: string, sinceIso: string): Promise<OrgEvent[]> {
  const sb = await createClient()
  const { data } = await sb
    .from('org_members')
    .select('id, user_id, member_role, status, joined_at, created_at')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .gte('joined_at', sinceIso)
    .order('joined_at', { ascending: false })
    .limit(50)
  const rows = (data ?? []) as Array<{ id: string; user_id: string; member_role: string; joined_at: string; created_at: string }>
  return rows.map(r => ({
    type:        'member_joined' as const,
    timestamp:   r.joined_at ?? r.created_at,
    actor_id:    r.user_id,
    actor_name:  null,
    target_id:   r.user_id,
    target_name: null,
    entity_id:   r.id,
    summary:     `Новый ${r.member_role === 'org_owner' ? 'владелец' : r.member_role === 'org_admin' ? 'администратор' : r.member_role === 'coach' ? 'тренер' : r.member_role === 'doctor' ? 'врач' : r.member_role === 'specialist' ? 'специалист' : 'атлет'} в организации`,
    tone:        'success',
  }))
}

async function fetchInquiriesCreated(athleteIds: string[], sinceIso: string): Promise<OrgEvent[]> {
  if (athleteIds.length === 0) return []
  const sb = await createClient()
  const { data } = await sb
    .from('doctor_inquiries')
    .select('id, coach_id, athlete_id, urgency, question_type, status, created_at')
    .in('athlete_id', athleteIds)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(50)
  const rows = (data ?? []) as Array<{
    id: string; coach_id: string; athlete_id: string
    urgency: 'routine' | 'urgent' | 'red_flag'; question_type: string
    status: string; created_at: string
  }>
  return rows.map(r => ({
    type:        'inquiry_created' as const,
    timestamp:   r.created_at,
    actor_id:    r.coach_id,
    actor_name:  null,
    target_id:   r.athlete_id,
    target_name: null,
    entity_id:   r.id,
    summary:     `Запрос врачу: ${r.question_type.replace(/_/g, ' ')}`,
    tone:        r.urgency === 'red_flag' ? 'critical' : r.urgency === 'urgent' ? 'warning' : 'info',
  }))
}

async function fetchInquiriesAnswered(athleteIds: string[], sinceIso: string): Promise<OrgEvent[]> {
  if (athleteIds.length === 0) return []
  const sb = await createClient()
  const { data } = await sb
    .from('doctor_inquiries')
    .select('id, coach_id, athlete_id, doctor_id, urgency, question_type, status, responded_at')
    .in('athlete_id', athleteIds)
    .eq('status', 'answered')
    .not('responded_at', 'is', null)
    .gte('responded_at', sinceIso)
    .order('responded_at', { ascending: false })
    .limit(50)
  const rows = (data ?? []) as Array<{
    id: string; coach_id: string; athlete_id: string; doctor_id: string | null
    urgency: 'routine' | 'urgent' | 'red_flag'; question_type: string
    status: string; responded_at: string
  }>
  return rows.map(r => ({
    type:        'inquiry_answered' as const,
    timestamp:   r.responded_at,
    actor_id:    r.doctor_id,
    actor_name:  null,
    target_id:   r.athlete_id,
    target_name: null,
    entity_id:   r.id,
    summary:     `Врач ответил на запрос: ${r.question_type.replace(/_/g, ' ')}`,
    tone:        'success',
  }))
}

async function fetchRecsIssued(athleteIds: string[], orgId: string, sinceIso: string): Promise<OrgEvent[]> {
  if (athleteIds.length === 0) return []
  const sb = await createClient()
  // Two paths: (a) recommendations explicitly tagged organization_id = orgId,
  // OR (b) recommendations for our athletes (visibility may still hide content,
  // but the event existence is meta — RLS in 052 lets org_admin SEE the row
  // and we redact body/title app-side for non-org_full visibility).
  const { data } = await sb
    .from('recommendations')
    .select('id, doctor_id, athlete_id, coach_id, category, severity, visibility_level, status, created_at')
    .in('athlete_id', athleteIds)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(50)
  const rows = (data ?? []) as Array<{
    id: string; doctor_id: string; athlete_id: string; coach_id: string | null
    category: string; severity: 'low' | 'moderate' | 'high' | 'critical'
    visibility_level: string; status: string; created_at: string
  }>
  return rows.map(r => ({
    type:        'recommendation_issued' as const,
    timestamp:   r.created_at,
    actor_id:    r.doctor_id,
    actor_name:  null,
    target_id:   r.athlete_id,
    target_name: null,
    entity_id:   r.id,
    summary:     `Рекомендация: ${r.category.replace(/_/g, ' ')} (${r.severity})`,
    tone:        r.severity === 'critical' ? 'critical' : r.severity === 'high' ? 'warning' : 'info',
  }))
}
