'use client'
import { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/lib/hooks/useUser'

type MemberRole = 'athlete' | 'coach'
type MemberStatus = 'active' | 'pending' | 'suspended' | 'removed'

type Member = {
  id: string; user_id: string; member_role: MemberRole; status: MemberStatus
  joined_at: string | null; created_at: string; user_name: string; user_email: string
}

function getSB() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const ROLE_CFG = {
  athlete: { label: 'Атлет',  icon: 'ki-abstract-26',  color: '#F97316', bg: '#FFF7ED', border: '#FED7AA' },
  coach:   { label: 'Тренер', icon: 'ki-notepad-edit', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
}

const STATUS_CFG: Record<MemberStatus, { label: string; color: string; bg: string; border: string }> = {
  active:    { label: 'Активен',    color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  pending:   { label: 'Ожидает',    color: '#CA8A04', bg: '#FEFCE8', border: '#FDE68A' },
  suspended: { label: 'Заморожен',  color: '#F97316', bg: '#FFF7ED', border: '#FED7AA' },
  removed:   { label: 'Удалён',     color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
}

// ── InviteDrawer ──────────────────────────────────────────────────────────────
function InviteDrawer({ orgId, onClose, onInvited }: {
  orgId: string; onClose: () => void; onInvited: (m: Member) => void
}) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [role, setRole] = useState<MemberRole>('athlete')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    setMounted(true)
    requestAnimationFrame(() => setVisible(true))
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, []) // eslint-disable-line

  function handleClose() { setVisible(false); setTimeout(onClose, 260) }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!email.trim()) { setErr('Email обязателен'); return }
    setSaving(true); setErr('')
    try {
      const sb = getSB()
      const { data: userRow } = await sb
        .from('users').select('id, email, name')
        .eq('email', email.trim().toLowerCase()).single()

      if (!userRow) {
        setErr('Пользователь не найден. Попросите их сначала зарегистрироваться в ProForm.')
        setSaving(false); return
      }

      const { data: existing } = await sb
        .from('org_members').select('id').eq('org_id', orgId).eq('user_id', userRow.id).maybeSingle()

      if (existing) { setErr('Этот пользователь уже участник организации.'); setSaving(false); return }

      const { data: member, error: insertErr } = await sb
        .from('org_members')
        .insert({ org_id: orgId, user_id: userRow.id, member_role: role, status: 'active', joined_at: new Date().toISOString() })
        .select().single()

      if (insertErr) throw insertErr
      onInvited({ id: member.id, user_id: member.user_id, member_role: member.member_role, status: member.status, joined_at: member.joined_at, created_at: member.created_at, user_name: userRow.name ?? email, user_email: userRow.email })
      handleClose()
    } catch (e: any) {
      setErr(e?.message ?? 'Ошибка при добавлении')
    } finally { setSaving(false) }
  }

  if (!mounted) return null

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
      {/* Backdrop */}
      <div onClick={handleClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', opacity: visible ? 1 : 0, transition: 'opacity 0.26s' }} />
      {/* Drawer */}
      <div style={{ position: 'relative', width: 460, maxWidth: '100vw', height: '100%', background: 'var(--card)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.26s cubic-bezier(.32,.72,0,1)', boxShadow: '-12px 0 48px rgba(0,0,0,0.15)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#F97316,#EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ki-filled ki-people text-white text-base" />
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Организация</p>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em', lineHeight: 1 }}>Добавить участника</h2>
            </div>
          </div>
          <button onClick={handleClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
            <i className="ki-filled ki-cross text-sm" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Выбор роли */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Роль</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {(['athlete', 'coach'] as MemberRole[]).map(r => {
                const cfg = ROLE_CFG[r]; const sel = role === r
                return (
                  <button key={r} type="button" onClick={() => setRole(r)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                    borderRadius: 14, border: `2px solid ${sel ? cfg.border : 'var(--border)'}`,
                    background: sel ? cfg.bg : 'transparent', cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: cfg.bg, border: `1px solid ${cfg.border}`, flexShrink: 0 }}>
                      <i className={`ki-filled ${cfg.icon} text-sm`} style={{ color: cfg.color }} />
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: sel ? cfg.color : 'var(--foreground)' }}>{cfg.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{r === 'athlete' ? 'Тренировки, метрики' : 'Наблюдение, пометки'}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Email */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>
              Email *
            </label>
            <input type="email" required value={email} onChange={e => { setEmail(e.target.value); setErr('') }}
              placeholder="athlete@example.com"
              style={{ width: '100%', borderRadius: 12, border: '1.5px solid var(--border)', padding: '11px 14px', fontSize: 14, outline: 'none', background: 'var(--background)', color: 'var(--foreground)', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
              onFocus={e => (e.target.style.borderColor = '#F97316')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 5 }}>Пользователь должен быть зарегистрирован в ProForm</p>
            {err && (
              <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 12, color: '#DC2626', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <i className="ki-filled ki-information-5 shrink-0" style={{ color: '#DC2626', marginTop: 1 }} />
                {err}
              </div>
            )}
          </div>

          {/* Инфо */}
          <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--accent)', border: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <i className="ki-filled ki-information-5 shrink-0" style={{ color: '#2563EB', marginTop: 1 }} />
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.55 }}>
              После добавления участник сразу получит доступ к разделам организации согласно своей роли.
            </p>
          </div>
        </form>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <button type="button" onClick={() => handleSubmit()} disabled={saving} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '12px 0', borderRadius: 12, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            background: 'linear-gradient(135deg,#F97316,#EA580C)', color: 'white',
            fontSize: 14, fontWeight: 700, opacity: saving ? 0.7 : 1, transition: 'all 0.15s',
            boxShadow: '0 2px 8px rgba(249,115,22,0.35)',
          }}>
            {saving
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Добавление…</>
              : <><i className="ki-filled ki-check text-sm" />Добавить участника</>}
          </button>
          <button onClick={handleClose} style={{ padding: '12px 18px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Отмена
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OrgMembersPage() {
  const { user } = useUser()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState<'all' | MemberRole>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | MemberStatus>('all')
  const [search, setSearch] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [toast, setToast] = useState('')

  const orgId = user?.id ?? ''

  useEffect(() => { if (orgId) loadMembers() }, [orgId]) // eslint-disable-line

  async function loadMembers() {
    setLoading(true)
    try {
      const { data, error } = await getSB()
        .from('org_members')
        .select('id, user_id, member_role, status, joined_at, created_at, users!inner(name, email)')
        .eq('org_id', orgId).neq('status', 'removed')
        .order('created_at', { ascending: false })
      if (error) throw error
      setMembers((data ?? []).map((m: any) => ({
        id: m.id, user_id: m.user_id, member_role: m.member_role, status: m.status,
        joined_at: m.joined_at, created_at: m.created_at,
        user_name: m.users?.name ?? '—', user_email: m.users?.email ?? '—',
      })))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function changeStatus(memberId: string, newStatus: MemberStatus) {
    const { error } = await getSB().from('org_members').update({ status: newStatus }).eq('id', memberId)
    if (error) { alert('Ошибка при изменении статуса'); return }
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, status: newStatus } : m).filter(m => m.status !== 'removed'))
    showToastMsg(newStatus === 'removed' ? 'Участник удалён' : 'Статус обновлён')
  }

  function showToastMsg(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const filtered = members.filter(m => {
    if (roleFilter !== 'all' && m.member_role !== roleFilter) return false
    if (statusFilter !== 'all' && m.status !== statusFilter) return false
    if (search) { const q = search.toLowerCase(); if (!m.user_name.toLowerCase().includes(q) && !m.user_email.toLowerCase().includes(q)) return false }
    return true
  })

  const total    = members.length
  const athletes = members.filter(m => m.member_role === 'athlete').length
  const coaches  = members.filter(m => m.member_role === 'coach').length
  const pending  = members.filter(m => m.status === 'pending').length

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
    </div>
  )

  return (
    <div className="flex flex-col gap-5 pf-enter">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Панель организации</p>
          <h2 className="pf-num text-[36px] text-foreground leading-none">Участники</h2>
        </div>
        <button onClick={() => setShowInvite(true)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '9px 18px', borderRadius: 12, border: '1.5px solid #FED7AA',
          background: 'linear-gradient(135deg,#F97316,#EA580C)', color: 'white',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(249,115,22,0.35)',
        }}>
          <i className="ki-filled ki-plus" style={{ fontSize: 14 }} />
          Добавить участника
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Всего',       value: total,    color: '#2563EB', bg: '#EFF6FF', icon: 'ki-people'       },
          { label: 'Атлетов',     value: athletes, color: '#F97316', bg: '#FFF7ED', icon: 'ki-abstract-26'  },
          { label: 'Тренеров',    value: coaches,  color: '#16A34A', bg: '#F0FDF4', icon: 'ki-notepad-edit' },
          { label: 'Ожидают',     value: pending,  color: '#CA8A04', bg: '#FEFCE8', icon: 'ki-time'         },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div style={{ width: 38, height: 38, borderRadius: 11, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`ki-filled ${s.icon} text-base`} style={{ color: s.color }} />
            </div>
            <div>
              <div className="pf-num text-2xl text-foreground">{s.value}</div>
              <div className="text-2xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Фильтры */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <i className="ki-filled ki-magnifier absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени или email…"
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-card text-sm outline-none focus:border-orange-400" />
        </div>
        {/* Роли */}
        <div style={{ display: 'flex', gap: 6, padding: 4, background: 'var(--accent)', borderRadius: 12, border: '1px solid var(--border)' }}>
          {(['all', 'athlete', 'coach'] as const).map(f => (
            <button key={f} onClick={() => setRoleFilter(f)} style={{
              padding: '6px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: roleFilter === f ? 'var(--card)' : 'transparent',
              color: roleFilter === f ? 'var(--foreground)' : 'var(--muted-foreground)',
              boxShadow: roleFilter === f ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
              {f === 'all' ? 'Все роли' : ROLE_CFG[f].label + 'ы'}
            </button>
          ))}
        </div>
        {/* Статусы */}
        <div style={{ display: 'flex', gap: 6, padding: 4, background: 'var(--accent)', borderRadius: 12, border: '1px solid var(--border)' }}>
          {(['all', 'active', 'pending', 'suspended'] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f as any)} style={{
              padding: '6px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: statusFilter === f ? 'var(--card)' : 'transparent',
              color: statusFilter === f ? 'var(--foreground)' : 'var(--muted-foreground)',
              boxShadow: statusFilter === f ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
              {f === 'all' ? 'Все статусы' : STATUS_CFG[f as MemberStatus].label}
            </button>
          ))}
        </div>
      </div>

      {/* Таблица */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl px-5 py-16 text-center">
          <i className="ki-filled ki-people text-3xl text-muted-foreground/20 block mb-3" />
          <p className="text-muted-foreground text-2sm mb-3">
            {members.length === 0 ? 'Участников пока нет. Добавьте первого!' : 'Никто не подходит под фильтры'}
          </p>
          {members.length === 0 && (
            <button onClick={() => setShowInvite(true)} style={{
              padding: '8px 18px', borderRadius: 10, border: '1.5px solid #FED7AA',
              background: 'linear-gradient(135deg,#F97316,#EA580C)', color: 'white',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              <i className="ki-filled ki-plus text-xs mr-1.5" />Добавить участника
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Заголовок таблицы */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 120px 120px', gap: 16, padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--accent)' }}>
            {['Участник', 'Роль', 'Статус', 'Действия'].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</span>
            ))}
          </div>
          <div className="divide-y divide-border">
            {filtered.map(m => {
              const rc = ROLE_CFG[m.member_role]
              const sc = STATUS_CFG[m.status]
              const initials = m.user_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
              return (
                <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 120px 120px', gap: 16, padding: '12px 20px', alignItems: 'center' }}
                  className="hover:bg-accent/30 transition-colors">
                  {/* Имя */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700, background: rc.bg, color: rc.color }}>
                      {initials}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.user_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.user_email}</div>
                    </div>
                  </div>
                  {/* Роль */}
                  <div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: rc.bg, color: rc.color, border: `1px solid ${rc.border}` }}>
                      <i className={`ki-filled ${rc.icon} text-[10px]`} />{rc.label}
                    </span>
                  </div>
                  {/* Статус */}
                  <div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.color, flexShrink: 0 }} />
                      {sc.label}
                    </span>
                  </div>
                  {/* Действия */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {m.status === 'active' && (
                      <button onClick={() => changeStatus(m.id, 'suspended')} title="Заморозить" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #FED7AA', background: '#FFF7ED', color: '#F97316', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                        <i className="ki-filled ki-pause text-xs" />
                      </button>
                    )}
                    {(m.status === 'suspended' || m.status === 'pending') && (
                      <button onClick={() => changeStatus(m.id, 'active')} title="Активировать" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #BBF7D0', background: '#F0FDF4', color: '#16A34A', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                        <i className="ki-filled ki-check text-xs" />
                      </button>
                    )}
                    <button onClick={() => { if (confirm('Удалить участника из организации?')) changeStatus(m.id, 'removed') }} title="Удалить" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                      <i className="ki-filled ki-trash text-xs" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showInvite && (
        <InviteDrawer orgId={orgId} onClose={() => setShowInvite(false)}
          onInvited={m => { setMembers(prev => [m, ...prev]); showToastMsg('Участник добавлен!') }} />
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: 'var(--foreground)', color: 'var(--background)', fontSize: 13, fontWeight: 600, padding: '10px 20px', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 8 }} className="pf-enter">
          <i className="ki-filled ki-check-circle text-green-400" />{toast}
        </div>
      )}
    </div>
  )
}
