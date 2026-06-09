'use client'
/**
 * PlanEditor — Sprint W5 Day 24 (PR #40).
 *
 * Shared component для /coach/plans/new (create mode) и /coach/plans/[id]
 * (edit mode). UI:
 *   - Header: name / sport / duration_weeks / is_public
 *   - 7-day grid (по weeks=N): per day = list of items с add/remove/reorder
 *   - Per item: activity_type select / name input / duration / intensity / notes
 *   - Save button (creates plan + items in one transaction-like sequence)
 *   - Assign-to-athlete drawer (только edit mode) — picker + start date
 *
 * Drag-drop НЕ используется в MVP (no library installed) — заменено
 * up/down reorder buttons. Можно мигрировать на @dnd-kit в будущем.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  createPlan, updatePlan, replacePlanItems, assignPlanToAthlete,
  listMyAssignedAthletes,
  ACTIVITY_TYPE_PRESETS, ACTIVITY_LABELS, INTENSITY_META,
  type Intensity, type WorkoutPlanFull, type AthleteOption,
} from '@/services/workout-plans.service'
import { Card, Alert } from '@/components/ui/metronic'

type Mode = 'create' | 'edit'

interface DraftItem {
  uiId:          string  // local React key
  day_index:     number
  order_in_day:  number
  activity_type: string
  name:          string
  duration_min:  string  // input string, parsed to int on save
  intensity:     Intensity | ''
  notes:         string
}

interface Props {
  mode:          Mode
  initial?:      WorkoutPlanFull | null
}

const WEEKDAYS = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье']

let _uiIdCounter = 0
function newUiId(): string { _uiIdCounter += 1; return `i${_uiIdCounter}_${Date.now()}` }

export default function PlanEditor({ mode, initial }: Props) {
  const router = useRouter()

  // Plan header state
  const [name, setName]                   = useState(initial?.name ?? '')
  const [description, setDescription]     = useState(initial?.description ?? '')
  const [sport, setSport]                 = useState(initial?.sport ?? '')
  const [durationWeeks, setDurationWeeks] = useState(initial?.duration_weeks ?? 1)
  const [isPublic, setIsPublic]           = useState(initial?.is_public ?? false)

  // Items state
  const [items, setItems] = useState<DraftItem[]>(() => {
    if (initial && initial.items.length > 0) {
      return initial.items.map(i => ({
        uiId:          newUiId(),
        day_index:     i.day_index,
        order_in_day:  i.order_in_day,
        activity_type: i.activity_type,
        name:          i.name ?? '',
        duration_min:  i.duration_min !== null ? String(i.duration_min) : '',
        intensity:     i.intensity ?? '',
        notes:         i.notes ?? '',
      }))
    }
    return []
  })

  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // Assign drawer
  const [showAssign, setShowAssign]         = useState(false)
  const [assignAthletes, setAssignAthletes] = useState<AthleteOption[]>([])
  const [assignAthleteId, setAssignAthleteId] = useState('')
  const [assignStartDate, setAssignStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [assignBusy, setAssignBusy]           = useState(false)
  const [assignError, setAssignError]         = useState<string | null>(null)
  const [assignResult, setAssignResult]       = useState<{ created: number } | null>(null)

  // ── Items ops ─────────────────────────────────────────────────────
  function addItem(dayIndex: number) {
    setItems(prev => {
      const inDay = prev.filter(i => i.day_index === dayIndex)
      const nextOrder = inDay.length > 0 ? Math.max(...inDay.map(i => i.order_in_day)) + 1 : 0
      return [...prev, {
        uiId:          newUiId(),
        day_index:     dayIndex,
        order_in_day:  nextOrder,
        activity_type: 'running',
        name:          '',
        duration_min:  '60',
        intensity:     'moderate',
        notes:         '',
      }]
    })
  }

  function removeItem(uiId: string) {
    setItems(prev => prev.filter(i => i.uiId !== uiId))
  }

  function updateItem(uiId: string, patch: Partial<DraftItem>) {
    setItems(prev => prev.map(i => i.uiId === uiId ? { ...i, ...patch } : i))
  }

  function moveItem(uiId: string, dir: -1 | 1) {
    setItems(prev => {
      const idx = prev.findIndex(i => i.uiId === uiId)
      if (idx === -1) return prev
      const item = prev[idx]
      const inDay = prev.filter(i => i.day_index === item.day_index).sort((a, b) => a.order_in_day - b.order_in_day)
      const inDayIdx = inDay.findIndex(i => i.uiId === uiId)
      const swapWith = inDay[inDayIdx + dir]
      if (!swapWith) return prev
      return prev.map(i => {
        if (i.uiId === item.uiId)     return { ...i, order_in_day: swapWith.order_in_day }
        if (i.uiId === swapWith.uiId) return { ...i, order_in_day: item.order_in_day }
        return i
      })
    })
  }

  // ── Save ──────────────────────────────────────────────────────────
  async function handleSave() {
    setError(null)
    if (name.trim().length < 1) { setError('Введите название плана'); return }
    if (items.length === 0)     { setError('Добавьте минимум одну тренировку'); return }

    // Validate durations
    for (const it of items) {
      const d = parseInt(it.duration_min, 10)
      if (it.duration_min !== '' && (!Number.isFinite(d) || d < 0 || d > 600)) {
        setError(`Длительность тренировки в дне ${it.day_index + 1} некорректна (0-600 мин)`)
        return
      }
    }

    setSaving(true)
    try {
      let planId: string
      if (mode === 'create') {
        const created = await createPlan({
          name, description: description || null, sport: sport || null,
          duration_weeks: durationWeeks, is_public: isPublic,
        })
        if (!created) { setError('Не удалось создать план'); return }
        planId = created.id
      } else {
        if (!initial) { setError('Нет данных плана'); return }
        const updated = await updatePlan(initial.id, {
          name, description: description || null, sport: sport || null,
          duration_weeks: durationWeeks, is_public: isPublic,
        })
        if (!updated) { setError('Не удалось обновить план'); return }
        planId = initial.id
      }

      // Replace items
      const ok = await replacePlanItems(planId, items.map(i => ({
        day_index:     i.day_index,
        order_in_day:  i.order_in_day,
        activity_type: i.activity_type,
        name:          i.name || null,
        duration_min:  i.duration_min ? parseInt(i.duration_min, 10) : null,
        intensity:     i.intensity || null,
        notes:         i.notes || null,
      })))
      if (!ok) { setError('Не удалось сохранить тренировки'); return }

      // Navigate to plan detail (or stay on edit if already there)
      if (mode === 'create') router.push(`/coach/plans/${planId}`)
      else router.refresh()
    } finally {
      setSaving(false)
    }
  }

  // ── Assign ────────────────────────────────────────────────────────
  async function openAssignDrawer() {
    if (mode === 'create') {
      setError('Сначала сохраните план')
      return
    }
    setAssignError(null)
    setAssignResult(null)
    const list = await listMyAssignedAthletes()
    setAssignAthletes(list)
    if (list.length > 0 && !assignAthleteId) setAssignAthleteId(list[0].id)
    setShowAssign(true)
  }

  async function handleAssign() {
    if (!initial) return
    if (!assignAthleteId) { setAssignError('Выберите атлета'); return }
    if (!assignStartDate) { setAssignError('Выберите дату старта'); return }
    setAssignBusy(true); setAssignError(null)
    try {
      const result = await assignPlanToAthlete(initial.id, assignAthleteId, new Date(assignStartDate))
      if (!result.ok) {
        setAssignError(result.error ?? 'Не удалось назначить')
        return
      }
      setAssignResult({ created: result.workouts_created })
    } finally {
      setAssignBusy(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────
  const totalDays = durationWeeks * 7
  const dayIndices = Array.from({ length: totalDays }, (_, i) => i)

  return (
    <div className="pf-enter max-w-6xl mx-auto px-4 py-8 flex flex-col gap-5">
      {/* Back link */}
      <div>
        <Link href="/coach/plans"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition no-underline">
          <i className="ki-filled ki-arrow-left text-sm" />
          К планам
        </Link>
      </div>

      {/* Header */}
      <Card className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Название *</label>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={160}
              placeholder="Например: Базовая беговая неделя"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400" />
          </div>
          <div className="md:col-span-3">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Спорт (опц.)</label>
            <select value={sport} onChange={e => setSport(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400">
              <option value="">—</option>
              {ACTIVITY_TYPE_PRESETS.map(a => <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>)}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Длительность</label>
            <select value={durationWeeks} onChange={e => setDurationWeeks(parseInt(e.target.value, 10))}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400">
              {[1,2,3,4,6,8,12].map(w => <option key={w} value={w}>{w} {w === 1 ? 'неделя' : w < 5 ? 'недели' : 'недель'}</option>)}
            </select>
          </div>
          <div className="md:col-span-12">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Описание (опц.)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} maxLength={2000}
              placeholder="Краткое описание плана — для каких атлетов, какая цель"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400 resize-vertical" />
          </div>
          <div className="md:col-span-12">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)}
                className="accent-orange-500" />
              <span>Сделать public — другие coaches организации смогут видеть и использовать</span>
            </label>
          </div>
        </div>
      </Card>

      {/* Days grid */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-navy-500">Тренировки по дням</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalDays} {totalDays === 1 ? 'день' : totalDays < 5 ? 'дня' : 'дней'} · {items.length} тренировок добавлено
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3">
          {dayIndices.map(dayIdx => {
            const weekNum = Math.floor(dayIdx / 7) + 1
            const weekdayName = WEEKDAYS[dayIdx % 7]
            const dayItems = items
              .filter(i => i.day_index === dayIdx)
              .sort((a, b) => a.order_in_day - b.order_in_day)
            return (
              <div key={dayIdx} className="rounded-xl border border-border bg-background p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-border">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Неделя {weekNum}
                    </div>
                    <div className="text-sm font-semibold text-foreground">{weekdayName}</div>
                  </div>
                  <button onClick={() => addItem(dayIdx)} type="button"
                    className="w-7 h-7 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-700 flex items-center justify-center"
                    title="Добавить тренировку">
                    <i className="ki-filled ki-plus text-xs" />
                  </button>
                </div>
                {dayItems.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic py-2 text-center">Отдых</p>
                ) : (
                  dayItems.map((it, posInDay) => {
                    const intMeta = it.intensity && it.intensity in INTENSITY_META ? INTENSITY_META[it.intensity as Intensity] : null
                    return (
                      <div key={it.uiId} className="rounded-lg border-2 p-2 text-xs space-y-1.5"
                        style={intMeta ? { borderColor: intMeta.border, background: intMeta.bg } : { borderColor: 'var(--border)' }}>
                        <div className="flex items-center justify-between gap-1">
                          <select value={it.activity_type} onChange={e => updateItem(it.uiId, { activity_type: e.target.value })}
                            className="flex-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold outline-none">
                            {ACTIVITY_TYPE_PRESETS.map(a => <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>)}
                          </select>
                          <div className="flex gap-0.5 shrink-0">
                            {posInDay > 0 && (
                              <button onClick={() => moveItem(it.uiId, -1)} type="button"
                                className="w-5 h-5 rounded bg-white border border-slate-200 hover:bg-slate-50 text-[10px]"
                                title="Выше">↑</button>
                            )}
                            {posInDay < dayItems.length - 1 && (
                              <button onClick={() => moveItem(it.uiId, 1)} type="button"
                                className="w-5 h-5 rounded bg-white border border-slate-200 hover:bg-slate-50 text-[10px]"
                                title="Ниже">↓</button>
                            )}
                            <button onClick={() => removeItem(it.uiId)} type="button"
                              className="w-5 h-5 rounded bg-white border border-red-200 hover:bg-red-50 text-red-600 text-[10px] flex items-center justify-center"
                              title="Удалить"><i className="ki-filled ki-cross" /></button>
                          </div>
                        </div>
                        <input value={it.name} onChange={e => updateItem(it.uiId, { name: e.target.value })} maxLength={160}
                          placeholder="Название (опц.)"
                          className="w-full rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] outline-none" />
                        <div className="grid grid-cols-2 gap-1">
                          <input value={it.duration_min} onChange={e => updateItem(it.uiId, { duration_min: e.target.value })}
                            type="number" min={0} max={600} placeholder="мин"
                            className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] outline-none" />
                          <select value={it.intensity} onChange={e => updateItem(it.uiId, { intensity: e.target.value as Intensity | '' })}
                            className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] outline-none">
                            <option value="">Intensity</option>
                            <option value="easy">Лёгкая</option>
                            <option value="moderate">Средняя</option>
                            <option value="hard">Высокая</option>
                            <option value="rest">Отдых</option>
                          </select>
                        </div>
                        <textarea value={it.notes} onChange={e => updateItem(it.uiId, { notes: e.target.value })}
                          rows={2} placeholder="Заметки (опц.)"
                          className="w-full rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] outline-none resize-none" />
                      </div>
                    )
                  })
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {error && (
        <Alert variant="destructive">{error}</Alert>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {mode === 'edit' && (
          <button onClick={openAssignDrawer} type="button"
            className="rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-4 py-2.5 text-sm font-bold">
            <i className="ki-filled ki-paper-plane text-sm mr-1.5" />
            Назначить атлету
          </button>
        )}
        <button onClick={handleSave} disabled={saving || items.length === 0}
          className="rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-5 py-2.5 text-sm font-bold disabled:opacity-50 shadow-md">
          {saving ? 'Сохраняем…' : mode === 'create' ? 'Создать план' : 'Сохранить'}
        </button>
      </div>

      {/* Assign drawer */}
      {showAssign && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-8 overflow-y-auto"
          onClick={() => setShowAssign(false)}>
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <div onClick={e => e.stopPropagation()}
            className="relative z-10 w-full max-w-md rounded-2xl bg-background shadow-2xl border border-border">
            <div className="border-b border-border px-5 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-navy-500">Назначить атлету</h3>
              <button onClick={() => setShowAssign(false)} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
                <i className="ki-filled ki-cross text-xs" />
              </button>
            </div>
            <div className="px-5 py-5 space-y-4">
              {assignResult ? (
                <Alert variant="success" title="План назначен">
                  Создано {assignResult.created} тренировок в календаре атлета.
                </Alert>
              ) : assignAthletes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  У вас пока нет атлетов с принятой связью. Добавьте атлетов через /athletes или организацию.
                </p>
              ) : (
                <>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Атлет</label>
                    <select value={assignAthleteId} onChange={e => setAssignAthleteId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400">
                      {assignAthletes.map(a => <option key={a.id} value={a.id}>{a.name ?? a.id.slice(0, 8)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Дата старта (первый день плана)</label>
                    <input type="date" value={assignStartDate} onChange={e => setAssignStartDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400" />
                  </div>
                  <Alert variant="info">
                    Будет создано <strong>{items.length}</strong> тренировок в календаре атлета, начиная с {new Date(assignStartDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}.
                  </Alert>
                  {assignError && (
                    <Alert variant="destructive">{assignError}</Alert>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-border px-5 py-3">
              {assignResult ? (
                <button onClick={() => setShowAssign(false)}
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white">
                  Готово
                </button>
              ) : (
                <>
                  <button onClick={handleAssign} disabled={assignBusy || assignAthletes.length === 0}
                    className="flex-1 rounded-xl bg-orange-600 hover:bg-orange-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                    {assignBusy ? 'Назначаем…' : 'Назначить'}
                  </button>
                  <button onClick={() => setShowAssign(false)} disabled={assignBusy}
                    className="rounded-xl border border-border bg-background hover:bg-muted px-4 py-2.5 text-sm font-semibold">
                    Отмена
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
