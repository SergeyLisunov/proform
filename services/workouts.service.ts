import { createClient } from '@/lib/supabase/client'
import { createCalendarEvent } from './calendar.service'

export type Workout = {
  id: string
  athlete_id: string
  event_date: string
  event_type: string | null
  activity_type: string | null
  name: string
  description: string | null
  start_time: string | null
  activity_duration_min: number | null
  activity_strain: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  activity_calories: number | null
  mood: string | null
  created_at: string
}

export async function getWorkouts(athleteId: string): Promise<Workout[]> {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('workouts')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('event_date', { ascending: false })
    .limit(100)
  return data ?? []
}

export async function createWorkout(workout: {
  athlete_id: string
  event_date: string
  event_type?: string | null
  activity_type?: string | null
  name: string
  description?: string | null
  start_time?: string | null
  activity_duration_min?: number | null
  activity_strain?: number | null
  avg_heart_rate?: number | null
  max_heart_rate?: number | null
  activity_calories?: number | null
  mood?: string | null
}): Promise<Workout | null> {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('workouts')
    .insert(workout)
    .select()
    .single() as { data: Workout | null; error: { message: string } | null }

  if (error) {
    console.error('createWorkout error:', error.message)
    return null
  }

  if (data) {
    await createCalendarEvent({
      owner_id: workout.athlete_id,
      event_date: workout.event_date,
      event_type: 'workout',
      title: workout.name,
      notes: workout.description ?? null,
      start_time: workout.start_time ?? null,
    })
  }

  return data
}
