import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { aiObject, isAiConfigured, AI_MODEL_SMART } from '@/lib/ai/gemma'
import { enforceAiRateLimit } from '@/lib/ai/rate-limit'
import { enforcePlanForAi } from '@/lib/ai/plan-gate'

export const runtime = 'nodejs'

// Бюджет функции на Vercel. Обёртка Gemma (lib/ai/gemma.ts) держит общий
// дедлайн вызова 45 с и при провале валидации делает одну ремонтную попытку —
// это рассчитано на maxDuration=60. Без явного значения платформа даёт свой
// умолчательный лимит, он МЕНЬШЕ, и функция умирает раньше собственного
// дедлайна: watchdog внутри клиента не успевает отработать, а пользователь
// получает обрыв вместо понятной ошибки.
export const maxDuration = 60


const AthleteItemSchema = z.object({
  athlete_id: z.string(),
  name:       z.string(),
  status:     z.enum(['ok', 'watch', 'risk']).describe('Зелёный/жёлтый/красный светофор'),
  headline:   z.string().max(120).describe('Одна фраза — что сейчас происходит с атлетом'),
  action:     z.string().max(160).describe('Что тренеру сделать сегодня'),
})

const BriefingSchema = z.object({
  overall:  z.string().max(320).describe('2–3 предложения о состоянии команды'),
  athletes: z.array(AthleteItemSchema).max(20),
  priorities: z.array(z.string().max(120)).max(3).describe('До 3 главных приоритетов на день'),
})

export async function GET(req: Request) {
  if (!isAiConfigured()) {
    return NextResponse.json({ ok: false, error: 'AI_NOT_CONFIGURED' }, { status: 503 })
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const { data: me } = await sb.from('users').select('id, role').eq('auth_id', auth.user.id).maybeSingle()
  if (!me) return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })
  const meRow = me as { id: string; role: string | null }
  if (meRow.role !== 'coach') {
    return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 })
  }

  const gated = await enforcePlanForAi(sb, meRow.id, meRow.role, {
    feature: 'coach_briefing',
    requiredPlan: 'pro',
  })
  if (gated) return gated

  const limited = await enforceAiRateLimit(req, sb, 'coach-briefing', 10, 3600)
  if (limited) return limited

  // Coach's athletes — prefer trainer_athletes mapping; fallback to athletes with role=athlete
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: links } = await (sb as any)
    .from('trainer_athletes')
    .select('athlete_id')
    .eq('trainer_id', meRow.id)

  let athleteIds: string[] = Array.isArray(links) ? links.map((l: { athlete_id: string }) => l.athlete_id) : []

  if (athleteIds.length === 0) {
    const { data: all } = await sb.from('users').select('id').eq('role', 'athlete').limit(12)
    athleteIds = (all ?? []).map((u: { id: string }) => u.id)
  }
  if (athleteIds.length === 0) {
    return NextResponse.json({ ok: true, data: { overall: 'Пока нет атлетов в команде.', athletes: [], priorities: [] } })
  }
  athleteIds = athleteIds.slice(0, 12)

  const { data: users } = await sb.from('users').select('id, name').in('id', athleteIds)
  const nameMap = new Map<string, string>((users ?? []).map((u: { id: string; name: string | null }) => [u.id, u.name ?? 'Атлет']))

  const since = new Date(); since.setDate(since.getDate() - 7)
  const sinceStr = since.toISOString().slice(0, 10)

  const { data: workouts } = await sb
    .from('workouts')
    .select('athlete_id, event_date, activity_type, activity_duration_min, activity_strain, avg_heart_rate, recovery_score, hrv, mood, coach_mark, name')
    .in('athlete_id', athleteIds)
    .gte('event_date', sinceStr)
    .order('event_date', { ascending: false })

  const byAthlete = new Map<string, unknown[]>()
  athleteIds.forEach(id => byAthlete.set(id, []))
  ;(workouts ?? []).forEach(w => {
    const id = (w as { athlete_id: string }).athlete_id
    const arr = byAthlete.get(id) ?? []
    arr.push(w)
    byAthlete.set(id, arr)
  })

  const athleteSummaries = athleteIds.map(id => ({
    athlete_id: id,
    name: nameMap.get(id) ?? 'Атлет',
    workouts: byAthlete.get(id) ?? [],
  }))

  try {
    const briefing = await aiObject({
      schema: BriefingSchema,
      model: AI_MODEL_SMART,
      system: 'Ты опытный главный тренер. Даёшь утренний брифинг по команде. Отвечай на русском, кратко и предметно.',
      prompt: [
        `Утренний брифинг по ${athleteIds.length} атлетам.`,
        'Для каждого оцени состояние светофором (ok/watch/risk), напиши одну фразу про текущее состояние и конкретное действие для тренера на сегодня.',
        'Данные за последние 7 дней (новые сверху):',
        JSON.stringify(athleteSummaries).slice(0, 8000),
        'Помечай risk, если: recovery < 40, или 3+ тяжёлых дня подряд, или coach_mark=risk.',
      ].join('\n'),
      maxTokens: 1400,
    })

    return NextResponse.json({ ok: true, data: briefing })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI_ERROR'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
