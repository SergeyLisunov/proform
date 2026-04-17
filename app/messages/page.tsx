'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/lib/hooks/useUser'

type ChatUser = { id: string; name: string; email: string; role: string }
type ChatType = 'direct' | 'group' | 'org_channel'
type Chat = {
  id: string
  athlete_id: string | null
  coach_id: string | null
  type: ChatType
  name: string | null
  org_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  other_user: ChatUser | null
  last_message?: string
  unread_count: number
  member_count?: number
}

function chatDisplayName(c: Chat, fallback = 'Чат'): string {
  if (c.type !== 'direct' && c.name) return c.name
  if (c.other_user) return c.other_user.name || c.other_user.email || fallback
  return fallback
}

function chatIcon(type: ChatType) {
  if (type === 'group')      return { icon: 'ki-people', color: '#9333ea', bg: '#FAF5FF' }
  if (type === 'org_channel') return { icon: 'ki-abstract-26', color: '#2563eb', bg: '#EFF6FF' }
  return null
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
    // Показываем всех пользователей (кроме себя и админов) — любой с любым может начать диалог
    sb.from('users')
      .select('id,name,email,role')
      .neq('id', currentUser.id)
      .neq('role', 'admin')
      .eq('is_searchable', true)
      .then(({ data }) => { setUsers(data ?? []); setLoading(false) })
  }, [currentUser.id])

  async function start(other: ChatUser) {
    setCreating(other.id)
    const sb = getSB()
    // Для direct chat пары (id1, id2) кладём меньший id в athlete_id-слот, больший в coach_id-слот
    // (схема сохраняет уникальность пары, семантика слотов не важна для direct)
    const [slotA, slotB] = [currentUser.id, other.id].sort()
    const { data, error } = await sb
      .from('chats')
      .upsert({ athlete_id: slotA, coach_id: slotB, type: 'direct' }, { onConflict: 'athlete_id,coach_id' })
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
                Выбери собеседника
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

  const ic = chatIcon(chat.type)
  const color = chat.type === 'direct' && chat.other_user
    ? getColor(chat.other_user.name || chat.other_user.email || '?')
    : (ic?.color ?? '#64748b')

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
          {chat.type === 'direct' && chat.other_user
            ? <Avatar name={chat.other_user.name || chat.other_user.email} size={46} ring />
            : (() => { const ic = chatIcon(chat.type)!; return (
                <div style={{ width: 46, height: 46, borderRadius: '50%', flexShrink: 0, background: ic.bg, border: `1.5px solid ${ic.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={`ki-filled ${ic.icon}`} style={{ color: ic.color, fontSize: 20 }} />
                </div>
              )})()
          }
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
              {chatDisplayName(chat)}
            </div>
            <div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
              {chat.type === 'direct' && chat.other_user ? (
                <><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                {chat.other_user.role === 'coach' ? 'Тренер' : 'Атлет'}</>
              ) : chat.type === 'group' ? (
                `Группа · ${chat.member_count ?? '?'} участников`
              ) : (
                `Канал организации · ${chat.member_count ?? '?'} участников`
              )}
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
                Напишите первое сообщение {chat.other_user?.name?.split(' ')[0] || 'участникам'}
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
                            {!sameAuthor && <Avatar name={chat.other_user?.name || chat.other_user?.email || '?'} size={32} />}
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

// ── New Group Modal ────────────────────────────────────────────────────────────
function NewGroupModal({ currentUser, onClose, onCreated }: {
  currentUser: ChatUser; onClose: () => void; onCreated: (chat: Chat) => void
}) {
  const [groupName, setGroupName] = useState('')
  const [users, setUsers] = useState<ChatUser[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    getSB().from('users').select('id,name,email,role')
      .neq('id', currentUser.id).neq('role', 'admin').eq('is_searchable', true)
      .then(({ data }) => { setUsers(data ?? []); setLoading(false) })
  }, [currentUser.id])

  async function create() {
    if (!groupName.trim() || selected.size < 1) return
    setCreating(true)
    const sb = getSB()
    const { data: chat, error } = await sb.from('chats')
      .insert({ type: 'group', name: groupName.trim(), created_by: currentUser.id })
      .select().single()
    if (error || !chat) { setCreating(false); return }
    // Add creator + selected members
    const memberIds = [currentUser.id, ...Array.from(selected)]
    await sb.from('chat_members').insert(
      memberIds.map((uid, i) => ({ chat_id: chat.id, user_id: uid, role: i === 0 ? 'admin' : 'member' }))
    )
    onCreated({ ...chat, other_user: null, unread_count: 0, member_count: memberIds.length })
  }

  const filtered = users.filter(u => (u.name || u.email).toLowerCase().includes(search.toLowerCase()))
  const toggle = (id: string) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(8px)' }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 440, background: 'var(--card)', borderRadius: 24, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 40px 100px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '22px 24px 16px', background: 'linear-gradient(135deg, rgba(147,51,234,0.05), transparent)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#9333ea', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>Новая группа</p>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', margin: '2px 0 0' }}>Создать группу</h3>
            </div>
            <button onClick={onClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost"><i className="ki-filled ki-cross text-sm" /></button>
          </div>
          <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Название группы…"
            style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
            onFocus={e => e.currentTarget.style.borderColor = '#9333ea'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
          />
          <div style={{ position: 'relative' }}>
            <i className="ki-filled ki-magnifier" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', fontSize: 13 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Найти участника…"
              style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.currentTarget.style.borderColor = '#9333ea'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            />
          </div>
          {selected.size > 0 && <p style={{ marginTop: 8, fontSize: 11, color: '#9333ea', fontWeight: 600 }}>Выбрано: {selected.size} участников</p>}
        </div>
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : filtered.map(u => {
            const sel = selected.has(u.id)
            return (
              <button key={u.id} onClick={() => toggle(u.id)}
                style={{ width: '100%', padding: '11px 24px', display: 'flex', alignItems: 'center', gap: 13, background: sel ? 'rgba(147,51,234,0.05)' : 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}
                className="hover:bg-accent/60 transition-colors">
                <Avatar name={u.name || u.email} size={40} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>{u.name || u.email}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>{u.role === 'coach' ? '🏋️ Тренер' : u.role === 'organization' ? '🏢 Организация' : '🏃 Атлет'}</div>
                </div>
                <div style={{ width: 22, height: 22, borderRadius: 6, border: sel ? 'none' : '1.5px solid var(--border)', background: sel ? '#9333ea' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                  {sel && <i className="ki-filled ki-check text-white" style={{ fontSize: 11 }} />}
                </div>
              </button>
            )
          })}
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)' }}>
          <button onClick={create} disabled={!groupName.trim() || selected.size < 1 || creating}
            style={{ width: '100%', padding: '11px', borderRadius: 14, border: 'none', background: groupName.trim() && selected.size > 0 ? 'linear-gradient(135deg,#9333ea,#7c3aed)' : 'var(--accent)', color: groupName.trim() && selected.size > 0 ? 'white' : 'var(--muted-foreground)', fontWeight: 700, fontSize: 14, cursor: groupName.trim() && selected.size > 0 ? 'pointer' : 'default', transition: 'all 0.15s' }}>
            {creating ? 'Создаём…' : `Создать группу${selected.size > 0 ? ` (${selected.size + 1})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── New Channel Modal (org only) ───────────────────────────────────────────────
function NewChannelModal({ currentUser, onClose, onCreated }: {
  currentUser: ChatUser; onClose: () => void; onCreated: (chat: Chat) => void
}) {
  const [channelName, setChannelName] = useState('')
  const [creating, setCreating] = useState(false)

  async function create() {
    if (!channelName.trim()) return
    setCreating(true)
    const sb = getSB()
    const { data: chat, error } = await sb.from('chats')
      .insert({ type: 'org_channel', name: channelName.trim(), created_by: currentUser.id, org_id: currentUser.id })
      .select().single()
    if (error || !chat) { setCreating(false); return }
    await sb.from('chat_members').insert({ chat_id: chat.id, user_id: currentUser.id, role: 'admin' })
    onCreated({ ...chat, other_user: null, unread_count: 0, member_count: 1 })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(8px)' }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, background: 'var(--card)', borderRadius: 24, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 40px 100px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '22px 24px 18px', background: 'linear-gradient(135deg, rgba(37,99,235,0.05), transparent)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>Канал организации</p>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', margin: '2px 0 0' }}>Создать канал</h3>
            </div>
            <button onClick={onClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost"><i className="ki-filled ki-cross text-sm" /></button>
          </div>
          <input value={channelName} onChange={e => setChannelName(e.target.value)} placeholder="Название канала…"
            autoFocus
            style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => e.currentTarget.style.borderColor = '#2563eb'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            onKeyDown={e => e.key === 'Enter' && create()}
          />
          <p style={{ marginTop: 8, fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
            Канал виден всем участникам организации. После создания можно приглашать пользователей.
          </p>
        </div>
        <div style={{ padding: '14px 24px' }}>
          <button onClick={create} disabled={!channelName.trim() || creating}
            style={{ width: '100%', padding: '11px', borderRadius: 14, border: 'none', background: channelName.trim() ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : 'var(--accent)', color: channelName.trim() ? 'white' : 'var(--muted-foreground)', fontWeight: 700, fontSize: 14, cursor: channelName.trim() ? 'pointer' : 'default', transition: 'all 0.15s' }}>
            {creating ? 'Создаём…' : 'Создать канал'}
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
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [search, setSearch] = useState('')

  const loadChats = useCallback(async () => {
    if (!user) return
    const sb = getSB()

    // direct chats
    const { data: directData } = await sb.from('chats').select('*')
      .or(`athlete_id.eq.${user.id},coach_id.eq.${user.id}`)
      .eq('type', 'direct')

    // group / org_channel chats via chat_members
    const { data: memberRows } = await sb.from('chat_members').select('chat_id').eq('user_id', user.id)
    const memberChatIds = (memberRows ?? []).map(r => r.chat_id)
    const { data: groupData } = memberChatIds.length > 0
      ? await sb.from('chats').select('*').in('id', memberChatIds)
      : { data: [] as typeof directData }

    const allRaw = [...(directData ?? []), ...(groupData ?? [])]
      .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))

    if (!allRaw.length) { setChats([]); setLoading(false); return }

    const enriched: Chat[] = await Promise.all(allRaw.map(async c => {
      const lm$ = sb.from('messages').select('body').eq('chat_id', c.id).order('created_at', { ascending: false }).limit(1).single()
      const uc$ = sb.from('messages').select('*', { count: 'exact', head: true }).eq('chat_id', c.id).eq('is_read', false).neq('sender_id', user.id)

      let other_user: ChatUser | null = null
      if (c.type === 'direct') {
        const otherId = c.athlete_id === user.id ? c.coach_id : c.athlete_id
        const { data: ou } = await sb.from('users').select('id,name,email,role').eq('id', otherId).single()
        other_user = ou ?? { id: otherId ?? '', name: 'Пользователь', email: '', role: '' }
      }

      let member_count: number | undefined
      if (c.type !== 'direct') {
        const { count } = await sb.from('chat_members').select('*', { count: 'exact', head: true }).eq('chat_id', c.id)
        member_count = count ?? 0
      }

      const [{ data: lm }, { count }] = await Promise.all([lm$, uc$])
      return { ...c, other_user, last_message: lm?.body ?? null, unread_count: count ?? 0, member_count }
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

  const filtered = chats.filter(c => chatDisplayName(c).toLowerCase().includes(search.toLowerCase()))
  const totalUnread = chats.reduce((s, c) => s + c.unread_count, 0)
  const activeChats = chats.length
  const visibleChats = filtered.length
  const hasUnread = totalUnread > 0
  const currentUser: ChatUser = { id: user.id, name: user.name ?? user.email ?? '', email: user.email ?? '', role: user.role ?? '' }

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-5 pf-enter">
      <div className="overflow-hidden rounded-[28px] border border-border bg-gradient-to-br from-orange-50 via-background to-background shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 px-5 py-5 md:px-6 md:py-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                Коммуникация
              </span>
              <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {activeChats} диалогов
              </span>
              <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {visibleChats} в списке
              </span>
            </div>

            <div className="mt-4 flex items-start gap-3">
              <Link
                href="/dashboard"
                style={{ width: 40, height: 40, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0, transition: 'all 0.15s' }}
                className="hover:bg-orange-50 hover:border-orange-200"
              >
                <i className="ki-filled ki-arrow-left text-muted-foreground text-sm" />
              </Link>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-[clamp(2.15rem,4.4vw,3.4rem)] font-semibold tracking-tight text-foreground leading-none">
                    Сообщения
                  </h2>
                  {hasUnread && (
                    <span style={{ padding: '4px 10px', borderRadius: 999, background: 'linear-gradient(135deg,#f97316,#ea580c)', color: 'white', fontSize: 13, fontWeight: 800, boxShadow: '0 6px 18px rgba(249,115,22,0.28)' }}>
                      {totalUnread}
                    </span>
                  )}
                </div>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Рабочее пространство для быстрых ответов, новых диалогов и контроля непрочитанных без лишнего шума.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:min-w-[320px]">
            <div className="rounded-2xl border border-border bg-background/80 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Текущее состояние</div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-foreground">{hasUnread ? 'Есть новые сообщения' : 'Входящих нет'}</div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                    {hasUnread ? 'Непрочитанные выделены в списке и обновляются в реальном времени.' : 'Можно начать новый диалог или открыть существующий чат.'}
                  </div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                  <i className={`ki-filled ${hasUnread ? 'ki-notification-on' : 'ki-message-text-2'} text-xl`} />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNew(true)} className="kt-btn kt-btn-primary gap-2 flex-1 justify-center">
                <i className="ki-filled ki-message-add text-sm" />
                Новый чат
              </button>
              <button onClick={() => setShowNewGroup(true)} className="kt-btn kt-btn-light gap-2 flex-1 justify-center" title="Создать группу">
                <i className="ki-filled ki-people text-sm text-purple-600" />
                Группа
              </button>
              {user?.role === 'organization' && (
                <button onClick={() => setShowNewChannel(true)} className="kt-btn kt-btn-light gap-2 flex-1 justify-center" title="Создать канал">
                  <i className="ki-filled ki-abstract-26 text-sm text-blue-600" />
                  Канал
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Всего диалогов</div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="pf-num text-[30px] leading-none text-foreground">{activeChats}</div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <i className="ki-filled ki-message-text-2 text-sm" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Непрочитанные</div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="pf-num text-[30px] leading-none text-foreground">{totalUnread}</div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
              <i className="ki-filled ki-notification-on text-sm" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Активные чаты</div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="pf-num text-[30px] leading-none text-foreground">{visibleChats}</div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <i className="ki-filled ki-abstract-26 text-sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-md">
        <i className="ki-filled ki-magnifier" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', fontSize: 14 }} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени…"
          className="w-full rounded-2xl border border-input bg-card text-sm outline-none"
          style={{ padding: '11px 14px 11px 38px', transition: 'border-color 0.15s' }}
          onFocus={e => e.currentTarget.style.borderColor = '#f97316'}
          onBlur={e => e.currentTarget.style.borderColor = ''}
        />
      </div>

      {loading ? (
        <div className="rounded-[24px] border border-border bg-card px-6 py-20 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
              <div className="w-9 h-9 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Загружаем переписку</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">Подтягиваем чаты, последнее сообщение и непрочитанные обновления.</div>
            </div>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[24px] border border-border bg-card px-6 py-16 text-center shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100 text-3xl">
            {search ? <i className="ki-filled ki-search-list text-orange-500 text-2xl" /> : <i className="ki-filled ki-message-text-2 text-orange-500 text-2xl" />}
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', margin: '16px 0 6px', letterSpacing: '-0.02em' }}>
            {search ? 'Ничего не найдено' : 'Пока нет сообщений'}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '0 auto 22px', lineHeight: 1.6, maxWidth: 320 }}>
            {search ? 'Попробуйте изменить запрос или очистить фильтр.' : 'Создайте первый чат, чтобы начать переписку с тренером или атлетом.'}
          </p>
          {!search && (
            <button onClick={() => setShowNew(true)} className="kt-btn kt-btn-primary gap-2">
              <i className="ki-filled ki-plus text-sm" />
              Создать первый чат
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
          {filtered.map(c => {
            const isDirect = c.type === 'direct'
            const ic = chatIcon(c.type)
            const color = isDirect && c.other_user
              ? getColor(c.other_user.name || c.other_user.email || '?')
              : (ic?.color ?? '#64748b')
            const displayName = chatDisplayName(c)
            const preview = c.last_message ?? 'Нет сообщений — начните диалог'
            return (
              <button
                key={c.id}
                onClick={() => setActiveChat(c)}
                className="group overflow-hidden rounded-[24px] border border-border bg-card text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
                style={{ cursor: 'pointer', padding: 0 }}
              >
                <div style={{ height: 4, background: `linear-gradient(90deg, ${color}, ${color}60)`, opacity: c.unread_count > 0 ? 1 : 0.38, transition: 'opacity 0.2s' }} className="group-hover:opacity-100" />
                <div style={{ padding: '16px 18px 18px' }}>
                  <div className="flex items-start gap-3">
                    <div style={{ position: 'relative' }}>
                      {isDirect && c.other_user
                        ? <Avatar name={c.other_user.name || c.other_user.email} size={48} ring={c.unread_count > 0} />
                        : <div style={{ width: 48, height: 48, borderRadius: '50%', background: ic!.bg, border: `1.5px solid ${ic!.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <i className={`ki-filled ${ic!.icon}`} style={{ color: ic!.color, fontSize: 22 }} />
                          </div>
                      }
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
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em', display: 'block' }}>
                            {displayName}
                          </span>
                          <span style={{ marginTop: 3, fontSize: 11, color, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {isDirect && c.other_user ? (
                              <><span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', opacity: 0.8 }} />
                              {c.other_user.role === 'coach' ? 'Тренер' : 'Атлет'}</>
                            ) : c.type === 'group' ? (
                              `👥 Группа · ${c.member_count ?? '?'} участников`
                            ) : (
                              `📢 Канал · ${c.member_count ?? '?'} участников`
                            )}
                          </span>
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0, marginTop: 1 }}>
                          {fmtTime(c.updated_at)}
                        </span>
                      </div>

                      <div
                        style={{
                          padding: '9px 12px',
                          borderRadius: 14,
                          background: c.unread_count > 0 ? `${color}10` : 'var(--accent)',
                          border: c.unread_count > 0 ? `1px solid ${color}20` : '1px solid transparent',
                          fontSize: 12.5,
                          color: c.unread_count > 0 ? 'var(--foreground)' : 'var(--muted-foreground)',
                          fontWeight: c.unread_count > 0 ? 600 : 400,
                          lineHeight: 1.55,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          minHeight: 46,
                          marginBottom: 12,
                        }}
                      >
                        {preview}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 600 }}>
                          {c.unread_count > 0 ? 'Новые сообщения ждут' : 'Открыть диалог'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {c.unread_count > 0 && (
                            <span style={{
                              minWidth: 20,
                              height: 20,
                              borderRadius: 999,
                              padding: '0 6px',
                              background: 'linear-gradient(135deg,#f97316,#ea580c)',
                              color: 'white',
                              fontSize: 10,
                              fontWeight: 800,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 4px 12px rgba(249,115,22,0.28)',
                            }}>
                              {c.unread_count > 99 ? '99+' : c.unread_count}
                            </span>
                          )}
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#f97316,#ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transform: 'translateX(-4px)', transition: 'all 0.2s' }} className="group-hover:opacity-100 group-hover:translate-x-0">
                            <i className="ki-filled ki-arrow-right text-white text-xs" />
                          </div>
                        </div>
                      </div>
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
      {showNewGroup && (
        <NewGroupModal
          currentUser={currentUser}
          onClose={() => setShowNewGroup(false)}
          onCreated={chat => {
            setChats(prev => [chat, ...prev])
            setActiveChat(chat)
            setShowNewGroup(false)
          }}
        />
      )}
      {showNewChannel && (
        <NewChannelModal
          currentUser={currentUser}
          onClose={() => setShowNewChannel(false)}
          onCreated={chat => {
            setChats(prev => [chat, ...prev])
            setActiveChat(chat)
            setShowNewChannel(false)
          }}
        />
      )}
    </div>
  )
}
