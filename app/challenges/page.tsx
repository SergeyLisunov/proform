'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import { useToast } from '@/lib/hooks/useToast'

type Challenge = {
  id: string
  owner_id: string
  org_id: string | null
  title: string
  description: string | null
  metric: 'duration_min' | 'strain' | 'workouts_count'
  activity_type: string | null
  starts_at: string
  ends_at: string
  owner: { id: string; name: string | null; nickname: string | null; avatar_url: string | null; role: string | null } | null
  org:   { id: string; org_name: string | null; logo_url: string | null } | null
}

const METRIC_LABEL: Record<Challenge['metric'], string> = {
  duration_min:   'Минуты',
  strain:         'Strain',
  workouts_count: 'Кол-во тренировок',
}

const ACTIVITY_OPTIONS = ['Бег', 'Велоспорт', 'Плавание', 'Силовые', 'Ходьба']

function toLocalISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function computeStatus(c: Challenge): 'active' | 'upcoming' | 'finished' {
  const today = toLocalISO(new Date())
  if (today < c.starts_at) return 'upcoming'
  if (today > c.ends_at)   return 'finished'
  return 'active'
}

const STATUS_STYLE: Record<'active' | 'upcoming' | 'finished', string> = {
  active:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  upcoming: 'bg-blue-50 text-blue-700 border-blue-200',
  finished: 'bg-slate-100 text-slate-600 border-slate-200',
}

const STATUS_LABEL: Record<'active' | 'upcoming' | 'finished', string> = {
  active:   'В разгаре',
  upcoming: 'Скоро',
  finished: 'Завершён',
}

export default function ChallengesPage() {
  const { user } = useUser()
  const { success, error } = useToast()
  const [list, setList]       = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'active' | 'upcoming' | 'finished' | 'all'>('active')

  const canCreate = !!user && ['coach', 'organization', 'admin'].includes(user.role ?? '')

  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [form, setForm] = useState({
    title:         '',
    description:   '',
    metric:        'duration_min' as Challenge['metric'],
    activity_type: '',
    starts_at:     toLocalISO(new Date()),
    ends_at:       toLocalISO(new Date(Date.now() + 7 * 86400_000)),
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/challenges?status=${filter}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'LOAD_ERROR')
      setList(json.challenges as Challenge[])
    } catch (e) {
      error(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [filter, error])

  useEffect(() => { load() }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title:         form.title.trim(),
          description:   form.description.trim() || null,
          metric:        form.metric,
          activity_type: form.activity_type || null,
          starts_at:     form.starts_at,
          ends_at:       form.ends_at,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'CREATE_ERROR')
      success('Челлендж создан')
      setFormOpen(false)
      setForm(f => ({ ...f, title: '', description: '' }))
      await load()
    } catch (e) {
      error(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(59,130,246,0.1),_transparent_28%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Челленджи
            </div>
            <h1 className="pf-num text-[32px] leading-none text-navy-500">Командные вызовы</h1>
            <p className="mt-2 max-w-[560px] text-sm text-muted-foreground">
              Создавайте недельные или месячные челленджи на объём, strain или количество тренировок. Лидерборд обновляется автоматически.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-full border border-border bg-background p-1 text-xs font-semibold">
              {(['active', 'upcoming', 'finished', 'all'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilter(s)}
                  className={`rounded-full px-3 py-1.5 transition-all ${
                    filter === s ? 'bg-emerald-500 text-white' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s === 'active' ? 'Активные' : s === 'upcoming' ? 'Скоро' : s === 'finished' ? 'Завершённые' : 'Все'}
                </button>
              ))}
            </div>
            {canCreate && (
              <button
                type="button"
                onClick={() => setFormOpen(o => !o)}
                className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-600"
              >
                + Новый челлендж
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Create form */}
      {formOpen && canCreate && (
        <section className="rounded-[20px] border border-border bg-card p-5 shadow-sm">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={create}>
            <div className="md:col-span-2">
              <label className="text-2xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Название</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                maxLength={160}
                required
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-emerald-400"
                placeholder="Июньская беговая сотня"
              />
            </div>
            <div>
              <label className="text-2xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Метрика</label>
              <select
                value={form.metric}
                onChange={e => setForm(f => ({ ...f, metric: e.target.value as Challenge['metric'] }))}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="duration_min">Суммарные минуты</option>
                <option value="strain">Суммарный strain</option>
                <option value="workouts_count">Количество тренировок</option>
              </select>
            </div>
            <div>
              <label className="text-2xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Активность (опц.)</label>
              <select
                value={form.activity_type}
                onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Любая</option>
                {ACTIVITY_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-2xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Старт</label>
              <input
                type="date"
                value={form.starts_at}
                onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-2xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Финиш</label>
              <input
                type="date"
                value={form.ends_at}
                onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-2xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Описание</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                maxLength={4000}
                className="mt-1 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm"
                placeholder="Правила, приз, хэштег…"
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-full border border-border bg-background px-4 py-2 text-xs font-bold text-muted-foreground"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={saving || !form.title.trim()}
                className="rounded-full bg-emerald-500 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                {saving ? 'Создаю…' : 'Создать'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* List */}
      <section className="rounded-[20px] border border-border bg-card p-5 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 rounded-full border-2 border-emerald-500 border-t-transparent pf-spin" />
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-background/60 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
              <i className="ki-filled ki-crown text-[20px]" />
            </div>
            <p className="text-sm font-semibold text-foreground">Челленджей пока нет</p>
            <p className="text-2xs text-muted-foreground">
              {canCreate ? 'Создайте первый — и пригласите атлетов.' : 'Попросите тренера создать челлендж.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {list.map(c => {
              const status = computeStatus(c)
              return (
                <Link
                  key={c.id}
                  href={`/challenges/${c.id}`}
                  className="group flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 transition-all hover:border-emerald-200 hover:bg-emerald-50/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-foreground">{c.title}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-2xs text-muted-foreground">
                        <span>{METRIC_LABEL[c.metric]}</span>
                        {c.activity_type && <><span className="h-1 w-1 rounded-full bg-border" /><span>{c.activity_type}</span></>}
                        <span className="h-1 w-1 rounded-full bg-border" />
                        <span>{new Date(c.starts_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — {new Date(c.ends_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[status]}`}>
                      {STATUS_LABEL[status]}
                    </span>
                  </div>
                  {c.description && (
                    <p className="line-clamp-2 text-2xs leading-relaxed text-muted-foreground">{c.description}</p>
                  )}
                  <div className="mt-auto flex items-center gap-2 text-2xs text-muted-foreground">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-foreground">
                      {(c.owner?.nickname || c.owner?.name || '?').slice(0, 1).toUpperCase()}
                    </span>
                    <span className="truncate">{c.org?.org_name || c.owner?.nickname || c.owner?.name || 'Организатор'}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
