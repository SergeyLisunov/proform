import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { aiObject, isAiConfigured } from '@/lib/ai/claude'

export const runtime = 'nodejs'

const DebriefSchema = z.object({
  mood:          z.number().int().min(0).max(4).describe('Настроение 0 (ужасно) – 4 (отлично)'),
  rpe:           z.number().int().min(1).max(10).describe('Rate of perceived exertion 1–10'),
  summary:       z.string().max(320).describe('1–3 предложения на русском — как прошла тренировка'),
  key_takeaways: z.array(z.string().max(120)).max(3).describe('До 3 ключевых моментов'),
  recommended_tag: z.enum(['good', 'risk', 'break', 'none']).describe('Тренерская пометка: good, risk (риск травмы/перегруза), break (нужен отдых), none'),
})

const BodySchema = z.object({
  workout_id: z.string().uuid(),
  transcript: z.string().min(2).max(8000),
})

export async function POST(req: Request) {
  if (!isAiConfigured()) {
    return NextResponse.json({ ok: false, error: 'AI_NOT_CONFIGURED' }, { status: 503 })
  }

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 })
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  const { data: me } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  if (!me) return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })

  const { data: workout } = await sb
    .from('workouts')
    .select('id, athlete_id, event_date, activity_type, activity_duration_min, avg_heart_rate, activity_strain, name, description, mood')
    .eq('id', body.workout_id)
    .maybeSingle()
  if (!workout) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 })
  if ((workout as { athlete_id: string }).athlete_id !== (me as { id: string }).id) {
    return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 })
  }

  try {
    const debrief = await aiObject({
      schema: DebriefSchema,
      system: 'Ты спортивный ассистент. Извлекай из голосовой записи атлета структурированный пост-воркаут дебриф. Отвечай на русском.',
      prompt: [
        'Контекст тренировки:',
        JSON.stringify({
          type: (workout as { activity_type: string | null }).activity_type,
          date: (workout as { event_date: string | null }).event_date,
          min:  (workout as { activity_duration_min: number | null }).activity_duration_min,
          hr:   (workout as { avg_heart_rate: number | null }).avg_heart_rate,
          strain:(workout as { activity_strain: number | null }).activity_strain,
        }),
        '',
        'Транскрипт голоса атлета:',
        body.transcript,
      ].join('\n'),
      maxTokens: 700,
    })

    // Apply edits to workout
    const prevDesc = (workout as { description: string | null }).description ?? ''
    const newDesc = prevDesc
      ? `${prevDesc}\n\n— Дебриф (${new Date().toLocaleDateString('ru-RU')}): ${debrief.summary}`
      : debrief.summary

    const coachMark = debrief.recommended_tag === 'none' ? null : debrief.recommended_tag

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb as any)
      .from('workouts')
      .update({
        mood: debrief.mood,
        description: newDesc,
        coach_mark: coachMark,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.workout_id)

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, data: debrief })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI_ERROR'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
