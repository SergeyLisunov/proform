import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  streamOllamaChat, isOllamaConfigured, OllamaError,
  type OllamaChatMessage,
} from '@/lib/ai/ollama'
import { enforceAiRateLimit } from '@/lib/ai/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Бюджет 60с: auth+контекст-запросы (~1-2с) + TTFT/prompt-eval Ollama +
// генерация (num_predict=500 при худших 17 ток/с ≈ 29с). Жёсткая граница —
// дедлайн апстрима 50с внутри streamOllamaChat: по нему стрим закрывается
// МЯГКО (частичный текст с чистым концом), а не убивается платформой.
export const maxDuration = 60

/**
 * POST /api/ai/chat — стриминговый чат-ассистент на Gemma 4 (Ollama Cloud).
 *
 * Замена /api/ai/ask для виджета и страницы /ai: тот же контекст атлета
 * (профиль + 30 дней тренировок + заметки, read-only), но ответ уходит
 * стримом чистого текста (chunked text/plain) — без стрима 200+ токенов
 * идут >13 секунд в пустоту.
 *
 * Ошибки ДО первого байта — обычный JSON {ok:false,error:"человеческое"}:
 * клиент различает по Content-Type. Обрыв посреди стрима клиент
 * показывает как усечённый ответ с пометкой.
 */
// Обрезаем, а НЕ отклоняем: длинный ответ ассистента, вернувшийся в
// history, не должен ломать следующие отправки. Потолки = то, что реально
// шлёт наш UI (slice(-8)); всё сверх — оплачиваемый токен-бюджет общей
// подписки Ollama, который скриптовый клиент мог бы выжигать.
const MessageSchema = z.object({
  role:    z.enum(['user', 'assistant']),
  content: z.string().transform(s => s.slice(0, 2500)),
})

const HISTORY_TOTAL_CHARS = 10_000

const BodySchema = z.object({
  question: z.string().min(1).transform(s => s.slice(0, 2000)),
  history:  z.array(MessageSchema).max(8).optional(),
})

/** Суммарный потолок истории: режем СТАРЕЙШИЕ, свежий контекст ценнее. */
function capHistoryTotal(history: { role: 'user' | 'assistant'; content: string }[]) {
  let total = 0
  const kept: typeof history = []
  for (let i = history.length - 1; i >= 0; i--) {
    total += history[i].content.length
    if (total > HISTORY_TOTAL_CHARS) break
    kept.unshift(history[i])
  }
  return kept
}

export async function POST(req: Request) {
  if (!isOllamaConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'AI-ассистент не настроен (нет OLLAMA_API_KEY).' },
      { status: 503 },
    )
  }

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ ok: false, error: 'Некорректный запрос.' }, { status: 400 })
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) {
    return NextResponse.json({ ok: false, error: 'Войдите в аккаунт.' }, { status: 401 })
  }
  const { data: me } = await sb
    .from('users')
    .select('id, name, role, sport')
    .eq('auth_id', auth.user.id)
    .maybeSingle()
  if (!me) {
    return NextResponse.json({ ok: false, error: 'Профиль не найден.' }, { status: 404 })
  }
  const meRow = me as { id: string; name: string | null; role: string | null; sport: string | null }

  // Свой rate limit ПЕРЕД обращением к Ollama: эндпоинт открыт наружу,
  // подписочный лимит облака конечен. 30/час на пользователя (как ask).
  const limited = await enforceAiRateLimit(req, sb, 'chat', 30, 3600)
  if (limited) {
    // Человеческое сообщение вместо машинного кода (виджет показывает
    // error как есть); Retry-After сохраняем.
    return NextResponse.json(
      { ok: false, error: 'Лимит AI-запросов исчерпан — попробуйте через час.' },
      { status: 429, headers: { 'Retry-After': limited.headers.get('Retry-After') ?? '3600' } },
    )
  }

  // Контекст атлета — те же read-only запросы, что у /api/ai/ask.
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

  const system = [
    'Ты — AI-ассистент спортивной платформы Sporteo.',
    'Отвечай на русском, по делу, НЕ ДЛИННЕЕ ~300 слов.',
    'Используй markdown умеренно: жирный, списки, `код` — без таблиц.',
    'Используй данные атлета, чтобы отвечать конкретно; если данных не хватает — прямо скажи.',
    'Ты НЕ врач: при симптомах травм или болезни советуй обратиться к специалисту, диагнозы не ставь.',
    `Профиль: имя ${meRow.name ?? 'атлет'}, роль ${meRow.role ?? 'athlete'}, вид спорта ${meRow.sport ?? 'не указан'}.`,
  ].join('\n')

  const contextBlock = [
    `Последние тренировки (${workouts.length}):\n${JSON.stringify(workouts).slice(0, 4500)}`,
    notes.length > 0 ? `Заметки (${notes.length}):\n${JSON.stringify(notes).slice(0, 1500)}` : '',
  ].filter(Boolean).join('\n')

  const messages: OllamaChatMessage[] = [
    { role: 'system', content: `${system}\n\nДанные атлета:\n${contextBlock}` },
    ...capHistoryTotal((body.history ?? []).slice(-8)),
    { role: 'user', content: body.question },
  ]

  try {
    const stream = await streamOllamaChat(messages, {
      signal:     req.signal, // обрыв клиента/«Остановить» гасит и апстрим
      numPredict: 500,        // ≈300 русских слов — согласовано с промптом
      deadlineMs: 50_000,
    })
    return new Response(stream, {
      headers: {
        'Content-Type':      'text/plain; charset=utf-8',
        'Cache-Control':     'no-store',
        // Hostiman/nginx: не буферизовать — чанки должны уходить сразу.
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err: unknown) {
    if (err instanceof OllamaError) {
      const map: Record<string, { status: number; msg: string }> = {
        OLLAMA_NOT_CONFIGURED: { status: 503, msg: 'AI-ассистент не настроен.' },
        OLLAMA_KEY_INVALID:    { status: 503, msg: 'AI временно недоступен (ключ API отклонён).' },
        OLLAMA_RATE_LIMITED:   { status: 429, msg: 'AI перегружен — попробуйте через минуту.' },
        OLLAMA_UPSTREAM:       { status: 502, msg: 'AI временно недоступен — попробуйте ещё раз.' },
      }
      const m = map[err.code] ?? map.OLLAMA_UPSTREAM
      console.warn('[ai-chat]', err.code, err.message)
      return NextResponse.json({ ok: false, error: m.msg }, { status: m.status })
    }
    if (err instanceof Error && err.name === 'AbortError') {
      return new Response(null, { status: 499 })
    }
    console.error('[ai-chat] unexpected:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { ok: false, error: 'AI временно недоступен — попробуйте ещё раз.' },
      { status: 500 },
    )
  }
}
