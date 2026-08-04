import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { aiObject, isAiConfigured } from '@/lib/ai/gemma'
import { enforceAiRateLimit } from '@/lib/ai/rate-limit'
import { enforcePlanForAi } from '@/lib/ai/plan-gate'
import { computeCoachAthletesAcwr } from '@/services/acwr.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/ai/adaptive-plan/[athleteId]
 * Тренер → Gemma анализирует ACWR атлета + статус последних
 * назначенных тренировок и предлагает корректировку плана на
 * ближайшие 7 дней.
 */

const SuggestionSchema = z.object({
  workout_id: z.string().uuid(),
  current_summary: z.string().max(160),
  proposed_action: z.enum([
    'reduce_volume',       // Сократить длительность/объём
    'lower_intensity',     // Снизить интенсивность
    'make_recovery',       // Превратить в восстановительную
    'reschedule',          // Перенести на другой день
    'delete',              // Отменить
    'keep',                // Оставить как есть
  ]),
  new_duration_min: z.number().int().min(0).max(600).nullable(),
  new_description: z.string().max(400).nullable(),
  rationale: z.string().max(200),
})

const AdaptivePlanSchema = z.object({
  reason: z.enum(['acwr_danger', 'acwr_monitor', 'skip_streak', 'low_recovery', 'ok']),
  overview: z.string().max(320),
  suggestions: z.array(SuggestionSchema).max(10),
  team_focus_next_week: z.string().max(200),
})

export async function GET(req: Request, props: { params: Promise<{ athleteId: string }> }) {
  const params = await props.params;
  if (!isAiConfigured()) {
    return NextResponse.json({ ok: false, error: 'AI_NOT_CONFIGURED' }, { status: 503 })
  }
  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  const { data: me } = await sb.from('users').select('id, role').eq('auth_id', auth.user.id).maybeSingle()
  const meRow = me as { id: string; role: string } | null
  if (!meRow) return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })
  if (meRow.role !== 'coach') return NextResponse.json({ ok: false, error: 'COACH_ONLY' }, { status: 403 })

  // Связь тренер↔атлет
  const { data: linkRaw } = await sb.from('trainer_athletes')
    .select('athlete_id').eq('trainer_id', meRow.id).eq('athlete_id', params.athleteId)
    .eq('status', 'accepted').maybeSingle()
  if (!linkRaw) return NextResponse.json({ ok: false, error: 'NOT_LINKED' }, { status: 403 })

  const gated = await enforcePlanForAi(sb, meRow.id, meRow.role, {
    feature: 'adaptive_plan',
    requiredPlan: 'pro',
  })
  if (gated) return gated

  const limited = await enforceAiRateLimit(req, sb, 'adaptive-plan', 10, 3600)
  if (limited) return limited

  // ACWR конкретного атлета
  const allAcwr = await computeCoachAthletesAcwr(meRow.id)
  const athleteAcwr = allAcwr.find(a => a.athlete_id === params.athleteId)

  // Назначенные тренировки +/- 14 дней
  const today = new Date().toISOString().slice(0, 10)
  const in7   = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const from14 = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
  const { data: upcomingRaw } = await sb
    .from('workouts')
    .select('id, event_date, activity_type, name, description, activity_duration_min, completion_status')
    .eq('athlete_id', params.athleteId)
    .eq('prescribed_by', meRow.id)
    .gte('event_date', today)
    .lte('event_date', in7)
    .order('event_date', { ascending: true })
    .limit(15)
  const { data: pastRaw } = await sb
    .from('workouts')
    .select('id, event_date, name, completion_status')
    .eq('athlete_id', params.athleteId)
    .eq('prescribed_by', meRow.id)
    .gte('event_date', from14)
    .lt('event_date', today)
    .order('event_date', { ascending: false })
    .limit(10)

  const upcoming = (upcomingRaw ?? []) as Array<{
    id: string; event_date: string; activity_type: string | null
    name: string | null; description: string | null
    activity_duration_min: number | null; completion_status: string | null
  }>
  const past = (pastRaw ?? []) as Array<{ id: string; event_date: string; name: string | null; completion_status: string | null }>

  // Скип-стрик: подряд skipped с конца
  let skipStreak = 0
  for (const w of past) {
    if (w.completion_status === 'skipped') skipStreak++
    else break
  }

  // Avg recovery последние 7 дней (daily_metrics)
  const from7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const { data: metricsRaw } = await sb.from('daily_metrics')
    .select('recovery_score').eq('athlete_id', params.athleteId).gte('date', from7)
  const recVals = ((metricsRaw ?? []) as Array<{ recovery_score: number | null }>)
    .map(m => m.recovery_score).filter((v): v is number => typeof v === 'number')
  const avgRecovery = recVals.length > 0
    ? Math.round(recVals.reduce((s, v) => s + v, 0) / recVals.length)
    : null

  // Если нет назначенных тренировок — возвращаем пустой план без AI-вызова.
  if (upcoming.length === 0) {
    return NextResponse.json({
      ok: true,
      data: {
        reason: 'ok',
        overview: 'Назначенных тренировок на ближайшие 7 дней нет.',
        suggestions: [],
        team_focus_next_week: 'Запланируйте 2–3 сессии на следующую неделю.',
      },
      context: { acwr: athleteAcwr?.acwr ?? null, skipStreak, avgRecovery },
    })
  }

  // Определим предварительный triggering reason — чтобы модель не фантазировала.
  let reason: 'acwr_danger' | 'acwr_monitor' | 'skip_streak' | 'low_recovery' | 'ok' = 'ok'
  if (athleteAcwr?.zone === 'danger')    reason = 'acwr_danger'
  else if (skipStreak >= 2)              reason = 'skip_streak'
  else if (avgRecovery != null && avgRecovery < 40) reason = 'low_recovery'
  else if (athleteAcwr?.zone === 'monitor') reason = 'acwr_monitor'

  try {
    const plan = await aiObject({
      schema: AdaptivePlanSchema,
      system: [
        'Ты опытный тренер по выносливости. Пиши коротко, на русском, по делу.',
        'По каждой предстоящей тренировке предложи одно конкретное действие из enum.',
        'Если reason=ok — ставь большинству "keep" с короткой причиной.',
        'Если reason=acwr_danger — минимум половину предложений должно быть',
        '"reduce_volume" (−30–40%), "lower_intensity" или "make_recovery".',
        'new_description — пиши ЧТО именно поменять, не обоснование (обоснование в rationale).',
      ].join(' '),
      prompt: [
        `Контекст атлета:`,
        `- ACWR: ${athleteAcwr?.acwr ?? 'нет данных'} (зона: ${athleteAcwr?.zone ?? '—'})`,
        `- Тренировок за 28 дней: ${athleteAcwr?.workouts_28d ?? '—'}`,
        `- Средний recovery за 7 дней: ${avgRecovery ?? '—'}%`,
        `- Пропущенных подряд тренировок: ${skipStreak}`,
        ``,
        `Триггер для адаптации: ${reason}`,
        ``,
        `Предстоящие 7 дней (назначенные тренировки):`,
        JSON.stringify(upcoming, null, 2),
        ``,
        `Последние 14 дней (статус выполнения):`,
        JSON.stringify(past, null, 2),
      ].join('\n'),
      maxTokens: 2000,
    })

    // Безопасность: reason форсим тот, что мы посчитали сами.
    const safe = { ...plan, reason }

    return NextResponse.json({
      ok: true,
      data: safe,
      context: {
        acwr: athleteAcwr?.acwr ?? null,
        zone: athleteAcwr?.zone ?? null,
        skipStreak,
        avgRecovery,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI_ERROR'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
