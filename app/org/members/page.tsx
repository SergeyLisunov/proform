'use client'
import { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { createBrowserClient } from '@supabase/ssr'
import { useOrgContext } from '@/lib/hooks/useOrgContext'
import { canAssignOrgAdmin } from '@/lib/permissions'
import { useDialog } from '@/lib/hooks/useDialog'
import { BulkImportDrawer } from './BulkImportDrawer'
import { getErrorMessage } from '@/lib/utils/errors'
import { Card } from '@/components/ui/metronic'

// Этап 7a — расширили локальный MemberRole до DB-полного набора (CHECK
// 053 разрешает 6 значений). До этого `'athlete' | 'coach'` молча
// type-cast'ил org_admin/org_owner/doctor/specialist строки и они
// падали в ROLE_CFG[undefined].
type MemberRole =
  | 'athlete' | 'coach' | 'org_admin' | 'org_owner' | 'doctor' | 'specialist'
// Invite-форма пускает только две роли: athlete/coach. Owner добавляет
// сам себя при онбординге, остальные scoped роли — через assign-флоу.
type InvitableRole = 'athlete' | 'coach'
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

const ROLE_CFG: Record<MemberRole, { label: string; icon: string; color: string; bg: string; border: string }> = {
  athlete:    { label: 'Атлет',      icon: 'ki-abstract-26',  color: '#F35703', bg: '#FEF0E7', border: '#FBC1A0' },
  coach:      { label: 'Тренер',     icon: 'ki-notepad-edit', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  org_owner:  { label: 'Владелец',   icon: 'ki-crown',        color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  org_admin:  { label: 'Админ',      icon: 'ki-shield-tick',  color: '#0F766E', bg: '#ECFDF5', border: '#A7F3D0' },
  doctor:     { label: 'Доктор',     icon: 'ki-pulse',        color: '#0EA5E9', bg: '#F0F9FF', border: '#BAE6FD' },
  specialist: { label: 'Специалист', icon: 'ki-people',       color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1' },
}

const STATUS_CFG: Record<MemberStatus, { label: string; color: string; bg: string; border: string }> = {
  active:    { label: 'Активен',    color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  pending:   { label: 'Ожидает',    color: '#CA8A04', bg: '#FEFCE8', border: '#FDE68A' },
  suspended: { label: 'Заморожен',  color: '#F35703', bg: '#FEF0E7', border: '#FBC1A0' },
  removed:   { label: 'Удалён',     color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
}

// ── InviteDrawer ──────────────────────────────────────────────────────────────
function InviteDrawer({ orgId, onClose, onInvited }: {
  orgId: string; onClose: () => void; onInvited: (m: Member) => void
}) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [role, setRole] = useState<InvitableRole>('athlete')
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
        setErr('Пользователь не найден. Попросите их сначала зарегистрироваться в Sporteo.')
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
    } catch (e: unknown) {
      setErr(getErrorMessage(e, 'Ошибка при добавлении'))
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
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#F35703,#D44A02)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
              {(['athlete', 'coach'] as InvitableRole[]).map(r => {
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
              onFocus={e => (e.target.style.borderColor = '#F35703')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 5 }}>Пользователь должен быть зарегистрирован в Sporteo</p>
            {err && (
              <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 12, color: '#DC2626', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <i className="ki-filled ki-information-4 shrink-0" style={{ color: '#DC2626', marginTop: 1 }} />
                {err}
              </div>
            )}
          </div>

          {/* Инфо */}
          <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--accent)', border: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <i className="ki-filled ki-information-4 shrink-0" style={{ color: '#2563EB', marginTop: 1 }} />
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
            background: 'linear-gradient(135deg,#F35703,#D44A02)', color: 'white',
            fontSize: 14, fontWeight: 700, opacity: saving ? 0.7 : 1, transition: 'all 0.15s',
            boxShadow: '0 2px 8px rgba(243,87,3,0.35)',
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

// ── AssignCoachModal — link an athlete to one of the org's coaches ──────────────
function AssignCoachModal({ athlete, coaches, onClose, onLinked }: {
  athlete: Member; coaches: Member[]; onClose: () => void; onLinked: (coachName: string) => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  async function link(coach: Member) {
    setBusyId(coach.user_id); setErr('')
    try {
      const res = await fetch('/api/org/connect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ athlete_id: athlete.user_id, provider_id: coach.user_id, provider_kind: 'coach' }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'link_failed')
      onLinked(coach.user_name)
      onClose()
    } catch (e) {
      setErr(getErrorMessage(e, 'Не удалось связать'))
    } finally { setBusyId(null) }
  }

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', width: 440, maxWidth: '100vw', maxHeight: '85vh', overflow: 'auto', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Назначить тренера</p>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', margin: '3px 0 0' }}>{athlete.user_name}</h3>
          </div>
          <button onClick={onClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost"><i className="ki-filled ki-cross text-sm" /></button>
        </div>
        <div style={{ padding: '14px 22px' }}>
          {coaches.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>В организации нет активных тренеров. Сначала добавьте тренера в состав.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {coaches.map(c => (
                <div key={c.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.user_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'monospace' }}>{c.user_email}</div>
                  </div>
                  <button onClick={() => link(c)} disabled={busyId === c.user_id} style={{ background: '#16A34A', color: 'white', borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 700, border: 'none', cursor: busyId === c.user_id ? 'not-allowed' : 'pointer', opacity: busyId === c.user_id ? 0.7 : 1, flexShrink: 0 }}>
                    {busyId === c.user_id ? 'Связываю…' : 'Связать'}
                  </button>
                </div>
              ))}
            </div>
          )}
          {err && <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 12, color: '#DC2626' }}>{err}</div>}
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '12px 0 0', lineHeight: 1.5 }}>
            Тренер получит доступ к данным спортсмена (тренировки, нагрузка). Связать можно только участников этой организации.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OrgMembersPage() {
  // P1: org_id брался из `user.id` — это верно только для аккаунта-организации
  // (organizations.id = users.id). У org_admin это чужой id, поэтому список
  // участников всегда приходил пустым. Плюс гейта не было вовсе.
  const { orgId: ctxOrgId, canManage, globalRole, loading: ctxLoading } = useOrgContext()
  const { confirm, alert } = useDialog()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState<'all' | MemberRole>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | MemberStatus>('all')
  const [search, setSearch] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [assignAthlete, setAssignAthlete] = useState<Member | null>(null)
  const [toast, setToast] = useState('')

  const orgId = ctxOrgId ?? ''
  const activeCoaches = members.filter(m => m.member_role === 'coach' && m.status === 'active')
  // Делегировать права может только глобальный аккаунт-организация — тот же
  // helper стоит на PATCH /api/org/members/role. org_admin не должен видеть
  // кнопку, которая гарантированно вернёт ему 403.
  const canDelegateAdmin = canAssignOrgAdmin(globalRole)

  useEffect(() => {
    if (ctxLoading) return
    if (!canManage || !orgId) { setLoading(false); return }
    loadMembers()
  }, [ctxLoading, canManage, orgId]) // eslint-disable-line

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
    // .select('id') обязателен: под RLS запись, не нашедшая доступных строк,
    // НЕ считается ошибкой — supabase-js вернёт error = null, и проверка
    // «нет ошибки → получилось» показывала «Статус обновлён» там, где в базе
    // не изменилось ничего. Судим по фактически затронутым строкам.
    const { data, error } = await getSB()
      .from('org_members').update({ status: newStatus }).eq('id', memberId).select('id')
    if (error) { await alert('Ошибка при изменении статуса'); return }
    if ((data ?? []).length === 0) {
      await alert('Статус не изменён — недостаточно прав для этого участника.')
      return
    }
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, status: newStatus } : m).filter(m => m.status !== 'removed'))
    showToastMsg(newStatus === 'removed' ? 'Участник удалён' : 'Статус обновлён')
  }

  // Этап 7a — назначение/разжалование org_admin. UI спрашивает причину
  // (хотя бы 4 символа — API enforced); audit_logs пишется на бэке.
  async function changeMemberRole(memberId: string, newRole: 'org_admin' | 'coach') {
    const label = newRole === 'org_admin' ? 'сделать админом' : 'снять с админа'
    const reason = window.prompt(`Кратко укажите причину (${label}):`)?.trim() ?? ''
    if (reason.length < 4) { await alert('Нужно указать причину (минимум 4 символа)'); return }
    const res = await fetch('/api/org/members/role', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ member_id: memberId, new_role: newRole, reason }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.ok) {
      await alert(`Не удалось изменить роль: ${json.error ?? res.status}`)
      return
    }
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, member_role: newRole } : m))
    showToastMsg(newRole === 'org_admin' ? 'Назначен админом' : 'Снят с админа')
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
  const hasFilters = roleFilter !== 'all' || statusFilter !== 'all' || Boolean(search.trim())

  // Filter tabs — owner всегда один (без отдельного tab); doctor/specialist
  // в /org/members не основной surface (приглашаются через другой флоу).
  const hasAdmins = members.some(m => m.member_role === 'org_admin')
  const roleOptions: { id: 'all' | MemberRole; label: string }[] = [
    { id: 'all', label: 'Все роли' },
    { id: 'athlete', label: 'Спортсмены' },
    { id: 'coach', label: 'Тренеры' },
    ...(hasAdmins ? [{ id: 'org_admin' as const, label: 'Админы' }] : []),
  ]

  const statusOptions: { id: 'all' | MemberStatus; label: string }[] = [
    { id: 'all', label: 'Все статусы' },
    { id: 'active', label: STATUS_CFG.active.label },
    { id: 'pending', label: STATUS_CFG.pending.label },
    { id: 'suspended', label: STATUS_CFG.suspended.label },
  ]

  if (ctxLoading || loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
    </div>
  )

  if (!canManage) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <i className="ki-filled ki-shield-cross text-3xl text-red-400" />
      <p className="text-sm font-semibold text-foreground">Требуется доступ к управлению клубом</p>
      <p className="text-2sm text-muted-foreground">Раздел доступен владельцу клуба и его администраторам.</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-5 pf-enter">
      <section className="relative overflow-hidden rounded-[30px] border border-orange-100 bg-[radial-gradient(circle_at_top_left,_rgba(243,87,3,0.15),_transparent_28%),radial-gradient(circle_at_88%_12%,_rgba(59,130,246,0.08),_transparent_24%),linear-gradient(135deg,#FFF8F1_0%,#FFFFFF_52%,#FFF4EC_100%)] p-6 shadow-[0_20px_55px_rgba(15,23,42,0.06)] sm:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-orange-300/70 bg-orange-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-700">
                Панель организации
              </span>
              <span className="inline-flex items-center rounded-full border border-border bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Команда и роли
              </span>
            </div>
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Участники</p>
            <h2 className="mt-2 text-[clamp(2rem,4vw,3.35rem)] font-semibold tracking-[-0.04em] text-navy-500">
              Управляйте составом организации без лишнего шума
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Добавляйте атлетов и тренеров, контролируйте статусы и держите состав команды в одном рабочем пространстве.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:min-w-[280px]">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-border bg-white/80 p-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">В выборке</div>
                <div className="mt-2 pf-num text-2xl text-foreground">{filtered.length}</div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {hasFilters ? 'Текущий набор участников после поиска и фильтров.' : 'Все участники организации в текущем списке.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowInvite(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-[linear-gradient(135deg,#F35703,#D44A02)] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(243,87,3,0.28)] transition-all hover:-translate-y-0.5"
            >
              <i className="ki-filled ki-plus text-sm" />
              Добавить участника
            </button>
            <button
              onClick={() => setShowBulkImport(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50"
            >
              <i className="ki-filled ki-cloud-add text-sm" />
              Импорт CSV
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Всего участников', value: total, color: '#2563EB', bg: '#EFF6FF', icon: 'ki-people' },
            { label: 'Спортсменов', value: athletes, color: '#F35703', bg: '#FEF0E7', icon: 'ki-abstract-26' },
            { label: 'Тренеров', value: coaches, color: '#16A34A', bg: '#F0FDF4', icon: 'ki-notepad-edit' },
            { label: 'Ожидают', value: pending, color: '#CA8A04', bg: '#FEFCE8', icon: 'ki-time' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-white/80 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="pf-num text-2xl leading-none text-foreground">{s.value}</div>
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{s.label}</div>
                </div>
                <div
                  style={{ width: 40, height: 40, borderRadius: 14, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >
                  <i className={`ki-filled ${s.icon} text-base`} style={{ color: s.color }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Card className="rounded-[28px] p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Навигация состава</p>
              <p className="mt-1 text-sm text-muted-foreground">Ищите участников, переключайте роли и быстро находите тех, кто требует внимания.</p>
            </div>
            {hasFilters && (
              <button
                type="button"
                onClick={() => { setSearch(''); setRoleFilter('all'); setStatusFilter('all') }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-all hover:border-orange-200 hover:text-orange-600"
              >
                <i className="ki-filled ki-cross text-xs" />
                Сбросить фильтры
              </button>
            )}
          </div>

          <div className="rounded-[24px] border border-border bg-background/70 p-3">
            <div className="flex flex-col gap-3">
              <div className="relative">
                <i className="ki-filled ki-magnifier absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Поиск по имени или email…"
                  className="w-full rounded-2xl border border-border bg-card pl-9 pr-4 py-3 text-sm outline-none transition-all focus:border-orange-400"
                />
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap">
                  <div className="flex flex-wrap gap-2">
                    {roleOptions.map((option) => {
                      const active = roleFilter === option.id
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setRoleFilter(option.id)}
                          className={[
                            'rounded-full border px-3.5 py-2 text-xs font-semibold transition-all',
                            active
                              ? 'border-orange-200 bg-orange-50 text-orange-700 shadow-sm'
                              : 'border-border bg-card text-muted-foreground hover:border-orange-100 hover:text-foreground',
                          ].join(' ')}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map((option) => {
                      const active = statusFilter === option.id
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setStatusFilter(option.id as any)}
                          className={[
                            'rounded-full border px-3.5 py-2 text-xs font-semibold transition-all',
                            active
                              ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
                              : 'border-border bg-card text-muted-foreground hover:border-blue-100 hover:text-foreground',
                          ].join(' ')}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                  Показано: {filtered.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="rounded-[28px] px-6 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#FFF0E5,#FEF0E7)] text-orange-400 shadow-sm">
            <i className="ki-filled ki-people text-3xl" />
          </div>
          <p className="mt-5 text-lg font-semibold text-foreground">
            {members.length === 0 ? 'Участников пока нет. Добавьте первого!' : 'Никто не подходит под фильтры'}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {members.length === 0
              ? 'Когда в организации появятся спортсмены и тренеры, они сразу отобразятся здесь в одном рабочем списке.'
              : 'Попробуйте ослабить фильтры или очистить поисковый запрос, чтобы снова увидеть участников.'}
          </p>
          {members.length === 0 && (
            <button
              onClick={() => setShowInvite(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-orange-200 bg-[linear-gradient(135deg,#F35703,#D44A02)] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(243,87,3,0.28)] transition-all hover:-translate-y-0.5"
            >
              <i className="ki-filled ki-plus text-sm" />
              Добавить участника
            </button>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-[28px]">
          <div className="flex flex-col gap-2 border-b border-border bg-background/60 px-5 py-4 sm:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Список участников</p>
            <p className="text-sm text-muted-foreground">Все действия по ролям и статусам доступны прямо из этой ленты.</p>
          </div>

          <div className="hidden border-b border-border bg-background/50 px-6 py-3 lg:grid lg:grid-cols-[minmax(0,1fr)_150px_140px_128px] lg:gap-4">
            {['Участник', 'Роль', 'Статус', 'Действия'].map((h) => (
              <span key={h} className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {h}
              </span>
            ))}
          </div>

          <div className="divide-y divide-border">
            {filtered.map(m => {
              const rc = ROLE_CFG[m.member_role]
              const sc = STATUS_CFG[m.status]
              const initials = m.user_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
              return (
                <div
                  key={m.id}
                  className="grid gap-4 px-5 py-4 transition-colors hover:bg-accent/30 sm:px-6 lg:grid-cols-[minmax(0,1fr)_150px_140px_128px] lg:items-center"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700, background: rc.bg, color: rc.color }}>
                      {initials}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.user_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.user_email}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground lg:hidden">
                        {rc.label} · {sc.label}
                      </div>
                    </div>
                  </div>

                  <div className="hidden lg:block">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: rc.bg, color: rc.color, border: `1px solid ${rc.border}` }}>
                      <i className={`ki-filled ${rc.icon} text-[10px]`} />{rc.label}
                    </span>
                  </div>

                  <div className="hidden lg:block">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.color, flexShrink: 0 }} />
                      {sc.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-start' }} className="lg:justify-end">
                    {m.member_role === 'athlete' && m.status === 'active' && (
                      <button onClick={() => setAssignAthlete(m)} title="Назначить тренера" style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid #BBF7D0', background: '#F0FDF4', color: '#16A34A', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                        <i className="ki-filled ki-fasten text-xs" />
                      </button>
                    )}
                    {canDelegateAdmin && m.member_role === 'coach' && m.status === 'active' && m.user_id !== orgId && (
                      <button onClick={() => changeMemberRole(m.id, 'org_admin')} title="Сделать админом" style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid #A7F3D0', background: '#ECFDF5', color: '#0F766E', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                        <i className="ki-filled ki-shield-tick text-xs" />
                      </button>
                    )}
                    {canDelegateAdmin && m.member_role === 'org_admin' && m.status === 'active' && (
                      <button onClick={() => changeMemberRole(m.id, 'coach')} title="Снять с админа" style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid #FEF3C7', background: '#FFFBEB', color: '#B45309', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                        <i className="ki-filled ki-shield-cross text-xs" />
                      </button>
                    )}
                    {m.status === 'active' && (
                      <button onClick={() => changeStatus(m.id, 'suspended')} title="Заморозить" style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid #FBC1A0', background: '#FEF0E7', color: '#F35703', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                        <i className="ki-filled ki-minus-circle text-xs" />
                      </button>
                    )}
                    {(m.status === 'suspended' || m.status === 'pending') && (
                      <button onClick={() => changeStatus(m.id, 'active')} title="Активировать" style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid #BBF7D0', background: '#F0FDF4', color: '#16A34A', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                        <i className="ki-filled ki-check text-xs" />
                      </button>
                    )}
                    <button onClick={async () => { if (await confirm('Удалить участника из организации?')) changeStatus(m.id, 'removed') }} title="Удалить" style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                      <i className="ki-filled ki-trash text-xs" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {showInvite && (
        <InviteDrawer orgId={orgId} onClose={() => setShowInvite(false)}
          onInvited={m => { setMembers(prev => [m, ...prev]); showToastMsg('Участник добавлен!') }} />
      )}

      {assignAthlete && (
        <AssignCoachModal
          athlete={assignAthlete}
          coaches={activeCoaches}
          onClose={() => setAssignAthlete(null)}
          onLinked={coachName => showToastMsg(`Тренер ${coachName} назначен`)}
        />
      )}

      {showBulkImport && (
        <BulkImportDrawer
          onClose={() => setShowBulkImport(false)}
          onComplete={summary => {
            // Invitees won't appear in org_members until they claim the
            // emailed link, so we don't refresh the list — just toast.
            const msg = summary.invited > 0
              ? `Отправлено ${summary.invited} приглашений`
              : 'Новых приглашений не отправлено'
            showToastMsg(msg)
          }}
        />
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: 'var(--foreground)', color: 'var(--background)', fontSize: 13, fontWeight: 600, padding: '10px 20px', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 8 }} className="pf-enter">
          <i className="ki-filled ki-check-circle text-green-400" />{toast}
        </div>
      )}
    </div>
  )
}
