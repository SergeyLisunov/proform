/**
 * Интеграционные тесты NDJSON-парсера streamOllamaChat / ollamaChatOnce
 * против ЛОКАЛЬНОГО http-сервера (env-override OLLAMA_CHAT_URL).
 *
 * Написаны после прод-инцидента: Gemma отвечала за 2с, но сбор стрима
 * зависал навсегда до убийства функции по maxDuration. Кейсы покрывают
 * ровно те режимы доставки, где прятался баг: несколько строк одним
 * чанком, построчная отдача, «сервер замолчал без done», done в первом
 * же батче.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

type Scenario = (res: ServerResponse) => void
const scenarios = new Map<string, Scenario>()

let server: Server
let baseUrl = ''

function line(obj: unknown): string {
  return JSON.stringify(obj) + '\n'
}
const content = (t: string) => ({ message: { content: t }, done: false })
const doneLine = () => ({ done: true, done_reason: 'stop' })

async function collect(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let out = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    out += decoder.decode(value, { stream: true })
  }
  return out + decoder.decode()
}

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => {
      // Сценарий выбирается содержимым последнего user-сообщения.
      const parsed = JSON.parse(body) as { messages: Array<{ role: string; content: string }> }
      const key = parsed.messages[parsed.messages.length - 1]?.content ?? ''
      const scenario = scenarios.get(key)
      if (!scenario) { res.writeHead(500); res.end('no scenario'); return }
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
      scenario(res)
    })
  })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  const addr = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${addr.port}/api/chat`
  process.env.OLLAMA_CHAT_URL = baseUrl
  process.env.OLLAMA_API_KEY = 'test-key'
})

afterAll(async () => {
  delete process.env.OLLAMA_CHAT_URL
  await new Promise<void>(r => { server.close(() => r()) })
})

// Импорт ПОСЛЕ выставления env (модуль читает OLLAMA_CHAT_URL при загрузке)
async function lib() {
  return import('./ollama')
}

describe('streamOllamaChat — режимы доставки NDJSON', () => {
  it('несколько строк одним TCP-чанком + done в конце', async () => {
    scenarios.set('batch', res => {
      res.end(line(content('Привет')) + line(content(' мир')) + line(doneLine()))
    })
    const { streamOllamaChat } = await lib()
    const stream = await streamOllamaChat([{ role: 'user', content: 'batch' }])
    await expect(collect(stream)).resolves.toBe('Привет мир')
  })

  it('построчная отдача с паузами (типичный стрим)', async () => {
    scenarios.set('slow', res => {
      res.write(line(content('a')))
      setTimeout(() => res.write(line(content('b'))), 120)
      setTimeout(() => res.write(line(content('c'))), 240)
      setTimeout(() => { res.write(line(doneLine())); res.end() }, 360)
    })
    const { streamOllamaChat } = await lib()
    const stream = await streamOllamaChat([{ role: 'user', content: 'slow' }])
    await expect(collect(stream)).resolves.toBe('abc')
  })

  it('done в ПЕРВОМ батче вместе с контентом', async () => {
    scenarios.set('instant', res => {
      res.write(line(content('всё сразу')) + line(doneLine()))
      // соединение НЕ закрываем — done обязан закрыть стрим сам
    })
    const { streamOllamaChat } = await lib()
    const stream = await streamOllamaChat([{ role: 'user', content: 'instant' }])
    await expect(collect(stream)).resolves.toBe('всё сразу')
  })

  it('ПРОД-КЕЙС: сервер замолчал без done — idle-watchdog мягко закрывает', async () => {
    scenarios.set('hang', res => {
      res.write(line(content('начало')))
      // ...и тишина навсегда: ни done, ни закрытия соединения
    })
    const { streamOllamaChat } = await lib()
    const t0 = Date.now()
    const stream = await streamOllamaChat(
      [{ role: 'user', content: 'hang' }],
      { idleMs: 500, deadlineMs: 5_000 },
    )
    const text = await collect(stream) // не должен зависнуть
    expect(text).toBe('начало')
    expect(Date.now() - t0).toBeLessThan(3_000)
  })

  it('строка, разрезанная между чанками, склеивается', async () => {
    scenarios.set('split', res => {
      const full = line(content('целая строка'))
      res.write(full.slice(0, 15))
      setTimeout(() => { res.write(full.slice(15) + line(doneLine())); res.end() }, 100)
    })
    const { streamOllamaChat } = await lib()
    const stream = await streamOllamaChat([{ role: 'user', content: 'split' }])
    await expect(collect(stream)).resolves.toBe('целая строка')
  })

  it('NDJSON-строка {"error":...} даёт OllamaError', async () => {
    scenarios.set('err', res => {
      res.end(line({ error: 'model overloaded' }))
    })
    const { streamOllamaChat, OllamaError } = await lib()
    const stream = await streamOllamaChat([{ role: 'user', content: 'err' }])
    await expect(collect(stream)).rejects.toBeInstanceOf(OllamaError)
  })
})

describe('ollamaChatOnce — нестриминговый путь (demo)', () => {
  it('возвращает content целиком', async () => {
    scenarios.set('once', res => {
      res.end(JSON.stringify({ message: { content: 'короткий ответ' }, done: true }))
    })
    const { ollamaChatOnce } = await lib()
    await expect(
      ollamaChatOnce([{ role: 'user', content: 'once' }]),
    ).resolves.toBe('короткий ответ')
  })

  it('зависший ответ убивается дедлайном, а не висит', async () => {
    scenarios.set('once-hang', () => { /* никогда не отвечаем телом */ })
    const { ollamaChatOnce, OllamaError } = await lib()
    const t0 = Date.now()
    await expect(
      ollamaChatOnce([{ role: 'user', content: 'once-hang' }], { deadlineMs: 800 }),
    ).rejects.toBeInstanceOf(OllamaError)
    expect(Date.now() - t0).toBeLessThan(3_000)
  })
})
