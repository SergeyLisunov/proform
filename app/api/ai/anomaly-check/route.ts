import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { aiObject, isAiConfigured } from '@/lib/ai/claude'
import { enforceAiRateLimit } from '@/lib/ai/rate-limit'

export const runtime = 'nodejs'

const AlertSchema = z.object({
  severity: z.enum(['info', 'warning', 'critical']).describe('info: к сведению, warning: требует внимания, critical: нужен отдых/врач'),
  type:     z.enum(['recovery', 'hrv', 'strain', 'load', 'hr', 'mood', 'pattern']).describe('Категория аномалии'),
  title:    z.string().max(80),
  detail:   z.string().max(200),
  action:   z.string().max(140).describe('Что предпринять сегодня/на ближайшие дни'),
})

const ResponseSchema = z.object({
  overall_status: z.enum(['green', 'yellow', 'red']),
  summary:        z.string().max(200),
  alerts:         z.array(AlertSchema).max(5),
})

export async function GET() {
  if (!isAiConfigured()) {
    return NextResponse.json({ ok: false, error: 'AI_NOT_CONFIGURED' }, { status: 503 })
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const { data: me } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  if (!me) return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })

  const limited = await enforceAiRateLimit(sb, 'anomaly-check', 20, 3600)
  if (limited) return limited

  const since = new Date(); since.setDate(since.getDate() - 21)
  const sinceStr = since.toISOString().slice(0, 10)

  const { data: workouts } = await sb
    .from('workouts')
    .select('event_date, activity_type, activity_duration_min, activity_strain, avg_heart_rate, max_heart_rate, recovery_score, hrv, mood')
    .eq('athlete_id', (me as { id: string }).id)
    .gte('event_date', sinceStr)
    .order('event_date', { ascending: false })
    .limit(40)

  const rows = workouts ?? []
  if (rows.length < 3) {
    return NextResponse.json({
      ok: true,
      data: {
        overall_status: 'green',
        summary: 'Пока мало данных для анализа аномалий — продолжай тренироваться.',
        alerts: [],
      },
    })
  }

  try {
    const result = await aiObject({
      schema: ResponseSchema,
      system: 'Ты спортивный физиолог. Находишь аномалии в данных атлета и даёшь конкретные рекомендации. Отвечай на русском. JSON.',
      prompt: [
        'Проанализируй последние 21 день тренировок. Найди до 5 значимых аномалий.',
        'Примеры аномалий: падение HRV на 20%+, recovery<40 подряд 2+ дня, резкий рост strain, необычно высокий пульс при привычной нагрузке, пропадание восстановительных дней, скачки настроения вниз.',
        'Формулируй кратко и по делу. severity: info/warning/critical. overall_status: green/yellow/red.',
        `Данные (новые сверху): ${JSON.stringify(rows).slice(0, 6000)}`,
      ].join('\n'),
      maxTokens: 1200,
    })

    return NextResponse.json({ ok: true, data: result })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI_ERROR'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
