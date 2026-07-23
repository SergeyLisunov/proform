'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { streamChat } from '@/lib/ai/chat-client'
import { renderMarkdownLite } from '@/lib/markdown-lite'

type Message = { role: 'user' | 'assistant'; content: string }

const STARTER_PROMPTS = [
  'Как мне тренироваться завтра?',
  'Сколько я тренировался за последние 7 дней?',
  'Есть ли признаки переутомления?',
  'Что улучшить в следующей тренировке?',
]

export default function AiChatBubble() {
  const [open, setOpen]           = useState(false)
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [hidden, setHidden]       = useState(false)
  const scrollRef                 = useRef<HTMLDivElement>(null)
  const inputRef                  = useRef<HTMLTextAreaElement>(null)
  const abortRef                  = useRef<AbortController | null>(null)

  // Hide entirely on auth pages
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname
      if (p.startsWith('/auth') || p === '/') setHidden(true)
    }
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streaming])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // Обрываем генерацию при размонтировании
  useEffect(() => () => abortRef.current?.abort(), [])

  const stop = useCallback(() => abortRef.current?.abort(), [])

  const send = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return
    const userMsg: Message = { role: 'user', content: text.trim() }
    const history = messages.slice(-8)
    setMessages(m => [...m, userMsg, { role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)
    setError(null)

    const controller = new AbortController()
    abortRef.current = controller

    // Чанки дописываем в последнее (пустое) assistant-сообщение
    const result = await streamChat({
      question: userMsg.content,
      history,
      signal: controller.signal,
      onChunk: chunk => {
        setMessages(m => {
          const next = [...m]
          const last = next[next.length - 1]
          next[next.length - 1] = { ...last, content: last.content + chunk }
          return next
        })
      },
    })

    setStreaming(false)
    abortRef.current = null

    setMessages(m => {
      const last = m[m.length - 1]
      if (last?.role === 'assistant' && !last.content) {
        // Ответ так и не начался (ошибка/стоп до первого чанка) — убираем пузырь
        return m.slice(0, -1)
      }
      return m
    })
    if (result.error) setError(result.error)
    if (result.interrupted) setError('Ответ прерван — попробуйте ещё раз.')
  }, [messages, streaming])

  if (hidden) return null

  return (
    <>
      {/* Floating launcher — на мобиле поднят над MobileBottomNav */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-[9997] flex h-14 w-14 items-center justify-center rounded-full shadow-[0_12px_40px_rgba(243,87,3,0.45)] transition hover:scale-105"
          style={{ background: 'linear-gradient(135deg,#F35703 0%,#D44A02 60%,#7C3AED 130%)' }}
          title="AI-ассистент"
        >
          <i className="ki-filled ki-message-programming text-white text-xl" />
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-amber-300 opacity-75" />
            <span className="relative h-3.5 w-3.5 rounded-full bg-amber-400 border-2 border-white" />
          </span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-20 right-2 lg:bottom-6 lg:right-6 z-[9998] flex w-[380px] max-w-[95vw] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_32px_80px_rgba(0,0,0,0.28)]"
          style={{ height: 'min(560px, 76vh)' }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ background: 'linear-gradient(135deg,#0F172A,#312E81)' }}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 backdrop-blur">
                <i className="ki-filled ki-flash-circle text-[14px] text-amber-300" />
              </div>
              <div>
                <div className="text-sm font-bold text-white leading-none">AI-ассистент</div>
                <div className="text-[10px] text-white/70 mt-0.5">На базе Gemma 4</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && !streaming && (
                <button
                  onClick={() => { setMessages([]); setError(null) }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/15"
                  title="Новый диалог"
                >
                  <i className="ki-filled ki-trash text-[12px] text-white/80" />
                </button>
              )}
              <button
                onClick={() => { stop(); setOpen(false) }}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/15"
                title="Закрыть"
              >
                <i className="ki-filled ki-cross text-[12px] text-white" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto bg-background/60 px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-card px-3 py-2.5 text-xs text-foreground leading-relaxed">
                  Привет! Я видел все твои тренировки за последний месяц. Спроси что-нибудь:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {STARTER_PROMPTS.map(p => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      className="rounded-full border border-border bg-card px-2.5 py-1 text-2xs font-semibold text-foreground hover:bg-accent transition"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => {
              const isLast = i === messages.length - 1
              const showTyping = streaming && isLast && m.role === 'assistant' && !m.content
              return (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-orange-500 text-white rounded-br-sm whitespace-pre-wrap'
                        : 'bg-card border border-border text-foreground rounded-bl-sm'
                    }`}
                  >
                    {m.role === 'assistant' ? (
                      showTyping ? (
                        <TypingDots />
                      ) : (
                        // renderMarkdownLite экранирует ВЕСЬ ввод до замен —
                        // инъекция HTML из ответа модели невозможна.
                        <div dangerouslySetInnerHTML={{ __html: renderMarkdownLite(m.content) }} />
                      )
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              )
            })}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {error}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border bg-card px-3 py-2.5">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send(input)
                  }
                }}
                placeholder="Спроси что-нибудь…"
                rows={1}
                maxLength={2000}
                className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-orange-400 max-h-32"
                style={{ minHeight: 36 }}
              />
              {streaming ? (
                <button
                  type="button"
                  onClick={stop}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-700 text-white transition hover:bg-slate-800"
                  title="Остановить генерацию"
                >
                  <i className="ki-filled ki-cross text-[13px]" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => send(input)}
                  disabled={!input.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white transition hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Отправить"
                >
                  <i className="ki-filled ki-paper-plane text-[13px]" />
                </button>
              )}
            </div>
            <div className="mt-1 text-center text-[9px] text-muted-foreground">
              Enter — отправить · Shift+Enter — новая строка
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function TypingDots() {
  return (
    <div className="flex gap-1 py-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '0ms' }} />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '120ms' }} />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '240ms' }} />
    </div>
  )
}
