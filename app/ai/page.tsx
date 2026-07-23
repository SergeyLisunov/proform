'use client'
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import { streamChat } from '@/lib/ai/chat-client'
import { renderMarkdownLite } from '@/lib/markdown-lite'

type TabKey = 'hub' | 'assistant' | 'week' | 'video' | 'voice' | 'coach' | 'diary-search'

type Feature = {
  key: TabKey
  icon: string
  title: string
  subtitle: string
  badge?: string
  href?: string
  color: string
  bg: string
  border: string
  roles: string[]
}

const FEATURES: Feature[] = [
  {
    key: 'assistant',
    icon: 'ki-message-question',
    title: 'AI Ассистент',
    subtitle: 'Вопросы по тренировкам, восстановлению, планированию',
    badge: 'Чат',
    color: '#7C3AED',
    bg: '#FAF5FF',
    border: '#E9D5FF',
    roles: ['athlete', 'coach', 'doctor', 'admin', 'organization'],
  },
  {
    key: 'week',
    icon: 'ki-message-programming',
    title: 'Разбор недели',
    subtitle: 'Тренды, риски и рекомендации на основе ваших данных',
    href: '/insights',
    color: '#0EA5E9',
    bg: '#F0F9FF',
    border: '#BAE6FD',
    roles: ['athlete', 'admin'],
  },
  {
    key: 'video',
    icon: 'ki-screen',
    title: 'Видеоразбор техники',
    subtitle: 'Загрузите видео — AI разберёт технику по кадрам',
    href: '/form-analysis',
    color: '#F43F5E',
    bg: '#FFF1F2',
    border: '#FECDD3',
    roles: ['athlete', 'coach', 'admin'],
  },
  {
    key: 'voice',
    icon: 'ki-message-text-2',
    title: 'Голос → тренировка',
    subtitle: 'Надиктуйте — AI соберёт карточку тренировки',
    href: '/quick',
    color: '#8B5CF6',
    bg: '#F5F3FF',
    border: '#DDD6FE',
    roles: ['athlete', 'admin'],
  },
  {
    key: 'coach',
    icon: 'ki-people',
    title: 'Инструменты тренера',
    subtitle: 'Брифинг по атлету, предложения тренировок, медсводки',
    badge: 'Coach',
    color: '#16A34A',
    bg: '#F0FDF4',
    border: '#BBF7D0',
    roles: ['coach', 'doctor', 'admin'],
  },
  {
    key: 'diary-search',
    icon: 'ki-magnifier',
    title: 'Поиск по смыслу',
    subtitle: 'Семантический поиск по заметкам и тренировкам',
    href: '/diary/search',
    color: '#2563EB',
    bg: '#EFF6FF',
    border: '#BFDBFE',
    roles: ['athlete', 'coach', 'doctor', 'admin'],
  },
]

function Tab({ active, onClick, children, icon }: { active: boolean; onClick: () => void; children: React.ReactNode; icon: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
        active
          ? 'bg-gradient-to-r from-[#7C3AED] to-[#5B21B6] text-white shadow-md shadow-purple-500/25'
          : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <i className={`ki-filled ${icon} text-[13px]`} />
      {children}
    </button>
  )
}

function FeatureCard({ f, onOpen }: { f: Feature; onOpen: (f: Feature) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(f)}
      className="group flex flex-col gap-3 rounded-2xl border bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg"
      style={{ borderColor: f.border }}
    >
      <div className="flex items-start justify-between gap-3">
        <div style={{ width: 44, height: 44, borderRadius: 14, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className={`ki-filled ${f.icon} text-base`} style={{ color: f.color }} />
        </div>
        {f.badge && (
          <span
            className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ background: f.bg, color: f.color, borderColor: f.border }}
          >
            {f.badge}
          </span>
        )}
      </div>
      <div>
        <div className="text-base font-semibold text-foreground">{f.title}</div>
        <div className="mt-1.5 text-[13px] leading-5 text-muted-foreground">{f.subtitle}</div>
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold" style={{ color: f.color }}>
        Открыть
        <i className="ki-filled ki-right text-[11px] transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  )
}

// ── Мини-чат ассистента ───────────────────────────────────────────────────────

type ChatMsg = { role: 'user' | 'assistant'; content: string }

function AssistantChat() {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => () => abortRef.current?.abort(), [])

  const stop = useCallback(() => abortRef.current?.abort(), [])

  // Стриминг через /api/ai/chat (Gemma 4): чанки дописываются в последнее
  // assistant-сообщение по мере генерации; общий хелпер с AiChatBubble.
  const send = useCallback(async () => {
    const q = input.trim()
    if (!q || loading) return
    setError(null)
    setInput('')
    const history = messages.slice(-8)
    setMessages(prev => [...prev, { role: 'user', content: q }, { role: 'assistant', content: '' }])
    setLoading(true)

    const controller = new AbortController()
    abortRef.current = controller

    const result = await streamChat({
      question: q,
      history,
      signal: controller.signal,
      onChunk: chunk => {
        setMessages(prev => {
          const next = [...prev]
          const last = next[next.length - 1]
          next[next.length - 1] = { ...last, content: last.content + chunk }
          return next
        })
      },
    })

    setLoading(false)
    abortRef.current = null
    setMessages(prev => {
      const last = prev[prev.length - 1]
      if (last?.role === 'assistant' && !last.content) return prev.slice(0, -1)
      return prev
    })
    if (result.error) setError(result.error)
    if (result.interrupted) setError('Ответ прерван — попробуйте ещё раз.')
  }, [input, loading, messages])

  const suggestions = useMemo(
    () => [
      'Как распланировать неделю под силовые?',
      'Почему у меня низкое восстановление?',
      'Что делать при переутомлении?',
      'Какие зоны ЧСС нужны для аэробной базы?',
    ],
    []
  )

  return (
    <div className="flex flex-col rounded-2xl border border-[#E9D5FF] bg-white overflow-hidden" style={{ minHeight: 560 }}>
      <div className="flex items-center gap-3 border-b border-[#E9D5FF] bg-gradient-to-r from-[#FAF5FF] to-white px-5 py-4">
        <div style={{ width: 36, height: 36, borderRadius: 12, background: '#FAF5FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="ki-filled ki-message-question text-sm" style={{ color: '#7C3AED' }} />
        </div>
        <div>
          <div className="text-sm font-semibold text-foreground">Sporteo AI Ассистент</div>
          <div className="text-[11px] text-muted-foreground">Задайте вопрос по тренировкам, сну, восстановлению</div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3" style={{ minHeight: 360, maxHeight: 480 }}>
        {messages.length === 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Попробуйте спросить:</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setInput(s)}
                  className="rounded-full border border-[#E9D5FF] bg-[#FAF5FF] px-3 py-1.5 text-xs font-medium text-[#7C3AED] hover:bg-[#F3E8FF]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => {
          const showTyping = loading && i === messages.length - 1 && m.role === 'assistant' && !m.content
          return (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-gradient-to-r from-[#7C3AED] to-[#5B21B6] text-white rounded-tr-sm'
                    : 'bg-[#F8FAFC] text-foreground rounded-tl-sm border border-[#E2E8F0]'
                }`}
              >
                {m.role === 'assistant' ? (
                  showTyping ? (
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" style={{ animationDelay: '120ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" style={{ animationDelay: '240ms' }} />
                      думаю…
                    </span>
                  ) : (
                    // renderMarkdownLite экранирует весь ввод до замен — XSS-safe
                    <div dangerouslySetInnerHTML={{ __html: renderMarkdownLite(m.content) }} />
                  )
                ) : (
                  m.content
                )}
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <div className="border-t border-red-100 bg-red-50 px-5 py-2 text-xs text-red-700">{error}</div>
      )}

      <div className="border-t border-[#E9D5FF] bg-white p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Спросите что-нибудь…"
            rows={1}
            maxLength={2000}
            className="flex-1 resize-none rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm outline-none focus:border-[#7C3AED]/50 focus:bg-white"
            style={{ maxHeight: 140 }}
          />
          {loading ? (
            <button
              type="button"
              onClick={stop}
              className="rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800"
            >
              Остановить
            </button>
          ) : (
            <button
              type="button"
              onClick={send}
              disabled={!input.trim()}
              className="rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#5B21B6] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            >
              Отправить
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Карточки для табов «coach tools» (ссылки на существующие API-скрипты) ────

function CoachToolsPanel({ role }: { role: string | undefined }) {
  const tools = [
    { title: 'Брифинг по атлету', subtitle: 'Краткое резюме состояния выбранного атлета', href: '/athletes', icon: 'ki-people', color: '#16A34A', bg: '#F0FDF4' },
    { title: 'Предложения тренировок', subtitle: 'AI-подсказки по плану на следующую неделю', href: '/athletes', icon: 'ki-information-2', color: '#F35703', bg: '#FEF0E7' },
    { title: 'Детектор аномалий', subtitle: 'Автоматический поиск просадок HRV / сна / нагрузки', href: '/analytics', icon: 'ki-shield-tick', color: '#DC2626', bg: '#FEF2F2' },
    { title: 'Медицинское резюме', subtitle: 'Сводка для врача / консилиума по атлету', href: '/athletes', icon: 'ki-note-2', color: '#0D9488', bg: '#F0FDFA' },
  ]
  const isDoctor = role === 'doctor'
  const filtered = isDoctor ? tools.filter(t => t.title !== 'Предложения тренировок') : tools
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {filtered.map(t => (
        <Link
          key={t.title}
          href={t.href}
          className="flex flex-col gap-2 rounded-2xl border border-[#E2E8F0] bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div style={{ width: 40, height: 40, borderRadius: 12, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className={`ki-filled ${t.icon} text-sm`} style={{ color: t.color }} />
          </div>
          <div className="text-sm font-semibold text-foreground mt-1">{t.title}</div>
          <div className="text-[12px] leading-5 text-muted-foreground">{t.subtitle}</div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: t.color }}>
            Перейти <i className="ki-filled ki-right text-[10px]" />
          </div>
        </Link>
      ))}
    </div>
  )
}

export default function AiHubPage() {
  const { user, loading } = useUser()
  const [tab, setTab] = useState<TabKey>('hub')

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }
  if (!user) return null

  const visible = FEATURES.filter(f => f.roles.includes(user.role))

  const onOpen = (f: Feature) => {
    if (f.key === 'assistant') setTab('assistant')
    else if (f.key === 'coach') setTab('coach')
    else if (f.href) window.location.href = f.href
  }

  return (
    <div className="flex flex-col gap-6 pf-page-enter">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-[#E9D5FF] bg-gradient-to-br from-[#FAF5FF] via-white to-[#F0F9FF] p-6 md:p-8">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-gradient-to-br from-purple-200/50 to-blue-200/40 blur-3xl" />
        <div className="relative flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E9D5FF] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#7C3AED]">
              <i className="ki-filled ki-message-programming text-[11px]" />
              Sporteo AI
            </span>
            <span className="inline-flex items-center rounded-full border border-[#BAE6FD] bg-[#F0F9FF] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0EA5E9]">
              Beta
            </span>
          </div>
          <h1 className="pf-num text-3xl md:text-4xl leading-tight text-navy-500">Умные инструменты</h1>
          <p className="max-w-2xl text-sm md:text-base text-muted-foreground">
            Всё, что связано с AI — в одном месте: ассистент, недельные разборы, видеоанализ, голосовой ввод и инструменты для тренера / врача.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <Tab icon="ki-abstract-26" active={tab === 'hub'} onClick={() => setTab('hub')}>Обзор</Tab>
        <Tab icon="ki-message-question" active={tab === 'assistant'} onClick={() => setTab('assistant')}>Ассистент</Tab>
        {(user.role === 'coach' || user.role === 'doctor' || user.role === 'admin') && (
          <Tab icon="ki-people" active={tab === 'coach'} onClick={() => setTab('coach')}>
            Инструменты тренера
          </Tab>
        )}
      </div>

      {/* Content */}
      {tab === 'hub' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map(f => (
              <FeatureCard key={f.key} f={f} onOpen={onOpen} />
            ))}
          </div>
          <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs text-muted-foreground">
            <i className="ki-filled ki-information-2 text-xs" /> Подсказка: нажмите <kbd className="mx-1 rounded border border-[#E2E8F0] bg-white px-1.5 py-0.5 text-[10px] font-bold">⌘K</kbd>
            в любом разделе, чтобы быстро вызвать команду или задать вопрос ассистенту.
          </div>
        </>
      )}

      {tab === 'assistant' && <AssistantChat />}

      {tab === 'coach' && <CoachToolsPanel role={user.role} />}
    </div>
  )
}
