'use client'
/**
 * /athlete/goals — Sprint W5 Day 25 (PR #41).
 *
 * Athlete-side goals management: list + create + mark achieved/abandoned.
 * Coach (с trainer_athletes link) тоже может видеть и manage goals для
 * своих athletes — но через /athletes/[id] (W5 Day 27 polish).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import {
  listMyGoals, createGoal, updateGoal, achieveGoal, abandonGoal,
  reactivateGoal, deleteGoal,
  METRIC_PRESETS, STATUS_META,
  type AthleteGoal, type GoalStatus,
} from '@/services/athlete-goals.service'

type FilterTab = 'all' | GoalStatus

export default function AthleteGoalsPage() {
  const { user, loading: userLoading } = useUser()
  const [goals, setGoals]     = useState<AthleteGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<FilterTab>('active')
  const [busyId, setBusyId]   = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId]   = useState<string | null>(null)

  // Create/edit form state
  const [metric, setMetric]               = useState<string>('weekly_volume')
  const [metricLabel, setMetricLabel]     = useState('')
  const [targetValue, setTargetValue]     = useState('')
  const [targetUnit, setTargetUnit]       = useState('')
  const [targetDate, setTargetDate]       = useState('')
  const [currentValue, setCurrentValue]   = useState('')
  const [notes, setNotes]                 = useState('')
  const [saving, setSaving]               = useState(false)
  const [formError, setFormError]         = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const list = await listMyGoals()
    setGoals(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (userLoading) return
    if (!user) { setLoading(false); return }
    load()
  }, [user, userLoading, load])

  const filtered = useMemo(() => {
    if (filter === 'all') return goals
    return goals.filter(g => g.status === filter)
  }, [goals, filter])

  // ── Modal helpers ─────────────────────────────────────────────────
  function resetForm() {
    setMetric('weekly_volume')
    setMetricLabel('')
    setTargetValue('')
    setTargetUnit('')
    setTargetDate('')
    setCurrentValue('')
    setNotes('')
    setFormError(null)
    setEditingId(null)
  }

  function applyPreset(presetValue: string) {
    setMetric(presetValue)
    const preset = METRIC_PRESETS.find(p => p.value === presetValue)
    if (preset && preset.value !== 'custom') {
      setMetricLabel(preset.label)
      setTargetUnit(preset.unit)
      if (!targetValue) setTargetValue(String(preset.suggestion))
    }
  }

  function openCreate() {
    resetForm()
    setShowCreate(true)
  }

  function openEdit(g: AthleteGoal) {
    setMetric(g.metric)
    setMetricLabel(g.metric_label)
    setTargetValue(g.target_value !== null ? String(g.target_value) : '')
    setTargetUnit(g.target_unit ?? '')
    setTargetDate(g.target_date ?? '')
    setCurrentValue(g.current_value !== null ? String(g.current_value) : '')
    setNotes(g.notes ?? '')
    setEditingId(g.id)
    setShowCreate(true)
  }

  async function handleSubmit() {
    setFormError(null)
    if (metricLabel.trim().length < 1) { setFormError('Введите название цели'); return }
    if (targetValue && !Number.isFinite(parseFloat(targetValue))) {
      setFormError('Target value должно быть числом')
      return
    }
    setSaving(true)
    try {
      const payload = {
        metric,
        metric_label: metricLabel,
        target_value: targetValue ? parseFloat(targetValue) : null,
        target_unit:  targetUnit || null,
        target_date:  targetDate || null,
        current_value: currentValue ? parseFloat(currentValue) : null,
        notes: notes || null,
      }
      let result: AthleteGoal | null
      if (editingId) {
        result = await updateGoal(editingId, payload)
      } else {
        result = await createGoal(payload)
      }
      if (!result) {
        setFormError('Не удалось сохранить цель')
        return
      }
      setShowCreate(false)
      resetForm()
      await load()
    } finally {
      setSaving(false)
    }
  }

  // ── Status actions ────────────────────────────────────────────────
  async function handleAchieve(id: string) {
    setBusyId(id)
    try {
      if (await achieveGoal(id)) await load()
    } finally { setBusyId(null) }
  }
  async function handleAbandon(id: string) {
    if (!confirm('Снять цель? Можно будет вернуть в активные позже.')) return
    setBusyId(id)
    try {
      if (await abandonGoal(id)) await load()
    } finally { setBusyId(null) }
  }
  async function handleReactivate(id: string) {
    setBusyId(id)
    try {
      if (await reactivateGoal(id)) await load()
    } finally { setBusyId(null) }
  }
  async function handleDelete(id: string) {
    if (!confirm('Удалить цель навсегда? Это действие необратимо.')) return
    setBusyId(id)
    try {
      if (await deleteGoal(id)) await load()
    } finally { setBusyId(null) }
  }

  // ── Render ─────────────────────────────────────────────────────────
  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <i className="ki-filled ki-shield-cross text-3xl text-red-400" />
        <p className="text-sm font-semibold text-foreground">Войдите в аккаунт</p>
        <Link href="/auth/login?next=/athlete/goals" className="text-sm text-orange-600 font-semibold hover:underline">
          → Войти
        </Link>
      </div>
    )
  }

  const counts = {
    all:        goals.length,
    active:     goals.filter(g => g.status === 'active').length,
    achieved:   goals.filter(g => g.status === 'achieved').length,
    abandoned:  goals.filter(g => g.status === 'abandoned').length,
  }

  return (
    <div className="pf-enter max-w-5xl mx-auto px-4 py-8 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground mb-1">Атлет · Цели</p>
          <h1 className="text-3xl font-bold text-foreground">Goals</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-xl">
            Ставьте измеримые цели — личный рекорд 5к, weekly volume, целевой вес. Отмечайте достижения и видите прогресс.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/athlete/progress"
            className="rounded-xl border border-border bg-background hover:bg-muted px-3 py-1.5 text-sm font-semibold no-underline inline-flex items-center gap-1.5">
            <i className="ki-filled ki-chart-line-up text-sm" />
            Прогресс
          </Link>
          <button onClick={openCreate}
            className="rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-2 text-sm font-bold shadow-md inline-flex items-center gap-1.5">
            <i className="ki-filled ki-plus text-sm" />
            Создать цель
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {(['active','achieved','abandoned','all'] as FilterTab[]).map(t => {
          const isAll = t === 'all'
          const meta = isAll ? null : STATUS_META[t]
          const label = isAll ? 'Все' : meta!.label
          const count = counts[t]
          const active = filter === t
          return (
            <button key={t} onClick={() => setFilter(t)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition border ${
                active
                  ? 'border-orange-300 bg-orange-50 text-orange-700'
                  : 'border-border bg-background hover:border-orange-200 text-muted-foreground'
              }`}>
              {meta ? `${meta.emoji} ` : ''}{label} · {count}
            </button>
          )
        })}
      </div>

      {/* Goals list */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-border bg-accent/30 px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 mb-4">
            <i className="ki-filled ki-flag text-2xl" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            {filter === 'active'
              ? 'Нет активных целей'
              : filter === 'achieved'
                ? 'Пока ничего не достигнуто'
                : filter === 'abandoned'
                  ? 'Снятых целей нет'
                  : 'У вас пока нет целей'}
          </h3>
          <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
            Создайте первую цель — конкретное измеримое улучшение с дедлайном.
          </p>
          <button onClick={openCreate}
            className="mt-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 text-sm font-semibold">
            + Создать цель
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(g => {
            const status = STATUS_META[g.status]
            const progressPct = g.target_value && g.current_value != null && g.target_value !== 0
              ? Math.max(0, Math.min(100, Math.round((g.current_value / g.target_value) * 100)))
              : null
            return (
              <div key={g.id} className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-foreground line-clamp-2">{g.metric_label}</h3>
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.metric}</p>
                  </div>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0"
                    style={{ background: status.bg, color: status.color, border: `1px solid ${status.border}` }}>
                    {status.emoji} {status.label}
                  </span>
                </div>

                {(g.target_value !== null || g.current_value !== null) && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-accent/40 px-2.5 py-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Цель</div>
                      <div className="text-sm font-bold text-foreground">
                        {g.target_value ?? '—'} {g.target_unit ?? ''}
                      </div>
                    </div>
                    <div className="rounded-lg bg-accent/40 px-2.5 py-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Сейчас</div>
                      <div className="text-sm font-bold text-foreground">
                        {g.current_value ?? '—'} {g.target_unit ?? ''}
                      </div>
                    </div>
                  </div>
                )}

                {progressPct !== null && (
                  <div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full transition-all" style={{ width: `${progressPct}%`, background: status.color }} />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">{progressPct}% прогресса</div>
                  </div>
                )}

                {g.target_date && (
                  <div className="text-[11px] text-muted-foreground">
                    📅 Дедлайн: {new Date(g.target_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                )}

                {g.notes && (
                  <p className="text-xs text-muted-foreground line-clamp-2 italic">{g.notes}</p>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-1.5 mt-1 pt-3 border-t border-border">
                  {g.status === 'active' && (
                    <>
                      <button onClick={() => openEdit(g)} disabled={busyId === g.id}
                        className="rounded-lg border border-border bg-background hover:bg-muted px-2 py-1 text-[11px] font-semibold">
                        ✏ Edit
                      </button>
                      <button onClick={() => handleAchieve(g.id)} disabled={busyId === g.id}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2 py-1 text-[11px] font-semibold">
                        ✅ Достигнуто
                      </button>
                      <button onClick={() => handleAbandon(g.id)} disabled={busyId === g.id}
                        className="rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground px-2 py-1 text-[11px] font-semibold">
                        ⏸ Снять
                      </button>
                    </>
                  )}
                  {g.status === 'achieved' && (
                    <span className="text-[11px] text-emerald-700 font-semibold">
                      ✅ Достигнуто {g.achieved_at ? new Date(g.achieved_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : ''}
                    </span>
                  )}
                  {g.status === 'abandoned' && (
                    <button onClick={() => handleReactivate(g.id)} disabled={busyId === g.id}
                      className="rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 text-[11px] font-semibold">
                      🔄 Вернуть
                    </button>
                  )}
                  <button onClick={() => handleDelete(g.id)} disabled={busyId === g.id}
                    className="rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 text-[11px] font-semibold"
                    title="Удалить">
                    🗑
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-8 overflow-y-auto"
          onClick={() => setShowCreate(false)}>
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <div onClick={e => e.stopPropagation()}
            className="relative z-10 w-full max-w-md rounded-2xl bg-background shadow-2xl border border-border">
            <div className="border-b border-border px-5 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                {editingId ? 'Редактировать цель' : 'Новая цель'}
              </h3>
              <button onClick={() => setShowCreate(false)} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
                <i className="ki-filled ki-cross text-xs" />
              </button>
            </div>
            <div className="px-5 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Метрика</label>
                <select value={metric} onChange={e => applyPreset(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400">
                  {METRIC_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Название *</label>
                <input value={metricLabel} onChange={e => setMetricLabel(e.target.value)} maxLength={160}
                  placeholder="Например: 5к за 23 минуты"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Цель</label>
                  <input value={targetValue} onChange={e => setTargetValue(e.target.value)}
                    type="number" step="0.01" placeholder="23"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Единица</label>
                  <input value={targetUnit} onChange={e => setTargetUnit(e.target.value)} maxLength={20}
                    placeholder="мин, кг, часов…"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Сейчас (опц.)</label>
                  <input value={currentValue} onChange={e => setCurrentValue(e.target.value)}
                    type="number" step="0.01" placeholder="25"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Дедлайн (опц.)</label>
                  <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Заметки (опц.)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} maxLength={400}
                  placeholder="План тренировок, мотивация, контекст…"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400 resize-vertical" />
              </div>
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-border px-5 py-3">
              <button onClick={handleSubmit} disabled={saving || !metricLabel.trim()}
                className="flex-1 rounded-xl bg-orange-600 hover:bg-orange-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {saving ? 'Сохраняем…' : editingId ? 'Сохранить' : 'Создать цель'}
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
