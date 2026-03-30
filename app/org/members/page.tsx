'use client'

import { useEffect, useState, useMemo } from 'react'
import { useUser } from '@/lib/hooks/useUser'
import { getMyOrg, getOrgMembers, inviteMember, updateMemberStatus } from '@/services/org.service'
import type { Organization, OrgMember, MemberStatus } from '@/types/org.types'

const STATUS_BADGE: Record<MemberStatus, string> = {
  active:    'bg-green-50 text-green-600 border border-green-200',
  pending:   'bg-orange-50 text-orange-600 border border-orange-200',
  suspended: 'bg-red-50 text-red-600 border border-red-200',
}

const STATUS_OPTIONS: { value: MemberStatus | 'removed'; label: string }[] = [
  { value: 'active',    label: 'Активный' },
  { value: 'pending',   label: 'Ожидает' },
  { value: 'suspended', label: 'Приостановлен' },
  { value: 'removed',   label: 'Удалить' },
]

export default function OrgMembersPage() {
  const { user, loading: userLoading } = useUser()
  const [org, setOrg] = useState<Organization | null>(null)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterRole, setFilterRole] = useState<'all' | 'athlete' | 'coach'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | MemberStatus>('all')

  // Invite modal
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'athlete' | 'coach'>('athlete')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState(false)

  useEffect(() => {
    if (userLoading) return
    if (user?.role !== 'organization') { setLoading(false); return }
    async function load() {
      const orgData = await getMyOrg()
      if (!orgData) { setLoading(false); return }
      setOrg(orgData)
      const m = await getOrgMembers(orgData.id)
      setMembers(m)
      setLoading(false)
    }
    load()
  }, [user, userLoading])

  const filtered = useMemo(() => members.filter(m => {
    if (filterRole !== 'all' && m.role !== filterRole) return false
    if (filterStatus !== 'all' && m.status !== filterStatus) return false
    return true
  }), [members, filterRole, filterStatus])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!org) return
    setInviteLoading(true)
    setInviteError('')
    const { error } = await inviteMember(org.id, inviteEmail, inviteRole)
    if (error) {
      setInviteError(error)
      setInviteLoading(false)
      return
    }
    setInviteSuccess(true)
    setInviteEmail('')
    const m = await getOrgMembers(org.id)
    setMembers(m)
    setInviteLoading(false)
    setTimeout(() => { setInviteSuccess(false); setShowInvite(false) }, 1500)
  }

  async function handleStatusChange(memberId: string, val: string) {
    if (!org) return
    if (val === 'removed') {
      setMembers(prev => prev.filter(m => m.id !== memberId))
      // In a real app, delete the record
      return
    }
    await updateMemberStatus(memberId, val as MemberStatus)
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, status: val as MemberStatus } : m))
  }

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  if (user?.role !== 'organization') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <i className="ki-filled ki-shield-cross text-3xl text-red-400" />
        <p className="text-sm font-semibold text-foreground">Требуется доступ организации</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 pf-enter">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Организация</p>
          <h2 className="pf-num text-[36px] text-foreground leading-none">Участники</h2>
          <p className="text-2sm text-muted-foreground mt-1">{org?.org_name}</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="kt-btn kt-btn-primary gap-2">
          <i className="ki-filled ki-plus text-sm" />
          Пригласить
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-card border border-border rounded-xl p-1">
          {(['all', 'athlete', 'coach'] as const).map(r => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className={`px-3 py-1.5 rounded-lg text-2xs font-semibold capitalize transition-colors ${filterRole === r ? 'bg-orange-500 text-white' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {r === 'all' ? 'Все роли' : r === 'athlete' ? 'Атлет' : 'Тренер'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-card border border-border rounded-xl p-1">
          {(['all', 'active', 'pending', 'suspended'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-2xs font-semibold capitalize transition-colors ${filterStatus === s ? 'bg-orange-500 text-white' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {s === 'all' ? 'Все статусы' : s === 'active' ? 'Активные' : s === 'pending' ? 'Ожидают' : 'Приостановлен'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
            {filtered.length} {filtered.length === 1 ? 'участник' : filtered.length < 5 ? 'участника' : 'участников'}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-muted-foreground text-2sm">
            Нет участников, соответствующих выбранным фильтрам.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(m => (
              <div key={m.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/30 transition-colors">
                <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0 text-sm font-bold pf-num text-blue-600">
                  {(m.user?.name ?? '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{m.user?.name ?? '—'}</div>
                  <div className="text-2xs text-muted-foreground font-mono truncate">{m.user?.email ?? '—'}</div>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold capitalize ${m.role === 'coach' ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-orange-50 text-orange-600 border border-orange-200'}`}>
                  {m.role}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold capitalize ${STATUS_BADGE[m.status]}`}>
                  {m.status}
                </span>
                <div className="text-2xs text-muted-foreground shrink-0 hidden md:block">
                  {new Date(m.joined_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
                <select
                  value={m.status}
                  onChange={e => handleStatusChange(m.id, e.target.value)}
                  className="px-2 py-1 rounded-lg border border-border bg-background text-2xs text-muted-foreground outline-none focus:border-orange-400 shrink-0"
                >
                  {STATUS_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowInvite(false) }}
        >
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="pf-num text-xl text-foreground">Пригласить участника</h3>
              <button onClick={() => setShowInvite(false)} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
                <i className="ki-filled ki-cross text-sm" />
              </button>
            </div>

            {inviteSuccess ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <i className="ki-filled ki-check text-xl text-green-600" />
                </div>
                <p className="text-sm font-semibold text-foreground">Приглашение отправлено!</p>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="flex flex-col gap-4">
                {inviteError && (
                  <div className="rounded-xl p-3 bg-red-50 border border-red-200 text-sm text-red-600">{inviteError}</div>
                )}
                <div>
                  <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Email</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    required
                    placeholder="member@example.com"
                    className="w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Роль</label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as 'athlete' | 'coach')}
                    className="w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400 bg-background"
                  >
                    <option value="athlete">Атлет</option>
                    <option value="coach">Тренер</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={inviteLoading} className="flex-1 kt-btn kt-btn-primary">
                    {inviteLoading ? 'Отправка…' : 'Отправить приглашение'}
                  </button>
                  <button type="button" onClick={() => setShowInvite(false)} className="kt-btn kt-btn-outline">Отмена</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
