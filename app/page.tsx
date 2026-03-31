'use client'
import { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/lib/hooks/useUser'

type MemberRole = 'athlete' | 'coach'
type MemberStatus = 'active' | 'pending' | 'suspended' | 'removed'

type Member = {
  id: string
  user_id: string
  member_role: MemberRole
  status: MemberStatus
  joined_at: string | null
  created_at: string
  user_name: string
  user_email: string
}

function sb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const ROLE_CFG = {
  athlete: { label: 'Спортсмен', icon: 'ki-abstract-26',  bg: '#FFF7ED', text: '#F97316', border: '#FED7AA' },
  coach:   { label: 'Тренер',    icon: 'ki-notepad-edit', bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
}

const STATUS_CFG: Record<MemberStatus, { label: string; dot: string; badge: string }> = {
  active:    { label: 'Активен',   dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700 border-green-200'   },
  pending:   { label: 'Ожидает',   dot: 'bg-yellow-400', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  suspended: { label: 'Заморожен', dot: 'bg-orange-400', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  removed:   { label: 'Удалён',    dot: 'bg-red-400',    badge: 'bg-red-50 text-red-700 border-red-200'          },
}

function InviteDrawer({ orgId, onClose, onInvited }: {
  orgId: string
  onClose: () => void
  onInvited: (m: Member) => void
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setErr('Email обязателен'); return }
    setSaving(true); setErr('')
    try {
      const supabase = sb()
      const { data: userRow } = await supabase
        .from('users').select('id, email, name')
        .eq('email', email.trim().toLowerCase()).single()

      if (!userRow) {
        setErr('Пользователь не найден. Попросите их сначала зарегистрироваться в ProForm.')
        setSaving(false); return
      }

      const { data: existing } = await supabase
        .from('org_members').select('id').eq('org_id', orgId).eq('user_id', userRow.id).single()

      if (existing) { setErr('Этот пользователь уже участник организации.'); setSaving(false); return }

      const { data: member, error: insertErr } = await supabase
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
    <>
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(3px)', transition: 'opacity 0.26s', opacity: visible ? 1 : 0 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 440, maxWidth: '100vw', zIndex: 9999, background: 'var(--card)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', transition: 'transform 0.26s cubic-bezier(.32,.72,0,1)', transform: visible ? 'translateX(0)' : 'translateX(100%)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Организация</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)' }}>Добавить участника</div>
          </div>
          <button onClick={handleClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost"><i className="ki-filled ki-cross text-sm" /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Роль</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {(['athlete', 'coach'] as MemberRole[]).map(r => {
                const cfg = ROLE_CFG[r]; const sel = role === r
                return (
                  <button key={r} type="button" onClick={() => setRole(r)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${sel ? cfg.border : 'var(--border)'}`, background: sel ? cfg.bg : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: cfg.bg, border: `1px solid ${cfg.border}`, flexShrink: 0 }}>
                      <i className={`ki-filled ${cfg.icon} text-sm`} style={{ color: cfg.text }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: sel ? cfg.text : 'var(--foreground)' }}>{cfg.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{r === 'athlete' ? 'Тренировки, метрики' : 'Наблюдение, пометки'}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Email *</label>
            <input type="email" required value={email} onChange={e => { setEmail(e.target.value); setErr('') }} placeholder="athlete@example.com" className="w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400" />
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 5 }}>Пользователь должен быть зарегистрирован в ProForm</p>
            {err && <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 12, color: '#DC2626' }}>{err}</div>}
          </div>

          <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--accent)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <i className="ki-filled ki-information-2 text-blue-500 text-sm mt-0.5 shrink-0" />
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.5 }}>После добавления участник сразу получит доступ к разделам организации согласно своей роли.</p>
            </div>
          </div>
        </form>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <button onClick={handleSubmit as any} disabled={saving} className="kt-btn kt-btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {saving ? <><i className="ki-filled ki-loading animate-spin text-xs" /> Добавление…</> : <><i className="ki-filled ki-check text-xs" /> Добавить участника</>}
          </button>
          <button onClick={handleClose} className="kt-btn kt-btn-outline">Отмена</button>
        </div>
      </div>
    </>,
    document.body
  )
}

export default function OrgPage() {
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
      const { data, error } = await sb()
        .from('org_members')
        .select('id, user_id, member_role, status, joined_at, created_at, users!inner(name, email)')
        .eq('org_id', orgId)
        .neq('status', 'removed')
        .order('created_at', { ascending: false })
      if (error) throw error
      setMembers((data ?? []).map((m: any) => ({ id: m.id, user_id: m.user_id, member_role: m.member_role, status: m.status, joined_at: m.joined_at, created_at: m.created_at, user_name: m.users?.name ?? '—', user_email: m.users?.email ?? '—' })))
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  async function changeStatus(memberId: string, newStatus: MemberStatus) {
    const { error } = await sb().from('org_members').update({ status: newStatus }).eq('id', memberId)
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

  const total = members.length
  const athletes = members.filter(m => m.member_role === 'athlete').length
  const coaches = members.filter(m => m.member_role === 'coach').length
  const pending = members.filter(m => m.status === 'pending').length

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" /></div>

  return (
    <div className="flex flex-col gap-5 pf-enter">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Панель организации</p>
          <h2 className="pf-num text-[36px] text-foreground leading-none">Участники</h2>
        </div>
        <button onClick={() => setShowInvite(true)} className="kt-btn kt-btn-primary gap-2">
          <i className="ki-filled ki-plus text-sm" /> Добавить участника
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Всего участников', value: total,    bg: 'bg-blue-50 text-blue-600',    icon: 'ki-people'      },
          { label: 'Спортсменов',      value: athletes, bg: 'bg-orange-50 text-orange-500', icon: 'ki-abstract-26' },
          { label: 'Тренеров',         value: coaches,  bg: 'bg-green-50 text-green-600',   icon: 'ki-notepad-edit'},
          { label: 'Ожидают',          value: pending,  bg: 'bg-yellow-50 text-yellow-600', icon: 'ki-time'        },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.bg}`}>
              <i className={`ki-filled ${s.icon} text-base`} />
            </div>
            <div>
              <div className="pf-num text-2xl text-foreground">{s.value}</div>
              <div className="text-2xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <i className="ki-filled ki-magnifier absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по имени или email…" className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-card text-sm outline-none focus:border-orange-400" />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'athlete', 'coach'] as const).map(f => (
            <button key={f} onClick={() => setRoleFilter(f)} className={['px-3 py-1.5 rounded-lg text-2sm font-medium border transition-all', roleFilter === f ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-card border-border text-muted-foreground hover:border-orange-200'].join(' ')}>
              {f === 'all' ? 'Все роли' : f === 'athlete' ? 'Спортсмены' : 'Тренеры'}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(['all', 'active', 'pending', 'suspended'] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)} className={['px-3 py-1.5 rounded-lg text-2sm font-medium border transition-all', statusFilter === f ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-card border-border text-muted-foreground hover:border-blue-200'].join(' ')}>
              {f === 'all' ? 'Все статусы' : STATUS_CFG[f as MemberStatus].label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl px-5 py-16 text-center">
          <i className="ki-filled ki-people text-3xl text-slate-300 mb-3 block" />
          <p className="text-muted-foreground text-2sm">{members.length === 0 ? 'Участников пока нет. Добавьте первого!' : 'Никто не подходит под фильтры'}</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_130px_110px_140px] gap-4 px-5 py-3 border-b border-border bg-muted/30">
            <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">Участник</span>
            <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">Роль</span>
            <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">Статус</span>
            <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">Действия</span>
          </div>
          <div className="divide-y divide-border">
            {filtered.map(m => {
              const rc = ROLE_CFG[m.member_role]
              const sc = STATUS_CFG[m.status]
              const initials = m.user_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
              return (
                <div key={m.id} className="grid grid-cols-[1fr_130px_110px_140px] gap-4 px-5 py-3.5 items-center hover:bg-accent/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold pf-num" style={{ background: rc.bg, color: rc.text }}>{initials}</div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{m.user_name}</div>
                      <div className="text-2xs text-muted-foreground font-mono truncate">{m.user_email}</div>
                    </div>
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-2xs font-semibold border" style={{ background: rc.bg, color: rc.text, borderColor: rc.border }}>
                      <i className={`ki-filled ${rc.icon} text-[10px]`} />{rc.label}
                    </span>
                  </div>
                  <div>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-2xs font-semibold border ${sc.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {m.status === 'active' && (
                      <button onClick={() => changeStatus(m.id, 'suspended')} className="px-2.5 py-1.5 rounded-lg border border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-100 text-2xs font-semibold transition-all" title="Заморозить">
                        <i className="ki-filled ki-pause text-xs" />
                      </button>
                    )}
                    {(m.status === 'suspended' || m.status === 'pending') && (
                      <button onClick={() => changeStatus(m.id, 'active')} className="px-2.5 py-1.5 rounded-lg border border-green-200 text-green-600 bg-green-50 hover:bg-green-100 text-2xs font-semibold transition-all" title="Активировать">
                        <i className="ki-filled ki-check text-xs" />
                      </button>
                    )}
                    <button onClick={() => { if (confirm('Удалить участника из организации?')) changeStatus(m.id, 'removed') }} className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 bg-red-50 hover:bg-red-100 text-2xs font-semibold transition-all" title="Удалить">
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-foreground text-background text-sm font-medium px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 pf-enter">
          <i className="ki-filled ki-check-circle text-green-400" />{toast}
        </div>
      )}
    </div>
  )
}
