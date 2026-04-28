import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { aiText, isAiConfigured, AI_MODEL_FAST } from '@/lib/ai/claude'
import { enforceAiRateLimit } from '@/lib/ai/rate-limit'

export const runtime = 'nodejs'

const MessageSchema = z.object({
  role:    z.enum(['user', 'assistant']),
  content: z.string().max(4000),
})

const BodySchema = z.object({
  question: z.string().min(1).max(2000),
  history:  z.array(MessageSchema).max(20).optional(),
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
  const { data: me } = await sb.from('users').select('id, name, role, sport_type').eq('auth_id', auth.user.id).maybeSingle()
  if (!me) return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })
  const meRow = me as { id: string; name: string | null; role: string | null; sport_type: string | null }

  const limited = await enforceAiRateLimit(req, sb, 'ask', 30, 3600)
  if (limited) return limited

  const since = new Date(); since.setDate(since.getDate() - 30)
  const sinceStr = since.toISOString().slice(0, 10)

  const [workoutsRes, notesRes] = await Promise.all([
    sb.from('workouts')
      .select('event_date, activity_type, activity_duration_min, activity_strain, avg_heart_rate, max_heart_rate, recovery_score, hrv, mood, name, description')
      .eq('athlete_id', meRow.id)
      .gte('event_date', sinceStr)
      .order('event_date', { ascending: false })
      .limit(40),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb as any).from('notes')
      .select('note_date, title, content')
      .eq('user_id', meRow.id)
      .eq('is_deleted', false)
      .order('note_date', { ascending: false })
      .limit(15),
  ])

  const workouts = workoutsRes.data ?? []
  const notes    = (notesRes as { data: { note_date: string; title: string | null; content: string }[] | null }).data ?? []

  const historyTxt = (body.history ?? [])
    .slice(-8)
    .map(m => `${m.role === 'user' ? 'Атлет' : 'Ассистент'}: ${m.content}`)
    .join('\n')

  const system = [
    'Ты персональный AI-ассистент атлета в приложении ProForm.',
    'Отвечай кратко, по делу, на русском. Используй данные атлета чтобы отвечать конкретно, а не обобщённо.',
    'Если у атлета не хватает данных для ответа — прямо скажи об этом.',
    'Ты НЕ врач. При симптомах травм/болезни — советуй обратиться к специалисту.',
    `Профиль: имя ${meRow.name ?? 'атлет'}, роль ${meRow.role ?? 'athlete'}, вид спорта ${meRow.sport_type ?? 'не указан'}.`,
  ].join('\n')

  const prompt = [
    historyTxt ? `История диалога:\n${historyTxt}\n` : '',
    `Последние тренировки (${workouts.length}):\n${JSON.stringify(workouts).slice(0, 4500)}`,
    notes.length > 0 ? `Заметки (${notes.length}):\n${JSON.stringify(notes).slice(0, 1500)}` : '',
    '',
    `Вопрос атлета: ${body.question}`,
  ].filter(Boolean).join('\n')

  try {
    const answer = await aiText({
      system,
      prompt,
      model: AI_MODEL_FAST,
      maxTokens: 800,
    })
    return NextResponse.json({ ok: true, answer })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI_ERROR'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
