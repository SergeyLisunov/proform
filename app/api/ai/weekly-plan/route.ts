import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { aiObject, isAiConfigured, AI_MODEL_SMART } from '@/lib/ai/claude'

export const runtime = 'nodejs'

const DaySchema = z.object({
  day_offset:  z.number().int().min(0).max(6).describe('0 = сегодня, 6 = через 6 дней'),
  weekday:     z.string().max(16).describe('Пн, Вт, Ср…'),
  activity:    z.enum(['Бег', 'Велоспорт', 'Плавание', 'Силовые', 'Ходьба', 'Отдых', 'Другое']),
  headline:    z.string().max(80),
  duration_min:z.number().int().min(0).max(240),
  intensity:   z.enum(['rest', 'easy', 'moderate', 'hard', 'peak']),
  rationale:   z.string().max(200),
})

const PlanSchema = z.object({
  overview:    z.string().max(280).describe('Короткое описание недели, на русском'),
  total_min:   z.number().int().min(0),
  days:        z.array(DaySchema).length(7),
  warnings:    z.array(z.string().max(120)).max(3),
})

const BodySchema = z.object({
  goal: z.string().max(400).optional(),
}).optional()

export async function POST(req: Request) {
  if (!isAiConfigured()) {
    return NextResponse.json({ ok: false, error: 'AI_NOT_CONFIGURED' }, { status: 503 })
  }

  let goal: string | undefined
  try {
    const parsed = BodySchema.parse(await req.json().catch(() => ({})))
    goal = parsed?.goal
  } catch {
    return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 })
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const { data: me } = await sb.from('users').select('id, sport_type').eq('auth_id', auth.user.id).maybeSingle()
  if (!me) return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })
  const meRow = me as { id: string; sport_type: string | null }

  const since = new Date(); since.setDate(since.getDate() - 14)
  const sinceStr = since.toISOString().slice(0, 10)

  const { data: workouts } = await sb
    .from('workouts')
    .select('event_date, activity_type, activity_duration_min, activity_strain, recovery_score, hrv')
    .eq('athlete_id', meRow.id)
    .gte('event_date', sinceStr)
    .order('event_date', { ascending: false })
    .limit(30)

  const lastRecovery = (workouts ?? []).find(w => w.recovery_score != null)?.recovery_score ?? null
  const lastHrv      = (workouts ?? []).find(w => w.hrv != null)?.hrv ?? null
  const weekStrain   = (workouts ?? []).reduce((s, w) => s + (Number(w.activity_strain) || 0), 0)

  try {
    const plan = await aiObject({
      schema: PlanSchema,
      model: AI_MODEL_SMART,
      system: 'Ты опытный тренер по выносливости. Составляешь недельные планы. Отвечай на русском, в JSON.',
      prompt: [
        'Составь план тренировок на 7 дней, начиная с завтра (day_offset=0 — завтра).',
        `Вид спорта: ${meRow.sport_type ?? 'не указан'}.`,
        `Цель атлета: ${goal ?? 'поддерживающая нагрузка'}.`,
        `Текущая готовность: ${lastRecovery ?? 'нет данных'}, HRV: ${lastHrv ?? 'нет данных'}.`,
        `Strain за 2 недели: ${weekStrain.toFixed(1)}.`,
        `История: ${JSON.stringify(workouts ?? []).slice(0, 3000)}`,
        'Включи минимум 1 день полного отдыха и 1 лёгкую восстановительную сессию.',
        'Избегай двух тяжёлых дней подряд.',
      ].join('\n'),
      maxTokens: 2200,
    })

    return NextResponse.json({ ok: true, data: plan })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI_ERROR'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
