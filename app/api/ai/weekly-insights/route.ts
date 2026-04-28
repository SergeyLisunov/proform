import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { aiObject, isAiConfigured } from '@/lib/ai/claude'
import { enforceAiRateLimit } from '@/lib/ai/rate-limit'

export const runtime = 'nodejs'

const InsightsSchema = z.object({
  summary:       z.string().max(320).describe('2–3 предложения — как прошла неделя, на русском'),
  highlights:    z.array(z.string().max(120)).max(4).describe('До 4 положительных моментов'),
  warnings:      z.array(z.string().max(120)).max(3).describe('До 3 предупреждений / рисков'),
  focus_next:    z.string().max(200).describe('Главный фокус на следующую неделю'),
  total_min:     z.number().int().min(0),
  total_strain:  z.number().min(0),
})

export async function GET(req: Request) {
  if (!isAiConfigured()) {
    return NextResponse.json({ ok: false, error: 'AI_NOT_CONFIGURED' }, { status: 503 })
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const { data: me } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  if (!me) return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })

  const limited = await enforceAiRateLimit(req, sb, 'weekly-insights', 10, 3600)
  if (limited) return limited

  const since = new Date(); since.setDate(since.getDate() - 7)
  const sinceStr = since.toISOString().slice(0, 10)

  const { data: workouts } = await sb
    .from('workouts')
    .select('event_date, activity_type, activity_duration_min, activity_strain, avg_heart_rate, recovery_score, hrv, mood, name')
    .eq('athlete_id', (me as { id: string }).id)
    .gte('event_date', sinceStr)
    .order('event_date', { ascending: false })

  const rows = workouts ?? []
  const totalMin = rows.reduce((s, w) => s + (w.activity_duration_min ?? 0), 0)
  const totalStrain = rows.reduce((s, w) => s + (Number(w.activity_strain) || 0), 0)

  if (rows.length === 0) {
    return NextResponse.json({
      ok: true,
      data: {
        summary: 'На этой неделе пока нет тренировок — самое время начать.',
        highlights: [],
        warnings: [],
        focus_next: 'Запланируй 3 лёгкие тренировки, чтобы войти в ритм.',
        total_min: 0,
        total_strain: 0,
      },
    })
  }

  try {
    const insights = await aiObject({
      schema: InsightsSchema,
      system: 'Ты спортивный аналитик. Коротко, по делу, на русском. JSON.',
      prompt: [
        `Проанализируй неделю атлета (${sinceStr} — сегодня).`,
        `Суммарное время: ${totalMin} мин, суммарный strain: ${totalStrain.toFixed(1)}.`,
        `Тренировки: ${JSON.stringify(rows).slice(0, 5000)}`,
        'Отметь монотонность, перекосы по интенсивности, пропуски восстановительных дней.',
      ].join('\n'),
      maxTokens: 900,
    })

    return NextResponse.json({
      ok: true,
      data: { ...insights, total_min: totalMin, total_strain: Number(totalStrain.toFixed(1)) },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI_ERROR'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
