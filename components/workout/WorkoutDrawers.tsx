'use client'

import { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { createBrowserClient } from '@supabase/ssr'
import type { Workout } from '@/services/workouts.service'
import VoiceDebriefButton from '@/components/workout/VoiceDebriefButton'
import { Badge } from '@/components/ui/metronic'
import ClearanceBadge from '@/components/clearance/ClearanceBadge'
import { useToast } from '@/lib/hooks/useToast'
import { checkPersonalRecords, RECORD_LABEL, formatRecordValue } from '@/services/personal-records.service'

// ── Константы ────────────────────────────────────────────────────────────────
export const ACTIVITY_CONFIG: Record<string, { icon: string; bg: string; border: string; text: string }> = {
  'Бег':       { icon: 'ki-abstract-26',  bg: '#EFF6FF', border: '#BFDBFE', text: '#2563EB' },
  'Велоспорт': { icon: 'ki-technology-4', bg: '#FEF0E7', border: '#FBC1A0', text: '#D44A02' },
  'Плавание':  { icon: 'ki-abstract-14',  bg: '#E0F2FE', border: '#7DD3FC', text: '#0284C7' },
  'Силовые':   { icon: 'ki-abstract-45',  bg: '#FAF5FF', border: '#E9D5FF', text: '#9333EA' },
  'Ходьба':    { icon: 'ki-map',          bg: '#F0FDF4', border: '#BBF7D0', text: '#16A34A' },
  'Другое':    { icon: 'ki-calendar',     bg: '#F8FAFC', border: '#E2E8F0', text: '#64748B' },
}
export const DEFAULT_AC = ACTIVITY_CONFIG['Другое']
const ACTIVITY_OPTIONS = Object.keys(ACTIVITY_CONFIG)

export type UpcomingEvent = {
  id: string
  title: string
  event_date: string
  start_time: string | null
  activity_type: string | null
}

// ── helpers ───────────────────────────────────────────────────────────────────
function sb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

function fireWorkoutsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('proform:workout-added'))
  }
}

function toLocalISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayISO() {
  return toLocalISO(new Date())
}

function fmtDuration(min: number | null | undefined): string {
  if (!min) return '—'
  if (min < 60) return `${min} мин`
  const h = Math.floor(min / 60); const m = min % 60
  return m ? `${h} ч ${m} мин` : `${h} ч`
}

function fmtFullDate(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s + 'T00:00:00').toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function addMinutesToTime(start: string | null | undefined, minutes: number | null | undefined): string | null {
  if (!start || !minutes || minutes <= 0) return null
  const [h, m] = start.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  const total = h * 60 + m + minutes
  const hh = Math.floor((total / 60) % 24)
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function minutesBetween(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  if ([sh, sm, eh, em].some(n => Number.isNaN(n))) return null
  const diff = (eh * 60 + em) - (sh * 60 + sm)
  return diff > 0 ? diff : null
}

// ── Duration H+M ──────────────────────────────────────────────────────────────
function DurationHMInput({
  valueMin, onChange, inputClassName,
}: {
  valueMin: string
  onChange: (totalMin: string) => void
  inputClassName: string
}) {
  const totalN = Number(valueMin) || 0
  const h = Math.floor(totalN / 60)
  const m = totalN % 60
  function update(hNew: number, mNew: number) {
    const hv = Math.max(0, Number.isFinite(hNew) ? Math.floor(hNew) : 0)
    const mv = Math.max(0, Math.min(59, Number.isFinite(mNew) ? Math.floor(mNew) : 0))
    const total = hv * 60 + mv
    onChange(total > 0 ? String(total) : '')
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="relative">
        <input
          type="number" min={0} inputMode="numeric" aria-label="Часы"
          value={valueMin === '' ? '' : String(h)}
          onChange={e => update(Number(e.target.value), m)}
          placeholder="0"
          className={`${inputClassName} pr-9`}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted-foreground">ч</span>
      </div>
      <div className="relative">
        <input
          type="number" min={0} max={59} inputMode="numeric" aria-label="Минуты"
          value={valueMin === '' ? '' : String(m)}
          onChange={e => update(h, Number(e.target.value))}
          placeholder="0"
          className={`${inputClassName} pr-11`}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted-foreground">мин</span>
      </div>
    </div>
  )
}

// ── Shell (порт + анимация) ──────────────────────────────────────────────────
function DrawerShell({
  open, onClose, children, width = 520,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  width?: number
}) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      requestAnimationFrame(() => setVisible(true))
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
      window.addEventListener('keydown', onKey)
      return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
    } else {
      setVisible(false)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!mounted || !open) return null

  return ReactDOM.createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(3px)',
          transition: 'opacity 0.25s', opacity: visible ? 1 : 0,
        }}
      />
      <div
        role="dialog" aria-modal="true"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width, maxWidth: '100vw', zIndex: 9999,
          background: '#ffffff', borderLeft: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.26s cubic-bezier(.32,.72,0,1)',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.18)',
        }}
      >
        {children}
      </div>
    </>,
    document.body,
  )
}

// ── Общие стили инпута ───────────────────────────────────────────────────────
const INPUT_CLASS =
  'w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10'

// ── Общая форма полей ────────────────────────────────────────────────────────
type WForm = {
  activity_type: string
  name: string
  event_date: string
  start_time: string
  activity_duration_min: string
  avg_heart_rate: string
  activity_calories: string
  description: string
}

function FormBody({
  form, setForm, showMetrics = true,
}: {
  form: WForm
  setForm: (updater: (f: WForm) => WForm) => void
  showMetrics?: boolean
}) {
  const ac = ACTIVITY_CONFIG[form.activity_type] ?? DEFAULT_AC
  return (
    <div className="flex flex-col gap-5">
      {/* Preview card */}
      <div
        className="rounded-[20px] border p-4"
        style={{
          background: `linear-gradient(135deg, ${ac.bg} 0%, rgba(255,255,255,0.96) 100%)`,
          borderColor: ac.border,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border"
            style={{ background: ac.bg, borderColor: ac.border }}
          >
            <i className={`ki-filled ${ac.icon} text-base`} style={{ color: ac.text }} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Текущий шаблон</div>
            <div className="mt-0.5 text-sm font-semibold text-foreground truncate">{form.name.trim() || form.activity_type}</div>
            <div className="text-xs text-muted-foreground truncate">
              {form.activity_duration_min ? fmtDuration(Number(form.activity_duration_min)) : 'Длительность не задана'}
            </div>
          </div>
        </div>
      </div>

      {/* Activity type grid */}
      <div>
        <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Тип активности</label>
        <div className="grid grid-cols-3 gap-2">
          {ACTIVITY_OPTIONS.map(t => {
            const cfg = ACTIVITY_CONFIG[t] ?? DEFAULT_AC
            const sel = form.activity_type === t
            return (
              <button
                key={t} type="button"
                onClick={() => setForm(f => ({ ...f, activity_type: t }))}
                className="flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 transition-all"
                style={{
                  borderColor: sel ? cfg.border : 'var(--border)',
                  background: sel ? cfg.bg : 'transparent',
                }}
              >
                <i className={`ki-filled ${cfg.icon} text-base`} style={{ color: sel ? cfg.text : 'var(--muted-foreground)' }} />
                <span className="text-[11px] font-semibold" style={{ color: sel ? cfg.text : 'var(--muted-foreground)' }}>{t}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Название</label>
        <input
          type="text" value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Например: Утренняя пробежка"
          className={INPUT_CLASS}
        />
      </div>

      {/* Date + Start */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Дата *</label>
          <input
            type="date" value={form.event_date}
            onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Начало</label>
          <input
            type="time" value={form.start_time}
            onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      {/* Duration */}
      <div>
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Длительность</label>
        <DurationHMInput
          valueMin={form.activity_duration_min}
          onChange={v => setForm(f => ({ ...f, activity_duration_min: v }))}
          inputClassName={INPUT_CLASS}
        />
      </div>

      {showMetrics && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ср. ЧСС</label>
            <input
              type="number" min={1} value={form.avg_heart_rate}
              onChange={e => setForm(f => ({ ...f, avg_heart_rate: e.target.value }))}
              placeholder="150" className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Калории</label>
            <input
              type="number" min={1} value={form.activity_calories}
              onChange={e => setForm(f => ({ ...f, activity_calories: e.target.value }))}
              placeholder="500" className={INPUT_CLASS}
            />
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Заметки</label>
        <textarea
          rows={3} value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Ощущения, условия, наблюдения…"
          className={`${INPUT_CLASS} resize-none`}
        />
      </div>
    </div>
  )
}

// ── Sync helpers ─────────────────────────────────────────────────────────────
/**
 * Ищет связанную строку в calendar_events по (owner_id, event_date, title).
 */
async function findLinkedCalendarEvent(ownerId: string, eventDate: string, title: string) {
  const { data } = await sb()
    .from('calendar_events')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('event_date', eventDate)
    .eq('title', title.trim())
    .limit(1)
  return (data ?? [])[0] ?? null
}

async function findLinkedWorkout(ownerId: string, eventDate: string, title: string) {
  const { data } = await sb()
    .from('workouts')
    .select('id')
    .eq('athlete_id', ownerId)
    .eq('event_date', eventDate)
    .eq('name', title.trim())
    .limit(1)
  return (data ?? [])[0] ?? null
}

// ── ADD DRAWER ───────────────────────────────────────────────────────────────
export function WorkoutAddDrawer({
  open, userId, onClose, onCreated,
}: {
  open: boolean
  userId: string
  onClose: () => void
  onCreated?: (workout: Workout) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { success: toastSuccess } = useToast()
  const [form, setForm] = useState<WForm>({
    activity_type: 'Бег',
    name: '',
    event_date: todayISO(),
    start_time: '',
    activity_duration_min: '',
    avg_heart_rate: '',
    activity_calories: '',
    description: '',
  })

  // P3 #5 — clearance gating. На open fetch'аем current_clearances для атлета.
  // Если status=banned (или review_needed для не-full) — на submit показываем
  // модалку override_reason, фиксим в audit_logs через /api/clearance/override.
  const [currentStatus, setCurrentStatus] = useState<'full'|'limited'|'light_only'|'banned'|null>(null)
  const [currentReviewNeeded, setCurrentReviewNeeded] = useState(false)
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideError, setOverrideError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm({
        activity_type: 'Бег',
        name: '',
        event_date: todayISO(),
        start_time: '',
        activity_duration_min: '',
        avg_heart_rate: '',
        activity_calories: '',
        description: '',
      })
      setError(null)
      setShowOverrideModal(false)
      setOverrideReason('')
      setOverrideError(null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      void (async () => {
        const { data } = await (sb() as any)
          .from('current_clearances')
          .select('status, review_needed')
          .eq('athlete_id', userId)
          .maybeSingle()
        setCurrentStatus((data?.status as 'full'|'limited'|'light_only'|'banned'|null) ?? null)
        setCurrentReviewNeeded(!!data?.review_needed)
      })()
    }
  }, [open, userId])

  const needsOverride = currentStatus === 'banned'
    || (currentReviewNeeded && currentStatus !== null && currentStatus !== 'full')

  async function actuallyCreate() {
    setSaving(true)
    setError(null)
    const name = form.name.trim()
    try {
      const duration = form.activity_duration_min ? Number(form.activity_duration_min) : null
      const payload = {
        athlete_id: userId,
        event_date: form.event_date,
        event_type: 'workout',
        activity_type: form.activity_type,
        start_time: form.start_time || null,
        activity_duration_min: duration,
        avg_heart_rate: form.avg_heart_rate ? Number(form.avg_heart_rate) : null,
        activity_calories: form.activity_calories ? Number(form.activity_calories) : null,
        name,
        description: form.description.trim() || null,
        is_public: false,
      }

      const { data: workout, error: wErr } = await sb()
        .from('workouts').insert(payload).select().single()
      if (wErr) throw wErr

      // Sync to calendar_events (без дубликата если уже есть)
      try {
        const existing = await findLinkedCalendarEvent(userId, form.event_date, name)
        if (!existing) {
          await sb().from('calendar_events').insert({
            owner_id: userId,
            event_date: form.event_date,
            event_type: 'workout',
            title: name,
            notes: form.description.trim() || null,
            start_time: form.start_time || null,
            end_time: addMinutesToTime(form.start_time, duration),
          })
        }
      } catch (syncErr) {
        console.warn('calendar sync error:', syncErr)
      }

      fireWorkoutsChanged()
      if (workout) onCreated?.(workout as Workout)

      // P1 — авто-детект личных рекордов (fire-and-forget: празднование не
      // блокирует сохранение; тост показывается поверх уже закрытого drawer).
      if (workout) {
        void checkPersonalRecords(userId, null, {
          id:                    (workout as Workout).id,
          event_date:            form.event_date,
          activity_duration_min: duration,
        }).then(broken => {
          if (broken.length > 0) {
            const b = broken[0]
            toastSuccess(`Новый личный рекорд — ${RECORD_LABEL[b.kind]}: ${formatRecordValue(b.kind, b.value)}`)
          }
        })
      }

      onClose()
    } catch (err) {
      console.error('WorkoutAddDrawer save error:', err)
      setError('Не удалось сохранить тренировку')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) { setError('Название обязательно'); return }
    if (!form.event_date) { setError('Дата обязательна'); return }
    if (needsOverride) { setShowOverrideModal(true); return }
    await actuallyCreate()
  }

  async function confirmOverrideAndCreate() {
    setOverrideError(null)
    const reason = overrideReason.trim()
    if (reason.length < 10) { setOverrideError('Минимум 10 символов'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/clearance/override', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          athlete_id: userId,
          reason,
          planned: {
            title:         form.name.trim() || undefined,
            event_date:    form.event_date || undefined,
            activity_type: form.activity_type || undefined,
          },
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'audit_failed')
      setShowOverrideModal(false)
      await actuallyCreate()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'audit_failed'
      setOverrideError(`Не удалось зафиксировать override: ${msg}`)
      setSaving(false)
    }
  }

  return (
    <DrawerShell open={open} onClose={onClose}>
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge variant="primary" size="sm" className="font-bold uppercase tracking-[0.18em]">
              Быстрая тренировка
            </Badge>
            <h3 className="mt-2 pf-num text-[26px] leading-none text-navy-500">Добавить тренировку</h3>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Запись попадёт в дневник и календарь.
            </p>
          </div>
          <button onClick={onClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost shrink-0">
            <i className="ki-filled ki-cross text-sm" />
          </button>
        </div>
      </div>

      {/* P3 #3 — clearance banner: показывает текущий допуск к нагрузке если
          выставлен; если нет — секция не рендерится (ClearanceBadge возвращает null) */}
      <div className="border-b border-border bg-background/40 px-6 py-3">
        <ClearanceBadge athleteId={userId} size="md" showNote />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <FormBody form={form} setForm={setForm} />
          {error && (
            <p className="mt-3 text-xs font-semibold text-red-500">{error}</p>
          )}
        </div>
        <div className="border-t border-border bg-card px-6 py-4 flex gap-2">
          <button type="button" onClick={onClose} className="kt-btn kt-btn-outline flex-1">Отмена</button>
          <button type="submit" disabled={saving} className="kt-btn kt-btn-primary flex-1 min-w-[160px] justify-center">
            {saving ? 'Сохранение…' : needsOverride ? 'Сохранить с override…' : 'Сохранить'}
          </button>
        </div>
      </form>

      {/* P3 #5 — override-confirm modal: требуется когда у атлета banned clearance
          или review_needed для не-full. POST /api/clearance/override фиксит
          в audit_logs, потом продолжается обычное создание тренировки. */}
      {showOverrideModal && (
        <div style={{ position:'absolute', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div onClick={() => !saving && setShowOverrideModal(false)} style={{ position:'absolute', inset:0, background:'rgba(15,23,42,0.6)', backdropFilter:'blur(4px)' }} />
          <div style={{ position:'relative', width:480, maxWidth:'100%', background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, boxShadow:'0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ padding:'18px 22px', borderBottom:'1px solid var(--border)' }}>
              <p style={{ fontSize:10, fontWeight:700, color:'#B91C1C', textTransform:'uppercase', letterSpacing:'0.18em', margin:0 }}>
                Override медицинского ограничения
              </p>
              <h3 style={{ fontSize:17, fontWeight:800, color:'var(--foreground)', margin:'4px 0 0' }}>
                {currentStatus === 'banned' ? 'Доктор выставил «Запрет тренировок»' : 'Требуется review допуска'}
              </h3>
            </div>
            <div style={{ padding:'16px 22px', display:'flex', flexDirection:'column', gap:12 }}>
              <p style={{ margin:0, fontSize:13, lineHeight:1.55, color:'var(--muted-foreground)' }}>
                Чтобы продолжить, укажите медицинскую причину override'а. Текст будет записан
                в audit-log и доступен для разбора. Минимум 10 символов.
              </p>
              <textarea
                value={overrideReason}
                onChange={(e) => { setOverrideReason(e.target.value); setOverrideError(null) }}
                rows={4}
                maxLength={500}
                placeholder="Например: согласовано с врачом X 03.06.2026 устно, лёгкая разминка после реабилитации"
                style={{ width:'100%', borderRadius:12, border:'1.5px solid var(--border)', background:'var(--background)', color:'var(--foreground)', padding:'10px 12px', fontSize:13, outline:'none', resize:'vertical', boxSizing:'border-box' }}
              />
              {overrideError && (
                <div style={{ padding:'9px 12px', borderRadius:10, background:'#FEF2F2', border:'1px solid #FECACA', fontSize:12, color:'#B91C1C' }}>
                  {overrideError}
                </div>
              )}
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={confirmOverrideAndCreate} disabled={saving || overrideReason.trim().length < 10}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {saving ? 'Сохраняем…' : 'Подтвердить и создать'}
                </button>
                <button onClick={() => !saving && setShowOverrideModal(false)} disabled={saving}
                  className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted">
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DrawerShell>
  )
}

// ── EDIT WORKOUT DRAWER ──────────────────────────────────────────────────────
export function WorkoutEditDrawer({
  workout, onClose, onSaved, onDeleted,
}: {
  workout: Workout | null
  onClose: () => void
  onSaved?: (w: Workout) => void
  onDeleted?: (id: string) => void
}) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<WForm>({
    activity_type: 'Бег', name: '', event_date: todayISO(), start_time: '',
    activity_duration_min: '', avg_heart_rate: '', activity_calories: '', description: '',
  })

  useEffect(() => {
    if (workout) {
      setForm({
        activity_type: workout.activity_type ?? 'Другое',
        name: workout.name ?? '',
        event_date: workout.event_date ?? todayISO(),
        start_time: workout.start_time ?? '',
        activity_duration_min: workout.activity_duration_min != null ? String(workout.activity_duration_min) : '',
        avg_heart_rate: workout.avg_heart_rate != null ? String(workout.avg_heart_rate) : '',
        activity_calories: workout.activity_calories != null ? String(workout.activity_calories) : '',
        description: workout.description ?? '',
      })
      setMode('view')
      setConfirmDel(false)
      setError(null)
    }
  }, [workout])

  const isOpen = Boolean(workout)
  const ac = workout ? (ACTIVITY_CONFIG[workout.activity_type ?? ''] ?? DEFAULT_AC) : DEFAULT_AC

  async function handleSave() {
    if (!workout) return
    const name = form.name.trim()
    if (!name) { setError('Название обязательно'); return }
    setSaving(true)
    setError(null)
    try {
      const duration = form.activity_duration_min ? Number(form.activity_duration_min) : null
      const patch = {
        name,
        activity_type: form.activity_type || null,
        event_date: form.event_date,
        start_time: form.start_time || null,
        activity_duration_min: duration,
        avg_heart_rate: form.avg_heart_rate ? Number(form.avg_heart_rate) : null,
        activity_calories: form.activity_calories ? Number(form.activity_calories) : null,
        description: form.description.trim() || null,
        updated_at: new Date().toISOString(),
      }
      const { data, error: err } = await sb()
        .from('workouts').update(patch).eq('id', workout.id).select().single()
      if (err) throw err

      // Sync to calendar_events
      try {
        const origTitle = (workout.name ?? '').trim()
        const origDate  = workout.event_date ?? ''
        const linked = await findLinkedCalendarEvent(workout.athlete_id, origDate, origTitle)
        const evPatch = {
          event_date: form.event_date,
          event_type: 'workout' as const,
          title: name,
          notes: form.description.trim() || null,
          start_time: form.start_time || null,
          end_time: addMinutesToTime(form.start_time, duration),
        }
        if (linked) {
          await sb().from('calendar_events').update(evPatch).eq('id', linked.id)
        } else {
          await sb().from('calendar_events').insert({
            owner_id: workout.athlete_id,
            ...evPatch,
          })
        }
      } catch (syncErr) {
        console.warn('calendar sync error:', syncErr)
      }

      fireWorkoutsChanged()
      onSaved?.(data as Workout)
      setMode('view')
    } catch (err) {
      console.error('WorkoutEditDrawer save error:', err)
      setError('Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!workout) return
    setDeleting(true)
    try {
      await sb().from('workouts').delete().eq('id', workout.id)
      try {
        const title = (workout.name ?? '').trim()
        if (title && workout.event_date) {
          await sb().from('calendar_events').delete()
            .eq('owner_id', workout.athlete_id)
            .eq('event_date', workout.event_date)
            .eq('title', title)
        }
      } catch (syncErr) {
        console.warn('calendar sync error:', syncErr)
      }
      fireWorkoutsChanged()
      onDeleted?.(workout.id)
      onClose()
    } catch (err) {
      console.error('WorkoutEditDrawer delete error:', err)
    } finally {
      setDeleting(false)
    }
  }

  if (!workout) return null

  return (
    <DrawerShell open={isOpen} onClose={onClose}>
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border"
              style={{ background: ac.bg, borderColor: ac.border }}
            >
              <i className={`ki-filled ${ac.icon} text-sm`} style={{ color: ac.text }} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                {mode === 'view' ? 'Детали тренировки' : 'Редактирование'}
              </div>
              <div className="mt-0.5 truncate text-base font-semibold text-foreground">
                {workout.name || workout.activity_type || 'Тренировка'}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {workout.activity_type ?? 'Тренировка'} · {fmtFullDate(workout.event_date)}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost shrink-0">
            <i className="ki-filled ki-cross text-sm" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {mode === 'view' ? (
          <div className="flex flex-col gap-4">
            <div
              className="rounded-2xl border p-4"
              style={{ background: ac.bg, borderColor: ac.border }}
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Сессия</div>
              <div className="mt-2 text-xl font-bold text-foreground">{workout.name || workout.activity_type || 'Тренировка'}</div>
              <div className="mt-1 text-xs text-muted-foreground">{fmtFullDate(workout.event_date)}{workout.start_time ? ` · ${workout.start_time.slice(0, 5)}` : ''}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InfoCell label="Длительность" value={workout.activity_duration_min ? fmtDuration(workout.activity_duration_min) : '—'} />
              <InfoCell label="Ср. ЧСС" value={workout.avg_heart_rate ? `${Math.round(Number(workout.avg_heart_rate))} уд/мин` : '—'} />
              <InfoCell label="Калории" value={workout.activity_calories ? `${workout.activity_calories} ккал` : '—'} />
              <InfoCell label="Тип" value={workout.activity_type ?? '—'} />
            </div>
            {workout.description && (
              <div className="rounded-2xl border border-border p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">Заметки</div>
                <p className="text-sm text-foreground whitespace-pre-wrap m-0">{workout.description}</p>
              </div>
            )}
            <VoiceDebriefButton workoutId={workout.id} onApplied={() => fireWorkoutsChanged()} />
          </div>
        ) : (
          <>
            <FormBody form={form} setForm={setForm} />
            {error && <p className="mt-3 text-xs font-semibold text-red-500">{error}</p>}
          </>
        )}
      </div>

      <div className="border-t border-border bg-card px-6 py-4 flex gap-2">
        {mode === 'view' ? (
          <>
            <button onClick={() => setMode('edit')} className="kt-btn kt-btn-primary flex-1 justify-center gap-2">
              <i className="ki-filled ki-pencil text-xs" /> Редактировать
            </button>
            {!confirmDel ? (
              <button
                onClick={() => setConfirmDel(true)}
                className="px-4 rounded-xl border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 transition"
              >
                <i className="ki-filled ki-trash text-sm" />
              </button>
            ) : (
              <>
                <button
                  onClick={handleDelete} disabled={deleting}
                  className="px-4 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {deleting ? '…' : 'Удалить'}
                </button>
                <button onClick={() => setConfirmDel(false)} className="kt-btn kt-btn-outline">Отмена</button>
              </>
            )}
          </>
        ) : (
          <>
            <button onClick={() => setMode('view')} className="kt-btn kt-btn-outline flex-1">Отмена</button>
            <button onClick={handleSave} disabled={saving} className="kt-btn kt-btn-primary flex-1 justify-center">
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </>
        )}
      </div>
    </DrawerShell>
  )
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  )
}

// ── CALENDAR EVENT EDIT DRAWER (для предстоящих) ─────────────────────────────
export function CalendarEventEditDrawer({
  event, ownerId, onClose, onSaved, onDeleted,
}: {
  event: UpcomingEvent | null
  ownerId: string
  onClose: () => void
  onSaved?: () => void
  onDeleted?: (id: string) => void
}) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notesLoaded, setNotesLoaded] = useState(false)
  const [initialEndTime, setInitialEndTime] = useState<string | null>(null)

  const [form, setForm] = useState<WForm>({
    activity_type: 'Бег', name: '', event_date: todayISO(), start_time: '',
    activity_duration_min: '', avg_heart_rate: '', activity_calories: '', description: '',
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!event) return
      setNotesLoaded(false)
      // Fetch full event (notes, end_time) + linked workout for metrics
      const [{ data: ev }, { data: wk }] = await Promise.all([
        sb().from('calendar_events')
          .select('id, event_date, start_time, end_time, title, notes, activity_type')
          .eq('id', event.id).maybeSingle(),
        sb().from('workouts')
          .select('id, event_date, start_time, activity_duration_min, avg_heart_rate, activity_calories, activity_type, description')
          .eq('athlete_id', ownerId)
          .eq('event_date', event.event_date)
          .eq('name', event.title)
          .maybeSingle(),
      ])
      if (cancelled) return
      const duration = wk?.activity_duration_min
        ?? minutesBetween(ev?.start_time ?? event.start_time, ev?.end_time ?? null)
      setForm({
        activity_type: (wk?.activity_type as string | null) ?? ev?.activity_type ?? event.activity_type ?? 'Бег',
        name: event.title,
        event_date: event.event_date,
        start_time: (ev?.start_time ?? event.start_time ?? '') || '',
        activity_duration_min: duration != null ? String(duration) : '',
        avg_heart_rate: wk?.avg_heart_rate != null ? String(wk.avg_heart_rate) : '',
        activity_calories: wk?.activity_calories != null ? String(wk.activity_calories) : '',
        description: wk?.description ?? ev?.notes ?? '',
      })
      setInitialEndTime(ev?.end_time ?? null)
      setMode('view')
      setConfirmDel(false)
      setError(null)
      setNotesLoaded(true)
    }
    load()
    return () => { cancelled = true }
  }, [event, ownerId])

  const isOpen = Boolean(event)
  const ac = event ? (ACTIVITY_CONFIG[form.activity_type] ?? DEFAULT_AC) : DEFAULT_AC

  async function handleSave() {
    if (!event) return
    const name = form.name.trim()
    if (!name) { setError('Название обязательно'); return }
    setSaving(true)
    setError(null)
    try {
      const duration = form.activity_duration_min ? Number(form.activity_duration_min) : null
      // Update calendar_events
      await sb().from('calendar_events').update({
        event_date: form.event_date,
        event_type: 'workout',
        title: name,
        notes: form.description.trim() || null,
        start_time: form.start_time || null,
        end_time: addMinutesToTime(form.start_time, duration),
      }).eq('id', event.id)

      // Sync linked workout
      const linked = await findLinkedWorkout(ownerId, event.event_date, event.title)
      const wkPatch = {
        event_date: form.event_date,
        event_type: 'workout',
        activity_type: form.activity_type,
        start_time: form.start_time || null,
        activity_duration_min: duration,
        avg_heart_rate: form.avg_heart_rate ? Number(form.avg_heart_rate) : null,
        activity_calories: form.activity_calories ? Number(form.activity_calories) : null,
        name,
        description: form.description.trim() || null,
      }
      if (linked) {
        await sb().from('workouts').update(wkPatch).eq('id', linked.id)
      } else {
        await sb().from('workouts').insert({
          athlete_id: ownerId,
          is_public: false,
          ...wkPatch,
        })
      }

      fireWorkoutsChanged()
      onSaved?.()
      onClose()
    } catch (err) {
      console.error('CalendarEventEditDrawer save error:', err)
      setError('Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!event) return
    setDeleting(true)
    try {
      await sb().from('calendar_events').delete().eq('id', event.id)
      try {
        await sb().from('workouts').delete()
          .eq('athlete_id', ownerId)
          .eq('event_date', event.event_date)
          .eq('name', event.title)
      } catch (syncErr) {
        console.warn('workouts sync error:', syncErr)
      }
      fireWorkoutsChanged()
      onDeleted?.(event.id)
      onClose()
    } catch (err) {
      console.error('CalendarEventEditDrawer delete error:', err)
    } finally {
      setDeleting(false)
    }
  }

  if (!event) return null

  return (
    <DrawerShell open={isOpen} onClose={onClose}>
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border"
              style={{ background: ac.bg, borderColor: ac.border }}
            >
              <i className={`ki-filled ${ac.icon} text-sm`} style={{ color: ac.text }} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                {mode === 'view' ? 'Предстоящая тренировка' : 'Редактирование'}
              </div>
              <div className="mt-0.5 truncate text-base font-semibold text-foreground">{form.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {form.activity_type} · {fmtFullDate(form.event_date)}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost shrink-0">
            <i className="ki-filled ki-cross text-sm" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {!notesLoaded ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
          </div>
        ) : mode === 'view' ? (
          <div className="flex flex-col gap-4">
            <div
              className="rounded-2xl border p-4"
              style={{ background: ac.bg, borderColor: ac.border }}
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">План</div>
              <div className="mt-2 text-xl font-bold text-foreground">{form.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {fmtFullDate(form.event_date)}{form.start_time ? ` · ${form.start_time.slice(0, 5)}` : ''}
                {initialEndTime ? ` — ${initialEndTime.slice(0, 5)}` : ''}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InfoCell label="Длительность" value={form.activity_duration_min ? fmtDuration(Number(form.activity_duration_min)) : '—'} />
              <InfoCell label="Начало" value={form.start_time || '—'} />
              <InfoCell label="Тип" value={form.activity_type || '—'} />
              <InfoCell label="Дата" value={fmtFullDate(form.event_date)} />
            </div>
            {form.description && (
              <div className="rounded-2xl border border-border p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">Заметки</div>
                <p className="text-sm text-foreground whitespace-pre-wrap m-0">{form.description}</p>
              </div>
            )}
          </div>
        ) : (
          <>
            <FormBody form={form} setForm={setForm} showMetrics={false} />
            {error && <p className="mt-3 text-xs font-semibold text-red-500">{error}</p>}
          </>
        )}
      </div>

      <div className="border-t border-border bg-card px-6 py-4 flex gap-2">
        {mode === 'view' ? (
          <>
            <button onClick={() => setMode('edit')} className="kt-btn kt-btn-primary flex-1 justify-center gap-2">
              <i className="ki-filled ki-pencil text-xs" /> Редактировать
            </button>
            {!confirmDel ? (
              <button
                onClick={() => setConfirmDel(true)}
                className="px-4 rounded-xl border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 transition"
              >
                <i className="ki-filled ki-trash text-sm" />
              </button>
            ) : (
              <>
                <button
                  onClick={handleDelete} disabled={deleting}
                  className="px-4 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {deleting ? '…' : 'Удалить'}
                </button>
                <button onClick={() => setConfirmDel(false)} className="kt-btn kt-btn-outline">Отмена</button>
              </>
            )}
          </>
        ) : (
          <>
            <button onClick={() => setMode('view')} className="kt-btn kt-btn-outline flex-1">Отмена</button>
            <button onClick={handleSave} disabled={saving} className="kt-btn kt-btn-primary flex-1 justify-center">
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </>
        )}
      </div>
    </DrawerShell>
  )
}
