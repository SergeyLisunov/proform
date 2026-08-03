'use client'

/**
 * FloatingAssistant — единый плавающий ролевой AI-помощник Sporteo (Gemma).
 *
 * Продуктовое решение (перенос из сайдбара): одна плавающая кнопка на ВСЕХ
 * авторизованных страницах кабинета; на публичных (лендинг, вход,
 * регистрация, legal, demo, публичные страницы клубов) компонент НЕ
 * РЕНДЕРИТСЯ вовсе (return null до любой разметки — не CSS-скрытие).
 *
 * Гейты рендера (оба обязательны):
 *   1. isAssistantPublicPath(pathname) — deny-list публичных префиксов
 *      (зеркалит публичную карту lib/supabase/middleware.ts);
 *   2. живая Supabase-сессия (getSession + onAuthStateChange).
 * Роль/тариф/лимиты/контекст решает ТОЛЬКО сервер (GET capabilities);
 * недоступная роль (admin и пр.) → кнопки нет.
 *
 * История диалогов разделена по роли на сервере (role_snapshot);
 * состояние панели живёт в root-layout → переживает клиентские переходы.
 *
 * Контекстные кнопки страниц открывают виджет событием
 * `sporteo-assistant:open` (detail: {contextType, contextEntityId,
 * contextLabel}) — наружу уходит только идентификатор, доступ к сущности
 * сервер перепроверяет на каждом сообщении.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { renderMarkdownLite } from '@/lib/markdown-lite'
import {
  fetchCapabilities, listConversations, createConversation,
  fetchConversation, deleteConversation, sendAssistantMessage,
} from '@/lib/ai/assistant/client'
import type {
  AssistantCapabilities, ConversationSummary, AssistantMessage, AssistantContextType,
} from '@/lib/ai/assistant/types'
import { RESERVED_TOP_LEVEL_SLUGS, PUBLIC_APP_SLUGS } from '@/lib/routes/reserved-slugs'

export const ASSISTANT_OPEN_EVENT = 'sporteo-assistant:open'

export interface AssistantOpenDetail {
  contextType?: AssistantContextType
  contextEntityId?: string
  contextLabel?: string
}

/**
 * Публичные страницы, где ассистента НЕ существует. Зеркалит публичную
 * карту auth-middleware + однословные slug'и публичных страниц клубов.
 * Чистая функция — покрыта unit-тестами.
 */
export function isAssistantPublicPath(pathname: string): boolean {
  if (pathname === '/') return true
  const exactPublic = ['/auth', '/legal', '/demo', '/tools', '/invite', '/pricing']
  if (exactPublic.includes(pathname)) return true
  const publicPrefixes = ['/auth/', '/legal/', '/demo/', '/tools/', '/invite/', '/p/']
  if (publicPrefixes.some(p => pathname.startsWith(p))) return true
  // Публичная страница клуба: одиночный сегмент вне зарезервированных
  // app-разделов. ЕДИНЫЙ источник правды с middleware (ревью-находка:
  // два рассинхронизированных хардкода прятали виджет на /templates и др.).
  const m = /^\/([a-z0-9-]+)$/.exec(pathname)
  if (m && !RESERVED_TOP_LEVEL_SLUGS.has(m[1])) return true
  // Публичные разделы приложения (/about, /contacts, /directory):
  // зарезервированы как маршруты, но открыты анонимно — помощника там нет.
  if (m && PUBLIC_APP_SLUGS.has(m[1])) return true
  return false
}

interface PendingContext {
  type: AssistantContextType
  id: string
  label: string
}

export default function FloatingAssistant() {
  const pathname = usePathname()
  const [hasSession, setHasSession] = useState(false)
  const [caps, setCaps] = useState<AssistantCapabilities | null>(null)
  const [open, setOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeConv, setActiveConv] = useState<ConversationSummary | null>(null)
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingContext, setPendingContext] = useState<PendingContext | null>(null)
  /** Подписи контекста созданных диалогов (id → имя спортсмена) — чтобы
   *  контекст АКТИВНОГО диалога был виден, а не только до создания. */
  const [contextLabels, setContextLabels] = useState<Record<string, string>>({})

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  /** Синхронный guard от double-send: streaming ставится только после
   *  await createConversation — окно для повторного Enter (ревью #4). */
  const sendingRef = useRef(false)

  // ── Гейт 2: живая сессия (гейт 1 — pathname — в самом рендере) ─────────
  useEffect(() => {
    const sb = createClient()
    let cancelled = false
    sb.auth.getSession().then(({ data }) => {
      if (!cancelled) setHasSession(!!data.session)
    })
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session)
      if (!session) {
        // Выход: полный сброс — переписка и контекст предыдущего
        // пользователя не должны пережить смену аккаунта (ревью #6).
        abortRef.current?.abort()
        setCaps(null)
        setOpen(false)
        setActiveConv(null)
        setMessages([])
        setConversations([])
        setPendingContext(null)
        setContextLabels({})
        setInput('')
        setError(null)
        setShowHistory(false)
      }
    })
    return () => { cancelled = true; sub.subscription.unsubscribe() }
  }, [])

  // Возможности — один раз на сессию (layout переживает переходы).
  useEffect(() => {
    if (!hasSession) return
    let cancelled = false
    fetchCapabilities().then(c => { if (!cancelled) setCaps(c) })
    return () => { cancelled = true }
  }, [hasSession])

  const reloadCaps = useCallback(async () => {
    setCaps(await fetchCapabilities())
  }, [])

  // ── Событие контекстных кнопок ─────────────────────────────────────────
  useEffect(() => {
    function onOpen(e: Event) {
      const d = (e as CustomEvent<AssistantOpenDetail>).detail ?? {}
      if (d.contextType && d.contextEntityId) {
        setPendingContext({
          type: d.contextType,
          id: d.contextEntityId,
          label: d.contextLabel ?? 'выбранный контекст',
        })
        // Контекст применяется к НОВОМУ диалогу.
        setActiveConv(null)
        setMessages([])
      }
      setOpen(true)
      setTimeout(() => inputRef.current?.focus(), 120)
    }
    window.addEventListener(ASSISTANT_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(ASSISTANT_OPEN_EVENT, onOpen)
  }, [])

  // ── A11y: Escape закрывает, фокус возвращается на кнопку ───────────────
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, streaming])

  useEffect(() => () => abortRef.current?.abort(), [])

  const stop = useCallback(() => abortRef.current?.abort(), [])

  async function loadHistory() {
    setConversations(await listConversations())
  }

  async function openConversation(conv: ConversationSummary) {
    // Переключение диалога прерывает текущий стрим (ревью #2): чанки
    // старого ответа не должны дописываться в чужую переписку.
    abortRef.current?.abort()
    setActiveConv(conv)
    setShowHistory(false)
    setError(null)
    const { messages: msgs, error: err } = await fetchConversation(conv.id)
    setMessages(msgs)
    if (err) setError(err)
  }

  const send = useCallback(async (text: string) => {
    if (!text.trim() || streaming || !caps?.available) return
    // Синхронный guard (ревью #4): между кликом и setStreaming есть await
    // createConversation — двойной Enter в это окно создавал два диалога
    // и два параллельных стрима, пишущих в один хвост массива.
    if (sendingRef.current) return
    sendingRef.current = true
    try {
      setError(null)

      let conv = activeConv
      if (!conv) {
        const opts = pendingContext
          ? { contextType: pendingContext.type, contextEntityId: pendingContext.id }
          : caps.allowedContextTypes?.[0] === 'organization'
            ? { contextType: 'organization' as AssistantContextType }
            : undefined
        const { conversation, error: err } = await createConversation(opts)
        if (!conversation) { setError(err ?? 'Не удалось создать диалог.'); return }
        conv = conversation
        setActiveConv(conversation)
        setMessages([])
        // Контекст применён к созданному диалогу: запоминаем подпись
        // (ревью #3 — контекст активного диалога должен оставаться виден)
        // и сбрасываем pending, чтобы он не «прилип» к следующему диалогу.
        if (pendingContext) {
          const label = pendingContext.label
          setContextLabels(prev => ({ ...prev, [conversation.id]: label }))
        }
        setPendingContext(null)
      }

      const now = new Date().toISOString()
      const assistantId = `tmp-a-${now}`
      setMessages(m => [
        ...m,
        { id: `tmp-u-${now}`, sender_type: 'user', content: text.trim(), status: 'ok', created_at: now },
        { id: assistantId, sender_type: 'assistant', content: '', status: 'ok', created_at: now },
      ])
      setInput('')
      setStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      const result = await sendAssistantMessage({
        conversationId: conv.id,
        content: text.trim(),
        signal: controller.signal,
        onChunk: chunk => {
          // Чанки адресуются плейсхолдеру по id (ревью #2): «последний
          // элемент массива» ломался при удалении/смене диалога во время
          // стрима — TypeError либо дописывание в чужой пузырь.
          setMessages(m => {
            const idx = m.findIndex(x => x.id === assistantId)
            if (idx === -1) return m
            const next = [...m]
            next[idx] = { ...next[idx], content: next[idx].content + chunk }
            return next
          })
        },
      })

      setStreaming(false)
      abortRef.current = null
      setMessages(m => {
        const idx = m.findIndex(x => x.id === assistantId)
        // trim: провайдер может прислать только переводы строк — сервер
        // такой ответ не сохраняет и квоту не списывает, значит и пузыря
        // в переписке быть не должно (иначе пустая рамка рядом с ошибкой).
        if (idx !== -1 && !m[idx].content.trim()) return m.filter(x => x.id !== assistantId)
        return m
      })
      if (result.error) setError(result.error)
      if (result.interrupted) setError('Ответ прерван — попробуйте ещё раз.')
      if (result.ok) void reloadCaps()
    } finally {
      sendingRef.current = false
    }
  }, [activeConv, caps, streaming, pendingContext, reloadCaps])

  // ── Гейт 1: на публичных страницах компонента не существует ────────────
  if (isAssistantPublicPath(pathname ?? '/')) return null
  if (!hasSession) return null
  if (!caps?.available) return null // роль/тариф без AI или ещё грузится

  const usage = caps.usage
  const exhausted = !!usage && usage.remaining <= 0
  const resetLabel = usage
    ? new Date(usage.resetsAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    : ''

  return (
    <>
      {/* Плавающая кнопка (закрытое состояние) */}
      {!open && (
        <button
          ref={buttonRef}
          type="button"
          aria-label="AI-помощник"
          title="AI-помощник"
          onClick={() => {
            setOpen(true)
            if (caps.historyEnabled) void loadHistory()
            setTimeout(() => inputRef.current?.focus(), 120)
          }}
          className="fixed bottom-24 right-4 z-[9996] flex h-14 w-14 items-center justify-center rounded-full shadow-[0_12px_40px_rgba(243,87,3,0.45)] transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 lg:bottom-6 lg:right-6"
          style={{ background: 'linear-gradient(135deg,#F35703 0%,#D44A02 60%,#7C3AED 130%)' }}
        >
          <i className="ki-filled ki-message-question text-xl text-white" />
        </button>
      )}

      {/* Панель (открытое состояние): mobile — bottom sheet, desktop — карточка */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={caps.assistantName}
          className="fixed inset-x-2 bottom-20 z-[9998] flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_32px_80px_rgba(0,0,0,0.28)] lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[420px]"
          style={{ height: 'min(600px, 78vh)' }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between gap-2 px-4 py-3"
            style={{ background: 'linear-gradient(135deg,#0F172A,#312E81)' }}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-bold leading-tight text-white">{caps.assistantName}</div>
              <div className="mt-0.5 text-[10px] text-white/70">
                {usage ? `${usage.remaining} / ${usage.limit} запросов · до ${resetLabel}` : 'Sporteo AI'}
                {usage?.scope === 'org' ? ' · пул клуба' : ''}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {caps.historyEnabled && (
                <button
                  onClick={() => { setShowHistory(s => !s); if (!showHistory) void loadHistory() }}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/15 ${showHistory ? 'bg-white/15' : ''}`}
                  title="История диалогов"
                  aria-label="История диалогов"
                >
                  <i className="ki-filled ki-time text-[12px] text-white/80" />
                </button>
              )}
              {(messages.length > 0 || activeConv) && !streaming && (
                <button
                  onClick={() => { setActiveConv(null); setMessages([]); setError(null); setPendingContext(null) }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/15"
                  title="Новый диалог"
                  aria-label="Новый диалог"
                >
                  <i className="ki-filled ki-plus text-[12px] text-white/80" />
                </button>
              )}
              <button
                onClick={() => { setOpen(false); buttonRef.current?.focus() }}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/15"
                title="Закрыть"
                aria-label="Закрыть AI-помощника"
              >
                <i className="ki-filled ki-cross text-[12px] text-white" />
              </button>
            </div>
          </div>

          {/* Выбранный контекст: до создания диалога — pending (можно убрать),
              после — контекст активного диалога (ревью #3: раньше плашка
              исчезала сразу после первого сообщения, и было не видно,
              о ком идёт разговор). */}
          {pendingContext && !activeConv ? (
            <div className="flex items-center justify-between gap-2 border-b border-border bg-orange-50 px-4 py-2">
              <span className="truncate text-xs text-orange-800">
                Контекст: <strong>{pendingContext.label}</strong>
              </span>
              <button
                onClick={() => setPendingContext(null)}
                className="text-2xs font-semibold text-orange-700 hover:underline"
              >
                очистить
              </button>
            </div>
          ) : activeConv?.context_type && activeConv.context_type !== 'organization' ? (
            <div className="border-b border-border bg-orange-50 px-4 py-2">
              <span className="block truncate text-xs text-orange-800">
                Контекст диалога:{' '}
                <strong>
                  {contextLabels[activeConv.id]
                    ?? (activeConv.context_type === 'athlete' ? 'выбранный спортсмен' : 'выбранный пациент')}
                </strong>
              </span>
            </div>
          ) : null}

          {/* История (панель поверх ленты) */}
          {showHistory ? (
            <div className="flex-1 overflow-y-auto bg-background/60">
              {conversations.length === 0 ? (
                <p className="px-4 py-10 text-center text-xs text-muted-foreground">История пуста.</p>
              ) : conversations.map(c => (
                <div key={c.id} className="group flex items-center gap-1 border-b border-border px-4 py-2.5 hover:bg-muted/40">
                  <button onClick={() => openConversation(c)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-xs font-medium text-foreground">{c.title ?? 'Новый диалог'}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(c.updated_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </div>
                  </button>
                  <button
                    onClick={async () => {
                      // Удаление активного диалога прерывает его стрим (ревью #2).
                      if (activeConv?.id === c.id) abortRef.current?.abort()
                      if (await deleteConversation(c.id)) {
                        setConversations(prev => prev.filter(x => x.id !== c.id))
                        if (activeConv?.id === c.id) { setActiveConv(null); setMessages([]) }
                      }
                    }}
                    className="hidden h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-600 group-hover:flex"
                    aria-label="Удалить диалог"
                  >
                    <i className="ki-filled ki-trash text-[11px]" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-background/60 px-4 py-3">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-border bg-card px-3 py-2.5 text-xs leading-relaxed text-foreground">
                    {caps.tagline}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(caps.starterPrompts ?? []).map(p => (
                      <button key={p} onClick={() => send(p)} disabled={exhausted}
                        className="rounded-full border border-border bg-card px-2.5 py-1 text-2xs font-semibold text-foreground transition hover:bg-accent disabled:opacity-40">
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => {
                const isLast = i === messages.length - 1
                const showTyping = streaming && isLast && m.sender_type === 'assistant' && !m.content
                return (
                  <div key={m.id} className={`flex ${m.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      m.sender_type === 'user'
                        ? 'whitespace-pre-wrap rounded-br-sm bg-orange-500 text-white'
                        : 'rounded-bl-sm border border-border bg-card text-foreground'
                    }`}>
                      {m.sender_type === 'assistant' ? (
                        showTyping ? <TypingDots /> : (
                          <>
                            <div dangerouslySetInnerHTML={{ __html: renderMarkdownLite(m.content) }} />
                            {m.status === 'stopped' && (
                              <div className="mt-1 text-2xs text-muted-foreground">— генерация остановлена</div>
                            )}
                          </>
                        )
                      ) : m.content}
                    </div>
                  </div>
                )
              })}
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>
              )}
            </div>
          )}

          {/* Ввод / quota reached */}
          <div className="border-t border-border bg-card px-3 py-2.5">
            {exhausted ? (
              <div className="flex flex-wrap items-center justify-between gap-2 py-1">
                <p className="text-xs text-muted-foreground">
                  Лимит исчерпан · обновится {resetLabel}. История доступна.
                </p>
                {usage?.scope === 'org' ? (
                  <span className="text-2xs font-semibold text-muted-foreground">
                    Обратитесь к администратору клуба
                  </span>
                ) : (
                  <Link href="/pricing"
                    className="rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600">
                    Повысить тариф
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.repeat) return // зажатый Enter — не очередь отправок
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
                    }}
                    placeholder="Спросите что-нибудь…"
                    rows={1}
                    maxLength={caps.maxMessageLength}
                    aria-label="Сообщение AI-помощнику"
                    className="max-h-28 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-orange-400"
                    style={{ minHeight: 38 }}
                  />
                  {streaming ? (
                    <button onClick={stop}
                      className="flex h-9 items-center gap-1.5 rounded-xl bg-slate-700 px-3 text-xs font-semibold text-white hover:bg-slate-800"
                      aria-label="Остановить генерацию">
                      <i className="ki-filled ki-cross text-[11px]" /> Стоп
                    </button>
                  ) : (
                    <button onClick={() => send(input)} disabled={!input.trim()}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40"
                      aria-label="Отправить">
                      <i className="ki-filled ki-paper-plane text-[13px]" />
                    </button>
                  )}
                </div>
                <div className="mt-1 text-center text-[9px] text-muted-foreground">
                  Enter — отправить · Shift+Enter — новая строка
                </div>
              </>
            )}
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
