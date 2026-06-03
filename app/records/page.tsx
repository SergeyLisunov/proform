'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useToast } from '@/lib/hooks/useToast'

type Category = 'run' | 'bike' | 'swim' | 'strength' | 'other'
type Metric = 'time' | 'distance' | 'weight' | 'reps' | 'duration' | 'power'

type Record = {
  id: string
  athlete_id: string
  category: Category
  exercise: string
  metric: Metric
  value: number
  unit: string
  achieved_at: string
  notes: string | null
  lower_is_better: boolean
  created_at: string
}

type FormState = {
  id?: string
  category: Category
  exercise: string
  metric: Metric
  value: string
  unit: string
  achieved_at: string
  notes: string
  lower_is_better: boolean
}

const CATEGORIES: { value: Category; label: string; icon: string; color: string }[] = [
  { value: 'run',      label: 'Бег',         icon: 'ki-route',       color: '#16A34A' },
  { value: 'bike',     label: 'Вело',        icon: 'ki-scooter',     color: '#0EA5E9' },
  { value: 'swim',     label: 'Плавание',    icon: 'ki-drop',        color: '#06B6D4' },
  { value: 'strength', label: 'Сила',        icon: 'ki-barbell',     color: '#DC2626' },
  { value: 'other',    label: 'Другое',      icon: 'ki-flash',       color: '#7C3AED' },
]

const METRICS: { value: Metric; label: string; defaultUnit: string; lowerBetter: boolean }[] = [
  { value: 'time',     label: 'Время',     defaultUnit: 'сек',  lowerBetter: true  },
  { value: 'distance', label: 'Дистанция', defaultUnit: 'км',   lowerBetter: false },
  { value: 'weight',   label: 'Вес',       defaultUnit: 'кг',   lowerBetter: false },
  { value: 'reps',     label: 'Повторы',   defaultUnit: 'раз',  lowerBetter: false },
  { value: 'duration', label: 'Длит-сть',  defaultUnit: 'мин',  lowerBetter: false },
  { value: 'power',    label: 'Мощность',  defaultUnit: 'вт',   lowerBetter: false },
]

const EMPTY_FORM: FormState = {
  category: 'strength',
  exercise: '',
  metric: 'weight',
  value: '',
  unit: 'кг',
  achieved_at: new Date().toISOString().slice(0, 10),
  notes: '',
  lower_is_better: false,
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtValue(value: number, metric: Metric, unit: string): string {
  if (metric === 'time') {
    // seconds → hh:mm:ss or mm:ss
    const total = Math.round(value)
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
  }
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(2)} ${unit}`
}

function catMeta(c: Category) { return CATEGORIES.find(x => x.value === c) ?? CATEGORIES[4] }

export default function RecordsPage() {
  const { success, error } = useToast()
  const [records, setRecords] = useState<Record[] | null>(null)
  const [filter, setFilter] = useState<Category | 'all'>('all')
  const [editing, setEditing] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)

  const supabase = useMemo(
    () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    []
  )

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setRecords([]); return }
    const { data: me } = await supabase.from('users').select('id').eq('auth_id', user.id).single()
    if (!me) { setRecords([]); return }
    const { data, error: err } = await (supabase as any)
      .from('personal_records')
      .select('*')
      .eq('athlete_id', me.id)
      .order('achieved_at', { ascending: false })
    if (err) { error(err.message); setRecords([]); return }
    setRecords((data ?? []) as Record[])
  }, [supabase, error])

  useEffect(() => { load() }, [load])

  const openNew = () => setEditing({ ...EMPTY_FORM })
  const openEdit = (r: Record) => setEditing({
    id: r.id,
    category: r.category,
    exercise: r.exercise,
    metric: r.metric,
    value: String(r.value),
    unit: r.unit,
    achieved_at: r.achieved_at,
    notes: r.notes ?? '',
    lower_is_better: r.lower_is_better,
  })

  const handleSave = useCallback(async () => {
    if (!editing) return
    const exercise = editing.exercise.trim()
    const valueN = parseFloat(editing.value.replace(',', '.'))
    if (!exercise) { error('Укажите упражнение'); return }
    if (!Number.isFinite(valueN) || valueN < 0) { error('Укажите значение'); return }
    if (!editing.unit.trim()) { error('Укажите единицу'); return }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Не авторизован')
      const { data: me } = await supabase.from('users').select('id').eq('auth_id', user.id).single()
      if (!me) throw new Error('Профиль не найден')

      const payload = {
        athlete_id: me.id,
        category: editing.category,
        exercise,
        metric: editing.metric,
        value: valueN,
        unit: editing.unit.trim(),
        achieved_at: editing.achieved_at,
        notes: editing.notes.trim() || null,
        lower_is_better: editing.lower_is_better,
        updated_at: new Date().toISOString(),
      }

      if (editing.id) {
        const { error: err } = await (supabase as any).from('personal_records').update(payload).eq('id', editing.id)
        if (err) throw new Error(err.message)
      } else {
        const { error: err } = await (supabase as any).from('personal_records').insert(payload)
        if (err) throw new Error(err.message)
      }
      success(editing.id ? 'Рекорд обновлён' : 'Рекорд добавлен')
      setEditing(null)
      load()
    } catch (e) {
      error(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }, [editing, supabase, success, error, load])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Удалить этот рекорд?')) return
    const { error: err } = await (supabase as any).from('personal_records').delete().eq('id', id)
    if (err) { error(err.message); return }
    success('Удалено')
    load()
  }, [supabase, success, error, load])

  // Group: exercise → its records (newest first), pick PR by lower_is_better
  const grouped = useMemo(() => {
    if (!records) return []
    const filtered = filter === 'all' ? records : records.filter(r => r.category === filter)
    const map = new Map<string, Record[]>()
    for (const r of filtered) {
      const k = `${r.category}::${r.exercise}`
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(r)
    }
    const arr = Array.from(map.entries()).map(([key, list]) => {
      const best = list.reduce((b, x) =>
        !b ? x : (x.lower_is_better ? (x.value < b.value ? x : b) : (x.value > b.value ? x : b))
      , null as Record | null)!
      const prev = list
        .filter(x => x.id !== best.id)
        .sort((a, b) => new Date(b.achieved_at).getTime() - new Date(a.achieved_at).getTime())[0] ?? null
      return { key, best, prev, all: list }
    })
    arr.sort((a, b) => new Date(b.best.achieved_at).getTime() - new Date(a.best.achieved_at).getTime())
    return arr
  }, [records, filter])

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.16),_transparent_42%)]" />
        <div className="relative flex flex-col gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-600">
            Персональные рекорды
          </div>
          <h1 className="pf-num text-[28px] leading-tight text-navy-500">
            Ваш лог достижений
          </h1>
          <p className="max-w-[640px] text-sm text-muted-foreground">
            Фиксируйте личные максимумы — бег, вело, плавание, силовые, любые метрики.
            Система сама отслеживает улучшения.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1 rounded-full border border-border bg-card p-1">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  filter === 'all' ? 'bg-amber-500 text-white' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Все
              </button>
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setFilter(c.value)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    filter === c.value ? 'bg-amber-500 text-white' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <i className={`ki-filled ${c.icon}`} style={{ color: filter === c.value ? '#fff' : c.color }} />
                  {c.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={openNew}
              className="ml-auto rounded-full bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600"
            >
              <i className="ki-filled ki-plus mr-1" />
              Новый рекорд
            </button>
          </div>
        </div>
      </section>

      {/* Cards */}
      {records === null ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
          Загрузка…
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
          {filter === 'all'
            ? 'Ещё нет рекордов. Нажмите «Новый рекорд», чтобы добавить первый.'
            : 'В этой категории пока нет рекордов.'}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {grouped.map(g => {
            const cat = catMeta(g.best.category)
            const delta = g.prev
              ? (g.best.lower_is_better
                  ? g.prev.value - g.best.value
                  : g.best.value - g.prev.value)
              : null
            const deltaPct = g.prev && g.prev.value !== 0
              ? Math.abs(delta!) / Math.abs(g.prev.value) * 100
              : null
            return (
              <li key={g.key} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: `${cat.color}18` }}
                  >
                    <i className={`ki-filled ${cat.icon} text-[18px]`} style={{ color: cat.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {cat.label} · {METRICS.find(m => m.value === g.best.metric)?.label}
                    </div>
                    <div className="mt-0.5 text-base font-bold text-foreground">{g.best.exercise}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEdit(g.best)}
                    className="rounded-lg border border-border bg-card px-2 py-1 text-[10px] font-bold text-muted-foreground hover:bg-accent"
                  >
                    ✎
                  </button>
                </div>
                <div className="mt-3 flex items-end gap-2">
                  <div className="pf-num text-3xl font-bold text-foreground">
                    {fmtValue(g.best.value, g.best.metric, g.best.unit)}
                  </div>
                  {delta !== null && deltaPct !== null && delta !== 0 && (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                        delta > 0
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-rose-200 bg-rose-50 text-rose-700'
                      }`}
                    >
                      <i className={`ki-filled ${delta > 0 ? 'ki-arrow-up' : 'ki-arrow-down'} mr-1`} />
                      {deltaPct.toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{fmtDate(g.best.achieved_at)}</div>
                {g.best.notes && (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{g.best.notes}</p>
                )}
                {g.all.length > 1 && (
                  <details className="mt-3 group">
                    <summary className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                      История · {g.all.length}
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {g.all.map(r => (
                        <li key={r.id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-1 text-xs">
                          <span className="pf-num font-bold text-foreground">
                            {fmtValue(r.value, r.metric, r.unit)}
                          </span>
                          <span className="text-muted-foreground">{fmtDate(r.achieved_at)}</span>
                          <div className="ml-auto flex gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(r)}
                              className="rounded px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                              title="Изменить"
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(r.id)}
                              className="rounded px-1.5 text-[10px] text-rose-500 hover:text-rose-700"
                              title="Удалить"
                            >
                              ✕
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Editor modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-[520px] rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-bold text-foreground">
                {editing.id ? 'Изменить рекорд' : 'Новый рекорд'}
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-full border border-border bg-card px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Категория</label>
                <select
                  value={editing.category}
                  onChange={e => setEditing({ ...editing, category: e.target.value as Category })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-amber-400"
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Метрика</label>
                <select
                  value={editing.metric}
                  onChange={e => {
                    const m = METRICS.find(x => x.value === e.target.value as Metric)!
                    setEditing({ ...editing, metric: m.value, unit: m.defaultUnit, lower_is_better: m.lowerBetter })
                  }}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-amber-400"
                >
                  {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Упражнение</label>
                <input
                  value={editing.exercise}
                  onChange={e => setEditing({ ...editing, exercise: e.target.value })}
                  placeholder="Например: 5К бег, присед 1ПМ, 100м кроль"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Значение {editing.metric === 'time' && '(секунды)'}
                </label>
                <input
                  type="number"
                  step="any"
                  value={editing.value}
                  onChange={e => setEditing({ ...editing, value: e.target.value })}
                  placeholder="0"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Единица</label>
                <input
                  value={editing.unit}
                  onChange={e => setEditing({ ...editing, unit: e.target.value })}
                  placeholder="кг / км / сек…"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Дата</label>
                <input
                  type="date"
                  value={editing.achieved_at}
                  onChange={e => setEditing({ ...editing, achieved_at: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-amber-400"
                />
              </div>
              <div className="flex items-center">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.lower_is_better}
                    onChange={e => setEditing({ ...editing, lower_is_better: e.target.checked })}
                    className="h-4 w-4"
                  />
                  Меньше = лучше
                </label>
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Заметки</label>
                <textarea
                  value={editing.notes}
                  onChange={e => setEditing({ ...editing, notes: e.target.value })}
                  rows={2}
                  placeholder="Условия, самочувствие, место…"
                  className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              {editing.id && (
                <button
                  type="button"
                  onClick={() => { handleDelete(editing.id!); setEditing(null) }}
                  className="mr-auto rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100"
                >
                  Удалить
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-full border border-border bg-card px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-accent"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-full bg-amber-500 px-5 py-2 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
