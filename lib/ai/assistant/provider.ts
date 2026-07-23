/**
 * AIProviderAdapter — провайдер-независимый слой генерации.
 *
 * Реализации:
 *   * 'ollama' — Gemma 4 через Ollama Cloud (lib/ai/ollama, стриминг,
 *     50с-дедлайн, типизированные ошибки) — прод-провайдер;
 *   * 'mock'   — детерминированный стрим без внешних вызовов и ключей:
 *     тестовый режим/локальная разработка (AI_ASSISTANT_PROVIDER=mock).
 *
 * Выбор — env AI_ASSISTANT_PROVIDER ('ollama' по умолчанию). Секретные
 * ключи живут только в env провайдера; во frontend не попадают.
 */
import {
  streamOllamaChat, isOllamaConfigured,
  type OllamaChatMessage,
} from '@/lib/ai/ollama'

export type ProviderName = 'ollama' | 'mock'

export interface ProviderStreamOpts {
  signal?: AbortSignal
  maxOutputTokens: number
}

export interface AIProvider {
  readonly name: ProviderName
  isConfigured(): boolean
  streamChat(messages: OllamaChatMessage[], opts: ProviderStreamOpts): Promise<ReadableStream<Uint8Array>>
}

const ollamaProvider: AIProvider = {
  name: 'ollama',
  isConfigured: () => isOllamaConfigured(),
  streamChat: (messages, opts) =>
    streamOllamaChat(messages, {
      signal:     opts.signal,
      numPredict: opts.maxOutputTokens,
      deadlineMs: 50_000,
    }),
}

const mockProvider: AIProvider = {
  name: 'mock',
  isConfigured: () => true,
  async streamChat(messages, opts) {
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    const text =
      `**Тестовый режим ассистента** (mock-провайдер, внешний AI не вызывался).\n\n` +
      `Ваш запрос: «${(lastUser?.content ?? '').slice(0, 200)}»\n\n` +
      `- системный контекст собран и ограничен по роли\n` +
      `- лимит будет списан только после этого успешного ответа\n` +
      `- подключите OLLAMA_API_KEY и уберите AI_ASSISTANT_PROVIDER=mock для боевых ответов`
    const encoder = new TextEncoder()
    const chunks: string[] = []
    for (let p = 0; p < text.length; p += 24) chunks.push(text.slice(p, p + 24))
    let i = 0
    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (opts.signal?.aborted) { controller.close(); return }
        if (i >= chunks.length) { controller.close(); return }
        controller.enqueue(encoder.encode(chunks[i++]))
        await new Promise(r => setTimeout(r, 25))
      },
    })
  },
}

export function getAssistantProvider(): AIProvider {
  return process.env.AI_ASSISTANT_PROVIDER === 'mock' ? mockProvider : ollamaProvider
}
