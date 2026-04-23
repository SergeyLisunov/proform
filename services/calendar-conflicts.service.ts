import { createClient } from '@/lib/supabase/client'

export interface Conflict {
  kind: 'coach_session' | 'medical_checkup' | 'group_session' | 'calendar_event'
  id: string
  title: string
  start_time: string | null  // "HH:MM" or null
  end_time: string | null
  location: string | null
}

export interface ConflictCheckInput {
  athlete_id: string
  date: string                  // YYYY-MM-DD
  start_time?: string | null    // "HH:MM"
  end_time?: string | null      // "HH:MM"
  /** Exclude these ids from the check (useful when editing). */
  exclude?: { kind: Conflict['kind']; id: string }[]
}

function toMin(t: string | null | undefined): number | null {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

function overlaps(
  aStart: number | null, aEnd: number | null,
  bStart: number | null, bEnd: number | null,
): boolean {
  // If either side has no time, treat as all-day → conflict with anything.
  if (aStart === null || bStart === null) return true
  const aEndEff = aEnd ?? aStart + 60
  const bEndEff = bEnd ?? bStart + 60
  return aStart < bEndEff && bStart < aEndEff
}

/**
 * Return all events for the athlete on the given date that overlap
 * with the proposed time window. "No time" is treated as all-day.
 */
export async function findAthleteConflicts(input: ConflictCheckInput): Promise<Conflict[]> {
  const sb = createClient()
  const proposedStart = toMin(input.start_time ?? null)
  const proposedEnd   = toMin(input.end_time ?? null)

  const excludeSet = new Set((input.exclude ?? []).map(e => `${e.kind}:${e.id}`))

  const conflicts: Conflict[] = []

  // Coach sessions
  const { data: csRaw } = await sb
    .from('coach_sessions')
    .select('id, title, start_time, end_time, location, status')
    .eq('athlete_id', input.athlete_id)
    .eq('session_date', input.date)
    .neq('status', 'cancelled')
  const cs = (csRaw ?? []) as Array<{
    id: string; title: string | null; start_time: string | null; end_time: string | null; location: string | null
  }>
  for (const s of cs) {
    if (excludeSet.has(`coach_session:${s.id}`)) continue
    if (overlaps(proposedStart, proposedEnd, toMin(s.start_time), toMin(s.end_time))) {
      conflicts.push({
        kind: 'coach_session', id: s.id,
        title: s.title ?? 'Занятие с тренером',
        start_time: s.start_time ? s.start_time.slice(0, 5) : null,
        end_time: s.end_time ? s.end_time.slice(0, 5) : null,
        location: s.location,
      })
    }
  }

  // Medical checkups
  const { data: mcRaw } = await sb
    .from('medical_checkups')
    .select('id, checkup_type, start_time, end_time, location, status')
    .eq('athlete_id', input.athlete_id)
    .eq('checkup_date', input.date)
    .neq('status', 'cancelled')
  const mc = (mcRaw ?? []) as Array<{
    id: string; checkup_type: string; start_time: string | null; end_time: string | null; location: string | null
  }>
  for (const s of mc) {
    if (excludeSet.has(`medical_checkup:${s.id}`)) continue
    if (overlaps(proposedStart, proposedEnd, toMin(s.start_time), toMin(s.end_time))) {
      conflicts.push({
        kind: 'medical_checkup', id: s.id,
        title: `Медосмотр (${s.checkup_type})`,
        start_time: s.start_time ? s.start_time.slice(0, 5) : null,
        end_time: s.end_time ? s.end_time.slice(0, 5) : null,
        location: s.location,
      })
    }
  }

  // Group sessions where athlete is participant
  const { data: partsRaw } = await sb
    .from('org_session_participants')
    .select('session_id')
    .eq('user_id', input.athlete_id)
  const parts = (partsRaw ?? []) as Array<{ session_id: string }>
  const sessionIds = parts.map(p => p.session_id)
  if (sessionIds.length > 0) {
    const { data: gsRaw } = await sb
      .from('org_group_sessions')
      .select('id, title, start_time, end_time, location, status')
      .in('id', sessionIds)
      .eq('session_date', input.date)
      .neq('status', 'cancelled')
    const gs = (gsRaw ?? []) as Array<{
      id: string; title: string; start_time: string | null; end_time: string | null; location: string | null
    }>
    for (const s of gs) {
      if (excludeSet.has(`group_session:${s.id}`)) continue
      if (overlaps(proposedStart, proposedEnd, toMin(s.start_time), toMin(s.end_time))) {
        conflicts.push({
          kind: 'group_session', id: s.id,
          title: s.title,
          start_time: s.start_time ? s.start_time.slice(0, 5) : null,
          end_time: s.end_time ? s.end_time.slice(0, 5) : null,
          location: s.location,
        })
      }
    }
  }

  // Athlete's own calendar events (workout, competition, etc.)
  const { data: evRaw } = await sb
    .from('calendar_events')
    .select('id, title, start_time, end_time, event_type')
    .eq('owner_id', input.athlete_id)
    .eq('event_date', input.date)
  const evs = (evRaw ?? []) as Array<{
    id: string; title: string; start_time: string | null; end_time: string | null; event_type: string
  }>
  for (const s of evs) {
    if (excludeSet.has(`calendar_event:${s.id}`)) continue
    if (overlaps(proposedStart, proposedEnd, toMin(s.start_time), toMin(s.end_time))) {
      conflicts.push({
        kind: 'calendar_event', id: s.id,
        title: s.title,
        start_time: s.start_time ? s.start_time.slice(0, 5) : null,
        end_time: s.end_time ? s.end_time.slice(0, 5) : null,
        location: null,
      })
    }
  }

  return conflicts
}

export function formatConflictTime(c: Conflict): string {
  if (!c.start_time) return 'весь день'
  return c.end_time ? `${c.start_time}–${c.end_time}` : c.start_time
}

export const CONFLICT_KIND_LABEL: Record<Conflict['kind'], string> = {
  coach_session:   'Тренировка',
  medical_checkup: 'Медосмотр',
  group_session:   'Командное событие',
  calendar_event:  'Личное событие',
}
