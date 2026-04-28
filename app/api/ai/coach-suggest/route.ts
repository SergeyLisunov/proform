import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { aiObject, isAiConfigured } from '@/lib/ai/claude'
import { enforceAiRateLimit } from '@/lib/ai/rate-limit'

export const runtime = 'nodejs'

const SuggestionSchema = z.object({
  headline:    z.string().max(80).describe('Короткий заголовок на русском (например, «Лёгкий восстановительный бег»)'),
  activity:    z.enum(['Бег', 'Велоспорт', 'Плавание', 'Силовые', 'Ходьба', 'Отдых', 'Другое']),
  duration_min:z.number().int().min(0).max(240),
  intensity:   z.enum(['rest', 'easy', 'moderate', 'hard', 'peak']),
  rationale:   z.string().max(280).describe('2–3 предложения на русском: почему именно это сегодня'),
  readiness:   z.number().int().min(0).max(100).describe('Оценка готовности к нагрузке 0–100'),
  tips:        z.array(z.string().max(120)).max(3).describe('До 3 коротких советов'),
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

  const limited = await enforceAiRateLimit(req, sb, 'coach-suggest', 20, 3600)
  if (limited) return limited

  const since = new Date(); since.setDate(since.getDate() - 14)
  const sinceStr = since.toISOString().slice(0, 10)

  const { data: workouts } = await sb
    .from('workouts')
    .select('event_date, activity_type, activity_duration_min, activity_strain, avg_heart_rate, recovery_score, hrv, name')
    .eq('athlete_id', (me as { id: string }).id)
    .gte('event_date', sinceStr)
    .order('event_date', { ascending: false })
    .limit(20)

  const recent = (workouts ?? []).map(w => ({
    date:     w.event_date,
    type:     w.activity_type,
    min:      w.activity_duration_min,
    strain:   w.activity_strain,
    hr:       w.avg_heart_rate,
    recovery: w.recovery_score,
    hrv:      w.hrv,
    name:     w.name,
  }))

  const lastRecovery = recent.find(r => r.recovery != null)?.recovery ?? null
  const lastHrv      = recent.find(r => r.hrv != null)?.hrv ?? null
  const weekStrain   = recent
    .filter(r => r.date && r.date >= sinceStr)
    .reduce((s, r) => s + (Number(r.strain) || 0), 0)

  try {
    const suggestion = await aiObject({
      schema: SuggestionSchema,
      system: 'Ты опытный тренер по выносливости. Отвечай кратко, на русском, в формате JSON.',
      prompt: [
        'Дай рекомендацию на завтра для атлета на основе последних 14 дней.',
        `Сегодняшняя готовность (recovery): ${lastRecovery ?? 'нет данных'}.`,
        `HRV (мс): ${lastHrv ?? 'нет данных'}.`,
        `Сумма strain за 7 дней: ${weekStrain.toFixed(1)}.`,
        `История (новые сверху): ${JSON.stringify(recent).slice(0, 4000)}`,
        'Избегай предлагать жёсткие интервалы при recovery < 50 или после двух тяжёлых дней подряд.',
      ].join('\n'),
      maxTokens: 600,
    })

    return NextResponse.json({ ok: true, data: suggestion })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI_ERROR'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
