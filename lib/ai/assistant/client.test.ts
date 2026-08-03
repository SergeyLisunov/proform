import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendAssistantMessage } from './client'

/**
 * Регрессия к дефекту «квота списывается за пустой ответ».
 *
 * Причина: провайдер закрывает стрим ШТАТНО, не сказав ни слова
 * (idle-watchdog / mid-stream дедлайн в lib/ai/ollama.ts делают soft close
 * без ошибки). Сервер такой ответ больше не считает успехом и не списывает
 * запрос — а клиент раньше возвращал { ok: true } на пустое тело, поэтому
 * пользователь видел молча исчезнувший пузырь вместо ошибки.
 */
function streamResponse(chunks: string[]): Response {
  const enc = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const s of chunks) c.enqueue(enc.encode(s))
      c.close()
    },
  })
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

function mockFetch(res: Response) {
  vi.stubGlobal('fetch', vi.fn(async () => res))
}

const baseOpts = {
  conversationId: '11111111-1111-4111-8111-111111111111',
  content: 'вопрос',
  signal: new AbortController().signal,
}

afterEach(() => vi.unstubAllGlobals())

describe('sendAssistantMessage — пустой ответ провайдера это ошибка, а не успех', () => {
  it('200 с пустым телом → ok:false с понятной ошибкой', async () => {
    mockFetch(streamResponse([]))
    const r = await sendAssistantMessage({ ...baseOpts, onChunk: () => {} })
    expect(r.ok).toBe(false)
    expect(r.error).toBeTruthy()
    // Не отмена и не обрыв — именно отказ с текстом для пользователя.
    expect(r.aborted).toBeFalsy()
    expect(r.interrupted).toBeFalsy()
  })

  it('тело из одних пробелов/переводов строк → тоже ok:false', async () => {
    mockFetch(streamResponse([' ', '\n', '\t']))
    const r = await sendAssistantMessage({ ...baseOpts, onChunk: () => {} })
    expect(r.ok).toBe(false)
  })

  it('непустой ответ → ok:true, чанки доставлены целиком', async () => {
    mockFetch(streamResponse(['Привет', ', ', 'это ответ']))
    const chunks: string[] = []
    const r = await sendAssistantMessage({ ...baseOpts, onChunk: c => { chunks.push(c) } })
    expect(r.ok).toBe(true)
    expect(chunks.join('')).toBe('Привет, это ответ')
  })

  it('JSON-ошибка до стрима остаётся ошибкой с текстом сервера', async () => {
    mockFetch(new Response(JSON.stringify({ ok: false, error: 'Лимит исчерпан.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    }))
    const r = await sendAssistantMessage({ ...baseOpts, onChunk: () => {} })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('Лимит исчерпан.')
  })
})
