/**
 * Клиентский сервис AI-помощника (browser-side, плавающий виджет).
 *
 * Только вызовы /api/assistant/* — никаких промптов, ролей и лимитов на
 * клиенте: всё решает сервер, клиент лишь отображает capabilities.
 */
import type {
  AssistantCapabilities, ConversationSummary, AssistantMessage, AssistantContextType,
} from './types'

export async function fetchCapabilities(): Promise<AssistantCapabilities | null> {
  const res = await fetch('/api/assistant/capabilities')
  const json = await res.json().catch(() => null) as { ok?: boolean; capabilities?: AssistantCapabilities } | null
  return json?.capabilities ?? null
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const res = await fetch('/api/assistant/conversations')
  const json = await res.json().catch(() => null) as { conversations?: ConversationSummary[] } | null
  return json?.conversations ?? []
}

export async function createConversation(opts?: {
  contextType?: AssistantContextType
  contextEntityId?: string
}): Promise<{ conversation?: ConversationSummary; error?: string }> {
  const res = await fetch('/api/assistant/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts ?? {}),
  })
  const json = await res.json().catch(() => null) as
    { ok?: boolean; conversation?: ConversationSummary; error?: string } | null
  if (!res.ok || !json?.conversation) {
    return { error: json?.error ?? 'Не удалось создать диалог.' }
  }
  return { conversation: json.conversation }
}

export async function fetchConversation(id: string): Promise<{
  messages: AssistantMessage[]
  error?: string
}> {
  const res = await fetch(`/api/assistant/conversations/${id}`)
  const json = await res.json().catch(() => null) as
    { messages?: AssistantMessage[]; error?: string } | null
  if (!res.ok) return { messages: [], error: json?.error ?? 'Диалог не найден.' }
  return { messages: json?.messages ?? [] }
}

export async function deleteConversation(id: string): Promise<boolean> {
  const res = await fetch(`/api/assistant/conversations/${id}`, { method: 'DELETE' })
  return res.ok
}

export interface SendResult {
  ok: boolean
  error?: string
  aborted?: boolean
  interrupted?: boolean
  /** Обновлённый остаток из заголовков не тянем — capabilities перезапросит вызывающий. */
}

/** Стриминговая отправка: ошибка до стрима = JSON, успех = text/plain чанки. */
export async function sendAssistantMessage(opts: {
  conversationId: string
  content: string
  signal: AbortSignal
  onChunk: (text: string) => void
}): Promise<SendResult> {
  let res: Response
  try {
    res = await fetch(`/api/assistant/conversations/${opts.conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: opts.content,
        // Idempotency-ключ отправки: сетевой ретрай того же запроса не
        // спишет лимит дважды (сервер ловит дубль по этому id).
        clientMessageId: crypto.randomUUID(),
      }),
      signal: opts.signal,
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return { ok: false, aborted: true }
    return { ok: false, error: 'Нет соединения — проверьте интернет.' }
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const json = await res.json().catch(() => null) as { error?: string } | null
    return { ok: false, error: json?.error ?? 'AI временно недоступен — попробуйте ещё раз.' }
  }
  if (!res.ok || !res.body) {
    return { ok: false, error: 'AI временно недоступен — попробуйте ещё раз.' }
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  /** Пришёл ли хоть один значащий символ: 200 с пустым телом — это отказ. */
  let hasText = false
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value, { stream: true })
      if (text) {
        hasText ||= text.trim().length > 0
        opts.onChunk(text)
      }
    }
    const tail = decoder.decode()
    if (tail) {
      hasText ||= tail.trim().length > 0
      opts.onChunk(tail)
    }
    // Провайдер закрыл стрим, не сказав ничего (штатный soft close по
    // idle-watchdog). Сервер такой ответ успехом не считает и квоту не
    // списывает — значит и пользователю нужна понятная ошибка, а не
    // молчаливо исчезнувший пустой пузырь.
    if (!hasText) return { ok: false, error: 'AI не ответил — попробуйте ещё раз.' }
    return { ok: true }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return { ok: false, aborted: true }
    return { ok: false, interrupted: true }
  }
}
