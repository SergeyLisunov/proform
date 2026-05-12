/**
 * Workout Plans service — Sprint W5 Day 24 (PR #40).
 *
 * CRUD над `workout_plans` + `workout_plan_items` (multi-day weekly plans
 * для coaches). Отличается от существующего `workout_templates` (Migration
 * 012, single-workout templates).
 *
 * Key flow: assignToAthlete(planId, athleteId, startDate) → bulk-create
 * workouts (event_type='prescribed', prescribed_by=coach, athlete_id=picked)
 * для каждого item плана, distributing по дням от startDate.
 *
 * RLS:
 *   - workout_plans: coach own + public
 *   - workout_plan_items: inherits parent
 *   - workouts INSERT: needs `trainer_athletes` accepted link для coach→athlete
 */
import { createClient } from '@/lib/supabase/client'

export type Intensity = 'easy' | 'moderate' | 'hard' | 'rest'

export const ACTIVITY_TYPE_PRESETS = [
  'running', 'strength', 'cycling', 'swimming',
  'mobility', 'interval', 'recovery', 'tempo',
  'long_run', 'other',
] as const
export type ActivityType = typeof ACTIVITY_TYPE_PRESETS[number]

export const ACTIVITY_LABELS: Record<string, string> = {
  running:    'Бег',
  strength:   'Силовая',
  cycling:    'Велосипед',
  swimming:   'Плавание',
  mobility:   'Мобильность',
  interval:   'Интервальная',
  recovery:   'Восстановление',
  tempo:      'Темповая',
  long_run:   'Длительная',
  other:      'Другое',
}

export const INTENSITY_META: Record<Intensity, { label: string; color: string; bg: string; border: string }> = {
  easy:     { label: 'Лёгкая',          color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  moderate: { label: 'Средняя',         color: '#0E7490', bg: '#ECFEFF', border: '#A5F3FC' },
  hard:     { label: 'Высокая',         color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  rest:     { label: 'Отдых',           color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0' },
}

export interface WorkoutPlan {
  id:              string
  coach_id:        string
  name:            string
  description:     string | null
  sport:           string | null
  duration_weeks:  number
  is_public:       boolean
  is_archived:     boolean
  created_at:      string
  updated_at:      string
}

export interface WorkoutPlanItem {
  id:            string
  plan_id:       string
  day_index:     number       // 0..(duration_weeks*7 - 1)
  order_in_day:  number
  activity_type: string
  name:          string | null
  duration_min:  number | null
  intensity:     Intensity | null
  notes:         string | null
  created_at:    string
}

export interface WorkoutPlanFull extends WorkoutPlan {
  items: WorkoutPlanItem[]
}

// ── List ───────────────────────────────────────────────────────────────

export async function listMyPlans(): Promise<WorkoutPlan[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('workout_plans')
    .select('*')
    .eq('is_archived', false)
    .order('updated_at', { ascending: false })
  if (error) {
    console.warn('[workout-plans.listMyPlans]', error.message)
    return []
  }
  return (data ?? []) as WorkoutPlan[]
}

export async function getPlan(planId: string): Promise<WorkoutPlanFull | null> {
  const sb = createClient()
  const { data: planRaw } = await sb
    .from('workout_plans')
    .select('*')
    .eq('id', planId)
    .maybeSingle()
  if (!planRaw) return null

  const { data: itemsRaw } = await sb
    .from('workout_plan_items')
    .select('*')
    .eq('plan_id', planId)
    .order('day_index', { ascending: true })
    .order('order_in_day', { ascending: true })

  return {
    ...(planRaw as WorkoutPlan),
    items: (itemsRaw ?? []) as WorkoutPlanItem[],
  }
}

// ── Create / Update ───────────────────────────────────────────────────

export interface CreatePlanInput {
  name:            string
  description?:    string | null
  sport?:          string | null
  duration_weeks?: number
  is_public?:      boolean
}

export async function createPlan(input: CreatePlanInput): Promise<WorkoutPlan | null> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return null
  const { data: meRow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string } | null
  if (!me) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).from('workout_plans').insert({
    coach_id:       me.id,
    name:           input.name.trim(),
    description:    input.description?.trim() || null,
    sport:          input.sport?.trim() || null,
    duration_weeks: input.duration_weeks ?? 1,
    is_public:      input.is_public ?? false,
  }).select().single()
  if (error) {
    console.warn('[workout-plans.createPlan]', error.message)
    return null
  }
  return data as WorkoutPlan
}

export interface UpdatePlanInput {
  name?:           string
  description?:    string | null
  sport?:          string | null
  duration_weeks?: number
  is_public?:      boolean
}

export async function updatePlan(planId: string, patch: UpdatePlanInput): Promise<WorkoutPlan | null> {
  const sb = createClient()
  const payload: Record<string, unknown> = {}
  if (patch.name           !== undefined) payload.name           = patch.name.trim()
  if (patch.description    !== undefined) payload.description    = patch.description?.trim() || null
  if (patch.sport          !== undefined) payload.sport          = patch.sport?.trim() || null
  if (patch.duration_weeks !== undefined) payload.duration_weeks = patch.duration_weeks
  if (patch.is_public      !== undefined) payload.is_public      = patch.is_public

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).from('workout_plans')
    .update(payload).eq('id', planId).select().single()
  if (error) {
    console.warn('[workout-plans.updatePlan]', error.message)
    return null
  }
  return data as WorkoutPlan
}

export async function archivePlan(planId: string): Promise<boolean> {
  const sb = createClient()
  const { error } = await sb.from('workout_plans').update({ is_archived: true }).eq('id', planId)
  if (error) {
    console.warn('[workout-plans.archivePlan]', error.message)
    return false
  }
  return true
}

// ── Items: replace all items в plan (simplest CRUD для builder UI) ─────

export interface ItemInput {
  day_index:     number
  order_in_day:  number
  activity_type: string
  name?:         string | null
  duration_min?: number | null
  intensity?:    Intensity | null
  notes?:        string | null
}

/**
 * Replace ALL items in plan. Simpler than delta-sync UI <-> DB — builder
 * sends full items array; we DELETE existing + INSERT new in transaction-
 * like sequence. RLS protects ownership.
 */
export async function replacePlanItems(planId: string, items: ItemInput[]): Promise<boolean> {
  const sb = createClient()

  // 1. Delete existing items
  const { error: delErr } = await sb.from('workout_plan_items').delete().eq('plan_id', planId)
  if (delErr) {
    console.warn('[workout-plans.replacePlanItems] delete:', delErr.message)
    return false
  }

  if (items.length === 0) return true

  // 2. Insert new items
  const payload = items.map(i => ({
    plan_id:       planId,
    day_index:     i.day_index,
    order_in_day:  i.order_in_day,
    activity_type: i.activity_type,
    name:          i.name?.trim() || null,
    duration_min:  i.duration_min ?? null,
    intensity:     i.intensity ?? null,
    notes:         i.notes?.trim() || null,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insErr } = await (sb as any).from('workout_plan_items').insert(payload)
  if (insErr) {
    console.warn('[workout-plans.replacePlanItems] insert:', insErr.message)
    return false
  }
  return true
}

// ── Assign to athlete (bulk-create workouts) ──────────────────────────

export interface AssignResult {
  ok:               boolean
  workouts_created: number
  error?:           string
}

/**
 * Materialize plan items as actual `workouts` rows для athlete starting
 * at startDate. Each item на day_index N → workout с event_date =
 * startDate + N days.
 *
 * Requires:
 *   - coach has accepted trainer_athletes link к athlete (workouts RLS enforces)
 *   - plan exists и coach owns или is_public
 */
export async function assignPlanToAthlete(
  planId: string,
  athleteId: string,
  startDate: Date,
): Promise<AssignResult> {
  const plan = await getPlan(planId)
  if (!plan) return { ok: false, workouts_created: 0, error: 'plan_not_found' }
  if (plan.items.length === 0) return { ok: false, workouts_created: 0, error: 'plan_empty' }

  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return { ok: false, workouts_created: 0, error: 'unauthorized' }
  const { data: meRow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string } | null
  if (!me) return { ok: false, workouts_created: 0, error: 'user_not_found' }

  const payload = plan.items.map(item => {
    const dt = new Date(startDate)
    dt.setDate(dt.getDate() + item.day_index)
    return {
      athlete_id:            athleteId,
      event_date:            dt.toISOString().slice(0, 10),
      event_type:            'prescribed',
      prescribed_by:         me.id,
      prescribed_at:         new Date().toISOString(),
      activity_type:         item.activity_type,
      name:                  item.name,
      description:           item.notes,
      activity_duration_min: item.duration_min,
      completion_status:     'pending',
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any).from('workouts').insert(payload)
  if (error) {
    console.warn('[workout-plans.assignPlanToAthlete]', error.message)
    return { ok: false, workouts_created: 0, error: error.message }
  }
  return { ok: true, workouts_created: payload.length }
}

// ── Picker: coach's assigned athletes ─────────────────────────────────

export interface AthleteOption {
  id:   string
  name: string | null
}

export async function listMyAssignedAthletes(): Promise<AthleteOption[]> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return []
  const { data: meRow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string } | null
  if (!me) return []

  const { data: links } = await sb
    .from('trainer_athletes')
    .select('athlete_id')
    .eq('trainer_id', me.id)
    .eq('status', 'accepted')
  const athleteIds = ((links ?? []) as Array<{ athlete_id: string }>).map(l => l.athlete_id)
  if (athleteIds.length === 0) return []

  const { data: users } = await sb
    .from('users')
    .select('id, name')
    .in('id', athleteIds)
    .order('name', { ascending: true })
  return ((users ?? []) as AthleteOption[])
}
