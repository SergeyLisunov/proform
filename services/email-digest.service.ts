import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  renderAthleteDailyDigest, renderCoachWeeklyDigest, renderParentWeeklyDigest,
  type AthleteDailyEvent, type CoachWeeklyAthleteStat, type ParentWeeklyChild,
} from '@/lib/email/templates'
import { isChannelAllowed, type PrefsBag } from './notification-prefs-server'

const FROM = process.env.RESEND_FROM ?? 'Sporteo <notifications@proform-delta.vercel.app>'

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

// ── Parent weekly digest (P1 соц-ядро) ────────────────────────────────────────

const CLEARANCE_EMAIL_META: Record<string, { label: string; color: string }> = {
  full:       { label: 'полный',            color: '#16A34A' },
  limited:    { label: 'ограниченный',      color: '#CA8A04' },
  light_only: { label: 'только лёгкая',     color: '#F35703' },
  banned:     { label: 'тренировки запрещены', color: '#DC2626' },
}

const RECORD_EMAIL_LABEL: Record<string, string> = {
  longest_workout:      'Самая длинная тренировка',
  best_week_volume:     'Лучший объём за неделю',
  training_streak_days: 'Серия дней подряд',
}

function fmtRecordEmail(kind: string, value: number): string {
  const label = RECORD_EMAIL_LABEL[kind] ?? kind
  const unit = kind === 'training_streak_days' ? 'дн.' : 'мин'
  return `${label}: ${value} ${unit}`
}

/**
 * Еженедельный отчёт родителю (вс 17:00, тот же cron, что coach weekly —
 * без новой записи в vercel.json). ClassDojo Friday-report модель: родитель
 * платит за секцию, но не видит тренировок — отчёт закрывает разрыв и
 * еженедельно подтверждает ценность. Данные — строгий safe-набор (как
 * /parent/dashboard): счётчики тренировок/минут, светофор, рекорды, число
 * комментариев тренера. Никаких HRV/recovery/медзаписей.
 * Opt-out: notification_prefs.parent_weekly_email = false.
 */
export async function runParentWeeklyDigest(): Promise<DigestResult> {
  const result: DigestResult = { sent: 0, skipped: 0, skipped_pref: 0, errors: [] }
  const resend = getResend()
  if (!resend) { result.errors.push('RESEND_API_KEY missing'); return result }

  const sb = createAdminClient()
  const weekAgo = weekAgoISO()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any
  const { data: linksRaw, error: lErr } = await sbAny
    .from('parent_links')
    .select('parent_id, child_id')
    .eq('status', 'active')
  if (lErr) { result.errors.push(`parent_links: ${lErr.message}`); return result }
  const links = (linksRaw ?? []) as Array<{ parent_id: string; child_id: string }>
  if (links.length === 0) return result

  const byParent = new Map<string, string[]>()
  for (const l of links) {
    if (!byParent.has(l.parent_id)) byParent.set(l.parent_id, [])
    byParent.get(l.parent_id)!.push(l.child_id)
  }
  const parentIds = [...byParent.keys()]
  const childIds  = [...new Set(links.map(l => l.child_id))]

  const [{ data: parentsRaw }, { data: childrenRaw }] = await Promise.all([
    sbAny.from('users')
      .select('id, name, email, notification_prefs').in('id', parentIds),
    sbAny.from('users').select('id, name').in('id', childIds),
  ])
  const parents = (parentsRaw ?? []) as Array<{
    id: string; name: string | null; email: string | null; notification_prefs: PrefsBag
  }>
  const childName = new Map(
    ((childrenRaw ?? []) as Array<{ id: string; name: string | null }>)
      .map(c => [c.id, c.name ?? 'Ребёнок']),
  )

  // Пакетные выборки по всем детям сразу (без N+1 по родителям).
  const [{ data: workoutsRaw }, { data: clearancesRaw }, { data: recordsRaw }, { data: notesRaw }] =
    await Promise.all([
      sbAny.from('workouts')
        .select('athlete_id, activity_duration_min')
        .in('athlete_id', childIds).gte('event_date', weekAgo),
      sbAny.from('current_clearances')
        .select('athlete_id, status, review_needed').in('athlete_id', childIds),
      sbAny.from('athlete_records')
        .select('athlete_id, kind, value')
        .in('athlete_id', childIds).gte('updated_at', `${weekAgo}T00:00:00Z`),
      sbAny.from('observation_diary')
        .select('athlete_id').in('athlete_id', childIds).gte('date', weekAgo),
    ])

  const statByChild = new Map<string, { count: number; min: number }>()
  for (const w of ((workoutsRaw ?? []) as Array<{ athlete_id: string; activity_duration_min: number | null }>)) {
    const s = statByChild.get(w.athlete_id) ?? { count: 0, min: 0 }
    s.count += 1; s.min += w.activity_duration_min ?? 0
    statByChild.set(w.athlete_id, s)
  }
  const clearanceByChild = new Map(
    ((clearancesRaw ?? []) as Array<{ athlete_id: string; status: string; review_needed: boolean }>)
      .map(c => [c.athlete_id, c]),
  )
  const recordsByChild = new Map<string, string[]>()
  for (const r of ((recordsRaw ?? []) as Array<{ athlete_id: string; kind: string; value: number }>)) {
    if (!recordsByChild.has(r.athlete_id)) recordsByChild.set(r.athlete_id, [])
    recordsByChild.get(r.athlete_id)!.push(fmtRecordEmail(r.kind, Number(r.value)))
  }
  const notesByChild = new Map<string, number>()
  for (const n of ((notesRaw ?? []) as Array<{ athlete_id: string }>)) {
    notesByChild.set(n.athlete_id, (notesByChild.get(n.athlete_id) ?? 0) + 1)
  }

  for (const p of parents) {
    if (!p.email) { result.skipped += 1; continue }
    if (!isChannelAllowed(p.notification_prefs, 'parent_weekly_email')) {
      result.skipped += 1; result.skipped_pref = (result.skipped_pref ?? 0) + 1; continue
    }
    const kids: ParentWeeklyChild[] = (byParent.get(p.id) ?? []).map(cid => {
      const stat = statByChild.get(cid) ?? { count: 0, min: 0 }
      const cl   = clearanceByChild.get(cid)
      const meta = cl ? CLEARANCE_EMAIL_META[cl.status] : undefined
      return {
        name:              childName.get(cid) ?? 'Ребёнок',
        workouts_count:    stat.count,
        total_min:         stat.min,
        clearance_label:   meta?.label ?? null,
        clearance_color:   meta?.color ?? '#64748B',
        review_needed:     cl?.review_needed ?? false,
        records:           recordsByChild.get(cid) ?? [],
        coach_notes_count: notesByChild.get(cid) ?? 0,
      }
    })
    if (kids.length === 0) { result.skipped += 1; continue }

    try {
      const { subject, html } = renderParentWeeklyDigest({ parent_name: p.name, children: kids })
      await resend.emails.send({ from: FROM, to: p.email, subject, html })
      result.sent += 1
    } catch (e) {
      result.errors.push(`${p.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return result
}
