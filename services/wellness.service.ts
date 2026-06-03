/**
 * Wellness Check-in Service — Sprint W1 Day 3.
 *
 * Daily 30-second ritual for athletes: mood, sleep duration, sleep quality,
 * soreness, energy. The data feeds:
 *   1. Coach dashboard widgets (early-warning before ACWR turns red)
 *   2. AI endpoints (anomaly-check, coach-briefing get pre-workout signal,
 *      not just post-workout `workout.mood`)
 *   3. Athlete's own historical trend
 *
 * Storage model: one row per (athlete_id, date) — UPSERT on save so an
 * athlete can refine their morning answer throughout the day. RLS already
 * isolates the athlete-side; coaches/doctors can only read for connected
 * athletes (see migration 049).
 */
import { createClient } from '@/lib/supabase/client'

export interface WellnessCheckin {
  id: string
  athlete_id: string
  date: string                     // YYYY-MM-DD
  mood: number | null              // 1–5
  sleep_hours: number | null       // 0–14, decimal allowed
  sleep_quality: number | null     // 1–5
  soreness: number | null          // 0–10
  energy: number | null            // 1–5
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

export interface WellnessInput {
  athlete_id: string
  date?: string                    // defaults to today
  mood?: number | null
  sleep_hours?: number | null
  sleep_quality?: number | null
  soreness?: number | null
  energy?: number | null
  notes?: string | null
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Mood / energy / sleep_quality emoji palette.
 * Stays in service (not component) so coach widgets can reuse the same
 * mapping when displaying an athlete's recent checkin.
 */
export const MOOD_EMOJI = ['', '😞', '😕', '😐', '🙂', '😊'] as const   // index 0 unused, mood is 1-5
export const ENERGY_EMOJI = ['', '🪫', '🔋', '⚡️', '🔥', '🚀'] as const
export const SLEEP_QUALITY_EMOJI = ['', '💤', '😴', '🛌', '🌙', '✨'] as const

/** Color for soreness 0–10 traffic light (green → yellow → red). */
export function sorenessColor(level: number | null): string {
  if (level == null) return '#94A3B8'
  if (level <= 2) return '#10B981'
  if (level <= 5) return '#F59E0B'
  if (level <= 7) return '#F35703'
  return '#EF4444'
}

/**
 * UPSERT the day's checkin. Returns the saved row, or null on error.
 * Caller passes whatever fields they collected — partial saves are fine
 * (athlete can fill mood now, soreness later).
 */
export async function recordCheckin(input: WellnessInput): Promise<WellnessCheckin | null> {
  const sb = createClient()
  const date = input.date ?? todayISO()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('wellness_checkins')
    .upsert(
      {
        athlete_id:    input.athlete_id,
        date,
        mood:          input.mood ?? null,
        sleep_hours:   input.sleep_hours ?? null,
        sleep_quality: input.sleep_quality ?? null,
        soreness:      input.soreness ?? null,
        energy:        input.energy ?? null,
        notes:         input.notes?.trim() || null,
      },
      { onConflict: 'athlete_id,date' },
    )
    .select()
    .single()
  if (error) {
    console.warn('[recordCheckin]', error.message)
    return null
  }
  return data as WellnessCheckin
}

/** Returns today's checkin if exists, otherwise null. */
export async function getTodayCheckin(athleteId: string): Promise<WellnessCheckin | null> {
  const sb = createClient()
  const { data, error } = await sb
    .from('wellness_checkins')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('date', todayISO())
    .maybeSingle()
  if (error) {
    console.warn('[getTodayCheckin]', error.message)
    return null
  }
  return (data as WellnessCheckin | null) ?? null
}

/**
 * Last `days` checkins for an athlete (newest first). Used by athlete
 * dashboard to show recent trend, and by coach widgets to display
 * "today's wellness" per athlete.
 */
export async function getCheckinHistory(
  athleteId: string,
  days = 14,
): Promise<WellnessCheckin[]> {
  const sb = createClient()
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const { data, error } = await sb
    .from('wellness_checkins')
    .select('*')
    .eq('athlete_id', athleteId)
    .gte('date', since)
    .order('date', { ascending: false })
  if (error) {
    console.warn('[getCheckinHistory]', error.message)
    return []
  }
  return (data ?? []) as WellnessCheckin[]
}

/**
 * Heuristic: should we nudge the athlete to fill in today's checkin?
 * Returns true after 9 AM local time if no row exists for today.
 * UI uses this to show a soft notification dot.
 */
export function shouldPromptToday(today: WellnessCheckin | null): boolean {
  if (today) return false
  const hour = new Date().getHours()
  return hour >= 9
}
