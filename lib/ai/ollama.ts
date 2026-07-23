/**
 * Ollama Cloud client — Gemma 4 для чат-ассистента (server-only).
 *
 * Факты API (проверены вживую, не перепроверять):
 *   - нативный endpoint POST https://ollama.com/api/chat;
 *   - авторизация `Authorization: Bearer ${OLLAMA_API_KEY}`;
 *   - модель СТРОГО 'gemma4:31b' (алиас gemma4:cloud может молча
 *     переехать на другую версию — не использовать);
 *   - стрим NDJSON: {"message":{"content":"..."},"done":false} по
 *     строке на чанк, финальная {"done":true};
 *   - служебных thinking-тегов в выводе нет, чистить нечего;
 *   - рекомендованный сэмплинг: temperature 1.0 (НЕ занижать —
 *     норма для этой модели), top_p 0.95, top_k 64;
 *   - тарификация подписочная с лимитами по частоте → возможен 429.
 *
 * Ключ OLLAMA_API_KEY — только сервер, никогда NEXT_PUBLIC_*.
 */

const OLLAMA_CHAT_URL = 'https://ollama.com/api/chat'
/** Строго закреплённая версия; env-override только для осознанной смены. */
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'gemma4:31b'

export type OllamaErrorCode =
  | 'OLLAMA_NOT_CONFIGURED'
  | 'OLLAMA_KEY_INVALID'
  | 'OLLAMA_RATE_LIMITED'
  | 'OLLAMA_UPSTREAM'

export class OllamaError extends Error {
  readonly code: OllamaErrorCode
  constructor(code: OllamaErrorCode, message?: string) {
    super(message ?? code)
    this.code = code
  }
}

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export function isOllamaConfigured(): boolean {
  return !!process.env.OLLAMA_API_KEY
}

interface StreamOpts {
  /** Проброс отмены (обрыв клиента / кнопка «Остановить»). */
  signal?: AbortSignal
  /** Жёсткий потолок токенов ответа (защита maxDuration роута). */
  numPredict?: number
  /**
   * Дедлайн всего апстрим-запроса, мс (дефолт 50с — с запасом внутри
   * maxDuration=60 роута). По дедлайну стрим закрывается МЯГКО (клиент
   * получает частичный текст с чистым концом), а не убивается платформой;
   * заодно защищает от зависшего сокета Ollama, который иначе держал бы
   * serverless-функцию все 60 оплачиваемых секунд.
   */
  deadlineMs?: number
}

interface OllamaChunk {
  message?: { content?: string }
  done?: boolean
  error?: string
}

/**
 * Стриминговый чат: возвращает ReadableStream ЧИСТОГО ТЕКСТА
 * (UTF-8 байты), уже распарсенного из NDJSON апстрима. Ошибки ДО
 * первого байта — типизированный OllamaError (роут превратит в JSON);
 * ошибка посреди стрима завершает поток (клиент видит усечённый ответ).
 */
export async function streamOllamaChat(
  messages: OllamaChatMessage[],
  opts: StreamOpts = {},
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OLLAMA_API_KEY
  if (!apiKey) throw new OllamaError('OLLAMA_NOT_CONFIGURED')

  const deadline = AbortSignal.timeout(opts.deadlineMs ?? 50_000)
  const signal = opts.signal ? AbortSignal.any([opts.signal, deadline]) : deadline

  let upstream: Response
  try {
    upstream = await fetch(OLLAMA_CHAT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:  OLLAMA_MODEL,
        stream: true,
        messages,
        options: {
          temperature: 1.0,
          top_p:       0.95,
          top_k:       64,
          ...(opts.numPredict ? { num_predict: opts.numPredict } : {}),
        },
      }),
      signal,
    })
  } catch (e) {
    if (deadline.aborted && !opts.signal?.aborted) {
      // Дедлайн до первого байта — апстрим завис/перегружен.
      throw new OllamaError('OLLAMA_UPSTREAM', 'upstream deadline before first byte')
    }
    if (e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError')) throw e
    throw new OllamaError('OLLAMA_UPSTREAM', e instanceof Error ? e.message : 'fetch failed')
  }

  if (!upstream.ok) {
    const detail = (await upstream.text().catch(() => '')).slice(0, 300)
    if (upstream.status === 401 || upstream.status === 403) {
      throw new OllamaError('OLLAMA_KEY_INVALID', detail)
    }
    if (upstream.status === 429) {
      throw new OllamaError('OLLAMA_RATE_LIMITED', detail)
    }
    throw new OllamaError('OLLAMA_UPSTREAM', `HTTP ${upstream.status}: ${detail}`)
  }
  if (!upstream.body) throw new OllamaError('OLLAMA_UPSTREAM', 'empty response body')

  const reader  = upstream.body.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          // Апстрим закрылся без {"done":true} — отдаём, что есть.
          controller.close()
          return
        }
        buffer += decoder.decode(value, { stream: true })
        // NDJSON: по JSON-объекту на строку; последняя может быть неполной.
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          let chunk: OllamaChunk
          try {
            chunk = JSON.parse(trimmed) as OllamaChunk
          } catch {
            continue // мусорная строка — пропускаем, не роняя стрим
          }
          if (chunk.error) {
            controller.error(new OllamaError('OLLAMA_UPSTREAM', chunk.error))
            await reader.cancel().catch(() => {})
            return
          }
          const text = chunk.message?.content
          if (text) controller.enqueue(encoder.encode(text))
          if (chunk.done) {
            controller.close()
            await reader.cancel().catch(() => {})
            return
          }
        }
      } catch (e) {
        if (deadline.aborted && !opts.signal?.aborted) {
          // Дедлайн посреди генерации — осознанное усечение: закрываем
          // мягко, клиент получает частичный текст с чистым концом.
          try { controller.close() } catch { /* уже закрыт */ }
        } else {
          controller.error(e)
        }
        await reader.cancel().catch(() => {})
      }
    },
    async cancel() {
      await reader.cancel().catch(() => {})
    },
  })
}
