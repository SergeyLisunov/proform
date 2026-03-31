'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/lib/hooks/useUser'

type ChatUser = { id: string; name: string; email: string; role: string }
type Chat = {
  id: string; athlete_id: string; coach_id: string
  created_at: string; updated_at: string
  other_user: ChatUser; last_message?: string; unread_count: number
}
type Message = {
  id: string; chat_id: string; sender_id: string
  body: string; is_read: boolean; created_at: string
}

function getSB() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function fmtTime(iso: string) {
  const d = new Date(iso), now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

const AVATAR_COLORS = ['#f97316','#2563eb','#16a34a','#9333ea','#0284c7','#dc2626','#d97706']

function getColor(name: string) {
  return AVATAR_COLORS[(name.charCodeAt(0) + name.charCodeAt(1 % name.length)) % AVATAR_COLORS.length]
}

function getInitials(name: string) {
  return name.split(' ').map(p => p[0] ?? '').join('').slice(0, 2).toUpperCase() || '?'
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 40, ring = false }: { name: string; size?: number; ring?: boolean }) {
  const color = getColor(name || '?')
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${color}30 0%, ${color}60 100%)`,
      border: ring ? `2px solid ${color}` : `1.5px solid ${color}30`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 800, color,
      letterSpacing: '-0.02em',
    }}>
      {getInitials(name)}
    </div>
  )
}

// ── New Chat Modal ─────────────────────────────────────────────────────────────
function NewChatModal({ currentUser, onClose, onCreated }: {
  currentUser: ChatUser; onClose: () => void; onCreated: (chat: Chat) => void
}) {
  const [users, setUsers] = useState<ChatUser[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const sb = getSB()
    const role = currentUser.role === 'athlete' ? 'coach' : 'athlete'
    sb.from('users').select('id,name,email,role').eq('role', role)
      .then(({ data }) => { setUsers(data ?? []); setLoading(false) })
  }, [currentUser.role])

  async function start(other: ChatUser) {
    setCreating(other.id)
    const sb = getSB()
    const athleteId = currentUser.role === 'athlete' ? currentUser.id : other.id
    const coachId   = currentUser.role === 'coach'   ? currentUser.id : other.id
    const { data, error } = await sb
      .from('chats')
      .upsert({ athlete_id: athleteId, coach_id: coachId }, { onConflict: 'athlete_id,coach_id' })
      .select().single()
    if (!error && data) onCreated({ ...data, other_user: other, unread_count: 0 })
    setCreating(null)
  }

  const filtered = users.filter(u => (u.name || u.email).toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(8px)' }} />
      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 420,
        background: 'var(--card)', borderRadius: 24, overflow: 'hidden',
        border: '1px solid var(--border)',
        boxShadow: '0 40px 100px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.05)',
      }}>
        <div style={{ padding: '22px 24px 16px', background: 'linear-gradient(135deg, rgba(249,115,22,0.05), transparent)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>Новый диалог</p>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', margin: '2px 0 0' }}>
                {currentUser.role === 'athlete' ? 'Выбери тренера' : 'Выбери атлета'}
              </h3>
            </div>
            <button onClick={onClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
              <i className="ki-filled ki-cross text-sm" />
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <i className="ki-filled ki-magnifier" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', fontSize: 13 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..."
              style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.currentTarget.style.borderColor = '#f97316'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            />
          </div>
        </div>
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>
              {search ? 'Никого не найдено' : 'Нет доступных пользователей'}
            </div>
          ) : filtered.map(u => (
            <button key={u.id} onClick={() => start(u)} disabled={!!creating}
              style={{ width: '100%', padding: '13px 24px', display: 'flex', alignItems: 'center', gap: 13, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}
              className="hover:bg-accent/60 transition-colors">
              <Avatar name={u.name || u.email} size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>{u.name || u.email}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
                  {u.role === 'coach' ? '🏋️ Тренер' : '🏃 Атлет'}
                </div>
              </div>
              {creating === u.id
                ? <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                : <div style={{ width: 28, height: 28, borderRadius: 8, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="ki-filled ki-arrow-right text-orange-500 text-xs" />
                  </div>
              }
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Chat Window Modal ──────────────────────────────────────────────────────────
function ChatModal({ chat, currentUserId, onClose, onUnreadChange }: {
  chat: Chat; currentUserId: string; onClose: () => void; onUnreadChange: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const sb = getSB()
    sb.from('messages').select('*').eq('chat_id', chat.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => { setMessages(data ?? []); setLoading(false) })

    sb.from('messages').update({ is_read: true })
      .eq('chat_id', chat.id).neq('sender_id', currentUserId).eq('is_read', false)
      .then(() => onUnreadChange())

    const channel = sb.channel(`chat:${chat.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chat.id}` },
        p => {
          const msg = p.new as Message
          setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
          if (msg.sender_id !== currentUserId)
            sb.from('messages').update({ is_read: true }).eq('id', msg.id).then(() => onUnreadChange())
        })
      .subscribe()

    setTimeout(() => inputRef.current?.focus(), 200)
    return () => { sb.removeChannel(channel) }
  }, [chat.id, currentUserId, onUnreadChange])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true); setText('')
    const sb = getSB()
    await sb.from('messages').insert({ chat_id: chat.id, sender_id: currentUserId, body })
    await sb.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chat.id)
    setSending(false)
    inputRef.current?.focus()
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const grouped: { date: string; msgs: Message[] }[] = []
  messages.forEach(m => {
    const d = new Date(m.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: new Date(m.created_at).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })
    const last = grouped[grouped.length - 1]
    if (last?.date === d) last.msgs.push(m)
    else grouped.push({ date: d, msgs: [m] })
  })

  const color = getColor(chat.other_user.name || chat.other_user.email || '?')

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(8px)' }} />
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 580, height: '82vh', maxHeight: 720,
        display: 'flex', flexDirection: 'column',
        background: 'var(--card)', borderRadius: 28,
        border: '1px solid var(--border)',
        boxShadow: '0 40px 120px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.04)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px', flexShrink: 0,
          borderBottom: '1px solid var(--border)',
          background: `linear-gradient(135deg, ${color}08 0%, transparent 60%)`,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <Avatar name={chat.other_user.name || chat.other_user.email} size={46} ring />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
              {chat.other_user.name || chat.other_user.email}
            </div>
            <div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              {chat.other_user.role === 'coach' ? 'Тренер' : 'Атлет'}
            </div>
          </div>
          <button onClick={onClose}
            style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <i className="ki-filled ki-cross text-muted-foreground text-sm" />
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>👋</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)' }}>Начните диалог</div>
              <div style={{ fontSize: 13, color: 'var(--muted-foreground)', textAlign: 'center', maxWidth: 240, lineHeight: 1.5 }}>
                Напишите первое сообщение {chat.other_user.name?.split(' ')[0] || 'собеседнику'}
              </div>
            </div>
          ) : (
            <>
              {grouped.map(g => (
                <div key={g.date}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 12px' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    <span style={{ fontSize: 10, color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', background: 'var(--card)', padding: '2px 10px', borderRadius: 20, border: '1px solid var(--border)' }}>{g.date}</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>
                  {g.msgs.map((m, i) => {
                    const isMe = m.sender_id === currentUserId
                    const sameAuthor = g.msgs[i - 1]?.sender_id === m.sender_id
                    return (
                      <div key={m.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, marginTop: sameAuthor ? 3 : 10 }}>
                        {!isMe && (
                          <div style={{ width: 32, flexShrink: 0, marginBottom: 2 }}>
                            {!sameAuthor && <Avatar name={chat.other_user.name || chat.other_user.email} size={32} />}
                          </div>
                        )}
                        <div style={{ maxWidth: '68%' }}>
                          <div style={{
                            padding: '10px 14px',
                            borderRadius: isMe ? '20px 20px 5px 20px' : '20px 20px 20px 5px',
                            background: isMe ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : 'var(--accent)',
                            color: isMe ? 'white' : 'var(--foreground)',
                            fontSize: 13.5, lineHeight: 1.55, wordBreak: 'break-word',
                            boxShadow: isMe ? '0 4px 16px rgba(249,115,22,0.3)' : '0 1px 4px rgba(0,0,0,0.05)',
                          }}>
                            {m.body}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 3, justifyContent: isMe ? 'flex-end' : 'flex-start', paddingLeft: isMe ? 0 : 4, paddingRight: isMe ? 4 : 0 }}>
                            {fmtTime(m.created_at)}
                            {isMe && <i className={`ki-filled ${m.is_read ? 'ki-check-circle text-blue-400' : 'ki-check text-muted-foreground'} text-[10px]`} />}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', background: 'var(--card)', flexShrink: 0, display: 'flex', alignItems: 'flex-end', gap: 10 }}>
          <textarea ref={inputRef} value={text} onChange={e => setText(e.target.value)} onKeyDown={onKey}
            placeholder="Сообщение… (Enter — отправить, Shift+Enter — новая строка)"
            rows={1}
            style={{
              flex: 1, border: '1.5px solid var(--border)', borderRadius: 16,
              padding: '11px 16px', fontSize: 13.5, outline: 'none', resize: 'none',
              background: 'var(--background)', color: 'var(--foreground)',
              lineHeight: 1.5, maxHeight: 120, transition: 'border-color 0.15s',
              fontFamily: 'inherit',
            }}
            onFocus={e => e.currentTarget.style.borderColor = '#f97316'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px' }}
          />
          <button onClick={send} disabled={!text.trim() || sending}
            style={{
              width: 44, height: 44, borderRadius: 14, border: 'none', flexShrink: 0,
              background: text.trim() ? 'linear-gradient(135deg, #f97316, #ea580c)' : 'var(--accent)',
              cursor: text.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
              boxShadow: text.trim() ? '0 4px 16px rgba(249,115,22,0.4)' : 'none',
              transform: text.trim() ? 'scale(1)' : 'scale(0.95)',
            }}>
            {sending
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <i className="ki-filled ki-send text-sm" style={{ color: text.trim() ? 'white' : 'var(--muted-foreground)' }} />
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function MessengerPage() {
  const { user, loading: ul } = useUser()
  const [chats, setChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(true)
  const [activeChat, setActiveChat] = useState<Chat | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')

  const loadChats = useCallback(async () => {
    if (!user) return
    const sb = getSB()
    const { data } = await sb.from('chats').select('*')
      .or(`athlete_id.eq.${user.id},coach_id.eq.${user.id}`)
      .order('updated_at', { ascending: false })
    if (!data) { setLoading(false); return }
    const enriched: Chat[] = await Promise.all(data.map(async c => {
      const otherId = c.athlete_id === user.id ? c.coach_id : c.athlete_id
      const { data: ou } = await sb.from('users').select('id,name,email,role').eq('id', otherId).single()
      const { data: lm } = await sb.from('messages').select('body').eq('chat_id', c.id).order('created_at', { ascending: false }).limit(1).single()
      const { count } = await sb.from('messages').select('*', { count: 'exact', head: true }).eq('chat_id', c.id).eq('is_read', false).neq('sender_id', user.id)
      return { ...c, other_user: ou ?? { id: otherId, name: 'Пользователь', email: '', role: '' }, last_message: lm?.body ?? null, unread_count: count ?? 0 }
    }))
    setChats(enriched)
    setLoading(false)
  }, [user])

  useEffect(() => { loadChats() }, [loadChats])

  useEffect(() => {
    if (!user) return
    const sb = getSB()
    const ch = sb.channel('chats-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => loadChats())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => loadChats())
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [user, loadChats])

  if (ul) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return null

  const filtered = chats.filter(c => (c.other_user.name || c.other_user.email).toLowerCase().includes(search.toLowerCase()))
  const totalUnread = chats.reduce((s, c) => s + c.unread_count, 0)
  const currentUser: ChatUser = { id: user.id, name: user.name ?? user.email ?? '', email: user.email ?? '', role: user.role ?? '' }

  return (
    <div className="flex flex-col gap-6 pf-enter">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard"
            style={{ width: 38, height: 38, borderRadius: 11, border: '1px solid var(--border)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0, transition: 'all 0.15s' }}
            className="hover:bg-orange-50 hover:border-orange-200">
            <i className="ki-filled ki-arrow-left text-muted-foreground text-sm" />
          </Link>
          <div>
            <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-0.5">Общение</p>
            <div className="flex items-center gap-2.5">
              <h2 className="pf-num text-[34px] text-foreground leading-none">Сообщения</h2>
              {totalUnread > 0 && (
                <span style={{ padding: '3px 10px', borderRadius: 20, background: 'linear-gradient(135deg,#f97316,#ea580c)', color: 'white', fontSize: 13, fontWeight: 800, boxShadow: '0 2px 10px rgba(249,115,22,0.4)' }}>
                  {totalUnread}
                </span>
              )}
            </div>
          </div>
        </div>
        <button onClick={() => setShowNew(true)} className="kt-btn kt-btn-primary gap-2">
          <i className="ki-filled ki-message-add text-sm" />
          Новый чат
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 380 }}>
        <i className="ki-filled ki-magnifier" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', fontSize: 14 }} />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени…"
          className="w-full rounded-2xl border border-input text-sm outline-none bg-card"
          style={{ padding: '11px 14px 11px 38px', transition: 'border-color 0.15s' }}
          onFocus={e => e.currentTarget.style.borderColor = '#f97316'}
          onBlur={e => e.currentTarget.style.borderColor = ''}
        />
      </div>

      {/* Chat cards */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-9 h-9 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-2xs text-muted-foreground font-medium">Загрузка чатов…</span>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl" style={{ padding: '64px 24px', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: 22, background: 'linear-gradient(135deg,#fff7ed,#ffedd5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 16px' }}>
            💬
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            {search ? 'Ничего не найдено' : 'Пока нет сообщений'}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '0 0 20px', lineHeight: 1.5 }}>
            {search ? 'Попробуйте изменить запрос' : 'Начни диалог с тренером или атлетом'}
          </p>
          {!search && (
            <button onClick={() => setShowNew(true)} className="kt-btn kt-btn-primary gap-2">
              <i className="ki-filled ki-plus text-sm" />Создать первый чат
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(c => {
            const color = getColor(c.other_user.name || c.other_user.email || '?')
            return (
              <button key={c.id} onClick={() => setActiveChat(c)}
                className="bg-card border border-border rounded-2xl text-left group transition-all hover:shadow-md"
                style={{ cursor: 'pointer', padding: 0, overflow: 'hidden' }}>
                {/* Color bar */}
                <div style={{ height: 4, background: `linear-gradient(90deg, ${color}, ${color}60)`, opacity: c.unread_count > 0 ? 1 : 0.4, transition: 'opacity 0.2s' }} className="group-hover:opacity-100" />
                <div style={{ padding: '16px 18px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                    <div style={{ position: 'relative' }}>
                      <Avatar name={c.other_user.name || c.other_user.email} size={48} ring={c.unread_count > 0} />
                      {c.unread_count > 0 && (
                        <span style={{
                          position: 'absolute', top: -4, right: -4,
                          minWidth: 20, height: 20, borderRadius: 10,
                          background: 'linear-gradient(135deg,#f97316,#ea580c)',
                          color: 'white', fontSize: 10, fontWeight: 800,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: '0 5px', border: '2px solid var(--card)',
                          boxShadow: '0 2px 8px rgba(249,115,22,0.5)',
                        }}>
                          {c.unread_count > 99 ? '99+' : c.unread_count}
                        </span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                          {c.other_user.name || c.other_user.email}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0 }}>{fmtTime(c.updated_at)}</span>
                      </div>
                      <span style={{ fontSize: 11, color, fontWeight: 600 }}>
                        {c.other_user.role === 'coach' ? '🏋️ Тренер' : '🏃 Атлет'}
                      </span>
                    </div>
                  </div>

                  {/* Last message */}
                  <div style={{
                    padding: '9px 12px', borderRadius: 12,
                    background: c.unread_count > 0 ? `${color}10` : 'var(--accent)',
                    border: c.unread_count > 0 ? `1px solid ${color}20` : '1px solid transparent',
                    fontSize: 12.5, color: c.unread_count > 0 ? 'var(--foreground)' : 'var(--muted-foreground)',
                    fontWeight: c.unread_count > 0 ? 600 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    marginBottom: 12,
                  }}>
                    {c.last_message ?? 'Нет сообщений — начните диалог'}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#f97316', fontWeight: 700 }}>Открыть</span>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#f97316,#ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transform: 'translateX(-4px)', transition: 'all 0.2s' }} className="group-hover:opacity-100 group-hover:translate-x-0">
                      <i className="ki-filled ki-arrow-right text-white text-xs" />
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {activeChat && (
        <ChatModal
          chat={activeChat}
          currentUserId={user.id}
          onClose={() => setActiveChat(null)}
          onUnreadChange={loadChats}
        />
      )}
      {showNew && (
        <NewChatModal
          currentUser={currentUser}
          onClose={() => setShowNew(false)}
          onCreated={chat => {
            setChats(prev => prev.find(c => c.id === chat.id) ? prev : [chat, ...prev])
            setActiveChat(chat)
            setShowNew(false)
          }}
        />
      )}
    </div>
  )
}
