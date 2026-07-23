'use client'

/**
 * /demo/ai-assistant — публичная демо-страница ролевых AI-ассистентов.
 *
 * Сильно ограниченная версия: выбор демонстрационной роли, готовые
 * примеры вопросов, максимум ДВА свободных запроса (учёт на сервере по
 * session+IP хэшам), только вымышленные данные, короткие ответы, CTA
 * регистрации. Полноценного чата на лендинге нет — это отдельная
 * страница-витрина.
 */
import { useState } from 'react'
import Link from 'next/link'
import { renderMarkdownLite } from '@/lib/markdown-lite'

type DemoRole = 'athlete' | 'coach' | 'doctor' | 'organization'

const ROLES: Array<{ key: DemoRole; icon: string; title: string; blurb: string }> = [
  { key: 'athlete',      icon: 'ki-user',        title: 'Спортсмен',  blurb: 'Объяснит план и подскажет, что важно сегодня' },
  { key: 'coach',        icon: 'ki-people',      title: 'Тренер',     blurb: 'Сводки по группе и планы тренировок' },
  { key: 'doctor',       icon: 'ki-shield-tick', title: 'Врач',       blurb: 'Черновики рекомендаций и ограничений' },
  { key: 'organization', icon: 'ki-office-bag',  title: 'Организация', blurb: 'Управленческие сводки по клубу' },
]

const PRESETS: Record<DemoRole, string[]> = {
  athlete: [
    'Объясни мой тренировочный план простыми словами',
    'Что мне важно сделать сегодня?',
    'Как подготовиться к завтрашней тренировке?',
  ],
  coach: [
    'На что обратить внимание перед следующей тренировкой?',
    'Подготовь план занятия для группы',
    'Кому из спортсменов нужно снизить нагрузку?',
  ],
  doctor: [
    'Сформируй нейтральный черновик ограничения по нагрузке',
    'Подготовь вопросы к повторному осмотру пациентки',
    'Резюмируй состояние пациента для тренера',
  ],
  organization: [
    'Какие процессы требуют внимания руководителя?',
    'Сформируй короткую сводку по клубу',
    'Что улучшить в работе с допусками?',
  ],
}

interface DemoMessage { role: 'user' | 'assistant'; content: string }

export default function DemoAssistantPage() {
  const [role, setRole] = useState<DemoRole | null>(null)
  const [messages, setMessages] = useState<DemoMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [limitReached, setLimitReached] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(text: string) {
    if (!role || !text.trim() || loading || limitReached) return
    setError(null)
    setLoading(true)
    setMessages(m => [...m, { role: 'user', content: text.trim() }])
    setInput('')

    const res = await fetch('/api/demo/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, message: text.trim() }),
    }).catch(() => null)
    const json = await res?.json().catch(() => null) as {
      ok?: boolean; answer?: string; remaining?: number
      limitReached?: boolean; error?: string
    } | null

    setLoading(false)
    if (!res || !json) { setError('Нет соединения — попробуйте позже.'); return }
    if (json.limitReached) {
      setLimitReached(true)
      setMessages(m => m.slice(0, -1))
      return
    }
    if (!json.ok || !json.answer) {
      setError(json.error ?? 'Демо временно недоступно.')
      setMessages(m => m.slice(0, -1))
      return
    }
    setMessages(m => [...m, { role: 'assistant', content: json.answer! }])
    if (typeof json.remaining === 'number') {
      setRemaining(json.remaining)
      if (json.remaining === 0) setLimitReached(true)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 text-center">
        <p className="mb-1 text-2xs font-bold uppercase tracking-[0.24em] text-orange-600">Демо Sporteo AI</p>
        <h1 className="text-3xl font-bold tracking-tight text-navy-500">Попробуйте ролевого AI-помощника</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Демонстрация на вымышленных данных — без регистрации, два свободных вопроса.
          В личном кабинете ассистент работает с вашими реальными данными по роли.
        </p>
      </div>

      {/* Выбор демо-роли */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ROLES.map(r => (
          <button key={r.key}
            onClick={() => { setRole(r.key); setMessages([]); setError(null) }}
            className={`rounded-2xl border p-3 text-left transition ${
              role === r.key
                ? 'border-orange-400 bg-orange-50 shadow-sm'
                : 'border-border bg-card hover:border-orange-200'
            }`}>
            <i className={`ki-filled ${r.icon} text-lg ${role === r.key ? 'text-orange-500' : 'text-muted-foreground'}`} />
            <div className="mt-1.5 text-sm font-bold text-foreground">{r.title}</div>
            <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{r.blurb}</div>
          </button>
        ))}
      </div>

      {role && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="space-y-3 px-4 py-4" style={{ minHeight: 220 }}>
            {messages.length === 0 && !limitReached && (
              <div className="space-y-2.5">
                <p className="text-xs text-muted-foreground">Примеры вопросов:</p>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS[role].map(p => (
                    <button key={p} onClick={() => send(p)}
                      className="rounded-full border border-border bg-background px-2.5 py-1 text-2xs font-semibold text-foreground hover:bg-accent">
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'whitespace-pre-wrap rounded-br-sm bg-orange-500 text-white'
                    : 'rounded-bl-sm border border-border bg-background text-foreground'
                }`}>
                  {m.role === 'assistant'
                    ? <div dangerouslySetInnerHTML={{ __html: renderMarkdownLite(m.content) }} />
                    : m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                  думаю…
                </div>
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>
            )}
          </div>

          <div className="border-t border-border bg-background/60 p-3">
            {limitReached ? (
              <div className="flex flex-col items-center gap-2 py-3 text-center">
                <p className="text-sm font-semibold text-foreground">Демо-лимит исчерпан</p>
                <p className="max-w-md text-xs text-muted-foreground">
                  Зарегистрируйтесь бесплатно — получите ролевого ассистента на своих данных
                  и 20 AI-запросов в месяц уже на бесплатном тарифе.
                </p>
                <Link href="/auth/register"
                  className="mt-1 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600">
                  Зарегистрироваться
                </Link>
              </div>
            ) : (
              <>
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
                    }}
                    placeholder="Свой вопрос (демо-данные)…"
                    rows={1}
                    maxLength={300}
                    className="max-h-24 flex-1 resize-none rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:border-orange-400"
                  />
                  <button onClick={() => send(input)} disabled={loading || !input.trim()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40">
                    <i className="ki-filled ki-paper-plane text-[13px]" />
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Данные вымышленные · история не сохраняется</span>
                  {remaining !== null && <span>Свободных вопросов: {remaining}</span>}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Уже с нами? <Link href="/assistant" className="font-semibold text-orange-600 hover:underline">Открыть своего AI-помощника</Link>
      </p>
    </div>
  )
}
