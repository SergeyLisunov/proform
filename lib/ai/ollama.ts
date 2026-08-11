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
 *   - рекомендованный сэмплинг: temperature 1.0 (НЕ занижать —
 *     норма для этой модели), top_p 0.95, top_k 64;
 *   - тарификация подписочная с лимитами по частоте → возможен 429.
 *
 * УРОК ПРОДА (504 на Vercel, диагностировано метками): abort зависшего
 * body-read у рантаймового undici может НЕ прерывать чтение — таймеры,
 * завязанные на AbortController, молчат, функция живёт до maxDuration.
 * Поэтому вся защита построена на Promise.race, которому не нужен abort:
 *   - каждый read гоняется против idle-watchdog (нет данных N сек);
 *   - весь запрос — против общего дедлайна;
 * abort() при этом всё равно дёргается (пусть закроет сокет, если умеет),
 * но корректность от него не зависит.
 *
 * Ключ OLLAMA_API_KEY — только сервер, никогда NEXT_PUBLIC_*.
 */

/** env-override — ТОЛЬКО для интеграционных тестов парсера (см. *.test.ts). */
const OLLAMA_CHAT_URL = process.env.OLLAMA_CHAT_URL ?? 'https://ollama.com/api/chat'
/**
 * Строго закреплённая версия; env-override только для осознанной смены.
 * Экспортируется, чтобы обёртки (lib/ai/gemma) не дублировали литерал:
 * единственное место, где живёт имя модели, — здесь.
 */
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'gemma4:31b'

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
  /** Общий дедлайн запроса, мс (дефолт 45с < maxDuration=60 роутов). */
  deadlineMs?: number
  /** Максимальная пауза между чанками апстрима, мс (дефолт 20с). */
  idleMs?: number
  /**
   * Ollama-параметр `format`. 'json' включает constrained decoding до
   * синтаксически валидного JSON — нужен структурированным вызовам
   * (lib/ai/gemma → aiObject). По умолчанию не передаём вовсе, чтобы не
   * менять поведение чата: с format:'json' модель обязана начать с '{',
   * и обычный текстовый ответ сломается.
   *
   * ВАЖНО: format гарантирует только СИНТАКСИС. Соответствие нужной
   * форме (поля, enum'ы, диапазоны) обязан проверять вызывающий —
   * gemma.aiObject прогоняет ответ через ту же Zod-схему.
   */
  format?: 'json'
}

interface OllamaChunk {
  message?: { content?: string }
  done?: boolean
  error?: string
}

const IDLE_SENTINEL = Symbol('idle')

/** Гонка промиса против таймера — работает без прерывания промиса. */
function raceIdle<T>(p: Promise<T>, ms: number): Promise<T | typeof IDLE_SENTINEL> {
  let timer: ReturnType<typeof setTimeout>
  const idle = new Promise<typeof IDLE_SENTINEL>(resolve => {
    timer = setTimeout(() => resolve(IDLE_SENTINEL), ms)
  })
  return Promise.race([p, idle]).finally(() => clearTimeout(timer))
}

function buildBody(
  messages: OllamaChatMessage[],
  stream: boolean,
  numPredict?: number,
  format?: 'json',
): string {
  return JSON.stringify({
    model: OLLAMA_MODEL,
    stream,
    messages,
    // Ключ format отсутствует, если не запрошен явно — старые вызовы
    // отправляют ровно тот же body, что и до появления параметра.
    ...(format ? { format } : {}),
    options: {
      temperature: 1.0,
      top_p:       0.95,
      top_k:       64,
      ...(numPredict ? { num_predict: numPredict } : {}),
    },
  })
}

async function openUpstream(
  body: string,
  signal: AbortSignal,
): Promise<Response> {
  const apiKey = process.env.OLLAMA_API_KEY
  if (!apiKey) throw new OllamaError('OLLAMA_NOT_CONFIGURED')
  let upstream: Response
  try {
    upstream = await fetch(OLLAMA_CHAT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body,
      signal,
    })
  } catch (e) {
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
  return upstream
}

/**
 * НЕстриминговый чат (stream:false): один JSON-ответ целиком. Для
 * коротких ответов (demo) — минимальная поверхность отказов, никакого
 * построчного парсинга. Дедлайн — через raceIdle (abort-независимый).
 */
export async function ollamaChatOnce(
  messages: OllamaChatMessage[],
  opts: Omit<StreamOpts, 'idleMs'> = {},
): Promise<string> {
  const ctrl = new AbortController()
  const onCallerAbort = () => ctrl.abort()
  opts.signal?.addEventListener('abort', onCallerAbort, { once: true })
  try {
    const work = (async () => {
      const upstream = await openUpstream(
        buildBody(messages, false, opts.numPredict, opts.format),
        ctrl.signal,
      )
      const json = (await upstream.json().catch(() => null)) as
        { message?: { content?: string }; error?: string } | null
      if (!json || json.error) {
        throw new OllamaError('OLLAMA_UPSTREAM', json?.error ?? 'malformed response')
      }
      return json.message?.content ?? ''
    })()
    const result = await raceIdle(work, opts.deadlineMs ?? 45_000)
    if (result === IDLE_SENTINEL) {
      ctrl.abort()
      throw new OllamaError('OLLAMA_UPSTREAM', 'deadline exceeded (chatOnce)')
    }
    return result
  } finally {
    opts.signal?.removeEventListener('abort', onCallerAbort)
  }
}

/**
 * Стриминговый чат: ReadableStream ЧИСТОГО ТЕКСТА (UTF-8 байты) из
 * NDJSON апстрима. PUSH-модель: жадный насос читает апстрим независимо
 * от потребителя (урок прода: pull-модель + недобиваемый abort давали
 * вечное зависание). Ошибки ДО первого байта — типизированный
 * OllamaError; дедлайн/idle посреди генерации — МЯГКОЕ закрытие
 * (потребитель получает частичный текст с чистым концом).
 */
export async function streamOllamaChat(
  messages: OllamaChatMessage[],
  opts: StreamOpts = {},
): Promise<ReadableStream<Uint8Array>> {
  const deadlineMs = opts.deadlineMs ?? 45_000
  const idleMs     = opts.idleMs ?? 20_000

  const ctrl = new AbortController()
  const onCallerAbort = () => ctrl.abort()
  opts.signal?.addEventListener('abort', onCallerAbort, { once: true })
  const detachCaller = () => opts.signal?.removeEventListener('abort', onCallerAbort)

  // Открытие соединения — под общий дедлайн (abort-независимо).
  let opened: Response | typeof IDLE_SENTINEL
  try {
    opened = await raceIdle(
      openUpstream(buildBody(messages, true, opts.numPredict, opts.format), ctrl.signal),
      deadlineMs,
    )
  } catch (e) {
    detachCaller()
    throw e
  }
  if (opened === IDLE_SENTINEL) {
    ctrl.abort()
    detachCaller()
    throw new OllamaError('OLLAMA_UPSTREAM', 'deadline before headers')
  }
  const upstream: Response = opened

  const reader  = upstream.body!.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  const startedAt = Date.now()

  return new ReadableStream<Uint8Array>({
    start(controller) {
      // Жадный насос: не ждёт pull'ов потребителя, закрытие гарантируют
      // race-таймеры, а не прерываемость reader.read().
      void (async () => {
        let buffer = ''
        let closed = false
        const finish = (mode: 'close' | 'error', err?: unknown) => {
          if (closed) return
          closed = true
          detachCaller()
          ctrl.abort() // пусть сокет закроется, если рантайм умеет
          void reader.cancel().catch(() => {})
          try {
            if (mode === 'close') controller.close()
            else controller.error(err)
          } catch { /* уже закрыт потребителем */ }
        }

        try {
          for (;;) {
            if (opts.signal?.aborted) { finish('close'); return }
            if (Date.now() - startedAt > deadlineMs) {
              console.warn('[ollama] deadline mid-stream — soft close')
              finish('close'); return
            }
            const r = await raceIdle(reader.read(), idleMs)
            if (r === IDLE_SENTINEL) {
              console.warn('[ollama] idle watchdog fired — soft close')
              finish('close'); return
            }
            const { done, value } = r
            if (done) { finish('close'); return }

            buffer += decoder.decode(value, { stream: true })
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
                finish('error', new OllamaError('OLLAMA_UPSTREAM', chunk.error))
                return
              }
              const text = chunk.message?.content
              if (text) controller.enqueue(encoder.encode(text))
              if (chunk.done) { finish('close'); return }
            }
          }
        } catch (e) {
          // Обрыв соединения/отмена: если что-то успели отдать — мягко.
          if (opts.signal?.aborted || Date.now() - startedAt > deadlineMs) {
            finish('close')
          } else {
            finish('error', e instanceof OllamaError
              ? e
              : new OllamaError('OLLAMA_UPSTREAM', e instanceof Error ? e.message : 'stream failed'))
          }
        }
      })()
    },
    cancel() {
      detachCaller()
      ctrl.abort()
      void reader.cancel().catch(() => {})
    },
  })
}
