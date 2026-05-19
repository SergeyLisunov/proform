/**
 * Org Health Snapshot service — Sprint W11 Day 54 (PR #75).
 *
 * Computes a one-pager «health portrait» for the current user's organization.
 * Aggregates existing tables — no new migration needed for v1.
 *
 * Surfaces:
 *   - Member counts (coaches/athletes/doctors) from org_members
 *   - Risk distribution from last daily_metrics.recovery_score per athlete
 *   - Coach utilization (top N coaches by athletes_count via trainer_athletes)
 *   - Athlete adherence (% with workout in last 7 days)
 *
 * RLS: services use authenticated client; data scoped by org_members RLS
 * (W2-W7) — only own-org rows visible.
 */
import { createClient } from '@/lib/supabase/client'

export type RiskBucket = 'low' | 'moderate' | 'high' | 'critical'

export interface RiskDistribution {
  low:        number
  moderate:   number
  high:       number
  critical:   number
  total:      number   // total athletes with at least one metric
  no_data:    number   // athletes with no metrics at all
}

export interface CoachUtilization {
  coach_id:        string
  coach_name:      string | null
  coach_avatar_url: string | null
  athletes_count:  number
}

export interface OrgHealthSnapshot {
  org_id:            string
  org_name:          string
  members_total:     number
  athletes_total:    number
  coaches_total:     number
  doctors_total:     number
  avg_recovery:      number | null      // 0..100, null if no data
  risk:              RiskDistribution
  coach_utilization: CoachUtilization[]
  adherence_pct:     number              // 0..100 — % athletes with workout in last 7d
}

function computeRisk(recovery: number): RiskBucket {
  if (recovery >= 70) return 'low'
  if (recovery >= 50) return 'moderate'
  if (recovery >= 30) return 'high'
  return 'critical'
}

export async function getOrgHealthSnapshot(): Promise<OrgHealthSnapshot | null> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return null

  // Resolve current user → org_id via org_members (most flexible — supports
  // org-owner, org-coach, org-doctor roles).
  const { data: meRow } = await sb.from('users').select('id, role').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string; role: string } | null
  if (!me) return null

  // Two paths: user IS the org (role='organization', users.id = orgs.id by W6 Day 31)
  // OR user is org_member (coach/doctor inside an org).
  let orgId: string | null = null
  let orgName = 'Организация'
  if (me.role === 'organization') {
    orgId = me.id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: orgRow } = await (sb as any)
      .from('organizations')
      .select('org_name, name')
      .eq('id', me.id)
      .maybeSingle()
    if (orgRow) orgName = orgRow.org_name ?? orgRow.name ?? 'Организация'
  } else {
    const { data: memberRow } = await sb
      .from('org_members')
      .select('org_id')
      .eq('user_id', me.id)
      .neq('status', 'suspended')
      .limit(1)
      .maybeSingle()
    orgId = (memberRow as { org_id?: string } | null)?.org_id ?? null
    if (orgId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: orgRow } = await (sb as any)
        .from('organizations')
        .select('org_name, name')
        .eq('id', orgId)
        .maybeSingle()
      if (orgRow) orgName = orgRow.org_name ?? orgRow.name ?? 'Организация'
    }
  }
  if (!orgId) return null

  // 1) Members snapshot
  const { data: membersData } = await sb
    .from('org_members')
    .select('user_id, member_role, status')
    .eq('org_id', orgId)
    .neq('status', 'suspended')
  const members = (membersData ?? []) as Array<{ user_id: string; member_role: string; status: string }>
  const athleteIds = members.filter(m => m.member_role === 'athlete').map(m => m.user_id)
  const coachIds = members.filter(m => m.member_role === 'coach').map(m => m.user_id)
  const doctorsTotal = members.filter(m => m.member_role === 'doctor').length

  // 2) Risk distribution from athletes' last metric
  const risk: RiskDistribution = { low: 0, moderate: 0, high: 0, critical: 0, total: 0, no_data: 0 }
  let recoverySum = 0
  let recoveryN = 0
  let activeAthletes7d = 0
  if (athleteIds.length > 0) {
    // Latest metric per athlete — fetch all recent and pick first per athlete.
    const { data: metricsData } = await sb
      .from('daily_metrics')
      .select('athlete_id, recovery_score, date')
      .in('athlete_id', athleteIds)
      .order('date', { ascending: false })
      .limit(athleteIds.length * 3)
    const metrics = (metricsData ?? []) as Array<{ athlete_id: string; recovery_score: number | null; date: string }>
    const latestPerAthlete = new Map<string, { recovery: number; date: string }>()
    for (const m of metrics) {
      if (m.recovery_score == null) continue
      if (latestPerAthlete.has(m.athlete_id)) continue
      latestPerAthlete.set(m.athlete_id, { recovery: m.recovery_score, date: m.date })
    }
    for (const athleteId of athleteIds) {
      const latest = latestPerAthlete.get(athleteId)
      if (!latest) {
        risk.no_data += 1
        continue
      }
      const bucket = computeRisk(latest.recovery)
      risk[bucket] += 1
      risk.total += 1
      recoverySum += latest.recovery
      recoveryN += 1
    }

    // 3) Adherence: workout in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    const { data: workoutsData } = await sb
      .from('workouts')
      .select('athlete_id')
      .in('athlete_id', athleteIds)
      .gte('event_date', sevenDaysAgo)
    const workouts = (workoutsData ?? []) as Array<{ athlete_id: string }>
    const activeSet = new Set(workouts.map(w => w.athlete_id))
    activeAthletes7d = activeSet.size
  }

  // 4) Coach utilization — count athletes per coach via trainer_athletes
  const coachUtilization: CoachUtilization[] = []
  if (coachIds.length > 0) {
    const { data: trainerData } = await sb
      .from('trainer_athletes')
      .select('trainer_id, athlete_id, status')
      .in('trainer_id', coachIds)
      .eq('status', 'accepted')
    const counts = new Map<string, number>()
    for (const r of (trainerData ?? []) as Array<{ trainer_id: string; athlete_id: string }>) {
      counts.set(r.trainer_id, (counts.get(r.trainer_id) ?? 0) + 1)
    }
    // Resolve names + avatars
    const { data: usersData } = await sb
      .from('users')
      .select('id, name, avatar_url')
      .in('id', coachIds)
    const userMap = new Map<string, { name: string | null; avatar_url: string | null }>()
    for (const u of (usersData ?? []) as Array<{ id: string; name: string | null; avatar_url: string | null }>) {
      userMap.set(u.id, u)
    }
    for (const coachId of coachIds) {
      coachUtilization.push({
        coach_id: coachId,
        coach_name: userMap.get(coachId)?.name ?? null,
        coach_avatar_url: userMap.get(coachId)?.avatar_url ?? null,
        athletes_count: counts.get(coachId) ?? 0,
      })
    }
    // Sort by athletes_count DESC, then name
    coachUtilization.sort((a, b) =>
      b.athletes_count - a.athletes_count
      || (a.coach_name ?? '').localeCompare(b.coach_name ?? ''),
    )
  }

  const avgRecovery = recoveryN > 0 ? Math.round(recoverySum / recoveryN) : null
  const adherencePct = athleteIds.length > 0
    ? Math.round((activeAthletes7d / athleteIds.length) * 100)
    : 0

  return {
    org_id:            orgId,
    org_name:          orgName,
    members_total:     members.length,
    athletes_total:    athleteIds.length,
    coaches_total:     coachIds.length,
    doctors_total:     doctorsTotal,
    avg_recovery:      avgRecovery,
    risk,
    coach_utilization: coachUtilization,
    adherence_pct:     adherencePct,
  }
}
