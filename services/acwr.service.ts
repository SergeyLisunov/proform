import { createClient } from '@/lib/supabase/client'
import { loadForWorkout } from '@/lib/analytics'

/**
 * Acute:Chronic Workload Ratio (ACWR).
 * Acute   = rolling 7-day average daily load
 * Chronic = rolling 28-day average daily load
 * ACWR    = acute / chronic
 *
 * "Sweet spot" per sports-science literature: 0.8–1.3.
 * >1.5 → heightened injury risk. <0.8 → under-training.
 *
 * Load per workout = activity_strain (Whoop 0–21 scale) when available,
 * otherwise activity_duration_min * 0.1 as a rough proxy so manually
 * logged sessions still contribute.
 */

export type AcwrZone = 'detraining' | 'optimal' | 'monitor' | 'danger' | 'no_data'

export const ACWR_ZONE_META: Record<AcwrZone, { label: string; color: string; bg: string; border: string }> = {
  detraining: { label: 'Недотренированность', color: '#CA8A04', bg: '#FEFCE8', border: '#FDE68A' },
  optimal:    { label: 'Оптимальная зона',    color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  monitor:    { label: 'Следить внимательнее', color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' },
  danger:     { label: 'Риск травмы',          color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  no_data:    { label: 'Мало данных',          color: '#475569', bg: '#F8FAFC', border: '#E2E8F0' },
}

export function zoneOf(acwr: number | null): AcwrZone {
  if (acwr === null || Number.isNaN(acwr)) return 'no_data'
  if (acwr < 0.8) return 'detraining'
  if (acwr <= 1.3) return 'optimal'
  if (acwr <= 1.5) return 'monitor'
  return 'danger'
}

export interface AthleteAcwr {
  athlete_id: string
  athlete_name: string
  acwr: number | null
  acute_avg: number
  chronic_avg: number
  workouts_28d: number
  zone: AcwrZone
}

function dayDiff(aISO: string, today: Date): number {
  const d = new Date(aISO + 'T00:00:00')
  return Math.floor((today.getTime() - d.getTime()) / 86400000)
}

/** Computes ACWR for every athlete the coach is linked to (status=accepted). */
export async function computeCoachAthletesAcwr(coachId: string): Promise<AthleteAcwr[]> {
  const sb = createClient()

  // 1. Linked athletes.
  const { data: linksRaw } = await sb
    .from('trainer_athletes')
    .select('athlete_id')
    .eq('trainer_id', coachId)
    .eq('status', 'accepted')
  const athleteIds = ((linksRaw ?? []) as Array<{ athlete_id: string }>).map(l => l.athlete_id)
  if (athleteIds.length === 0) return []

  const { data: usersRaw } = await sb.from('users').select('id, name').in('id', athleteIds)
  const nameById = new Map(((usersRaw ?? []) as Array<{ id: string; name: string | null }>).map(u => [u.id, u.name ?? '—']))

  // 2. Pull last 28 days of workouts for all athletes in one query.
  const today = new Date()
  const from28 = new Date(today.getTime() - 28 * 86400000).toISOString().slice(0, 10)
  const { data: wRaw } = await sb
    .from('workouts')
    .select('athlete_id, event_date, activity_strain, activity_duration_min')
    .in('athlete_id', athleteIds)
    .gte('event_date', from28)
  const rows = (wRaw ?? []) as Array<{ athlete_id: string; event_date: string | null; activity_strain: number | null; activity_duration_min: number | null }>

  // 3. Bucket per-athlete and per-day: compute load sum per day, then 7d & 28d averages.
  const perAthlete: Record<string, Record<string, number>> = {}
  for (const r of rows) {
    if (!r.event_date) continue
    const load = loadForWorkout(r) ?? 0
    if (load <= 0) continue
    const a = (perAthlete[r.athlete_id] ??= {})
    a[r.event_date] = (a[r.event_date] ?? 0) + load
  }

  const out: AthleteAcwr[] = athleteIds.map(id => {
    const byDay = perAthlete[id] ?? {}
    let sum28 = 0, sum7 = 0, count28 = 0
    for (const date of Object.keys(byDay)) {
      const diff = dayDiff(date, today)
      if (diff < 0) continue
      if (diff < 28) { sum28 += byDay[date]; count28++ }
      if (diff < 7)  { sum7  += byDay[date] }
    }
    const acute   = sum7  / 7
    const chronic = sum28 / 28
    const acwr    = chronic > 0 ? acute / chronic : null
    return {
      athlete_id: id,
      athlete_name: nameById.get(id) ?? '—',
      acwr: acwr != null ? Number(acwr.toFixed(2)) : null,
      acute_avg:   Number(acute.toFixed(2)),
      chronic_avg: Number(chronic.toFixed(2)),
      workouts_28d: count28,
      zone: count28 < 3 ? 'no_data' : zoneOf(acwr),
    }
  })

  // Sort by risk: danger first, then monitor, then optimal, then detraining, then no_data.
  const order: Record<AcwrZone, number> = { danger: 0, monitor: 1, detraining: 2, optimal: 3, no_data: 4 }
  out.sort((a, b) => order[a.zone] - order[b.zone] || a.athlete_name.localeCompare(b.athlete_name))
  return out
}
