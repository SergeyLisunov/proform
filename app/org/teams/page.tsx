'use client'
/**
 * /org/teams — Sprint W2 Day 10.
 *
 * Org admin view: list teams with name + age range + level + count
 * athletes + head coach. Create new team modal. Click team card —
 * drill-down to manage members (Day 11/12 will expand drill-down with
 * bulk-add from roster).
 *
 * For Day 10 minimum: list + create. Member management done via
 * separate sub-page (Day 11) or via existing /org/athletes page where
 * coach can assign athlete to group dropdown (Day 12).
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import { useDialog } from '@/lib/hooks/useDialog'
import { getMyOrg } from '@/services/org.service'
import {
  listOrgGroups, createOrgGroup, archiveOrgGroup,
  LEVEL_META, type SkillLevel, type OrgGroupWithCounts,
} from '@/services/org-groups.service'
import type { Organization } from '@/types/org.types'
import { Card, Badge } from '@/components/ui/metronic'

const LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'pro', 'recreational']

export default function OrgTeamsPage() {
  const { user, loading: userLoading } = useUser()
  const { confirm }                 = useDialog()
  const [org, setOrg]               = useState<Organization | null>(null)
  const [groups, setGroups]         = useState<OrgGroupWithCounts[]>([])
  const [loading, setLoading]       = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [busyId, setBusyId]         = useState<string | null>(null)

  // Create form state
  const [name, setName]                 = useState('')
  const [description, setDescription]   = useState('')
  const [ageMin, setAgeMin]             = useState<number | ''>('')
  const [ageMax, setAgeMax]             = useState<number | ''>('')
  const [level, setLevel]               = useState<SkillLevel | ''>('')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState<string | null>(null)

  const load = useCallback(async (orgId: string) => {
    setLoading(true)
    try {
      const list = await listOrgGroups(orgId)
      setGroups(list)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (userLoading) return
    if (user?.role !== 'organization') { setLoading(false); return }
    async function init() {
      const orgData = await getMyOrg()
      if (!orgData) { setLoading(false); return }
      setOrg(orgData)
      await load(orgData.id)
    }
    init()
  }, [user, userLoading, load])

  const submit = async () => {
    if (!org) return
    if (name.trim().length < 1) { setError('Введите название'); return }
    if (typeof ageMin === 'number' && typeof ageMax === 'number' && ageMin > ageMax) {
      setError('Возрастной диапазон некорректный')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const created = await createOrgGroup({
        organization_id: org.id,
        name:            name.trim(),
        description:     description.trim() || null,
        age_min:         typeof ageMin === 'number' ? ageMin : null,
        age_max:         typeof ageMax === 'number' ? ageMax : null,
        level:           level || null,
      })
      if (!created) {
        setError('Не удалось создать команду. Возможно, команда с таким именем уже существует.')
        return
      }
      // Reset form + reload
      setName(''); setDescription(''); setAgeMin(''); setAgeMax(''); setLevel('')
      setShowCreate(false)
      await load(org.id)
    } finally {
      setSaving(false)
    }
  }

  const archive = async (groupId: string) => {
    if (!(await confirm('Архивировать команду? Атлеты останутся в системе, команда будет скрыта.'))) return
    setBusyId(groupId)
    try {
      const ok = await archiveOrgGroup(groupId)
      if (ok && org) await load(org.id)
    } finally { setBusyId(null) }
  }

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  if (user?.role !== 'organization' || !org) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <i className="ki-filled ki-shield-cross text-3xl text-red-400" />
        <p className="text-sm font-semibold text-foreground">Требуется доступ организации</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 pf-enter">
      {/* Header */}
      <Card className="rounded-3xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-700">Организация · {org.org_name}</p>
            <h1 className="text-3xl font-bold text-navy-500 mt-1">Команды</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Группы атлетов организации с возрастным диапазоном и уровнем подготовки.
              Команды используются для bulk-планирования, командных рассылок и аналитики.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#9333EA,#7C3AED)] px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:opacity-95">
            <i className="ki-filled ki-plus text-sm" />
            Новая команда
          </button>
        </div>
      </Card>

      {/* List */}
      {groups.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-border bg-accent/30 px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 mb-4">
            <i className="ki-filled ki-people text-2xl" />
          </div>
          <h3 className="text-lg font-semibold text-navy-500">Команд пока нет</h3>
          <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
            Создайте первую команду — например «U-12», «Senior», «Бегуны» — чтобы группировать атлетов
            и управлять ими массово.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 text-sm font-semibold">
            + Создать первую команду
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map(g => {
            const lvl = g.level ? LEVEL_META[g.level] : null
            const ageRange = g.age_min && g.age_max ? `${g.age_min}–${g.age_max} лет`
                          : g.age_min ? `${g.age_min}+ лет`
                          : g.age_max ? `до ${g.age_max} лет`
                          : null
            return (
              <Link key={g.id} href={`/org/teams/${g.id}`} className="no-underline block group">
                <Card className="p-5 rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-violet-200">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-navy-500 truncate group-hover:text-violet-700 transition-colors">{g.name}</h3>
                    {g.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{g.description}</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); archive(g.id) }}
                    disabled={busyId === g.id}
                    className="kt-btn kt-btn-xs kt-btn-icon kt-btn-ghost shrink-0 hover:!bg-red-50"
                    title="Архивировать">
                    <i className="ki-filled ki-archive text-xs text-red-500" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {ageRange && (
                    <Badge variant="warning" size="sm" className="!rounded-full uppercase tracking-wider">
                      {ageRange}
                    </Badge>
                  )}
                  {lvl && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: lvl.bg, color: lvl.color, border: `1px solid ${lvl.border}` }}>
                      {lvl.label}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 pt-3 border-t border-border">
                  <div>
                    <div className="pf-num text-2xl font-bold text-foreground">{g.athletes_count}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">атлетов</div>
                  </div>
                  {g.head_coach && (
                    <div className="min-w-0 text-right">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Тренер</div>
                      <div className="text-xs font-semibold text-foreground truncate">{g.head_coach.name ?? '—'}</div>
                    </div>
                  )}
                </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-8 overflow-y-auto"
          onClick={() => setShowCreate(false)}>
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <div onClick={e => e.stopPropagation()}
            className="relative z-10 w-full max-w-md rounded-2xl bg-background shadow-2xl border border-border">
            <div className="border-b border-border px-5 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-navy-500">Новая команда</h3>
              <button onClick={() => setShowCreate(false)} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
                <i className="ki-filled ki-cross text-xs" />
              </button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Название</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="Например: U-12, Senior, Бегуны"
                  maxLength={100}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-violet-400 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Описание (опц.)</label>
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
                    const selected = level === l
                    return (
                      <button key={l} type="button" onClick={() => setLevel(selected ? '' : l)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                          selected ? 'ring-2 ring-current' : 'opacity-60 hover:opacity-100'
                        }`}
                        style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}>
                        {meta.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-border px-5 py-3">
              <button onClick={submit} disabled={saving || !name.trim()}
                className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {saving ? 'Сохраняем…' : 'Создать команду'}
              </button>
              <button onClick={() => setShowCreate(false)} disabled={saving}
                className="rounded-xl border border-border bg-background hover:bg-muted px-4 py-2.5 text-sm font-semibold">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
