'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'

type Notification = {
  id: string
  type: string
  title: string
  body: string | null
  is_read: boolean
  is_archived: boolean
  action_url: string | null
  created_at: string
}

const TYPE_META: Record<string, { icon: string; color: string; bg: string }> = {
  invitation_received:     { icon: 'ki-user-plus',       color: '#F97316', bg: '#FFF7ED' },
  invitation_accepted:     { icon: 'ki-check-circle',    color: '#16A34A', bg: '#F0FDF4' },
  invitation_declined:     { icon: 'ki-cross-circle',    color: '#DC2626', bg: '#FEF2F2' },
  invitation_cancelled:    { icon: 'ki-information-5',   color: '#64748B', bg: '#F8FAFC' },
  connection_terminated:   { icon: 'ki-disconnect',      color: '#DC2626', bg: '#FEF2F2' },
  broadcast:               { icon: 'ki-notification-on', color: '#2563EB', bg: '#EFF6FF' },
  system:                  { icon: 'ki-setting-2',       color: '#7C3AED', bg: '#F5F3FF' },
  // W12 Day 60: review-system + pass-system events
  coach_replied_to_review: { icon: 'ki-message-text',    color: '#16A34A', bg: '#F0FDF4' },
  new_review_for_coach:    { icon: 'ki-star',            color: '#F59E0B', bg: '#FFFBEB' },
  pass_session_used:       { icon: 'ki-minus-squared',   color: '#F97316', bg: '#FFF7ED' },
}

function getTypeMeta(type: string) {
  return TYPE_META[type] ?? { icon: 'ki-notification-on', color: '#64748B', bg: '#F8FAFC' }
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  if (diff < 604800) return `${Math.floor(diff / 86400)} д назад`
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export default function NotificationsPage() {
  const { user } = useUser()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [markingAll, setMarkingAll] = useState(false)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const res = await fetch('/api/notifications?limit=50')
      const data = await res.json()
      setNotifications(data.notifications ?? [])
      setUnreadCount(data.unread_count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { load() }, [load])

  async function markRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
    await fetch(`/api/notifications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: true }),
    })
  }

  async function markAllRead() {
    setMarkingAll(true)
    try {
      await fetch('/api/notifications/read-all', { method: 'PATCH' })
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } finally {
      setMarkingAll(false)
    }
  }

  async function archive(id: string) {
    setNotifications(prev => prev.filter(n => n.id !== id))
    await fetch(`/api/notifications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_archived: true }),
    })
  }

  const visible = filter === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications

  return (
    <div className="flex flex-col gap-6 pf-enter" style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Link href="/dashboard" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 10, border: '1.5px solid var(--border)',
            background: 'var(--card)', color: 'var(--muted-foreground)', textDecoration: 'none', marginBottom: 14,
          }}>
            <i className="ki-filled ki-left" style={{ fontSize: 13 }} />
          </Link>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Центр уведомлений</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="pf-num" style={{ fontSize: 34, color: 'var(--foreground)', letterSpacing: '-0.03em', lineHeight: 1 }}>Уведомления</h1>
            {unreadCount > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 24, height: 24, borderRadius: 99, padding: '0 8px',
                background: 'linear-gradient(135deg, #F97316, #EA580C)',
                color: 'white', fontSize: 12, fontWeight: 800,
                boxShadow: '0 2px 8px rgba(249,115,22,0.4)',
              }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            style={{
              padding: '9px 18px', borderRadius: 12, border: '1.5px solid var(--border)',
              background: 'var(--card)', color: 'var(--foreground)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
            }}>
            {markingAll
              ? <><div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />Отмечаем…</>
              : <><i className="ki-filled ki-check-circle text-xs" />Прочитать все</>
            }
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, padding: 4, background: 'var(--accent)', borderRadius: 14, border: '1px solid var(--border)', width: 'fit-content' }}>
        {(['all', 'unread'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '7px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: filter === f ? 700 : 600,
            background: filter === f ? 'var(--card)' : 'transparent',
            color: filter === f ? 'var(--foreground)' : 'var(--muted-foreground)',
            boxShadow: filter === f ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s',
          }}>
            {f === 'all' ? 'Все' : `Непрочитанные${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted-foreground)' }}>
          <i className="ki-filled ki-notification-on text-4xl block mb-3" style={{ color: 'var(--border)' }} />
          <p style={{ fontSize: 14, fontWeight: 600 }}>
            {filter === 'unread' ? 'Нет непрочитанных уведомлений' : 'Уведомлений пока нет'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visible.map(n => {
            const meta = getTypeMeta(n.type)
            return (
              <div
                key={n.id}
                onClick={() => { if (!n.is_read) markRead(n.id) }}
                style={{
                  background: n.is_read ? 'var(--card)' : 'var(--accent)',
                  border: `1px solid ${n.is_read ? 'var(--border)' : '#FED7AA'}`,
                  borderRadius: 16, padding: '14px 16px',
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  cursor: n.is_read ? 'default' : 'pointer',
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                  background: meta.bg, border: `1px solid ${meta.color}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <i className={`ki-filled ${meta.icon} text-sm`} style={{ color: meta.color }} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: n.is_read ? 500 : 700, color: 'var(--foreground)', margin: 0 }}>
                      {n.title}
                    </p>
                    <span style={{ fontSize: 10, color: 'var(--muted-foreground)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                  {n.body && (
                    <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '3px 0 0', lineHeight: 1.4 }}>{n.body}</p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    {n.action_url && (
                      <Link href={n.action_url} style={{ fontSize: 11, color: '#F97316', fontWeight: 600, textDecoration: 'none' }} onClick={e => e.stopPropagation()}>
                        Перейти →
                      </Link>
                    )}
                    {!n.is_read && (
                      <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#F97316', flexShrink: 0 }} />
                    )}
                  </div>
                </div>

                {/* Archive button */}
                <button
                  onClick={e => { e.stopPropagation(); archive(n.id) }}
                  title="Скрыть"
                  style={{
                    flexShrink: 0, width: 28, height: 28, borderRadius: 8,
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--muted-foreground)', cursor: 'pointer', fontSize: 11,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FEF2F2'; (e.currentTarget as HTMLButtonElement).style.color = '#DC2626' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted-foreground)' }}
                >
                  <i className="ki-filled ki-cross text-[10px]" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
