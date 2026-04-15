'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'

type ConnUser = {
  id: string
  nickname: string | null
  first_name: string | null
  last_name: string | null
  role: string
  avatar_url: string | null
  city: string | null
}

type Connection = {
  id: string
  status: 'pending' | 'active' | 'declined' | 'cancelled' | 'terminated'
  connection_type: string
  initiated_at: string
  responded_at: string | null
  message: string | null
  initiator: ConnUser
  recipient: ConnUser
}

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  athlete:      { label: 'Атлет',      color: '#F97316', bg: '#FFF7ED' },
  coach:        { label: 'Тренер',     color: '#16A34A', bg: '#F0FDF4' },
  organization: { label: 'Орг.',       color: '#2563EB', bg: '#EFF6FF' },
}

const CONN_TYPE_LABEL: Record<string, string> = {
  coach_athlete: 'Тренер → Атлет',
  org_coach:     'Организация → Тренер',
  org_athlete:   'Организация → Атлет',
}

function userName(u: ConnUser) {
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || (u.nickname ? `@${u.nickname}` : 'Пользователь')
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

type Tab = 'active' | 'incoming' | 'outgoing' | 'history'

export default function ConnectionsPage() {
  const { user } = useUser()
  const [conns, setConns] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('active')
  const [acting, setActing] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/connections?status=all')
    const data = await res.json()
    setConns(data.connections ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  async function act(id: string, action: 'accept' | 'decline' | 'cancel') {
    setActing(id)
    try {
      const res = await fetch(`/api/connections/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      await load()
      showToast(action === 'accept' ? 'Связь установлена' : 'Готово', true)
    } catch (e: any) { showToast(e.message, false) }
    finally { setActing(null) }
  }

  async function terminate(id: string) {
    setActing(id)
    try {
      await fetch(`/api/connections/${id}`, { method: 'DELETE' })
      await load()
      showToast('Связь завершена', true)
    } catch { showToast('Ошибка', false) }
    finally { setActing(null) }
  }

  const myId = user?.id ?? ''
  const active   = conns.filter(c => c.status === 'active')
  const incoming = conns.filter(c => c.status === 'pending' && c.recipient.id === myId)
  const outgoing = conns.filter(c => c.status === 'pending' && c.initiator.id === myId)
  const history  = conns.filter(c => ['declined', 'cancelled', 'terminated'].includes(c.status))

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'active',   label: 'Активные',    count: active.length   || undefined },
    { id: 'incoming', label: 'Входящие',    count: incoming.length || undefined },
    { id: 'outgoing', label: 'Исходящие',   count: outgoing.length || undefined },
    { id: 'history',  label: 'История' },
  ]

  const displayed: Connection[] = tab === 'active' ? active : tab === 'incoming' ? incoming : tab === 'outgoing' ? outgoing : history

  function otherUser(c: Connection) {
    return c.initiator.id === myId ? c.recipient : c.initiator
  }

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
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Сеть</p>
          <h1 className="pf-num" style={{ fontSize: 34, color: 'var(--foreground)', letterSpacing: '-0.03em', lineHeight: 1 }}>Мои связи</h1>
        </div>
        <Link href="/search" style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '10px 18px', borderRadius: 14,
          background: 'linear-gradient(135deg,#F97316,#EA580C)',
          color: 'white', fontSize: 13, fontWeight: 700, textDecoration: 'none',
          boxShadow: '0 3px 12px rgba(249,115,22,0.3)',
        }}>
          <i className="ki-filled ki-user-plus text-sm" />Найти людей
        </Link>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--accent)', borderRadius: 16, border: '1px solid var(--border)', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: '0 0 auto', padding: '8px 14px', borderRadius: 12, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: tab === t.id ? 700 : 600,
            background: tab === t.id ? 'var(--card)' : 'transparent',
            color: tab === t.id ? 'var(--foreground)' : 'var(--muted-foreground)',
            boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {t.label}
            {t.count !== undefined && (
              <span style={{
                minWidth: 18, height: 18, borderRadius: 99, padding: '0 5px',
                background: tab === t.id ? '#F97316' : '#E2E8F0',
                color: tab === t.id ? 'white' : 'var(--muted-foreground)',
                fontSize: 10, fontWeight: 800,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted-foreground)' }}>
          <i className="ki-filled ki-people text-4xl block mb-3" style={{ color: 'var(--border)' }} />
          <p style={{ fontSize: 14, fontWeight: 600 }}>
            {tab === 'active' ? 'Нет активных связей' :
             tab === 'incoming' ? 'Нет входящих приглашений' :
             tab === 'outgoing' ? 'Нет исходящих приглашений' : 'История пуста'}
          </p>
          {tab === 'active' && (
            <Link href="/search" style={{ display: 'inline-block', marginTop: 12, fontSize: 13, color: '#F97316', fontWeight: 600, textDecoration: 'none' }}>
              Найти людей →
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {displayed.map(c => {
            const other = otherUser(c)
            const rm = ROLE_META[other.role] ?? { label: other.role, color: '#64748B', bg: '#F8FAFC' }
            const isLoading = acting === c.id

            return (
              <div key={c.id} style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 18, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
              }}>
                {/* Avatar */}
                <Link href={`/profile/${other.id}`} style={{ flexShrink: 0, textDecoration: 'none' }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 13,
                    background: other.avatar_url ? 'transparent' : `${rm.color}20`,
                    border: `1.5px solid ${rm.color}30`, overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {other.avatar_url
                      ? <img src={other.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 18, fontWeight: 800, color: rm.color }}>{userName(other)[0]?.toUpperCase()}</span>
                    }
                  </div>
                </Link>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Link href={`/profile/${other.id}`} style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', textDecoration: 'none' }}>
                      {userName(other)}
                    </Link>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                      background: rm.bg, color: rm.color, border: `1px solid ${rm.color}22`,
                    }}>{rm.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2, display: 'flex', gap: 10 }}>
                    <span>{CONN_TYPE_LABEL[c.connection_type] ?? c.connection_type}</span>
                    <span>·</span>
                    <span>{timeAgo(c.initiated_at)}</span>
                  </div>
                  {c.message && (
                    <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4, fontStyle: 'italic' }}>"{c.message}"</p>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                  {tab === 'incoming' && (
                    <>
                      <button disabled={isLoading} onClick={() => act(c.id, 'accept')} style={{
                        padding: '7px 14px', borderRadius: 10, border: 'none',
                        background: '#16A34A', color: 'white', fontSize: 12, fontWeight: 700,
                        cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.6 : 1,
                      }}>
                        {isLoading ? '…' : 'Принять'}
                      </button>
                      <button disabled={isLoading} onClick={() => act(c.id, 'decline')} style={{
                        padding: '7px 12px', borderRadius: 10, border: '1.5px solid var(--border)',
                        background: 'transparent', color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600,
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                      }}>
                        Отклонить
                      </button>
                    </>
                  )}
                  {tab === 'outgoing' && (
                    <button disabled={isLoading} onClick={() => act(c.id, 'cancel')} style={{
                      padding: '7px 12px', borderRadius: 10, border: '1.5px solid var(--border)',
                      background: 'transparent', color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600,
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                    }}>
                      {isLoading ? '…' : 'Отозвать'}
                    </button>
                  )}
                  {tab === 'active' && (
                    <button disabled={isLoading} onClick={() => terminate(c.id)} style={{
                      padding: '7px 12px', borderRadius: 10, border: '1.5px solid #FECACA',
                      background: '#FEF2F2', color: '#DC2626', fontSize: 12, fontWeight: 600,
                      cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.6 : 1,
                    }}>
                      {isLoading ? '…' : 'Завершить'}
                    </button>
                  )}
                  {tab === 'history' && (
                    <span style={{
                      padding: '5px 12px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                      background: 'var(--muted)', color: 'var(--muted-foreground)',
                    }}>
                      {c.status === 'declined' ? 'Отклонено' : c.status === 'cancelled' ? 'Отозвано' : 'Завершено'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          padding: '12px 18px', borderRadius: 14,
          background: toast.ok ? '#F0FDF4' : '#FEF2F2',
          border: `1px solid ${toast.ok ? '#BBF7D0' : '#FECACA'}`,
          color: toast.ok ? '#15803D' : '#DC2626',
          fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        }}>
          <i className={`ki-filled ${toast.ok ? 'ki-check-circle' : 'ki-information-5'} text-sm`} />
          {toast.msg}
        </div>
      )}
    </div>
  )
}
