'use client'
/**
 * /org/teams/[id] — Sprint W3 Day 17 (PR #32) team drill-down.
 *
 * Composes the existing org-groups service + members endpoint into a
 * single management page:
 *   - Hero header (name, age range, level, description, head coach)
 *   - Stats tiles (athletes count placeholder; future: avg readiness, last training)
 *   - Member roster with per-row remove (DELETE /api/org/teams/[id]/members)
 *   - Add-member picker (search org athletes NOT in team → POST add)
 *   - Edit modal (PATCH /api/org/teams/[id])
 *   - Archive button (DELETE /api/org/teams/[id], redirects to /org/teams)
 *
 * RLS handles auth: org_admin/org_owner can do everything; head_coach of
 * the team can edit + manage members of their own team only. Non-members
 * see read-only view (or get redirected by middleware in production).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useUser } from '@/lib/hooks/useUser'
import { useDialog } from '@/lib/hooks/useDialog'
import { getMyOrg } from '@/services/org.service'
import {
  getOrgGroup, listOrgAthletesNotInGroup,
  LEVEL_META, type SkillLevel, type OrgGroup,
} from '@/services/org-groups.service'
import type { Organization } from '@/types/org.types'
import { Card, Badge } from '@/components/ui/metronic'

const LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'pro', 'recreational']

interface Member {
  id: string
  name: string | null
  avatar_url: string | null
}

interface AvailableAthlete {
  id: string
  name: string | null
}

export default function TeamDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const groupId = params.id

  const { user, loading: userLoading } = useUser()
  const { confirm }                     = useDialog()
  const [org, setOrg]                   = useState<Organization | null>(null)
  const [group, setGroup]               = useState<OrgGroup | null>(null)
  const [members, setMembers]           = useState<Member[]>([])
  const [available, setAvailable]       = useState<AvailableAthlete[]>([])
  const [loading, setLoading]           = useState(true)
  const [busyAthleteId, setBusyAthleteId] = useState<string | null>(null)
  const [showEdit, setShowEdit]         = useState(false)
  const [archiving, setArchiving]       = useState(false)
  const [search, setSearch]             = useState('')
  const [toast, setToast]               = useState<string | null>(null)

  // Edit form state
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [ageMin, setAgeMin]           = useState<number | ''>('')
  const [ageMax, setAgeMax]           = useState<number | ''>('')
  const [level, setLevel]             = useState<SkillLevel | ''>('')
  const [saving, setSaving]           = useState(false)
  const [editError, setEditError]     = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // ── Load ────────────────────────────────────────────────────────────
  const load = useCallback(async (orgId: string) => {
    setLoading(true)
    try {
      const data = await getOrgGroup(groupId)
      if (!data) {
        setGroup(null)
        return
      }
      setGroup(data.group)
      setMembers(data.members)
      const avail = await listOrgAthletesNotInGroup(orgId, groupId)
      setAvailable(avail)
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    if (userLoading) return
    if (user?.role !== 'organization') { setLoading(false); return }
    let cancelled = false
    async function init() {
      const orgData = await getMyOrg()
      if (cancelled || !orgData) { setLoading(false); return }
      setOrg(orgData)
      await load(orgData.id)
    }
    init()
    return () => { cancelled = true }
  }, [user, userLoading, load])

  // ── Sync edit form when group loads/changes ────────────────────────
  useEffect(() => {
    if (!group) return
    setName(group.name)
    setDescription(group.description ?? '')
    setAgeMin(group.age_min ?? '')
    setAgeMax(group.age_max ?? '')
    setLevel(group.level ?? '')
  }, [group])

  // ── Filtered available list (client-side search) ───────────────────
  const filteredAvailable = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return available
    return available.filter(a => (a.name ?? '').toLowerCase().includes(q))
  }, [available, search])

  // ── Add member ──────────────────────────────────────────────────────
  async function addMember(athleteId: string) {
    if (!org) return
    setBusyAthleteId(athleteId)
    try {
      const res = await fetch(`/api/org/teams/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athlete_id: athleteId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data?.error === 'ALREADY_MEMBER' ? 'Уже в команде' : 'Не удалось добавить')
        return
      }
      showToast('Атлет добавлен')
      await load(org.id)
    } finally {
      setBusyAthleteId(null)
    }
  }

  // ── Remove member ───────────────────────────────────────────────────
  async function removeMember(athleteId: string) {
    if (!org) return
    if (!(await confirm('Удалить атлета из команды? Профиль атлета останется в организации.'))) return
    setBusyAthleteId(athleteId)
    try {
      const res = await fetch(
        `/api/org/teams/${groupId}/members?athlete_id=${encodeURIComponent(athleteId)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        showToast('Не удалось удалить')
        return
      }
      showToast('Атлет удалён из команды')
      await load(org.id)
    } finally {
      setBusyAthleteId(null)
    }
  }

  // ── Edit submit ─────────────────────────────────────────────────────
  async function submitEdit() {
    if (!group) return
    if (name.trim().length < 1) { setEditError('Введите название'); return }
    if (typeof ageMin === 'number' && typeof ageMax === 'number' && ageMin > ageMax) {
      setEditError('Возрастной диапазон некорректный')
      return
    }
    setSaving(true)
    setEditError(null)
    try {
      const patch: Record<string, unknown> = {
        name:        name.trim(),
        description: description.trim() || null,
        age_min:     typeof ageMin === 'number' ? ageMin : null,
        age_max:     typeof ageMax === 'number' ? ageMax : null,
        level:       level || null,
      }
      const res = await fetch(`/api/org/teams/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setEditError(
          data?.error === 'NAME_CONFLICT'
            ? 'Команда с таким именем уже существует'
            : 'Не удалось сохранить изменения',
        )
        return
      }
      setShowEdit(false)
      showToast('Команда обновлена')
      if (org) await load(org.id)
    } finally {
      setSaving(false)
    }
  }

  // ── Archive ─────────────────────────────────────────────────────────
  async function archive() {
    if (!(await confirm('Архивировать команду? Атлеты останутся в системе, команда будет скрыта.'))) return
    setArchiving(true)
    try {
      const res = await fetch(`/api/org/teams/${groupId}`, { method: 'DELETE' })
      if (!res.ok) {
        showToast('Не удалось архивировать')
        return
      }
      router.push('/org/teams')
    } finally {
      setArchiving(false)
    }
  }

  // ── States ──────────────────────────────────────────────────────────
  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full pf-spin" />
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

  if (!group) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="rounded-3xl border-2 border-dashed border-border bg-accent/30 px-6 py-12 text-center">
          <i className="ki-filled ki-information-2 text-4xl text-muted-foreground mb-3 block" />
          <h2 className="text-lg font-semibold text-navy-500">Команда не найдена</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Возможно, команда была архивирована или у вас нет доступа.
          </p>
          <Link href="/org/teams"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 text-sm font-bold no-underline">
            ← К командам
          </Link>
        </div>
      </div>
    )
  }

  const lvl = group.level ? LEVEL_META[group.level] : null
  const ageRange = group.age_min && group.age_max ? `${group.age_min}–${group.age_max} лет`
                : group.age_min ? `${group.age_min}+ лет`
                : group.age_max ? `до ${group.age_max} лет`
                : null

  return (
    <div className="flex flex-col gap-6 pf-enter max-w-6xl mx-auto px-4 py-6">
      {/* Back link */}
      <div>
        <Link href="/org/teams"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition no-underline">
          <i className="ki-filled ki-arrow-left text-sm" />
          К командам
        </Link>
      </div>

      {/* Hero */}
      <section className="rounded-3xl border border-violet-200 bg-[radial-gradient(circle_at_top_left,_rgba(147,51,234,0.12),_transparent_30%),linear-gradient(135deg,#FAF5FF_0%,#FFFFFF_50%,#F5F3FF_100%)] p-6 md:p-7 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-700 mb-2">
              Организация {org ? '· ' + org.org_name : ''}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-navy-500 tracking-tight">
              {group.name}
            </h1>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {ageRange && (
                <Badge variant="warning" size="sm" className="!rounded-full uppercase tracking-wider">
                  {ageRange}
                </Badge>
              )}
              {lvl && (
                <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: lvl.bg, color: lvl.color, border: `1px solid ${lvl.border}` }}>
                  {lvl.label}
                </span>
              )}
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-violet-50 text-violet-700 border border-violet-200">
                <i className="ki-filled ki-people text-[10px] mr-1" />
                {members.length} атлет{plural(members.length, 'ов', '', 'а')}
              </span>
            </div>
            {group.description && (
              <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground whitespace-pre-wrap">
                {group.description}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button onClick={() => setShowEdit(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50 transition">
              <i className="ki-filled ki-pencil text-sm" />
              Редактировать
            </button>
            <button onClick={archive} disabled={archiving}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition">
              <i className="ki-filled ki-archive text-sm" />
              {archiving ? 'Архивируем…' : 'Архивировать'}
            </button>
          </div>
        </div>
      </section>

      {/* Roster */}
      <Card className="rounded-3xl p-5 md:p-6">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Состав</p>
            <h2 className="text-xl font-bold text-navy-500 mt-1">Атлеты команды</h2>
          </div>
          <span className="text-xs text-muted-foreground">{members.length} в команде</span>
        </div>

        {members.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border bg-accent/30 px-4 py-8 text-center">
            <i className="ki-filled ki-people text-3xl text-muted-foreground mb-2 block" />
            <p className="text-sm text-foreground font-semibold">В команде ещё нет атлетов</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Добавьте первого атлета из списка ниже.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {members.map(m => {
              const initials = (m.name ?? '?').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3">
                  <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-700 overflow-hidden shrink-0">
                    {m.avatar_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                      : initials || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/org/athletes/${m.id}`}
                      className="text-sm font-semibold text-foreground hover:text-violet-600 truncate block no-underline">
                      {m.name ?? '—'}
                    </Link>
                  </div>
                  <button onClick={() => removeMember(m.id)} disabled={busyAthleteId === m.id}
                    title="Убрать из команды"
                    className="w-8 h-8 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 flex items-center justify-center shrink-0">
                    <i className="ki-filled ki-cross text-xs" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Add picker */}
      <Card className="rounded-3xl p-5 md:p-6">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Доступно</p>
            <h2 className="text-xl font-bold text-navy-500 mt-1">Добавить в команду</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Атлеты организации, ещё не входящие в эту команду
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{available.length} доступно</span>
        </div>

        {available.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border bg-accent/30 px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Все атлеты организации уже в этой команде. Чтобы пригласить новых атлетов в организацию,
              перейдите в{' '}
              <Link href="/org/members" className="font-semibold text-violet-700 hover:underline">
                Участники
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <i className="ki-filled ki-magnifier absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Поиск по имени…"
                className="w-full rounded-2xl border border-border bg-background pl-9 pr-4 py-2.5 text-sm outline-none focus:border-violet-400" />
            </div>

            {filteredAvailable.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                По запросу никого не найдено
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[360px] overflow-y-auto">
                {filteredAvailable.map(a => {
                  const initials = (a.name ?? '?').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()
                  const busy = busyAthleteId === a.id
                  return (
                    <button key={a.id} onClick={() => addMember(a.id)} disabled={busy}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-background hover:border-violet-300 hover:bg-violet-50 transition p-2.5 disabled:opacity-50 text-left">
                      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                        {initials || '?'}
                      </div>
                      <span className="text-sm font-semibold text-foreground truncate flex-1">
                        {a.name ?? '—'}
                      </span>
                      <i className={`ki-filled ${busy ? 'ki-loading pf-spin' : 'ki-plus'} text-sm text-violet-600 shrink-0`} />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Edit modal */}
      {showEdit && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-8 overflow-y-auto"
          onClick={() => setShowEdit(false)}>
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <div onClick={e => e.stopPropagation()}
            className="relative z-10 w-full max-w-md rounded-2xl bg-background shadow-2xl border border-border">
            <div className="border-b border-border px-5 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-navy-500">Редактирование команды</h3>
              <button onClick={() => setShowEdit(false)} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
                <i className="ki-filled ki-cross text-xs" />
              </button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Название</label>
                <input value={name} onChange={e => setName(e.target.value)} maxLength={100}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-violet-400 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Описание</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  rows={2} maxLength={2000}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-violet-400 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Возраст от</label>
                  <input type="number" min={3} max={120} value={ageMin}
                    onChange={e => setAgeMin(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-violet-400 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Возраст до</label>
                  <input type="number" min={3} max={120} value={ageMax}
                    onChange={e => setAgeMax(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-violet-400 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Уровень</label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {LEVELS.map(l => {
                    const meta = LEVEL_META[l]
                    const sel = level === l
                    return (
                      <button key={l} type="button" onClick={() => setLevel(sel ? '' : l)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                          sel ? 'ring-2 ring-current' : 'opacity-60 hover:opacity-100'
                        }`}
                        style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}>
                        {meta.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {editError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {editError}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-border px-5 py-3">
              <button onClick={submitEdit} disabled={saving || !name.trim()}
                className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {saving ? 'Сохраняем…' : 'Сохранить'}
              </button>
              <button onClick={() => setShowEdit(false)} disabled={saving}
                className="rounded-xl border border-border bg-background hover:bg-muted px-4 py-2.5 text-sm font-semibold">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999 }}
          className="rounded-2xl bg-foreground text-background px-5 py-2.5 text-sm font-semibold shadow-2xl pf-enter">
          {toast}
        </div>
      )}
    </div>
  )
}

// ── helpers ─────────────────────────────────────────────────────────────

/** Plural helper for Russian: 1 атлет, 2-4 атлета, 5+ атлетов */
function plural(n: number, many: string, one: string, few: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}
