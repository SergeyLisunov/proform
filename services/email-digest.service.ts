import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  renderAthleteDailyDigest, renderCoachWeeklyDigest,
  type AthleteDailyEvent, type CoachWeeklyAthleteStat,
} from '@/lib/email/templates'
import { isChannelAllowed, type PrefsBag } from './notification-prefs-server'

const FROM = process.env.RESEND_FROM ?? 'ProForm <notifications@proform-delta.vercel.app>'

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function weekAgoISO(): string {
  return new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
}

function in30ISO(): string {
  return new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
}

interface DigestResult {
  sent:           number
  skipped:        number
  /** W6 Day 29: distinct subset of skipped — opted out via notification_prefs. */
  skipped_pref?:  number
  errors:         string[]
}

/**
 * Daily athlete digest. For each athlete, collects today's events and
 * emails a summary. If no events and user wants to skip empty days,
 * we still send once per week (Sunday) as a gentle "free day" note.
 */
export async function runAthleteDailyDigest(): Promise<DigestResult> {
  const result: DigestResult = { sent: 0, skipped: 0, skipped_pref: 0, errors: [] }
  const resend = getResend()
  if (!resend) { result.errors.push('RESEND_API_KEY missing'); return result }

  const sb = createAdminClient()
  const today = todayISO()

  // Fetch all athletes with email + their prefs (W6 Day 29: filter
  // opt-outs server-side rather than per-row RPC).
  const { data: athletesRaw, error: aErr } = await sb
    .from('users')
    .select('id, name, email, role, notification_prefs')
    .eq('role', 'athlete')
  if (aErr) { result.errors.push(`users: ${aErr.message}`); return result }
  const athletes = (athletesRaw ?? []) as Array<{
    id: string; name: string | null; email: string | null; role: string
    notification_prefs: PrefsBag
  }>

  for (const a of athletes) {
    if (!a.email) { result.skipped++; continue }
    // W6 Day 29: respect users.notification_prefs.daily_digest_email
    if (!isChannelAllowed(a.notification_prefs, 'daily_digest_email')) {
      result.skipped++
      result.skipped_pref = (result.skipped_pref ?? 0) + 1
      continue
    }

    // Today's coach sessions
    const { data: csRaw } = await sb
      .from('coach_sessions')
      .select('id, title, start_time, location, notes')
      .eq('athlete_id', a.id)
      .eq('session_date', today)
      .neq('status', 'cancelled')
    const cs = (csRaw ?? []) as Array<{
      id: string; title: string | null; start_time: string | null; location: string | null; notes: string | null
    }>

    // Today's checkups
    const { data: mcRaw } = await sb
      .from('medical_checkups')
      .select('id, checkup_type, start_time, location, recommendations')
      .eq('athlete_id', a.id)
      .eq('checkup_date', today)
      .neq('status', 'cancelled')
    const mc = (mcRaw ?? []) as Array<{
      id: string; checkup_type: string; start_time: string | null; location: string | null; recommendations: string | null
    }>

    // Today's group sessions where athlete is participant
    const { data: partsRaw } = await sb
      .from('org_session_participants')
      .select('session_id')
      .eq('user_id', a.id)
    const parts = (partsRaw ?? []) as Array<{ session_id: string }>
    const sessionIds = parts.map(p => p.session_id)
    let groups: Array<{ id: string; title: string; start_time: string | null; location: string | null; description: string | null }> = []
    if (sessionIds.length > 0) {
      const { data: gsRaw } = await sb
        .from('org_group_sessions')
        .select('id, title, start_time, location, description')
        .in('id', sessionIds)
        .eq('session_date', today)
        .neq('status', 'cancelled')
      groups = (gsRaw ?? []) as typeof groups
    }

    const events: AthleteDailyEvent[] = [
      ...cs.map(s => ({
        kind: 'coach_session' as const,
        title: s.title ?? 'Занятие с тренером',
        time: s.start_time ? s.start_time.slice(0, 5) : null,
        location: s.location,
        note: s.notes,
      })),
      ...mc.map(c => ({
        kind: 'checkup' as const,
        title: c.checkup_type === 'general' ? 'Общий осмотр' : c.checkup_type,
        time: c.start_time ? c.start_time.slice(0, 5) : null,
        location: c.location,
        note: c.recommendations,
      })),
      ...groups.map(g => ({
        kind: 'group_session' as const,
        title: g.title,
        time: g.start_time ? g.start_time.slice(0, 5) : null,
        location: g.location,
        note: g.description,
      })),
    ].sort((x, y) => (x.time ?? '99:99').localeCompare(y.time ?? '99:99'))

    // Only send if there are events (reduce noise)
    if (events.length === 0) { result.skipped++; continue }

    const { subject, html } = renderAthleteDailyDigest({ name: a.name ?? 'Атлет', events })
    try {
      await resend.emails.send({ from: FROM, to: a.email, subject, html })
      result.sent++
    } catch (e) {
      result.errors.push(`${a.email}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return result
}

/**
 * Weekly coach digest: sent on Sundays. For each coach, aggregates
 * their athletes' missed sessions (last 7d), expiring passes (next 30d),
 * and average recovery score.
 */
export async function runCoachWeeklyDigest(): Promise<DigestResult> {
  const result: DigestResult = { sent: 0, skipped: 0, skipped_pref: 0, errors: [] }
  const resend = getResend()
  if (!resend) { result.errors.push('RESEND_API_KEY missing'); return result }

  const sb = createAdminClient()
  const today = todayISO()
  const weekAgo = weekAgoISO()
  const in30 = in30ISO()

  const { data: coachesRaw } = await sb
    .from('users')
    .select('id, name, email, role, notification_prefs')
    .eq('role', 'coach')
  const coaches = (coachesRaw ?? []) as Array<{
    id: string; name: string | null; email: string | null; role: string
    notification_prefs: PrefsBag
  }>

  for (const c of coaches) {
    if (!c.email) { result.skipped++; continue }
    // W6 Day 29: respect users.notification_prefs.coach_weekly_email
    if (!isChannelAllowed(c.notification_prefs, 'coach_weekly_email')) {
      result.skipped++
      result.skipped_pref = (result.skipped_pref ?? 0) + 1
      continue
    }

    const { data: linksRaw } = await sb
      .from('trainer_athletes')
      .select('athlete_id')
      .eq('trainer_id', c.id)
      .eq('status', 'accepted')
    const links = (linksRaw ?? []) as Array<{ athlete_id: string }>
    const athleteIds = links.map(l => l.athlete_id)
    if (athleteIds.length === 0) { result.skipped++; continue }

    const { data: usersRaw } = await sb
      .from('users')
      .select('id, name')
      .in('id', athleteIds)
    const nameById = new Map(
      ((usersRaw ?? []) as Array<{ id: string; name: string | null }>)
        .map(u => [u.id, u.name ?? '—'])
    )

    // Missed sessions last 7 days (coach_sessions with no_show)
    const { data: missedRaw } = await sb
      .from('coach_sessions')
      .select('athlete_id, status, session_date')
      .eq('coach_id', c.id)
      .in('athlete_id', athleteIds)
      .eq('status', 'no_show')
      .gte('session_date', weekAgo)
      .lte('session_date', today)
    const missed = (missedRaw ?? []) as Array<{ athlete_id: string }>
    const missedCount: Record<string, number> = {}
    for (const m of missed) missedCount[m.athlete_id] = (missedCount[m.athlete_id] ?? 0) + 1

    // Expiring passes within 30 days (active, expiring_at <= in30)
    const { data: passRaw } = await sb
      .from('athlete_passes')
      .select('athlete_id, expires_at, status')
      .eq('coach_id', c.id)
      .in('athlete_id', athleteIds)
      .eq('status', 'active')
      .gte('expires_at', today)
      .lte('expires_at', in30)
    const passes = (passRaw ?? []) as Array<{ athlete_id: string }>
    const passCount: Record<string, number> = {}
    for (const p of passes) passCount[p.athlete_id] = (passCount[p.athlete_id] ?? 0) + 1

    // Avg recovery last 7 days
    const { data: metricsRaw } = await sb
      .from('daily_metrics')
      .select('athlete_id, recovery_score, date')
      .in('athlete_id', athleteIds)
      .gte('date', weekAgo)
      .lte('date', today)
    const metrics = (metricsRaw ?? []) as Array<{ athlete_id: string; recovery_score: number | null; date: string }>
    const metricSum: Record<string, { sum: number; n: number; last: string | null }> = {}
    for (const m of metrics) {
      if (m.recovery_score === null) continue
      const bucket = metricSum[m.athlete_id] ?? { sum: 0, n: 0, last: null }
      bucket.sum += m.recovery_score
      bucket.n += 1
      if (!bucket.last || m.date > bucket.last) bucket.last = m.date
      metricSum[m.athlete_id] = bucket
    }

    const stats: CoachWeeklyAthleteStat[] = athleteIds.map(id => ({
      name: nameById.get(id) ?? '—',
      missed_sessions: missedCount[id] ?? 0,
      expiring_passes: passCount[id] ?? 0,
      last_metric_date: metricSum[id]?.last ?? null,
      avg_recovery: metricSum[id] ? Math.round(metricSum[id].sum / metricSum[id].n) : null,
    }))

    const { subject, html } = renderCoachWeeklyDigest({
      name: c.name ?? 'Тренер',
      athletes_count: athleteIds.length,
      stats,
    })
    try {
      await resend.emails.send({ from: FROM, to: c.email, subject, html })
      result.sent++
    } catch (e) {
      result.errors.push(`${c.email}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return result
}
