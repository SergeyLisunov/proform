'use client'

/**
 * /assistant — раздел «AI-помощник» личного кабинета Sporteo.
 *
 * Единый route для всех ролей: сервер (GET /api/assistant/capabilities)
 * решает, КАКОЙ ассистент показать (врач/тренер/спортсмен/организация),
 * какие подсказки, есть ли история и сколько запросов осталось. Клиент
 * ничего не решает и не содержит промптов.
 *
 * Состояния: загрузка, роль-без-ассистента, тариф-без-AI (upgrade CTA),
 * пустой диалог, генерация (стоп-кнопка), ошибка, лимит исчерпан
 * (история доступна, ввод закрыт, дата сброса + CTA), предупреждения
 * 80/95%.
 */
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/metronic'
import { renderMarkdownLite } from '@/lib/markdown-lite'
import {
  fetchCapabilities, listConversations, createConversation,
  fetchConversation, deleteConversation, sendAssistantMessage,
} from '@/lib/ai/assistant/client'
import type {
  AssistantCapabilities, ConversationSummary, AssistantMessage, AssistantContextType,
} from '@/lib/ai/assistant/types'

interface ContextOption { id: string; name: string }

export default function AssistantPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="pf-spin h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    }>
      <AssistantPageInner />
    </Suspense>
  )
}

function AssistantPageInner() {
  const search = useSearchParams()
  const [caps, setCaps] = useState<AssistantCapabilities | null | 'loading'>('loading')
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeConv, setActiveConv] = useState<ConversationSummary | null>(null)
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contextOptions, setContextOptions] = useState<ContextOption[]>([])
  const [pendingContextId, setPendingContextId] = useState<string>('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const reloadCaps = useCallback(async () => {
    setCaps(await fetchCapabilities())
  }, [])

  // Начальная загрузка: capabilities + история + варианты контекста роли.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const c = await fetchCapabilities()
      if (cancelled) return
      setCaps(c)
      if (!c?.available) return
      if (c.historyEnabled) {
        const list = await listConversations()
        if (!cancelled) setConversations(list)
      }
      if (c.allowedContextTypes?.length) {
        const opts = await loadContextOptions(c.allowedContextTypes[0])
        if (!cancelled) setContextOptions(opts)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Контекстный переход: /assistant?context=athlete:<uuid> из карточек.
  useEffect(() => {
    const ctx = search.get('context')
    if (ctx) {
      const [, id] = ctx.split(':')
      if (id) setPendingContextId(id)
    }
  }, [search])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, streaming])

  useEffect(() => () => abortRef.current?.abort(), [])

  const stop = useCallback(() => abortRef.current?.abort(), [])

  async function openConversation(conv: ConversationSummary) {
    setActiveConv(conv)
    setError(null)
    const { messages: msgs, error: err } = await fetchConversation(conv.id)
    setMessages(msgs)
    if (err) setError(err)
  }

  async function startNewConversation(): Promise<ConversationSummary | null> {
    if (caps === 'loading' || !caps?.available) return null
    const ct = caps.allowedContextTypes?.[0]
    const opts = ct && pendingContextId
      ? { contextType: ct as AssistantContextType, contextEntityId: pendingContextId }
      : ct === 'organization'
        ? { contextType: 'organization' as AssistantContextType }
        : undefined
    const { conversation, error: err } = await createConversation(opts)
    if (!conversation) { setError(err ?? 'Не удалось создать диалог.'); return null }
    setConversations(prev => [conversation, ...prev])
    setActiveConv(conversation)
    setMessages([])
    return conversation
  }

  const send = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return
    if (caps === 'loading' || !caps?.available) return
    setError(null)

    let conv = activeConv
    if (!conv) {
      conv = await startNewConversation()
      if (!conv) return
    }

    const now = new Date().toISOString()
    setMessages(m => [
      ...m,
      { id: `tmp-u-${now}`, sender_type: 'user', content: text.trim(), status: 'ok', created_at: now },
      { id: `tmp-a-${now}`, sender_type: 'assistant', content: '', status: 'ok', created_at: now },
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
      if (last?.sender_type === 'assistant' && !last.content) return m.slice(0, -1)
      return m
    })
    if (result.error) setError(result.error)
    if (result.interrupted) setError('Ответ прерван — попробуйте ещё раз.')
    if (result.ok) void reloadCaps() // обновить остаток лимита
  }, [activeConv, caps, streaming, pendingContextId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Состояния до основного UI ───────────────────────────────────────────
  if (caps === 'loading') {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="pf-spin h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    )
  }
  if (!caps) {
    return <CenteredNote icon="ki-shield-cross" title="Войдите в аккаунт"
      body={<Link href="/auth/login?next=/assistant" className="text-sm font-semibold text-orange-600 hover:underline">→ Войти</Link>} />
  }
  if (!caps.available) {
    return (
      <CenteredNote icon="ki-message-programming" title="AI-помощник недоступен"
        body={
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{caps.unavailableReason}</p>
            {caps.upgrade && (
              <Link href={caps.upgrade.href}
                className="inline-block rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">
                {caps.upgrade.cta}
              </Link>
            )}
          </div>
        } />
    )
  }

  const usage = caps.usage
  const exhausted = !!usage && usage.remaining <= 0
  const usagePct = usage && usage.limit > 0 ? usage.used / usage.limit : 0
  const resetLabel = usage
    ? new Date(usage.resetsAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    : ''

  return (
    <div className="pf-enter mx-auto max-w-6xl px-4 py-6">
      {/* Заголовок роли + лимит */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Sporteo AI</p>
          <h1 className="text-2xl font-bold tracking-tight text-navy-500">{caps.assistantName}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{caps.tagline}</p>
        </div>
        {usage && (
          <div className="rounded-xl border border-border bg-card px-4 py-2.5 text-right">
            <div className="pf-num text-lg text-foreground">
              {usage.remaining}<span className="text-xs text-muted-foreground"> / {usage.limit}</span>
            </div>
            <div className="text-2xs text-muted-foreground">
              запросов до {resetLabel}{usage.scope === 'org' ? ' · пул клуба' : ''}
            </div>
          </div>
        )}
      </div>

      {/* Предупреждения 80 / 95 / 100% */}
      {usage && !exhausted && usagePct >= 0.8 && (
        <div className={`mb-3 rounded-xl border px-4 py-2.5 text-xs ${
          usagePct >= 0.95 ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'
        }`}>
          Использовано {Math.round(usagePct * 100)}% лимита. Обновление — {resetLabel}.{' '}
          <Link href="/pricing" className="font-semibold underline">Расширить тариф</Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        {/* Левая колонка: новый диалог, контекст, история */}
        <div className="space-y-3">
          <button
            onClick={() => { setActiveConv(null); setMessages([]); setError(null) }}
            className="w-full rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Новый диалог
          </button>

          {contextOptions.length > 0 && (
            <Card className="p-3">
              <label className="mb-1.5 block text-2xs font-bold uppercase tracking-wide text-muted-foreground">
                {caps.role === 'doctor' ? 'Пациент' : 'Спортсмен'} (контекст)
              </label>
              <select
                value={pendingContextId}
                onChange={e => setPendingContextId(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-orange-400"
              >
                <option value="">Без конкретного {caps.role === 'doctor' ? 'пациента' : 'спортсмена'}</option>
                {contextOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <p className="mt-1.5 text-2xs text-muted-foreground">
                Применяется к новому диалогу; доступ проверяется на сервере.
              </p>
            </Card>
          )}

          {caps.historyEnabled && conversations.length > 0 && (
            <Card className="overflow-hidden">
              <div className="border-b border-border bg-muted/40 px-3 py-2 text-2xs font-bold uppercase tracking-wide text-muted-foreground">
                История
              </div>
              <div className="max-h-[320px] overflow-y-auto">
                {conversations.map(c => (
                  <div key={c.id} className={`group flex items-center gap-1 border-b border-border px-3 py-2 ${
                    activeConv?.id === c.id ? 'bg-orange-50' : 'hover:bg-muted/40'
                  }`}>
                    <button onClick={() => openConversation(c)} className="min-w-0 flex-1 text-left">
                      <div className="truncate text-xs font-medium text-foreground">{c.title ?? 'Новый диалог'}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(c.updated_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </div>
                    </button>
                    <button
                      onClick={async () => {
                        if (await deleteConversation(c.id)) {
                          setConversations(prev => prev.filter(x => x.id !== c.id))
                          if (activeConv?.id === c.id) { setActiveConv(null); setMessages([]) }
                        }
                      }}
                      className="hidden h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-600 group-hover:flex"
                      title="Удалить диалог"
                    >
                      <i className="ki-filled ki-trash text-[11px]" />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
            AI-помощник готовит черновики и советы — не заменяет врача и решений
            специалистов. Действия (отправка, изменения) вы подтверждаете сами.
          </p>
        </div>

        {/* Чат */}
        <Card className="flex min-h-[520px] flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-background/60 px-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-card px-3 py-2.5 text-xs leading-relaxed text-foreground">
                  {caps.tagline}. Начните с подсказки или задайте свой вопрос:
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

          {/* Ввод / limit reached */}
          <div className="border-t border-border bg-card px-3 py-2.5">
            {exhausted ? (
              <div className="flex flex-wrap items-center justify-between gap-2 py-1">
                <p className="text-xs text-muted-foreground">
                  Лимит AI-запросов исчерпан. Обновится {resetLabel}. История остаётся доступной.
                </p>
                <Link href="/pricing"
                  className="rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600">
                  Повысить тариф
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
                    placeholder="Спросите что-нибудь…"
                    rows={1}
                    maxLength={caps.maxMessageLength}
                    className="max-h-32 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-orange-400"
                    style={{ minHeight: 38 }}
                  />
                  {streaming ? (
                    <button onClick={stop}
                      className="flex h-9 items-center gap-1.5 rounded-xl bg-slate-700 px-3 text-xs font-semibold text-white hover:bg-slate-800">
                      <i className="ki-filled ki-cross text-[11px]" /> Стоп
                    </button>
                  ) : (
                    <button onClick={() => send(input)} disabled={!input.trim()}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40">
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
        </Card>
      </div>
    </div>
  )
}

/** Списки контекста роли — читаются ПОД RLS пользователя (чужого не отдаст). */
async function loadContextOptions(ct: AssistantContextType): Promise<ContextOption[]> {
  const sb = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return []
  const { data: me } = await sbAny.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  if (!me) return []
  const myId = (me as { id: string }).id

  if (ct === 'athlete') {
    const { data: links } = await sbAny.from('trainer_athletes')
      .select('athlete_id').eq('trainer_id', myId).eq('status', 'accepted').limit(50)
    const ids = ((links ?? []) as Array<{ athlete_id: string }>).map(l => l.athlete_id)
    if (!ids.length) return []
    const { data: users } = await sbAny.from('users').select('id, name').in('id', ids)
    return ((users ?? []) as Array<{ id: string; name: string | null }>)
      .map(u => ({ id: u.id, name: u.name ?? 'Без имени' }))
  }
  if (ct === 'patient') {
    const { data: conns } = await sbAny.from('connections')
      .select('initiator_id, recipient_id')
      .eq('connection_type', 'doctor_athlete').eq('status', 'active')
      .or(`initiator_id.eq.${myId},recipient_id.eq.${myId}`)
      .limit(50)
    const ids = ((conns ?? []) as Array<{ initiator_id: string; recipient_id: string }>)
      .map(c => (c.initiator_id === myId ? c.recipient_id : c.initiator_id))
    if (!ids.length) return []
    const { data: users } = await sbAny.from('users').select('id, name').in('id', ids)
    return ((users ?? []) as Array<{ id: string; name: string | null }>)
      .map(u => ({ id: u.id, name: u.name ?? 'Без имени' }))
  }
  return [] // organization: всегда своя, выбор не нужен
}

function CenteredNote({ icon, title, body }: { icon: string; title: string; body: React.ReactNode }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 px-4 text-center">
      <i className={`ki-filled ${icon} text-3xl text-muted-foreground`} />
      <h1 className="text-lg font-bold text-navy-500">{title}</h1>
      {body}
    </div>
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
