/**
 * Gemma 4 (Ollama Cloud) — единая обёртка встроенных AI-инструментов
 * Sporteo: aiText для свободного текста, aiObject для структурированного
 * ответа по Zod-схеме.
 *
 * ИСТОРИЧЕСКАЯ ПОМЕТКА (единственная в коде). Раньше на этом месте был
 * модуль поверх стороннего LLM-SDK со второй моделью. Платформа перешла
 * на одного AI-провайдера, старый модуль удалён целиком. Практический
 * эффект: ключа того провайдера в проде никогда не было, все эти
 * маршруты отдавали 503 AI_NOT_CONFIGURED — переезд их не ломает, а
 * чинит. Форма публичного API (isAiConfigured / aiObject / aiText /
 * константы моделей) сохранена намеренно: 17 потребителей меняют только
 * путь импорта, а не логику вызова.
 *
 * Почему напрямую lib/ai/ollama, а не провайдер AI SDK: клиент в
 * lib/ai/ollama написан под Vercel, где зависшее чтение тела ответа
 * НЕ прерывается через AbortController. Вся его защита построена на
 * Promise.race с watchdog-таймерами. Замена на AI SDK вернёт
 * FUNCTION_INVOCATION_TIMEOUT — см. комментарий в lib/ai/ollama.ts.
 */
import type { z } from 'zod'
import {
  isOllamaConfigured, ollamaChatOnce, OllamaError, OLLAMA_MODEL,
  type OllamaChatMessage,
} from '@/lib/ai/ollama'
import { describeZodSchema } from '@/lib/ai/zod-schema-prompt'

/**
 * У Gemma одна модель, и она закреплена в lib/ai/ollama. Обе константы
 * указывают на неё: деления fast/smart больше НЕ существует, выбор
 * модели невозможен. Константы оставлены только чтобы не править 17
 * мест вызова; опция `model` ниже по той же причине принимается и
 * игнорируется. Появится вторая модель — здесь же и разъедутся.
 */
export const AI_MODEL_FAST  = OLLAMA_MODEL
export const AI_MODEL_SMART = OLLAMA_MODEL

/** Общий дедлайн вызова, мс. Ниже maxDuration=60 у AI-маршрутов. */
const DEFAULT_DEADLINE_MS = 45_000
/**
 * Минимальный остаток бюджета, при котором есть смысл начинать
 * ремонтную попытку. Меньше — гарантированно упрёмся в maxDuration и
 * потеряем даже первый (пусть и невалидный) ответ.
 */
const MIN_REPAIR_BUDGET_MS = 12_000

// ── Ошибки ─────────────────────────────────────────────────────────────

export type AiErrorCode =
  /** Ключ провайдера не сконфигурирован — функция недоступна в принципе. */
  | 'AI_NOT_CONFIGURED'
  /** Провайдер недоступен/ответил ошибкой: 429, 5xx, дедлайн, обрыв. */
  | 'AI_UPSTREAM'
  /** Модель ответила, но ответ не является валидным JSON нужной формы. */
  | 'AI_INVALID_OUTPUT'

/**
 * Вызывающий код обязан различать «модели нет» и «модель вернула мусор»:
 * первое — деградация фичи (503 / rule-based fallback), второе —
 * повод показать ошибку и/или отправить запрос ещё раз позже.
 *
 * `message` намеренно равен коду: маршруты отдают его наружу как
 * `error`, и он должен оставаться машиночитаемым. Подробности (текст
 * ошибок валидатора, кусок ответа модели) лежат в `detail` и наружу не
 * утекают.
 */
export class AiError extends Error {
  readonly code: AiErrorCode
  readonly detail?: string

  constructor(code: AiErrorCode, detail?: string) {
    super(code)
    this.name = 'AiError'
    this.code = code
    this.detail = detail
  }
}

/** Ошибки транспорта → доменные коды обёртки. */
function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e
  if (e instanceof OllamaError) {
    return e.code === 'OLLAMA_NOT_CONFIGURED'
      ? new AiError('AI_NOT_CONFIGURED')
      : new AiError('AI_UPSTREAM', `${e.code}: ${e.message}`)
  }
  return new AiError('AI_UPSTREAM', e instanceof Error ? e.message : String(e))
}

export function isAiConfigured(): boolean {
  return isOllamaConfigured()
}

// ── Общие опции ────────────────────────────────────────────────────────

interface BaseOpts {
  prompt: string
  system?: string
  /**
   * ПРИНИМАЕТСЯ И ИГНОРИРУЕТСЯ. У платформы одна модель (см. AI_MODEL_*).
   * Параметр оставлен, чтобы не переписывать существующие вызовы.
   */
  model?: string
  /** Потолок токенов ответа — защита от упирания в maxDuration роута. */
  maxTokens?: number
  /** Общий бюджет вызова, мс (включая ремонтную попытку в aiObject). */
  deadlineMs?: number
}

function buildMessages(system: string | undefined, prompt: string): OllamaChatMessage[] {
  const messages: OllamaChatMessage[] = []
  if (system) messages.push({ role: 'system', content: system })
  messages.push({ role: 'user', content: prompt })
  return messages
}

// ── Свободный текст ────────────────────────────────────────────────────

export async function aiText(opts: BaseOpts): Promise<string> {
  if (!isAiConfigured()) throw new AiError('AI_NOT_CONFIGURED')
  try {
    return await ollamaChatOnce(buildMessages(opts.system, opts.prompt), {
      numPredict: opts.maxTokens ?? 600,
      deadlineMs: opts.deadlineMs ?? DEFAULT_DEADLINE_MS,
    })
  } catch (e) {
    throw toAiError(e)
  }
}

// ── Структурированный вывод ────────────────────────────────────────────

/**
 * Контракт формата. Дублирует то, что даёт format:'json' на уровне
 * API, СОЗНАТЕЛЬНО: параметр гарантирует лишь синтаксически валидный
 * JSON, а не отсутствие болтовни вокруг и не нужные нам ключи.
 */
const JSON_CONTRACT =
`ФОРМАТ ОТВЕТА — СТРОГО ОДИН JSON-ОБЪЕКТ И БОЛЬШЕ НИЧЕГО.
Без markdown-ограждений (\`\`\`), без пояснений до или после, без комментариев внутри JSON.
Ключи — ровно как в схеме: ничего не переименовывай, не добавляй своих полей и не пропускай обязательные.
Соблюдай указанные типы, перечисления (допустимы ТОЛЬКО перечисленные значения) и числовые границы.
Значения текстовых полей — на русском, если в подсказке к полю не сказано иначе.

Схема ответа (комментарии после // — пояснения, в ответ их не включать):
`

type ExtractResult =
  | { ok: true; value: unknown }
  | { ok: false; detail: string }

/**
 * Достаёт JSON из ответа модели. Содержимое НЕ «чинит» (типы не приводит,
 * полей не досочиняет) — только снимает обёртки, которые модель иногда
 * добавляет вопреки инструкции: markdown-ограждения и фразу вокруг
 * объекта. Всё остальное — работа схемы.
 */
function tryExtractJson(raw: string): ExtractResult {
  const text = raw.trim()
  if (!text) return { ok: false, detail: 'пустой ответ модели' }

  const candidates: string[] = [text]

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced?.[1]) candidates.push(fenced[1].trim())

  // Срез от первой открывающей скобки до последней закрывающей — снимает
  // болтовню вокруг объекта/массива.
  for (const [open, close] of [['{', '}'], ['[', ']']] as const) {
    const start = text.indexOf(open)
    const end   = text.lastIndexOf(close)
    if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1))
  }

  for (const candidate of candidates) {
    try {
      return { ok: true, value: JSON.parse(candidate) as unknown }
    } catch {
      continue
    }
  }
  return { ok: false, detail: `ответ не является JSON: ${text.slice(0, 300)}` }
}

/** Ошибки валидатора в виде, понятном и человеку, и модели. */
function formatIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 12)
    .map(issue => `- ${issue.path.join('.') || '<корень>'}: ${issue.message}`)
    .join('\n')
}

/**
 * Структурированная генерация по Zod-схеме.
 *
 * Как это работает без generateObject:
 *   1. схема разворачивается в читаемый скетч и уходит в system-промпт —
 *      иначе модель просто не знает форму ответа;
 *   2. запрос уходит с format:'json' (constrained decoding до валидного
 *      JSON на стороне Ollama);
 *   3. ответ парсится и ПРОВЕРЯЕТСЯ той же схемой — единственный
 *      источник истины;
 *   4. при несовпадении делается ОДНА ремонтная попытка: модели
 *      возвращается её же ответ и список претензий валидатора. Причина —
 *      у Gemma нет декодирования под схему, и типовой промах мелкий
 *      (не тот вариант enum, пропущенное необязательное-по-мнению-модели
 *      поле). Чинится с одного раза и дешевле, чем отдавать пользователю
 *      ошибку. Бюджет общий на обе попытки: два независимых дедлайна по
 *      45с не влезут в maxDuration=60.
 *
 * Бросает AiError: AI_NOT_CONFIGURED (нет ключа), AI_UPSTREAM (провайдер
 * недоступен), AI_INVALID_OUTPUT (ответ есть, но он не по схеме).
 * Молчаливого null не возвращает никогда.
 */
export async function aiObject<T>(opts: BaseOpts & { schema: z.ZodType<T> }): Promise<T> {
  if (!isAiConfigured()) throw new AiError('AI_NOT_CONFIGURED')

  const deadlineAt = Date.now() + (opts.deadlineMs ?? DEFAULT_DEADLINE_MS)
  const numPredict = opts.maxTokens ?? 800
  const system = [opts.system, JSON_CONTRACT + describeZodSchema(opts.schema)]
    .filter(Boolean)
    .join('\n\n')

  const messages = buildMessages(system, opts.prompt)
  let lastDetail = 'ответ не прошёл валидацию схемой'

  // Максимум две итерации: первичная генерация + одна ремонтная.
  for (let attempt = 0; attempt < 2; attempt++) {
    const remainingMs = deadlineAt - Date.now()
    if (remainingMs <= 0) break

    let raw: string
    try {
      raw = await ollamaChatOnce(messages, {
        numPredict,
        deadlineMs: remainingMs,
        format: 'json',
      })
    } catch (e) {
      // Провайдер недоступен — ремонт бессмыслен, ошибка не в ответе.
      throw toAiError(e)
    }

    // Невалидный JSON и валидный-но-не-по-схеме лечатся одинаково:
    // показать модели её ответ и объяснить, что не так.
    let complaint: string
    const parsed = tryExtractJson(raw)
    if (parsed.ok) {
      const result = opts.schema.safeParse(parsed.value)
      if (result.success) return result.data
      complaint =
`Твой предыдущий JSON не прошёл проверку по схеме. Ошибки:
${formatIssues(result.error)}

Исправь ТОЛЬКО перечисленное и верни целиком новый JSON-объект по той же схеме. Никакого текста вокруг.`
      lastDetail = formatIssues(result.error)
    } else {
      complaint = 'Твой ответ не является валидным JSON. Верни ТОЛЬКО JSON-объект по схеме, без текста вокруг.'
      lastDetail = parsed.detail
    }

    // Ремонт возможен только после ПЕРВОЙ попытки и только если на вторую
    // реально хватит времени — иначе гарантированно упрёмся в maxDuration.
    const isLastAttempt = attempt > 0
    if (isLastAttempt || deadlineAt - Date.now() < MIN_REPAIR_BUDGET_MS) break

    console.warn('[gemma] ответ не принят, ремонтная попытка:\n' + lastDetail)
    messages.push(
      { role: 'assistant', content: raw.slice(0, 4000) },
      { role: 'user', content: complaint },
    )
  }

  console.warn('[gemma] структурированный вызов провален: ' + lastDetail)
  throw new AiError('AI_INVALID_OUTPUT', lastDetail)
}
