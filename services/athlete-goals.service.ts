/**
 * Athlete Goals service — Sprint W5 Day 25 (PR #41).
 *
 * CRUD над athlete_goals + progress stats helpers (агрегация из workouts
 * для weekly load + completion rate + recovery trend).
 *
 * Used by:
 *   - /athlete/goals — list/create/achieve/abandon
 *   - /athlete/progress — chart (weekly load + completion + goals)
 *   - Coach view на /athletes/[id] — read-only goals tab (W5 Day 27 polish)
 */
import { createClient } from '@/lib/supabase/client'

export type GoalStatus = 'active' | 'achieved' | 'abandoned'

export const METRIC_PRESETS = [
  { value: 'pb_5k',            label: 'Личный рекорд 5к',       unit: 'мин',    suggestion: 25 },
  { value: 'pb_10k',           label: 'Личный рекорд 10к',      unit: 'мин',    suggestion: 52 },
  { value: 'weekly_volume',    label: 'Объём тренировок',       unit: 'часов',  suggestion: 8 },
  { value: 'weight_kg',        label: 'Целевой вес',            unit: 'кг',     suggestion: 70 },
  { value: 'monthly_sessions', label: 'Сессий в месяц',         unit: 'сессий', suggestion: 20 },
  { value: 'custom',           label: 'Своя цель',              unit: '',       suggestion: 0 },
] as const

export const STATUS_META: Record<GoalStatus, { label: string; color: string; bg: string; border: string; emoji: string }> = {
  active:    { label: 'В работе',  color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', emoji: '🎯' },
  achieved:  { label: 'Достигнуто', color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0', emoji: '✅' },
  abandoned: { label: 'Снято',     color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0', emoji: '⏸' },
}

export interface AthleteGoal {
  id:              string
  athlete_id:      string
  set_by_user_id:  string | null
  metric:          string
  metric_label:    string
  target_value:    number | null
  target_unit:     string | null
  target_date:     string | null
  current_value:   number | null
  status:          GoalStatus
  achieved_at:     string | null
  notes:           string | null
  created_at:      string
  updated_at:      string
}

// ── Reads ──────────────────────────────────────────────────────────────

export async function listMyGoals(status?: GoalStatus): Promise<AthleteGoal[]> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return []
  const { data: meRow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string } | null
  if (!me) return []

  let q = sb.from('athlete_goals').select('*').eq('athlete_id', me.id)
  if (status) q = q.eq('status', status)

  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) {
    console.warn('[athlete-goals.listMyGoals]', error.message)
    return []
  }
  return (data ?? []) as AthleteGoal[]
}

export async function listGoalsForAthlete(athleteId: string): Promise<AthleteGoal[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('athlete_goals')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('[athlete-goals.listGoalsForAthlete]', error.message)
    return []
  }
  return (data ?? []) as AthleteGoal[]
}

// ── Writes ─────────────────────────────────────────────────────────────

export interface CreateGoalInput {
  athlete_id?:    string         // если coach создаёт — указывает athlete; else self
  metric:         string
  metric_label:   string
  target_value?:  number | null
  target_unit?:   string | null
  target_date?:   string | null   // YYYY-MM-DD
  current_value?: number | null
  notes?:         string | null
}

export async function createGoal(input: CreateGoalInput): Promise<AthleteGoal | null> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return null
  const { data: meRow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string } | null
  if (!me) return null

  const athleteId = input.athlete_id ?? me.id

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).from('athlete_goals').insert({
    athlete_id:     athleteId,
    set_by_user_id: me.id,
    metric:         input.metric,
    metric_label:   input.metric_label.trim(),
    target_value:   input.target_value ?? null,
    target_unit:    input.target_unit?.trim() || null,
    target_date:    input.target_date || null,
    current_value:  input.current_value ?? null,
    notes:          input.notes?.trim() || null,
    status:         'active',
  }).select().single()
  if (error) {
    console.warn('[athlete-goals.createGoal]', error.message)
    return null
  }
  return data as AthleteGoal
}

export interface UpdateGoalInput {
  metric_label?:  string
  target_value?:  number | null
  target_unit?:   string | null
  target_date?:   string | null
  current_value?: number | null
  notes?:         string | null
}

export async function updateGoal(goalId: string, patch: UpdateGoalInput): Promise<AthleteGoal | null> {
  const sb = createClient()
  const payload: Record<string, unknown> = {}
  if (patch.metric_label  !== undefined) payload.metric_label  = patch.metric_label.trim()
  if (patch.target_value  !== undefined) payload.target_value  = patch.target_value
  if (patch.target_unit   !== undefined) payload.target_unit   = patch.target_unit?.trim() || null
  if (patch.target_date   !== undefined) payload.target_date   = patch.target_date || null
  if (patch.current_value !== undefined) payload.current_value = patch.current_value
  if (patch.notes         !== undefined) payload.notes         = patch.notes?.trim() || null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('athlete_goals').update(payload).eq('id', goalId).select().single()
  if (error) {
    console.warn('[athlete-goals.updateGoal]', error.message)
    return null
  }
  return data as AthleteGoal
}

export async function achieveGoal(goalId: string): Promise<boolean> {
  const sb = createClient()
  const { error } = await sb.from('athlete_goals').update({ status: 'achieved' }).eq('id', goalId)
  if (error) {
    console.warn('[athlete-goals.achieveGoal]', error.message)
    return false
  }
  return true
}

export async function abandonGoal(goalId: string): Promise<boolean> {
  const sb = createClient()
  const { error } = await sb.from('athlete_goals').update({ status: 'abandoned' }).eq('id', goalId)
  if (error) {
    console.warn('[athlete-goals.abandonGoal]', error.message)
    return false
  }
  return true
}

export async function reactivateGoal(goalId: string): Promise<boolean> {
  const sb = createClient()
  const { error } = await sb.from('athlete_goals').update({ status: 'active', achieved_at: null }).eq('id', goalId)
  if (error) {
    console.warn('[athlete-goals.reactivateGoal]', error.message)
    return false
  }
  return true
}

export async function deleteGoal(goalId: string): Promise<boolean> {
  const sb = createClient()
  const { error } = await sb.from('athlete_goals').delete().eq('id', goalId)
  if (error) {
    console.warn('[athlete-goals.deleteGoal]', error.message)
    return false
  }
  return true
}

// ── Progress stats (агрегация из workouts) ─────────────────────────────

export interface WeeklyStat {
  /** ISO week start (Monday) YYYY-MM-DD */
  week_start:     string
  total_minutes:  number
  workout_count:  number
  completed:      number
  skipped:        number
  pending:        number
  avg_recovery:   number | null
}

export interface ProgressStats {
  weeks:               WeeklyStat[]
  completion_rate_pct: number
  avg_weekly_minutes:  number
  total_goals_active:  number
  total_goals_done:    number
}

/**
 * Pull 8 weeks of workouts + aggregate per week. Includes:
 *   - total_minutes (sum of activity_duration_min)
 *   - workout_count
 *   - completion stats (completed / skipped / pending — prescribed only)
 *   - avg_recovery score (если есть)
 *
 * Plus goal counts (active vs achieved за period).
 */
export async function getProgressStats(weeks: number = 8): Promise<ProgressStats> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return EMPTY_STATS

  const { data: meRow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string } | null
  if (!me) return EMPTY_STATS

  // Compute week range — 8 weeks back from today Monday
  const today    = new Date()
  const dayOfWk  = today.getDay() === 0 ? 7 : today.getDay() // Mon=1, Sun=7
  const thisMon  = new Date(today)
  thisMon.setDate(today.getDate() - (dayOfWk - 1))
  const startOf  = new Date(thisMon)
  startOf.setDate(thisMon.getDate() - (weeks - 1) * 7)

  const sinceStr = startOf.toISOString().slice(0, 10)

  const { data: workoutsRaw, error } = await sb
    .from('workouts')
    .select('event_date, activity_duration_min, completion_status, recovery_score, event_type')
    .eq('athlete_id', me.id)
    .gte('event_date', sinceStr)
    .order('event_date', { ascending: true })

  if (error) {
    console.warn('[athlete-goals.getProgressStats]', error.message)
    return EMPTY_STATS
  }

  const workouts = (workoutsRaw ?? []) as Array<{
    event_date:            string
    activity_duration_min: number | null
    completion_status:     string | null
    recovery_score:        number | null
    event_type:            string | null
  }>

  // Build week buckets
  const weekArr: WeeklyStat[] = []
  for (let i = 0; i < weeks; i++) {
    const ws = new Date(startOf)
    ws.setDate(startOf.getDate() + i * 7)
    weekArr.push({
      week_start:    ws.toISOString().slice(0, 10),
      total_minutes: 0,
      workout_count: 0,
      completed:     0,
      skipped:       0,
      pending:       0,
      avg_recovery:  null,
    })
  }

  const recoveryAccum: number[][] = weekArr.map(() => [])

  for (const w of workouts) {
    const wkIdx = Math.floor((new Date(w.event_date).getTime() - startOf.getTime()) / (7 * 24 * 3600_000))
    if (wkIdx < 0 || wkIdx >= weeks) continue
    const wk = weekArr[wkIdx]
    wk.total_minutes += w.activity_duration_min ?? 0
    wk.workout_count += 1
    if (w.event_type === 'prescribed') {
      if      (w.completion_status === 'completed') wk.completed++
      else if (w.completion_status === 'skipped')   wk.skipped++
      else                                          wk.pending++
    }
    if (typeof w.recovery_score === 'number') recoveryAccum[wkIdx].push(w.recovery_score)
  }

  for (let i = 0; i < weeks; i++) {
    const arr = recoveryAccum[i]
    weekArr[i].avg_recovery = arr.length > 0
      ? Math.round(arr.reduce((s, n) => s + n, 0) / arr.length)
      : null
  }

  const totalCompleted = weekArr.reduce((s, w) => s + w.completed, 0)
  const totalSkipped   = weekArr.reduce((s, w) => s + w.skipped, 0)
  const totalPrescribed = totalCompleted + totalSkipped + weekArr.reduce((s, w) => s + w.pending, 0)
  const completionRate = totalPrescribed > 0
    ? Math.round((totalCompleted / totalPrescribed) * 100)
    : 0

  const avgWeeklyMinutes = Math.round(
    weekArr.reduce((s, w) => s + w.total_minutes, 0) / Math.max(1, weeks),
  )

  // Goal counts
  const { data: goalsRaw } = await sb
    .from('athlete_goals')
    .select('status, achieved_at')
    .eq('athlete_id', me.id)
  const goals = (goalsRaw ?? []) as Array<{ status: string; achieved_at: string | null }>
  const totalActive = goals.filter(g => g.status === 'active').length
  const totalDone   = goals.filter(g => g.status === 'achieved').length

  return {
    weeks:               weekArr,
    completion_rate_pct: completionRate,
    avg_weekly_minutes:  avgWeeklyMinutes,
    total_goals_active:  totalActive,
    total_goals_done:    totalDone,
  }
}

const EMPTY_STATS: ProgressStats = {
  weeks: [], completion_rate_pct: 0, avg_weekly_minutes: 0,
  total_goals_active: 0, total_goals_done: 0,
}
