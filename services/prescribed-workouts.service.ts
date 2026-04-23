import { createClient } from '@/lib/supabase/client'
import { notify } from './notifications.service'

export type CompletionStatus = 'pending' | 'completed' | 'skipped'

export interface PrescribedWorkout {
  id: string
  athlete_id: string
  event_date: string
  event_type: string | null
  activity_type: string | null
  name: string | null
  description: string | null
  activity_duration_min: number | null
  prescribed_by: string
  prescribed_at: string
  prescribed_note: string | null
  completion_status: CompletionStatus | null
}

/** Coach prescribes a workout for one of their athletes. */
export async function prescribeWorkout(input: {
  coach_id: string
  athlete_id: string
  event_date: string
  activity_type?: string | null
  name?: string | null
  description?: string | null
  activity_duration_min?: number | null
  prescribed_note?: string | null
}): Promise<PrescribedWorkout | null> {
  const sb = createClient()
  const { data, error } = await (sb as any)
    .from('workouts')
    .insert({
      athlete_id:  input.athlete_id,
      event_date:  input.event_date,
      event_type:  'prescribed',
      activity_type: input.activity_type ?? null,
      name:        input.name ?? null,
      description: input.description ?? null,
      activity_duration_min: input.activity_duration_min ?? null,
      prescribed_by:   input.coach_id,
      prescribed_at:   new Date().toISOString(),
      prescribed_note: input.prescribed_note ?? null,
      completion_status: 'pending',
    })
    .select()
    .single()
  if (error) { console.error('prescribeWorkout:', error.message); return null }
  const row = data as PrescribedWorkout

  await notify({
    user_id: input.athlete_id,
    type: 'session_scheduled',
    title: 'Тренер назначил тренировку',
    body: `${input.name ?? 'Тренировка'} · ${input.event_date}${input.activity_duration_min ? ` · ${input.activity_duration_min} мин` : ''}`,
    entity_type: 'workout',
    entity_id: row.id,
    action_url: '/workouts',
  })

  return row
}

/** Athlete marks a prescribed workout as completed/skipped. */
export async function setPrescribedCompletion(id: string, status: CompletionStatus): Promise<boolean> {
  const sb = createClient()
  const { error } = await (sb as any)
    .from('workouts')
    .update({ completion_status: status })
    .eq('id', id)
  if (error) { console.warn('[setPrescribedCompletion]', error.message); return false }
  return true
}

/** Upcoming prescriptions for the signed-in athlete (today onwards). */
export async function listUpcomingPrescribedForAthlete(athleteId: string): Promise<PrescribedWorkout[]> {
  const sb = createClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await sb
    .from('workouts')
    .select('id, athlete_id, event_date, event_type, activity_type, name, description, activity_duration_min, prescribed_by, prescribed_at, prescribed_note, completion_status')
    .eq('athlete_id', athleteId)
    .not('prescribed_by', 'is', null)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(20)
  if (error) { console.warn('[listUpcomingPrescribedForAthlete]', error.message); return [] }
  return (data ?? []) as unknown as PrescribedWorkout[]
}

/** Coach-side: recent prescriptions for their athletes (last 30d / next 30d). */
export async function listCoachPrescriptions(coachId: string): Promise<PrescribedWorkout[]> {
  const sb = createClient()
  const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const to   = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  const { data, error } = await sb
    .from('workouts')
    .select('id, athlete_id, event_date, event_type, activity_type, name, description, activity_duration_min, prescribed_by, prescribed_at, prescribed_note, completion_status')
    .eq('prescribed_by', coachId)
    .gte('event_date', from)
    .lte('event_date', to)
    .order('event_date', { ascending: false })
  if (error) { console.warn('[listCoachPrescriptions]', error.message); return [] }
  return (data ?? []) as unknown as PrescribedWorkout[]
}
