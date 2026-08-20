/**
 * Регрессия на чтение OLLAMA_API_KEY.
 *
 * Написана после прод-инцидента: встроенные AI-функции отвечали ошибкой,
 * а Ollama возвращала `{"error":"Unauthorized"}` — тот же самый ответ, что
 * и на запрос вообще без заголовка авторизации. Отличить «ключа нет»,
 * «ключ неверен» и «ключ верен, но при вставке в панель Vercel к нему
 * прилип перенос строки» по ответу апстрима невозможно.
 *
 * Поэтому значение нормализуется на входе, а тест держит два инварианта:
 * пробельный мусор не уходит в заголовок и не считается настроенным ключом.
 */
import { afterAll, beforeAll, afterEach, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

let server: Server
let seenAuth: string | undefined

beforeAll(async () => {
  server = createServer((req, res) => {
    seenAuth = req.headers.authorization
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => {
      // ollamaChatOnce — нестриминговый путь: одно тело, один JSON-объект.
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ message: { content: 'ок' }, done: true, done_reason: 'stop' }))
    })
  })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  const addr = server.address() as AddressInfo
  // OLLAMA_CHAT_URL читается при загрузке модуля — выставляем до импорта.
  process.env.OLLAMA_CHAT_URL = `http://127.0.0.1:${addr.port}/api/chat`
})

afterAll(async () => {
  delete process.env.OLLAMA_CHAT_URL
  delete process.env.OLLAMA_API_KEY
  await new Promise<void>(r => { server.close(() => r()) })
})

afterEach(() => { seenAuth = undefined })

async function lib() {
  return import('./ollama')
}

describe('isOllamaConfigured — что считается настроенным ключом', () => {
  it('ключ из одних пробелов НЕ считается настроенным', async () => {
    const { isOllamaConfigured } = await lib()
    process.env.OLLAMA_API_KEY = '   \n\t '
    expect(isOllamaConfigured()).toBe(false)
  })

  it('пустая строка НЕ считается настроенной', async () => {
    const { isOllamaConfigured } = await lib()
    process.env.OLLAMA_API_KEY = ''
    expect(isOllamaConfigured()).toBe(false)
  })

  it('ключ с прилипшим переносом строки считается настроенным', async () => {
    const { isOllamaConfigured } = await lib()
    process.env.OLLAMA_API_KEY = ' real-key\n'
    expect(isOllamaConfigured()).toBe(true)
  })
})

describe('заголовок Authorization', () => {
  it('пробелы и перенос строки не уходят в заголовок', async () => {
    const { ollamaChatOnce } = await lib()
    process.env.OLLAMA_API_KEY = '  real-key\n'

    await ollamaChatOnce([{ role: 'user', content: 'привет' }], {})

    // Ровно `Bearer real-key`: любой пробельный хвост Ollama отвергает с 401,
    // неотличимым от отсутствующего ключа, — ради этого и нужен инвариант.
    expect(seenAuth).toBe('Bearer real-key')
  })

  it('пробельный ключ не уходит в сеть вовсе — ошибка до запроса', async () => {
    const { ollamaChatOnce, OllamaError } = await lib()
    process.env.OLLAMA_API_KEY = '   '

    await expect(
      ollamaChatOnce([{ role: 'user', content: 'привет' }], {}),
    ).rejects.toBeInstanceOf(OllamaError)
    expect(seenAuth).toBeUndefined()
  })
})
