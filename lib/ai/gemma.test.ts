/**
 * Тесты обёртки Gemma. Фокус — на том, что раньше делал за нас
 * generateObject и что теперь наша ответственность:
 *   - схема действительно доезжает до модели (иначе она не знает формы);
 *   - ответ проверяется схемой, а не принимается на веру;
 *   - «модель недоступна» и «модель вернула мусор» — РАЗНЫЕ ошибки;
 *   - невалидный ответ вызывает ремонтную попытку, а не молчаливый null.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const chatOnce = vi.fn()

vi.mock('@/lib/ai/ollama', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/ollama')>('@/lib/ai/ollama')
  return {
    ...actual,
    OLLAMA_MODEL: 'gemma4:31b',
    isOllamaConfigured: () => !!process.env.OLLAMA_API_KEY,
    ollamaChatOnce: (...args: unknown[]) => chatOnce(...args),
  }
})

const { aiObject, aiText, AiError, AI_MODEL_FAST, AI_MODEL_SMART, isAiConfigured } =
  await import('@/lib/ai/gemma')
const { describeZodSchema } = await import('@/lib/ai/zod-schema-prompt')
const { OllamaError } = await import('@/lib/ai/ollama')

const Schema = z.object({
  title: z.string().describe('Короткий заголовок'),
  score: z.number().min(0).max(10),
  status: z.enum(['ok', 'watch', 'risk']),
  tags: z.array(z.string()).max(3),
  note: z.string().nullable(),
})

type SystemMessage = { role: string; content: string }
const systemOf = (call: unknown[]): string =>
  (call[0] as SystemMessage[]).find(m => m.role === 'system')?.content ?? ''

const VALID = { title: 'Неделя', score: 7, status: 'ok', tags: ['бег'], note: null }

beforeEach(() => {
  chatOnce.mockReset()
  process.env.OLLAMA_API_KEY = 'test-key'
})

describe('describeZodSchema', () => {
  it('разворачивает объект с типами, границами, enum и подсказками', () => {
    const sketch = describeZodSchema(Schema)
    // Запятая-разделитель стоит ДО комментария, а не внутри него.
    expect(sketch).toContain('"title": string,  // Короткий заголовок')
    expect(sketch).toContain('"score": number (>=0, <=10),')
    expect(sketch).toContain('"status": "ok" | "watch" | "risk",')
    expect(sketch).toContain('"tags": string[] (не более 3 элементов),')
    expect(sketch).toContain('"note": string или null')
  })

  it('разворачивает вложенные объекты внутри массива', () => {
    const nested = z.object({
      items: z.array(z.object({ n: z.number().int(), kind: z.enum(['a', 'b']) })).length(2),
    })
    const sketch = describeZodSchema(nested)
    expect(sketch).toContain('Array<{')
    expect(sketch).toContain('"n": number (целое)')
    expect(sketch).toContain('ровно 2 элементов')
  })

  it('не падает на незнакомых узлах — деградирует в any', () => {
    expect(describeZodSchema(z.object({ raw: z.any() }))).toContain('"raw": any')
  })
})

describe('isAiConfigured / модели', () => {
  it('обе константы — одна и та же модель (выбора нет)', () => {
    expect(AI_MODEL_FAST).toBe(AI_MODEL_SMART)
    expect(AI_MODEL_FAST).toBe('gemma4:31b')
  })

  it('без ключа функция считается недоступной', () => {
    delete process.env.OLLAMA_API_KEY
    expect(isAiConfigured()).toBe(false)
  })
})

describe('aiObject', () => {
  it('кладёт схему в system-промпт и возвращает разобранный объект', async () => {
    chatOnce.mockResolvedValueOnce(JSON.stringify(VALID))
    const out = await aiObject({ schema: Schema, prompt: 'дай разбор', system: 'Ты тренер.' })

    expect(out).toEqual(VALID)
    const system = systemOf(chatOnce.mock.calls[0])
    expect(system).toContain('Ты тренер.')
    expect(system).toContain('"status": "ok" | "watch" | "risk"')
    // format:'json' обязателен — без него модель уходит в свободный текст.
    expect(chatOnce.mock.calls[0][1]).toMatchObject({ format: 'json' })
  })

  it('снимает markdown-ограждения и болтовню вокруг JSON', async () => {
    chatOnce.mockResolvedValueOnce('Вот результат:\n```json\n' + JSON.stringify(VALID) + '\n```\nГотово!')
    await expect(aiObject({ schema: Schema, prompt: 'x' })).resolves.toEqual(VALID)
  })

  it('чинит несовпадение со схемой второй попыткой, передав модели ошибки валидатора', async () => {
    chatOnce
      .mockResolvedValueOnce(JSON.stringify({ ...VALID, status: 'всё хорошо' }))
      .mockResolvedValueOnce(JSON.stringify(VALID))

    await expect(aiObject({ schema: Schema, prompt: 'x' })).resolves.toEqual(VALID)
    expect(chatOnce).toHaveBeenCalledTimes(2)

    const repairTurn = (chatOnce.mock.calls[1][0] as SystemMessage[]).at(-1)?.content ?? ''
    expect(repairTurn).toContain('status')
  })

  it('после провала обеих попыток бросает AI_INVALID_OUTPUT, а не null', async () => {
    chatOnce.mockResolvedValue(JSON.stringify({ title: 'нет полей' }))
    const err = await aiObject({ schema: Schema, prompt: 'x' }).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(AiError)
    expect((err as InstanceType<typeof AiError>).code).toBe('AI_INVALID_OUTPUT')
    expect((err as InstanceType<typeof AiError>).detail).toContain('score')
  })

  it('«мусор вместо JSON» отличается от «модель недоступна»', async () => {
    chatOnce.mockResolvedValue('извини, не могу')
    const bad = await aiObject({ schema: Schema, prompt: 'x' }).catch((e: unknown) => e)
    expect((bad as InstanceType<typeof AiError>).code).toBe('AI_INVALID_OUTPUT')

    delete process.env.OLLAMA_API_KEY
    const off = await aiObject({ schema: Schema, prompt: 'x' }).catch((e: unknown) => e)
    expect((off as InstanceType<typeof AiError>).code).toBe('AI_NOT_CONFIGURED')
    // Маршруты отдают message наружу как error — код должен остаться стабильным.
    expect((off as Error).message).toBe('AI_NOT_CONFIGURED')
  })

  it('сбой провайдера — AI_UPSTREAM, без ремонтных попыток', async () => {
    chatOnce.mockRejectedValue(new OllamaError('OLLAMA_RATE_LIMITED', 'too many'))
    const err = await aiObject({ schema: Schema, prompt: 'x' }).catch((e: unknown) => e)

    expect((err as InstanceType<typeof AiError>).code).toBe('AI_UPSTREAM')
    expect(chatOnce).toHaveBeenCalledTimes(1)
  })

  it('исчерпанный бюджет не даёт начать вторую попытку', async () => {
    chatOnce.mockResolvedValue(JSON.stringify({ title: 'нет полей' }))
    const err = await aiObject({ schema: Schema, prompt: 'x', deadlineMs: 1_000 })
      .catch((e: unknown) => e)

    expect((err as InstanceType<typeof AiError>).code).toBe('AI_INVALID_OUTPUT')
    expect(chatOnce).toHaveBeenCalledTimes(1)
  })
})

describe('aiText', () => {
  it('возвращает текст как есть и не просит JSON', async () => {
    chatOnce.mockResolvedValueOnce('Свободный ответ')
    await expect(aiText({ prompt: 'привет', system: 'Ты тренер.' })).resolves.toBe('Свободный ответ')
    expect(chatOnce.mock.calls[0][1]).not.toHaveProperty('format')
  })

  it('без ключа бросает AI_NOT_CONFIGURED и не ходит в сеть', async () => {
    delete process.env.OLLAMA_API_KEY
    await expect(aiText({ prompt: 'привет' })).rejects.toThrow('AI_NOT_CONFIGURED')
    expect(chatOnce).not.toHaveBeenCalled()
  })
})
