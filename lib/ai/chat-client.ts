/**
 * Клиентский хелпер стримингового чата — общий для AiChatBubble и /ai.
 *
 * Протокол /api/ai/chat: успех = chunked text/plain (куски ответа по
 * мере генерации), ошибка ДО стрима = JSON {ok:false,error} — различаем
 * по Content-Type. Обрыв посреди стрима отдаём флагом interrupted,
 * частичный текст у вызывающего уже есть через onChunk.
 */

export interface ChatStreamResult {
  ok: boolean
  /** Человекочитаемая ошибка (уже по-русски, из роута). */
  error?: string
  /** true, если пользователь нажал «Остановить» (AbortError). */
  aborted?: boolean
  /** true, если стрим оборвался посреди ответа (сеть/таймаут). */
  interrupted?: boolean
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function streamChat(opts: {
  question: string
  history: ChatHistoryMessage[]
  signal: AbortSignal
  onChunk: (text: string) => void
}): Promise<ChatStreamResult> {
  let res: Response
  try {
    // Клампы зеркалят серверные потолки (роут обрезает, а не отклоняет —
    // но не гоняем лишние килобайты по сети).
    res = await fetch('/api/ai/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        question: opts.question.slice(0, 2000),
        history:  opts.history.slice(-8).map(m => ({ ...m, content: m.content.slice(0, 2500) })),
      }),
      signal:  opts.signal,
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return { ok: false, aborted: true }
    return { ok: false, error: 'Нет соединения — проверьте интернет.' }
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    // Ошибка до старта стрима — человекочитаемый JSON из роута.
    const json = (await res.json().catch(() => null)) as { error?: string } | null
    return { ok: false, error: json?.error ?? 'AI временно недоступен — попробуйте ещё раз.' }
  }
  if (!res.ok || !res.body) {
    return { ok: false, error: 'AI временно недоступен — попробуйте ещё раз.' }
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value, { stream: true })
      if (text) opts.onChunk(text)
    }
    const tail = decoder.decode()
    if (tail) opts.onChunk(tail)
    return { ok: true }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return { ok: false, aborted: true }
    return { ok: false, interrupted: true }
  }
}
