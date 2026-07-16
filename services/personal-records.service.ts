/**
 * Personal records service (P1 соц-ядро) — авто-детект личных рекордов.
 *
 * Вызывается после записи тренировки (WorkoutAddDrawer) и после отметки
 * prescribed-тренировки выполненной. Сравнивает с текущими рекордами в
 * athlete_records (UPSERT при побитии) и рассылает празднование: самому
 * атлету, его тренерам и родителям (silent-fail через can_notify).
 *
 * Mastery-safe: только «соревнование с собой», никаких сравнений с другими.
 */
import { createClient } from '@/lib/supabase/client'
import { notifyMany, type NotifyInput } from './notifications.service'

export type RecordKind = 'longest_workout' | 'best_week_volume' | 'training_streak_days'

export const RECORD_LABEL: Record<RecordKind, string> = {
  longest_workout:      'Самая длинная тренировка',
  best_week_volume:     'Лучший объём за неделю',
  training_streak_days: 'Серия дней подряд',
}

export function formatRecordValue(kind: RecordKind, value: number): string {
  if (kind === 'training_streak_days') return `${value} дн.`
  return `${value} мин`
}

export interface BrokenRecord {
  kind:  RecordKind
  value: number
  prev:  number | null
}

interface WorkoutInput {
  id:                    string
  event_date:            string
  activity_duration_min: number | null
}

function isoWeekBounds(dateISO: string): { from: string; to: string } {
  const d = new Date(dateISO + 'T00:00:00')
  const day = (d.getDay() + 6) % 7 // 0 = понедельник
  const mon = new Date(d); mon.setDate(d.getDate() - day)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) }
}

/** Серия подряд идущих дней с тренировками, заканчивающаяся anchor-датой. */
function streakEndingAt(datesDesc: string[], anchor: string): number {
  const set = new Set(datesDesc)
  if (!set.has(anchor)) return 0
  let streak = 0
  const cur = new Date(anchor + 'T00:00:00')
  while (set.has(cur.toISOString().slice(0, 10))) {
    streak += 1
    cur.setDate(cur.getDate() - 1)
  }
  return streak
}

export async function checkPersonalRecords(
  athleteId: string,
  athleteName: string | null,
  workout: WorkoutInput,
): Promise<BrokenRecord[]> {
  const sb = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any
  const broken: BrokenRecord[] = []

  try {
    const [{ data: records }, { data: weekRows }, { data: dateRows }] = await Promise.all([
      sbAny.from('athlete_records')
        .select('kind, value').eq('athlete_id', athleteId),
      sbAny.from('workouts')
        .select('activity_duration_min')
        .eq('athlete_id', athleteId)
        .gte('event_date', isoWeekBounds(workout.event_date).from)
        .lte('event_date', isoWeekBounds(workout.event_date).to),
      sbAny.from('workouts')
        .select('event_date')
        .eq('athlete_id', athleteId)
        .lte('event_date', workout.event_date)
        .order('event_date', { ascending: false })
        .limit(120),
    ])

    const current = new Map<RecordKind, number>(
      ((records ?? []) as Array<{ kind: RecordKind; value: number }>).map(r => [r.kind, Number(r.value)]),
    )

    const candidates: Array<{ kind: RecordKind; value: number }> = []

    // 1. Самая длинная тренировка.
    const duration = workout.activity_duration_min ?? 0
    if (duration > 0 && duration > (current.get('longest_workout') ?? 0)) {
      candidates.push({ kind: 'longest_workout', value: duration })
    }

    // 2. Лучший недельный объём (ISO-неделя тренировки).
    const weekVolume = ((weekRows ?? []) as Array<{ activity_duration_min: number | null }>)
      .reduce((s, r) => s + (r.activity_duration_min ?? 0), 0)
    if (weekVolume > 0 && weekVolume > (current.get('best_week_volume') ?? 0)) {
      candidates.push({ kind: 'best_week_volume', value: weekVolume })
    }

    // 3. Серия дней подряд.
    const dates = [...new Set(((dateRows ?? []) as Array<{ event_date: string }>).map(r => r.event_date))]
    const streak = streakEndingAt(dates, workout.event_date)
    if (streak > 1 && streak > (current.get('training_streak_days') ?? 0)) {
      candidates.push({ kind: 'training_streak_days', value: streak })
    }

    if (candidates.length === 0) return []

    // UPSERT побитых рекордов.
    const { error: upsertErr } = await sbAny.from('athlete_records').upsert(
      candidates.map(c => ({
        athlete_id:  athleteId,
        kind:        c.kind,
        value:       c.value,
        workout_id:  workout.id,
        achieved_on: workout.event_date,
        updated_at:  new Date().toISOString(),
      })),
      { onConflict: 'athlete_id,kind' },
    )
    if (upsertErr) {
      console.warn('[personal-records.upsert]', upsertErr.message)
      return []
    }
    for (const c of candidates) {
      broken.push({ kind: c.kind, value: c.value, prev: current.get(c.kind) ?? null })
    }

    // Празднование: атлету + тренерам + родителям (silent-fail can_notify).
    const [{ data: trainers }, { data: parents }, { data: meRow }] = await Promise.all([
      sbAny.from('trainer_athletes')
        .select('trainer_id').eq('athlete_id', athleteId).eq('status', 'accepted'),
      sbAny.from('parent_links')
        .select('parent_id').eq('child_id', athleteId).eq('status', 'active'),
      athleteName
        ? Promise.resolve({ data: null })
        : sbAny.from('users').select('name').eq('id', athleteId).maybeSingle(),
    ])
    const summary = broken
      .map(b => `${RECORD_LABEL[b.kind]}: ${formatRecordValue(b.kind, b.value)}`)
      .join(' · ')
    const who = athleteName ?? (meRow?.name as string | null) ?? 'Атлет'
    const targets: NotifyInput[] = [
      {
        user_id: athleteId, type: 'broadcast',
        title: 'Новый личный рекорд!', body: summary,
        entity_type: 'athlete_record', entity_id: workout.id, action_url: '/dashboard',
      },
      ...((trainers ?? []) as Array<{ trainer_id: string }>).map(t => ({
        user_id: t.trainer_id, type: 'broadcast' as const,
        title: `${who}: новый личный рекорд`, body: summary,
        entity_type: 'athlete_record', entity_id: workout.id, action_url: '/athletes',
      })),
      ...((parents ?? []) as Array<{ parent_id: string }>).map(p => ({
        user_id: p.parent_id, type: 'broadcast' as const,
        title: `У ${who} новый рекорд!`, body: summary,
        entity_type: 'athlete_record', entity_id: workout.id, action_url: '/parent/dashboard',
      })),
    ]
    await notifyMany(targets)
  } catch (e) {
    console.warn('[personal-records]', e instanceof Error ? e.message : e)
  }

  return broken
}
