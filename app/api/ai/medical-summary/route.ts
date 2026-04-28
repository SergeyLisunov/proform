import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { aiObject, isAiConfigured, AI_MODEL_SMART } from '@/lib/ai/claude'
import { enforceAiRateLimit } from '@/lib/ai/rate-limit'

export const runtime = 'nodejs'

const SummarySchema = z.object({
  overview:     z.string().max(400).describe('Медицинское резюме на русском — что важно врачу знать о состоянии спортсмена'),
  key_findings: z.array(z.string().max(180)).max(5).describe('До 5 ключевых находок'),
  risks:        z.array(z.string().max(180)).max(4).describe('Потенциальные медицинские риски'),
  recommendations: z.array(z.string().max(180)).max(4).describe('Рекомендации на ближайшие 2 недели'),
})

export async function GET(req: Request) {
  if (!isAiConfigured()) {
    return NextResponse.json({ ok: false, error: 'AI_NOT_CONFIGURED' }, { status: 503 })
  }

  const url = new URL(req.url)
  const athleteId = url.searchParams.get('athlete_id')
  if (!athleteId) return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 })

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const { data: me } = await sb.from('users').select('id, role').eq('auth_id', auth.user.id).maybeSingle()
  if (!me) return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })
  const meRow = me as { id: string; role: string | null }
  if (meRow.role !== 'doctor' && meRow.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 })
  }

  // Doctor must have an active doctor_athlete connection with this athlete.
  // Admin bypasses (full-access role). Without this check any doctor could pull
  // any athlete's full workout/HRV/medical history.
  if (meRow.role === 'doctor') {
    const { data: link } = await sb
      .from('connections')
      .select('id')
      .eq('connection_type', 'doctor_athlete')
      .eq('status', 'active')
      .or(
        `and(initiator_id.eq.${meRow.id},recipient_id.eq.${athleteId}),` +
        `and(initiator_id.eq.${athleteId},recipient_id.eq.${meRow.id})`
      )
      .maybeSingle()
    if (!link) {
      return NextResponse.json({ ok: false, error: 'NO_PATIENT_RELATIONSHIP' }, { status: 403 })
    }
  }

  const limited = await enforceAiRateLimit(req, sb, 'medical-summary', 10, 3600)
  if (limited) return limited

  // Default period: last 30 days
  const sinceParam = url.searchParams.get('from')
  const untilParam = url.searchParams.get('to')
  const since = sinceParam ?? (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) })()
  const until = untilParam ?? new Date().toISOString().slice(0, 10)

  const { data: workouts } = await sb
    .from('workouts')
    .select('event_date, activity_type, activity_duration_min, activity_strain, avg_heart_rate, max_heart_rate, recovery_score, hrv, mood, coach_mark, risk_flag, name, description')
    .eq('athlete_id', athleteId)
    .gte('event_date', since)
    .lte('event_date', until)
    .order('event_date', { ascending: false })

  const rows = workouts ?? []
  if (rows.length === 0) {
    return NextResponse.json({
      ok: true,
      data: {
        overview: 'За выбранный период тренировки не зарегистрированы.',
        key_findings: [],
        risks: [],
        recommendations: ['Рекомендуется обсудить со спортсменом отсутствие активности.'],
      },
    })
  }

  try {
    const summary = await aiObject({
      schema: SummarySchema,
      model: AI_MODEL_SMART,
      system: 'Ты врач спортивной медицины. Формируешь медицинское резюме для коллеги-врача по данным тренировок атлета. Отвечай на русском, по делу, избегай общих фраз. JSON.',
      prompt: [
        `Период: ${since} — ${until}.`,
        `Всего тренировок: ${rows.length}.`,
        `Данные (новые сверху):`,
        JSON.stringify(rows).slice(0, 7000),
      ].join('\n'),
      maxTokens: 1600,
    })

    return NextResponse.json({ ok: true, data: summary })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI_ERROR'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
