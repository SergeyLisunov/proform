import { createBrowserClient } from '@supabase/ssr'

function getSB() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── Тип Workout — соответствует реальной схеме БД ─────────────────────────────
export type Workout = {
  id: string
  athlete_id: string
  event_date: string | null
  event_type: string | null
  activity_type: string | null
  workout_time_of_day: string | null
  start_time: string | null
  activity_duration_min: number | null
  activity_strain: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  activity_calories: number | null
  hr_zone_1_min: number | null
  hr_zone_2_min: number | null
  hr_zone_3_min: number | null
  hr_zone_4_min: number | null
  hr_zone_5_min: number | null
  recovery_score: number | null
  hrv: number | null
  name: string | null
  description: string | null
  mood: number | null          // 0–4 integer
  is_public: boolean | null
  cycle_type: string | null
  trainer_comment: string | null
  coach_mark: string | null
  coach_marked_at: string | null
  coach_marked_by: string | null
  risk_flag: string | null
  marks: string[] | null
  created_at: string | null
  updated_at: string | null
}

export type CreateWorkoutInput = {
  athlete_id: string
  event_date: string
  event_type?: string
  activity_type?: string | null
  workout_time_of_day?: string | null
  start_time?: string | null
  activity_duration_min?: number | null
  activity_strain?: number | null
  avg_heart_rate?: number | null
  max_heart_rate?: number | null
  activity_calories?: number | null
  name?: string | null
  description?: string | null
  mood?: number | null
  is_public?: boolean
}

// ── Получить все тренировки атлета ────────────────────────────────────────────
export async function getWorkouts(athleteId: string): Promise<Workout[]> {
  const sb = getSB()
  const { data, error } = await sb
    .from('workouts')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('event_date', { ascending: false })
    .limit(100)

  if (error) {
    console.error('getWorkouts error:', error)
    return []
  }
  return (data ?? []) as Workout[]
}

// ── Получить тренировки за период ─────────────────────────────────────────────
export async function getWorkoutsRange(
  athleteId: string,
  from: string,
  to: string
): Promise<Workout[]> {
  const sb = getSB()
  const { data, error } = await sb
    .from('workouts')
    .select('*')
    .eq('athlete_id', athleteId)
    .gte('event_date', from)
    .lte('event_date', to)
    .order('event_date', { ascending: false })

  if (error) {
    console.error('getWorkoutsRange error:', error)
    return []
  }
  return (data ?? []) as Workout[]
}

// ── Создать тренировку ────────────────────────────────────────────────────────
export async function createWorkout(input: CreateWorkoutInput): Promise<Workout | null> {
  const sb = getSB()
  const { data, error } = await sb
    .from('workouts')
    .insert({
      athlete_id:           input.athlete_id,
      event_date:           input.event_date,
      event_type:           input.event_type ?? 'workout',
      activity_type:        input.activity_type ?? null,
      workout_time_of_day:  input.workout_time_of_day ?? null,
      start_time:           input.start_time ?? null,
      activity_duration_min: input.activity_duration_min ?? null,
      activity_strain:      input.activity_strain ?? null,
      avg_heart_rate:       input.avg_heart_rate ?? null,
      max_heart_rate:       input.max_heart_rate ?? null,
      activity_calories:    input.activity_calories ?? null,
      name:                 input.name ?? null,
      description:          input.description ?? null,
      mood:                 input.mood ?? null,
      is_public:            input.is_public ?? false,
    })
    .select()
    .single()

  if (error) {
    console.error('createWorkout error:', error)
    return null
  }
  return data as Workout
}

// ── Обновить тренировку ───────────────────────────────────────────────────────
export async function updateWorkout(
  id: string,
  updates: Partial<Omit<Workout, 'id' | 'athlete_id' | 'created_at'>>
): Promise<Workout | null> {
  const sb = getSB()
  const { data, error } = await sb
    .from('workouts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('updateWorkout error:', error)
    return null
  }
  return data as Workout
}

// ── Удалить тренировку ────────────────────────────────────────────────────────
export async function deleteWorkout(id: string): Promise<boolean> {
  const sb = getSB()
  const { error } = await sb
    .from('workouts')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('deleteWorkout error:', error)
    return false
  }
  return true
}
