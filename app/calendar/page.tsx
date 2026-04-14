'use client'
import Link from 'next/link'
import { useState, useMemo, useCallback, useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { DEMO_SESSIONS, DEMO_COMPETITIONS, EVENT_COLORS, recoveryColor } from '@/lib/utils/data'
import { ZoneBar } from '@/components/ui/ZoneBar'
import { useUser } from '@/lib/hooks/useUser'
import { createBrowserClient } from '@supabase/ssr'
import {
  getCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
  EVENT_TYPES, type CalendarEvent, type EventType,
} from '@/services/calendar.service'
import type { Workout } from '@/services/workouts.service'
import {
  getCycles, getCycleDays, getCycleDaysByCycle, createCycle, updateCycle, deleteCycle,
  upsertCycleDay, deleteCycleDay,
  CYCLE_TYPE_CFG, DAY_TYPE_CFG,
  type CycleBlock, type CycleType, type CycleDay, type DayType, type UpdateCycleInput,
} from '@/services/cycles.service'

function getWS() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}
async function getWorkoutsForMonth(athleteId: string, from: string, to: string): Promise<Workout[]> {
  const { data } = await getWS().from('workouts').select('*').eq('athlete_id', athleteId).gte('event_date', from).lte('event_date', to).order('event_date', { ascending: false })
  return (data ?? []) as Workout[]
}

const ACTIVITY_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  'Бег':       { icon: 'ki-abstract-26',  color: '#2563EB', bg: '#EFF6FF' },
  'Велоспорт': { icon: 'ki-technology-4', color: '#EA580C', bg: '#FFF7ED' },
  'Плавание':  { icon: 'ki-abstract-14',  color: '#0284C7', bg: '#E0F2FE' },
  'Силовые':   { icon: 'ki-abstract-45',  color: '#9333EA', bg: '#FAF5FF' },
  'Ходьба':    { icon: 'ki-map',          color: '#16A34A', bg: '#F0FDF4' },
  'Другое':    { icon: 'ki-abstract-26',  color: '#64748B', bg: '#F8FAFC' },
}
function getActivityCfg(t: string | null) { return ACTIVITY_ICONS[t ?? ''] ?? ACTIVITY_ICONS['Другое'] }
function fmtDur(min: number | null | undefined): string {
  if (!min) return ''
  return min < 60 ? `${min} мин` : `${Math.floor(min/60)}ч${min%60?` ${min%60}м`:''}`
}

type ViewMode = 'month' | 'week' | 'year' | 'quarter'

const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_RU   = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const MONTHS      = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']
const DAYS_SHORT  = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

function parseLocalDate(s: string): Date { return new Date(s + 'T00:00:00') }
function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function addDays(s: string, n: number): string {
  const d = parseLocalDate(s); d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function diffDays(a: string, b: string): number {
  return Math.round((parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / 86400000)
}
function enumerateDays(from: string, to: string): string[] {
  const days: string[] = []; let cur = from
  while (cur <= to) { days.push(cur); cur = addDays(cur, 1) }
  return days
}

function buildHeatmap() {
  const map: Record<string, { strain: number; hasComp: boolean }> = {}
  DEMO_SESSIONS.forEach(s => { map[s.date] = { strain: s.strain, hasComp: false } })
  DEMO_COMPETITIONS.forEach(c => { if (map[c.date]) map[c.date].hasComp = true; else map[c.date] = { strain: 0, hasComp: true } })
  return map
}
const HEATMAP = buildHeatmap()

function strainColor(strain: number): string {
  if (strain === 0) return '#F1F5F9'
  if (strain < 8)  return '#DBEAFE'
  if (strain < 12) return '#93C5FD'
  if (strain < 15) return '#3B82F6'
  return '#1D4ED8'
}

function SurfaceFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[28px] border border-border bg-card shadow-sm ${className}`}>
      {children}
    </div>
  )
}

function MetricCard({ label, value, hint, icon, tone, href }: {
  label: string
  value: string | number
  hint: string
  icon: string
  tone: string
  href?: string
}) {
  const inner = (
    <div className="flex h-full items-start gap-3 rounded-2xl border border-border bg-background/75 p-4 transition-colors hover:bg-accent/40">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <i className={`ki-filled ${icon} text-base`} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <div className="mt-1 flex items-end gap-1.5">
          <span className="pf-num text-[clamp(1.8rem,3vw,2.45rem)] leading-none text-foreground">{value}</span>
        </div>
        <p className="mt-1.5 text-2xs leading-5 text-muted-foreground">{hint}</p>
      </div>
    </div>
  )

  if (href) {
    return <Link href={href} className="block no-underline">{inner}</Link>
  }

  return inner
}

function SegmentedButton({ active, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...props}
      className={[
        'inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-2sm font-medium transition-all',
        active ? 'bg-orange-50 text-orange-600 shadow-sm' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        props.className ?? '',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Tag({ children, tone = 'border-border bg-background text-muted-foreground' }: { children: ReactNode; tone?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${tone}`}>
      {children}
    </span>
  )
}

// ── DayCell ────────────────────────────────────────────────────────────────────
function DayCell({ date, day, dayType, cfg, onSelect }: {
  date: string; day: number; dayType?: DayType
  cfg: typeof CYCLE_TYPE_CFG[CycleType]
  onSelect: (date: string, dt: DayType) => void
}) {
  const [open, setOpen] = useState(false)
  const dcfg = dayType ? DAY_TYPE_CFG[dayType] : null
  return (
    <div style={{ position: 'relative' }}>
      <div onClick={() => setOpen(v => !v)}
        style={{ aspectRatio: '1', borderRadius: 8, border: dayType ? `2px solid ${dcfg!.color}60` : '1.5px solid var(--border)', background: dayType ? dcfg!.bg : 'var(--background)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, transition: 'all 0.12s' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: dayType ? dcfg!.color : 'var(--foreground)' }}>{day}</span>
        {dayType && <i className={`ki-filled ${dcfg!.icon}`} style={{ fontSize: 8, color: dcfg!.color }} />}
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 140, marginTop: 4 }}>
          {(Object.entries(DAY_TYPE_CFG) as [DayType, typeof DAY_TYPE_CFG[DayType]][]).map(([key, c]) => (
            <button key={key} onClick={() => { onSelect(date, key); setOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', borderRadius: 8, border: 'none', background: dayType === key ? c.bg : 'transparent', color: c.color, fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
              <i className={`ki-filled ${c.icon}`} style={{ fontSize: 12, flexShrink: 0 }} />{c.label}
            </button>
          ))}
          {dayType && (
            <button onClick={() => { onSelect(date, dayType); setOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', borderRadius: 8, border: 'none', background: 'transparent', color: '#94A3B8', fontSize: 11, fontWeight: 600, cursor: 'pointer', marginTop: 2, borderTop: '1px solid var(--border)' }}>
              <i className="ki-filled ki-cross" style={{ fontSize: 10 }} />Убрать метку
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── CYCLE DETAIL DRAWER ────────────────────────────────────────────────────────
function CycleDetailDrawer({ cycle, userId, onClose, onUpdated, onDeleted }: {
  cycle: CycleBlock
  userId: string
  onClose: () => void
  onUpdated: (c: CycleBlock) => void
  onDeleted: (id: string) => void
}) {
  const [mounted, setMounted]   = useState(false)
  const [visible, setVisible]   = useState(false)
  const [mode, setMode]         = useState<'view' | 'edit'>('view')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editStep, setEditStep] = useState<'info' | 'days'>('info')

  const [cycleDaysList, setCycleDaysList] = useState<CycleDay[]>([])
  const [daysLoading, setDaysLoading] = useState(false)

  const [label,       setLabel]       = useState(cycle.label)
  const [type,        setType]        = useState<CycleType>(cycle.type)
  const [startDate,   setStartDate]   = useState(cycle.start_date)
  const [endDate,     setEndDate]     = useState(cycle.end_date)
  const [description, setDescription] = useState(cycle.description ?? '')
  const [goal,        setGoal]        = useState(cycle.goal ?? '')
  const [dayMap,      setDayMap]      = useState<Record<string, DayType>>({})

  const cycleDaysEnum = useMemo(() => {
    if (!startDate || !endDate || startDate > endDate) return []
    return enumerateDays(startDate, endDate)
  }, [startDate, endDate])

  const duration = cycleDaysEnum.length

  useEffect(() => {
    setMounted(true)
    const t = setTimeout(() => setVisible(true), 10)
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    setDaysLoading(true)
    getCycleDaysByCycle(cycle.id).then(days => {
      setCycleDaysList(days)
      const m: Record<string, DayType> = {}
      days.forEach(d => { m[d.day_date] = d.day_type })
      setDayMap(m)
      setDaysLoading(false)
    })
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, []) // eslint-disable-line

  function handleClose() { setVisible(false); setTimeout(onClose, 260) }

  function toggleDay(date: string, dayType: DayType) {
    setDayMap(prev => {
      if (prev[date] === dayType) { const next = { ...prev }; delete next[date]; return next }
      return { ...prev, [date]: dayType }
    })
  }

  async function handleSave() {
    if (!label.trim()) { setError('Введите название'); return }
    if (startDate > endDate) { setError('Дата начала должна быть раньше конца'); return }
    setSaving(true); setError('')
    try {
      const updates: UpdateCycleInput = { label: label.trim(), type, start_date: startDate, end_date: endDate, description: description || null, goal: goal || null }
      const result = await updateCycle(cycle.id, updates)
      if (!result) { setError('Не удалось сохранить'); setSaving(false); return }
      for (const d of cycleDaysList) {
        await deleteCycleDay(cycle.id, d.day_date)
      }
      const newDays = Object.entries(dayMap)
      if (newDays.length > 0) {
        for (const [day_date, day_type] of newDays) {
          await upsertCycleDay(userId, cycle.id, day_date, day_type)
        }
      }
      onUpdated(result)
      handleClose()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    await deleteCycle(cycle.id)
    onDeleted(cycle.id)
    handleClose()
  }

  if (!mounted) return null

  const cfg = CYCLE_TYPE_CFG[type]
  const viewCfg = CYCLE_TYPE_CFG[cycle.type]
  const total  = diffDays(cycle.start_date, cycle.end_date) + 1
  const passed = Math.max(0, Math.min(total, diffDays(cycle.start_date, todayISO()) + 1))
  const progress = Math.round((passed / total) * 100)

  const dayStat = Object.values(dayMap).reduce((acc, t) => { acc[t] = (acc[t] ?? 0) + 1; return acc }, {} as Record<string, number>)

  return createPortal(
    <div aria-modal="true" role="dialog" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={handleClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(3px)', transition: 'opacity 0.25s', opacity: visible ? 1 : 0 }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 520, height: '100%', background: 'var(--card)', boxShadow: '-8px 0 40px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.26s cubic-bezier(0.4,0,0.2,1)' }}>

        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: viewCfg.bg, border: `1px solid ${viewCfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="ki-filled ki-abstract-26" style={{ color: viewCfg.text, fontSize: 16 }} />
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{viewCfg.label}</p>
              <h2 className="pf-num" style={{ fontSize: 20, color: 'var(--foreground)', lineHeight: 1 }}>{mode === 'edit' ? 'Редактировать цикл' : cycle.label}</h2>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {mode === 'view' && (
              <button onClick={() => setMode('edit')} className="kt-btn kt-btn-sm kt-btn-outline" style={{ gap: 6 }}>
                <i className="ki-filled ki-pencil" style={{ fontSize: 12 }} />Изменить
              </button>
            )}
            <button onClick={handleClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
              <i className="ki-filled ki-cross" style={{ fontSize: 14 }} />
            </button>
          </div>
        </div>

        {mode === 'edit' && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            {[{ id: 'info', label: '1. Параметры' }, { id: 'days', label: '2. Дни цикла' }].map(s => (
              <button key={s.id} onClick={() => setEditStep(s.id as any)}
                style={{ flex: 1, padding: '10px 0', fontSize: 12, fontWeight: 600, borderBottom: editStep === s.id ? `2px solid ${cfg.text}` : '2px solid transparent', color: editStep === s.id ? cfg.text : 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer', marginBottom: -1 }}>
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {mode === 'view' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ padding: '16px', borderRadius: 14, background: viewCfg.bg, border: `1px solid ${viewCfg.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: viewCfg.text, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Прогресс</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: viewCfg.text, fontFamily: "'DM Sans', sans-serif" }}>{passed} / {total} дн.</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: viewCfg.text, fontFamily: "'DM Sans', sans-serif" }}>{progress}%</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>выполнено</div>
                  </div>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.5)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 999, background: viewCfg.text, width: `${progress}%`, transition: 'width 0.5s ease' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <InfoBlock label="Начало" value={parseLocalDate(cycle.start_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })} />
                <InfoBlock label="Конец" value={parseLocalDate(cycle.end_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })} />
                <InfoBlock label="Длительность" value={`${total} дней · ${Math.ceil(total / 7)} нед.`} />
                <InfoBlock label="Тип" value={viewCfg.label} color={viewCfg.text} />
              </div>

              {cycle.goal && <InfoBlock label="Цель" value={cycle.goal} />}
              {cycle.description && <InfoBlock label="Описание" value={cycle.description} multiline />}

              {daysLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                  <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
                </div>
              ) : Object.keys(dayStat).length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Структура цикла</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    {(Object.entries(DAY_TYPE_CFG) as [DayType, typeof DAY_TYPE_CFG[DayType]][]).map(([key, c]) => {
                      const count = dayStat[key] ?? 0
                      if (!count) return null
                      return (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: c.bg, border: `1px solid ${c.color}20` }}>
                          <i className={`ki-filled ${c.icon}`} style={{ color: c.color, fontSize: 16, flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: c.color, fontFamily: "'DM Sans', sans-serif" }}>{count}</div>
                            <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{c.label}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {confirmDelete ? (
                <div style={{ padding: '14px 16px', borderRadius: 12, background: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#DC2626', marginBottom: 10 }}>Удалить этот цикл? Все метки дней тоже удалятся.</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleDelete} style={{ flex: 1, padding: '9px 0', borderRadius: 10, background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Да, удалить</button>
                    <button onClick={() => setConfirmDelete(false)} style={{ padding: '9px 14px', borderRadius: 10, background: '#F1F5F9', color: '#64748B', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Отмена</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                  <i className="ki-filled ki-trash" style={{ fontSize: 14 }} />Удалить цикл
                </button>
              )}
            </div>
          )}

          {mode === 'edit' && editStep === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={labelStyle}>Тип цикла</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {(Object.entries(CYCLE_TYPE_CFG) as [CycleType, typeof CYCLE_TYPE_CFG[CycleType]][]).map(([key, c]) => (
                    <button key={key} type="button" onClick={() => setType(key)}
                      style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 14px', borderRadius: 12, border: type === key ? `2px solid ${c.border}` : '1.5px solid var(--border)', background: type === key ? c.bg : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: type === key ? c.text : 'var(--foreground)' }}>{c.label}</span>
                      <span style={{ fontSize: 10, color: 'var(--muted-foreground)', lineHeight: 1.3 }}>{c.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Название *</label>
                <input type="text" value={label} onChange={e => { setLabel(e.target.value); setError('') }}
                  style={inputStyle} onFocus={e => (e.target.style.borderColor = cfg.text)} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Дата начала</label>
                  <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setError('') }}
                    style={inputStyle} onFocus={e => (e.target.style.borderColor = cfg.text)} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                </div>
                <div>
                  <label style={labelStyle}>Дата конца</label>
                  <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setError('') }} min={startDate}
                    style={inputStyle} onFocus={e => (e.target.style.borderColor = cfg.text)} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                </div>
              </div>
              {duration > 0 && (
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.border}`, textAlign: 'center' }}>
                    <div className="pf-num" style={{ fontSize: 24, color: cfg.text, lineHeight: 1 }}>{duration}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>дней</div>
                  </div>
                  <div style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: 'var(--accent)', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div className="pf-num" style={{ fontSize: 24, color: 'var(--foreground)', lineHeight: 1 }}>{Math.ceil(duration / 7)}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>недель</div>
                  </div>
                </div>
              )}
              <div>
                <label style={labelStyle}>Цель цикла</label>
                <input type="text" value={goal} onChange={e => setGoal(e.target.value)} placeholder="Набор базы, пиковая форма…"
                  style={inputStyle} onFocus={e => (e.target.style.borderColor = cfg.text)} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
              </div>
              <div>
                <label style={labelStyle}>Описание</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                  style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit' }}
                  onFocus={e => (e.target.style.borderColor = cfg.text)} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
              </div>
            </div>
          )}

          {mode === 'edit' && editStep === 'days' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>Кликните по дню чтобы назначить тип.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(Object.entries(DAY_TYPE_CFG) as [DayType, typeof DAY_TYPE_CFG[DayType]][]).map(([key, c]) => (
                  <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: c.bg, border: `1px solid ${c.color}30`, fontSize: 11, fontWeight: 600, color: c.color }}>
                    <i className={`ki-filled ${c.icon}`} style={{ fontSize: 10 }} />{c.label}
                  </span>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: 'var(--muted-foreground)', paddingBottom: 4, textTransform: 'uppercase' }}>{d}</div>
                ))}
                {Array.from({ length: (parseLocalDate(startDate).getDay() + 6) % 7 }).map((_, i) => <div key={`e-${i}`} />)}
                {cycleDaysEnum.map(date => (
                  <DayCell key={date} date={date} day={parseLocalDate(date).getDate()} dayType={dayMap[date]} cfg={cfg} onSelect={toggleDay} />
                ))}
              </div>
              {Object.keys(dayStat).length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {(Object.entries(DAY_TYPE_CFG) as [DayType, typeof DAY_TYPE_CFG[DayType]][]).map(([key, c]) => {
                    const count = Object.values(dayMap).filter(v => v === key).length
                    if (!count) return null
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: c.bg, border: `1px solid ${c.color}25` }}>
                        <i className={`ki-filled ${c.icon}`} style={{ color: c.color, fontSize: 14, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{count} дн.</div>
                          <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{c.label}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {mode === 'edit' && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 12, color: '#DC2626' }}>
                <i className="ki-filled ki-information-5" style={{ flexShrink: 0 }} />{error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              {editStep === 'info' ? (
                <button onClick={() => { if (!label.trim()) { setError('Введите название'); return } setError(''); setEditStep('days') }}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: cfg.text, color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                  Далее: Дни цикла →
                </button>
              ) : (
                <>
                  <button onClick={() => setEditStep('info')}
                    style={{ padding: '11px 16px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    ← Назад
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: saving ? cfg.border : cfg.text, color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
                    {saving ? 'Сохранение…' : '✓ Сохранить изменения'}
                  </button>
                </>
              )}
              <button onClick={() => { setMode('view'); setEditStep('info') }}
                style={{ padding: '11px 14px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }
const inputStyle: React.CSSProperties = { width: '100%', borderRadius: 12, border: '1.5px solid var(--border)', padding: '10px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: 'var(--background)', color: 'var(--foreground)' }

function InfoBlock({ label, value, color, multiline }: { label: string; value: string; color?: string; multiline?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      {multiline
        ? <p style={{ fontSize: 14, color: color ?? 'var(--foreground)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{value}</p>
        : <span style={{ fontSize: 14, fontWeight: 500, color: color ?? 'var(--foreground)' }}>{value}</span>}
    </div>
  )
}

// ── CYCLE CREATE DRAWER ────────────────────────────────────────────────────────
function CycleCreateDrawer({ initialDate, userId, onClose, onCreated }: {
  initialDate: string; userId: string; onClose: () => void; onCreated: (c: CycleBlock) => void
}) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [step, setStep]       = useState<'info' | 'days'>('info')
  const [label, setLabel]     = useState('')
  const [type, setType]       = useState<CycleType>('meso')
  const [startDate, setStartDate] = useState(initialDate)
  const [endDate, setEndDate]     = useState(addDays(initialDate, 6))
  const [description, setDescription] = useState('')
  const [goal, setGoal]       = useState('')
  const [dayMap, setDayMap]   = useState<Record<string, DayType>>({})

  const cycleDays = useMemo(() => {
    if (!startDate || !endDate || startDate > endDate) return []
    return enumerateDays(startDate, endDate)
  }, [startDate, endDate])

  useEffect(() => {
    setMounted(true)
    const t = setTimeout(() => setVisible(true), 10)
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, []) // eslint-disable-line

  function handleClose() { setVisible(false); setTimeout(onClose, 260) }

  function toggleDay(date: string, dayType: DayType) {
    setDayMap(prev => {
      if (prev[date] === dayType) { const next = { ...prev }; delete next[date]; return next }
      return { ...prev, [date]: dayType }
    })
  }

  async function handleSave() {
    if (!label.trim()) { setError('Введите название цикла'); return }
    if (startDate > endDate) { setError('Дата начала должна быть раньше конца'); return }
    setSaving(true); setError('')
    try {
      const days = Object.entries(dayMap).map(([day_date, day_type]) => ({ day_date, day_type }))
      const result = await createCycle({ user_id: userId, label: label.trim(), type, start_date: startDate, end_date: endDate, description: description || undefined, goal: goal || undefined, days })
      if (!result) { setError('Не удалось создать цикл. Проверьте RLS политики.'); setSaving(false); return }
      onCreated(result); handleClose()
    } finally { setSaving(false) }
  }

  if (!mounted) return null
  const cfg = CYCLE_TYPE_CFG[type]
  const duration = cycleDays.length

  return createPortal(
    <div aria-modal="true" role="dialog" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={handleClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(3px)', transition: 'opacity 0.25s', opacity: visible ? 1 : 0 }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 520, height: '100%', background: 'var(--card)', boxShadow: '-8px 0 40px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.26s cubic-bezier(0.4,0,0.2,1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="ki-filled ki-abstract-26" style={{ color: cfg.text, fontSize: 16 }} />
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Тренировочный цикл</p>
              <h2 className="pf-num" style={{ fontSize: 20, color: 'var(--foreground)', lineHeight: 1 }}>Создать цикл</h2>
            </div>
          </div>
          <button onClick={handleClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost"><i className="ki-filled ki-cross" style={{ fontSize: 14 }} /></button>
        </div>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {[{ id: 'info', label: '1. Параметры' }, { id: 'days', label: '2. Дни цикла' }].map(s => (
            <button key={s.id} onClick={() => { if (s.id === 'days' && !label.trim()) { setError('Сначала введите название'); return } setError(''); setStep(s.id as any) }}
              style={{ flex: 1, padding: '10px 0', fontSize: 12, fontWeight: 600, borderBottom: step === s.id ? `2px solid ${cfg.text}` : '2px solid transparent', color: step === s.id ? cfg.text : 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer', marginBottom: -1 }}>
              {s.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {step === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={labelStyle}>Тип цикла</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {(Object.entries(CYCLE_TYPE_CFG) as [CycleType, typeof CYCLE_TYPE_CFG[CycleType]][]).map(([key, c]) => (
                    <button key={key} type="button" onClick={() => setType(key)}
                      style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 14px', borderRadius: 12, border: type === key ? `2px solid ${c.border}` : '1.5px solid var(--border)', background: type === key ? c.bg : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: type === key ? c.text : 'var(--foreground)' }}>{c.label}</span>
                      <span style={{ fontSize: 10, color: 'var(--muted-foreground)', lineHeight: 1.3 }}>{c.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Название *</label>
                <input type="text" value={label} onChange={e => { setLabel(e.target.value); setError('') }}
                  placeholder={type === 'macro' ? 'Сезон 2026' : type === 'meso' ? 'Базовая подготовка' : 'Неделя 1 — втягивающая'}
                  style={inputStyle} onFocus={e => (e.target.style.borderColor = cfg.text)} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Дата начала</label>
                  <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setError('') }}
                    style={inputStyle} onFocus={e => (e.target.style.borderColor = cfg.text)} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                </div>
                <div>
                  <label style={labelStyle}>Дата конца</label>
                  <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setError('') }} min={startDate}
                    style={inputStyle} onFocus={e => (e.target.style.borderColor = cfg.text)} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                </div>
              </div>
              {duration > 0 && (
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.border}`, textAlign: 'center' }}>
                    <div className="pf-num" style={{ fontSize: 24, color: cfg.text, lineHeight: 1 }}>{duration}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>дней</div>
                  </div>
                  <div style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: 'var(--accent)', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div className="pf-num" style={{ fontSize: 24, color: 'var(--foreground)', lineHeight: 1 }}>{Math.ceil(duration / 7)}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>недель</div>
                  </div>
                </div>
              )}
              <div>
                <label style={labelStyle}>Цель цикла</label>
                <input type="text" value={goal} onChange={e => setGoal(e.target.value)} placeholder="Набор базы, пиковая форма к старту…"
                  style={inputStyle} onFocus={e => (e.target.style.borderColor = cfg.text)} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
              </div>
              <div>
                <label style={labelStyle}>Описание</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                  style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit' }}
                  onFocus={e => (e.target.style.borderColor = cfg.text)} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
              </div>
            </div>
          )}
          {step === 'days' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>Кликните по дню и выберите тип. Это поможет отслеживать структуру цикла на календаре.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(Object.entries(DAY_TYPE_CFG) as [DayType, typeof DAY_TYPE_CFG[DayType]][]).map(([key, c]) => (
                  <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: c.bg, border: `1px solid ${c.color}30`, fontSize: 11, fontWeight: 600, color: c.color }}>
                    <i className={`ki-filled ${c.icon}`} style={{ fontSize: 10 }} />{c.label}
                  </span>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: 'var(--muted-foreground)', paddingBottom: 4, textTransform: 'uppercase' }}>{d}</div>
                ))}
                {Array.from({ length: (parseLocalDate(startDate).getDay() + 6) % 7 }).map((_, i) => <div key={`e-${i}`} />)}
                {cycleDays.map(date => (
                  <DayCell key={date} date={date} day={parseLocalDate(date).getDate()} dayType={dayMap[date]} cfg={cfg} onSelect={toggleDay} />
                ))}
              </div>
              {Object.keys(dayMap).length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {(Object.entries(DAY_TYPE_CFG) as [DayType, typeof DAY_TYPE_CFG[DayType]][]).map(([key, c]) => {
                    const count = Object.values(dayMap).filter(v => v === key).length
                    if (!count) return null
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: c.bg, border: `1px solid ${c.color}25` }}>
                        <i className={`ki-filled ${c.icon}`} style={{ color: c.color, fontSize: 14, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{count} дн.</div>
                          <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{c.label}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
          {error && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 12, color: '#DC2626' }}><i className="ki-filled ki-information-5" style={{ flexShrink: 0 }} />{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            {step === 'info' ? (
              <button onClick={() => { if (!label.trim()) { setError('Введите название'); return } setError(''); setStep('days') }}
                style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: cfg.text, color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                Далее: Дни цикла →
              </button>
            ) : (
              <>
                <button onClick={() => setStep('info')} style={{ padding: '11px 16px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>← Назад</button>
                <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: saving ? cfg.border : cfg.text, color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Создание…' : '✓ Создать цикл'}
                </button>
              </>
            )}
            <button onClick={handleClose} style={{ padding: '11px 14px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Отмена</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── YEAR/QUARTER/MONTH/WEEK VIEWS ─────────────────────────────────────────────
function YearView({ year, onSelect, cycles, selected }: { year: number; onSelect: (d: string) => void; cycles: CycleBlock[]; selected?: string | null }) {
  const today = todayISO()
  return (
    <div className="flex flex-col gap-5 pf-enter">
      <div className="flex items-center gap-3 flex-wrap">
        {(['macro','meso','micro'] as CycleType[]).map(t => { const c = CYCLE_TYPE_CFG[t]; return (
          <div key={t} className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <span className="w-3 h-3 rounded-sm" style={{ background: c.bg, border: `1px solid ${c.border}` }} />{c.label}
          </div>
        )})}
        <div className="flex items-center gap-1.5 text-2xs text-muted-foreground ml-auto">
          Интенсивность:
          {['#DBEAFE','#93C5FD','#3B82F6','#1D4ED8'].map((c,i) => <span key={i} className="w-4 h-3 rounded-sm inline-block" style={{ background: c }} />)}
          Высокая
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {MONTHS.map((m, mi) => {
          const fd = new Date(year, mi, 1).getDay(); const off = (fd+6)%7
          const days = new Date(year, mi+1, 0).getDate()
          const cells = [...Array(off).fill(null), ...Array.from({length:days},(_,i)=>i+1)]
          while (cells.length%7!==0) cells.push(null)
          return (
            <div key={m} className="bg-card border border-border rounded-xl p-3">
              <div className="text-2xs font-bold text-foreground uppercase tracking-wider mb-2">{MONTHS_RU[mi]}</div>
              <div className="grid grid-cols-7 gap-[2px] mb-1">
                {DAYS_SHORT.map((d,i) => <div key={i} className="text-center text-[8px] text-muted-foreground/60 font-medium pb-0.5">{d[0]}</div>)}
                {cells.map((day, di) => {
                  if (!day) return <div key={di} />
                  const ds = `${year}-${String(mi+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                  const h = HEATMAP[ds]; const inC = cycles.find(c => ds >= c.start_date && ds <= c.end_date)
                  const cc = inC ? CYCLE_TYPE_CFG[inC.type] : null
                  const isSel = ds === selected
                  const isToday = ds === today
                  return (
                    <div key={di} onClick={() => onSelect(ds)}
                      className="aspect-square rounded-sm cursor-pointer hover:ring-1 hover:ring-orange-400 transition-all flex items-center justify-center relative group"
                      title={ds}
                      style={{ background: isSel ? '#FFF7ED' : (cc ? cc.bg : (h ? strainColor(h.strain) : '#F8FAFC')), outline: isSel ? '2px solid #F97316' : (cc ? `1px solid ${cc.border}` : 'none') }}>
                      {h?.hasComp && <span className="absolute bottom-0 right-0 w-1 h-1 rounded-full bg-orange-500" />}
                      {isToday && <span className="absolute top-0 left-0 w-1 h-1 rounded-full bg-rose-500" />}
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-foreground text-background text-[9px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                        {parseLocalDate(ds).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function QuarterView({ year, quarter, onSelect, cycles, selected }: { year: number; quarter: number; onSelect: (d: string) => void; cycles: CycleBlock[]; selected?: string | null }) {
  const sm = (quarter-1)*3; const months = [sm, sm+1, sm+2]; const today = todayISO()
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pf-enter">
      {months.map(mi => {
        const fd = new Date(year,mi,1).getDay(); const off=(fd+6)%7
        const days = new Date(year,mi+1,0).getDate()
        const cells = [...Array(off).fill(null), ...Array.from({length:days},(_,i)=>i+1)]
        while (cells.length%7!==0) cells.push(null)
        const mc = cycles.filter(c => { const cs=parseLocalDate(c.start_date),ce=parseLocalDate(c.end_date); return cs<=new Date(year,mi+1,0)&&ce>=new Date(year,mi,1) })
        return (
          <div key={mi} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border"><h3 className="pf-num text-lg text-foreground">{MONTHS_RU[mi]} {year}</h3></div>
            <div className="p-3">
              <div className="grid grid-cols-7 mb-1">{DAYS_SHORT.map(d => <div key={d} className="text-center text-2xs text-muted-foreground/60 font-medium py-0.5">{d[0]}</div>)}</div>
              {mc.map((c,ci) => { const cc=CYCLE_TYPE_CFG[c.type]; return <div key={ci} className="mb-1 px-2 py-0.5 rounded text-2xs font-medium truncate border" style={{ background:cc.bg, color:cc.text, borderColor:cc.border }}>{c.label}</div> })}
              <div className="grid grid-cols-7 gap-[2px]">
                {cells.map((day,di) => {
                  if (!day) return <div key={di} />
                  const ds = `${year}-${String(mi+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                  const h=HEATMAP[ds]; const inC=cycles.find(c=>ds>=c.start_date&&ds<=c.end_date); const cc=inC?CYCLE_TYPE_CFG[inC.type]:null
                  const isSel = ds === selected; const isToday = ds === today
                  return <div key={di} onClick={()=>onSelect(ds)} className="min-h-[36px] rounded cursor-pointer hover:border-orange-300 transition-all border flex flex-col items-center justify-start pt-1 gap-0.5"
                    style={{ background: isSel ? '#FFF7ED' : (cc?cc.bg:(h?strainColor(h.strain):'#FAFAFA')), borderColor: isSel ? '#F97316' : (isToday ? '#FB923C' : (cc?cc.border:'transparent')), borderWidth: isSel ? '2px' : '1px' }}>
                    <span className={`text-[9px] font-medium ${isSel ? 'text-orange-600' : isToday ? 'text-orange-500' : 'text-foreground/60'}`}>{day}</span>
                    {isToday && <span className="w-1 h-1 rounded-full bg-orange-400"/>}
                    {h?.hasComp&&<span className="w-1.5 h-1.5 rounded-full bg-orange-500"/>}
                  </div>
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MonthView({ year, month, onSelect, selected, savedEvents, monthWorkouts, cycles, cycleDaysMap }: {
  year: number; month: number; onSelect: (d: string) => void; selected: string | null
  savedEvents: CalendarEvent[]; monthWorkouts: Workout[]; cycles: CycleBlock[]; cycleDaysMap: Record<string, DayType>
}) {
  const fd=(new Date(year,month,1).getDay()+6)%7; const days=new Date(year,month+1,0).getDate()
  const cells: (number|null)[] = [...Array(fd).fill(null), ...Array.from({length:days},(_,i)=>i+1)]
  while (cells.length%7!==0) cells.push(null)
  const weeks: (number|null)[][] = []; for (let i=0;i<cells.length;i+=7) weeks.push(cells.slice(i,i+7))
  const today = todayISO()
  const activeCycles = cycles.filter(c => parseLocalDate(c.start_date)<=new Date(year,month+1,0)&&parseLocalDate(c.end_date)>=new Date(year,month,1))
  const eventsByDate = useMemo(() => { const m: Record<string,CalendarEvent[]>={}; savedEvents.forEach(ev=>{if(!m[ev.event_date])m[ev.event_date]=[]; m[ev.event_date].push(ev)}); return m }, [savedEvents])
  // Группируем реальные тренировки по дате
  const workoutsByDate = useMemo(() => {
    const m: Record<string, Workout[]> = {}
    monthWorkouts.forEach(w => { if (!w.event_date) return; if (!m[w.event_date]) m[w.event_date] = []; m[w.event_date].push(w) })
    return m
  }, [monthWorkouts])
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden pf-enter">
      {activeCycles.length>0&&<div className="px-4 py-2 border-b border-border flex flex-wrap gap-1.5">
        {activeCycles.map((c,i)=>{ const cc=CYCLE_TYPE_CFG[c.type]; return <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold border" style={{background:cc.bg,color:cc.text,borderColor:cc.border}}><span className="w-1.5 h-1.5 rounded-full" style={{background:cc.text}}/>{c.label}</span> })}
      </div>}
      <div className="grid grid-cols-7 border-b border-border">{DAYS_SHORT.map(d=><div key={d} className="py-2 text-center text-2xs font-semibold text-muted-foreground uppercase tracking-wider">{d}</div>)}</div>
      {weeks.map((week,wi)=>(
        <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0">
          {week.map((day,di)=>{
            const ds=day?`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`:''
            const evs=day?(eventsByDate[ds]??[]):[]
            const dayWks=day?(workoutsByDate[ds]??[]):[]
            const cd=day?cycleDaysMap[ds]:undefined; const cdcfg=cd?DAY_TYPE_CFG[cd]:null
            const inC=day?cycles.find(c=>ds>=c.start_date&&ds<=c.end_date):null; const ccfg=inC?CYCLE_TYPE_CFG[inC.type]:null
            const isT=ds===today; const isSel=ds===selected
            // Цвет ячейки на основе максимальной нагрузки за день
            const maxStrain = dayWks.length > 0 ? Math.max(...dayWks.map(w => Number(w.activity_strain ?? 0))) : 0
            const cellBg = ccfg ? ccfg.bg : (maxStrain > 0 ? strainColor(maxStrain) + '40' : undefined)
            return <div key={di} onClick={()=>day&&onSelect(ds)}
              className={['min-h-[90px] p-1.5 border-e border-e-border last:border-e-0 transition-colors', day?'cursor-pointer':'bg-background/40', isSel?'bg-orange-50/80':day?'hover:bg-accent/50':''].join(' ')}
              style={{ borderLeft: ccfg?`3px solid ${ccfg.text}`:undefined, background: isSel ? undefined : cellBg }}>
              {day&&<>
                <div className={['w-7 h-7 rounded-lg flex items-center justify-center text-2sm font-semibold mb-1 mx-auto', isT?'bg-orange-500 text-white':isSel?'bg-orange-100 text-orange-600':'text-foreground'].join(' ')}>{day}</div>
                {cdcfg&&<div className="mb-0.5 px-1 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5" style={{background:cdcfg.bg,color:cdcfg.color}}><i className={`ki-filled ${cdcfg.icon} text-[8px]`}/>{cdcfg.label.slice(0,8)}</div>}
                {/* Реальные тренировки */}
                {dayWks.slice(0,2).map(w => {
                  const ac = getActivityCfg(w.activity_type)
                  return <div key={w.id} className="mb-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold truncate flex items-center gap-1" style={{background:ac.bg,color:ac.color}}>
                    <i className={`ki-filled ${ac.icon} text-[9px] shrink-0`}/>{(w.name??w.activity_type??'').slice(0,10)}{w.activity_strain!=null&&<span className="ml-auto font-bold">{Number(w.activity_strain).toFixed(0)}</span>}
                  </div>
                })}
                {dayWks.length>2&&<div className="text-[10px] text-muted-foreground px-1.5">+{dayWks.length-2} трен.</div>}
                {/* События из calendar_events (только не-workout) */}
                {evs.filter(ev=>ev.event_type!=='workout').slice(0,1).map(ev=>{ const meta=EVENT_TYPES.find(t=>t.value===ev.event_type); return <div key={ev.id} className="mb-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium truncate flex items-center gap-1" style={{background:(meta?.color??'#64748B')+'18',color:meta?.color??'#64748B'}}><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:meta?.color??'#64748B'}}/>{ev.title.slice(0,10)}</div> })}
              </>}
            </div>
          })}
        </div>
      ))}
    </div>
  )
}

function WeekView({ weekStart, onSelect, selected, savedEvents, cycles, cycleDaysMap }: {
  year: number; month: number; weekStart: Date; onSelect: (d: string) => void; selected: string | null
  savedEvents: CalendarEvent[]; cycles: CycleBlock[]; cycleDaysMap: Record<string, DayType>
}) {
  const days = Array.from({length:7},(_,i)=>{ const d=new Date(weekStart); d.setDate(d.getDate()+i); return d })
  const today = todayISO()
  return (
    <div className="grid grid-cols-7 gap-2 pf-enter">
      {days.map((d,di)=>{
        const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
        const ses=DEMO_SESSIONS.find(s=>s.date===ds); const comp=DEMO_COMPETITIONS.find(c=>c.date===ds)
        const evs=savedEvents.filter(e=>e.event_date===ds)
        const cd=cycleDaysMap[ds]; const cdcfg=cd?DAY_TYPE_CFG[cd]:null
        const inC=cycles.find(c=>ds>=c.start_date&&ds<=c.end_date); const ccfg=inC?CYCLE_TYPE_CFG[inC.type]:null
        const isT=ds===today; const isSel=ds===selected
        return <div key={di} onClick={()=>onSelect(ds)}
          className={['bg-card border rounded-xl p-3 cursor-pointer transition-all hover:border-orange-200 hover:shadow-sm', isSel?'border-orange-400 shadow-sm':isT?'border-orange-300':'border-border'].join(' ')}
          style={{ borderTop: ccfg?`3px solid ${ccfg.text}`:undefined }}>
          <div className="text-center mb-2">
            <div className="text-2xs text-muted-foreground uppercase tracking-widest">{DAYS_SHORT[di]}</div>
            <div className={`pf-num text-2xl ${isT?'text-orange-500':'text-foreground'}`}>{d.getDate()}</div>
          </div>
          {cdcfg&&<div className="mb-1.5 px-1.5 py-1 rounded-lg text-2xs font-semibold flex items-center gap-1" style={{background:cdcfg.bg,color:cdcfg.color}}><i className={`ki-filled ${cdcfg.icon} text-[10px]`}/>{cdcfg.label}</div>}
          {inC&&!cdcfg&&<div className="mb-1 px-1.5 py-0.5 rounded text-[9px] font-bold border truncate" style={{background:ccfg!.bg,color:ccfg!.text,borderColor:ccfg!.border}}>{inC.label.slice(0,12)}</div>}
          {ses&&<div className="mb-1.5"><div className="px-2 py-1 rounded-lg text-2xs font-semibold mb-1" style={{background:strainColor(ses.strain),color:'#1D4ED8'}}>{ses.type}</div><ZoneBar zones={ses.z} height={18}/><div className="flex justify-between mt-1"><span className="text-[9px] text-muted-foreground">{ses.dur}m</span><span className="text-[9px] font-bold text-foreground">{ses.strain}</span></div></div>}
          {comp&&<div className="px-2 py-1 rounded-lg text-2xs font-semibold" style={{background:EVENT_COLORS.competition.bg,color:EVENT_COLORS.competition.text}}>🏆 Race</div>}
          {evs.slice(0,2).map(ev=>{ const meta=EVENT_TYPES.find(t=>t.value===ev.event_type); return <div key={ev.id} className="mt-1 px-1.5 py-0.5 rounded text-[9px] font-semibold truncate flex items-center gap-1" style={{background:(meta?.color??'#64748B')+'18',color:meta?.color??'#64748B'}}><i className={`ki-filled ${meta?.icon??'ki-calendar'} text-[9px]`}/>{ev.title.slice(0,12)}</div> })}
          {!ses&&!comp&&evs.length===0&&!cdcfg&&!inC&&<div className="flex items-center justify-center h-12 text-muted-foreground/30"><i className="ki-filled ki-minus text-xs"/></div>}
        </div>
      })}
    </div>
  )
}

// ── DETAIL PANEL ───────────────────────────────────────────────────────────────
function DetailPanel({ dateStr, savedEvents, monthWorkouts, cycles, cycleDaysMap, onAddEvent, onDeleteEvent, onViewEvent, onOpenCycle }: {
  dateStr: string; savedEvents: CalendarEvent[]; monthWorkouts: Workout[]; cycles: CycleBlock[]
  cycleDaysMap: Record<string, DayType>
  onAddEvent: (date: string) => void; onDeleteEvent: (id: string) => void
  onViewEvent?: (event: CalendarEvent, mode: 'view' | 'edit') => void
  onOpenCycle?: (cycle: CycleBlock) => void
}) {
  const activeCycles = cycles.filter(c => dateStr >= c.start_date && dateStr <= c.end_date)
  const cycleDay = cycleDaysMap[dateStr]; const cdcfg = cycleDay ? DAY_TYPE_CFG[cycleDay] : null
  const label = parseLocalDate(dateStr).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  const dayEvents = savedEvents.filter(e => e.event_date === dateStr)
  // Реальные тренировки из workouts таблицы
  const dayWorkouts = monthWorkouts.filter(w => w.event_date === dateStr)

  const isEmpty = activeCycles.length === 0 && dayEvents.length === 0 && dayWorkouts.length === 0 && !cdcfg

  return (
    <SurfaceFrame className="flex h-full flex-col">
      <div className="border-b border-border bg-gradient-to-br from-orange-50/90 via-card to-card px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Выбрано</p>
            <h3 className="mt-1 text-[clamp(1.2rem,2vw,1.45rem)] font-semibold tracking-tight text-foreground capitalize">{label}</h3>
          </div>
          <Tag tone="border-orange-200 bg-orange-50 text-orange-700">{dayWorkouts.length + dayEvents.length || 0} items</Tag>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Tag tone="border-border bg-background text-muted-foreground">Циклов {activeCycles.length}</Tag>
          <Tag tone="border-border bg-background text-muted-foreground">Тренировок {dayWorkouts.length}</Tag>
          <Tag tone="border-border bg-background text-muted-foreground">Событий {dayEvents.length}</Tag>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {cdcfg && (
          <div className="rounded-2xl border px-4 py-3" style={{ background: cdcfg.bg, borderColor: cdcfg.color + '40' }}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: cdcfg.color + '16' }}>
                <i className={`ki-filled ${cdcfg.icon} text-base`} style={{ color: cdcfg.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: cdcfg.color }}>Тип дня</p>
                <p className="mt-1 text-sm font-semibold" style={{ color: cdcfg.color }}>{cdcfg.label}</p>
              </div>
            </div>
          </div>
        )}

        {activeCycles.length > 0 && (
          <div className="rounded-2xl border border-border bg-background/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Активные циклы</p>
              <span className="text-[11px] font-semibold text-muted-foreground">{activeCycles.length}</span>
            </div>
            <div className="mt-3 flex flex-col gap-2.5">
              {activeCycles.map((c, i) => {
                const cc = CYCLE_TYPE_CFG[c.type]
                const total = diffDays(c.start_date, c.end_date) + 1
                const passed = Math.min(total, diffDays(c.start_date, dateStr) + 1)
                return (
                  <button
                    key={i}
                    onClick={() => onOpenCycle?.(c)}
                    className="group flex flex-col gap-2 rounded-2xl border p-3 text-left transition-all hover:shadow-sm"
                    style={{ background: cc.bg, borderColor: cc.border }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: cc.text }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-2xs font-bold uppercase tracking-[0.16em]" style={{ color: cc.text }}>{c.label}</div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">{cc.label} · {c.start_date} → {c.end_date}</div>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-bold" style={{ color: cc.text }}>
                        {passed}/{total}
                        <i className="ki-filled ki-right text-[10px]" />
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/60">
                      <div className="h-full rounded-full transition-all" style={{ width: `${(passed / total) * 100}%`, background: cc.text }} />
                    </div>
                    {c.goal && <div className="text-[10px] text-muted-foreground">{c.goal}</div>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {dayWorkouts.length > 0 && (
          <div className="rounded-2xl border border-border bg-background/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Тренировки</p>
              <Tag tone="border-blue-200 bg-blue-50 text-blue-700">{dayWorkouts.length}</Tag>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {dayWorkouts.map(w => {
                const ac = getActivityCfg(w.activity_type)
                const MOODS = ['😴', '😕', '😐', '🙂', '🔥']
                return (
                  <div key={w.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-accent/30">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: ac.bg }}>
                      <i className={`ki-filled ${ac.icon} text-sm`} style={{ color: ac.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">{w.name ?? w.activity_type ?? 'Тренировка'}</span>
                        {w.mood != null && w.mood >= 0 && <span className="text-sm">{MOODS[w.mood]}</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                        {w.activity_duration_min && <span>{fmtDur(w.activity_duration_min)}</span>}
                        {w.activity_calories && <span>{w.activity_calories} ккал</span>}
                        {w.avg_heart_rate && <span>{w.avg_heart_rate} уд/мин</span>}
                      </div>
                    </div>
                    {w.activity_strain != null && (
                      <div className="shrink-0 text-right">
                        <div className="pf-num text-xl font-bold leading-none" style={{ color: strainColor(Number(w.activity_strain)) }}>
                          {Number(w.activity_strain).toFixed(1)}
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">нагрузка</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {dayEvents.length > 0 && (
          <div className="rounded-2xl border border-border bg-background/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">События</p>
              <Tag tone="border-orange-200 bg-orange-50 text-orange-700">{dayEvents.length}</Tag>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {dayEvents.map(ev => {
                const meta = EVENT_TYPES.find(t => t.value === ev.event_type)
                return (
                  <div
                    key={ev.id}
                    onClick={() => onViewEvent?.(ev, 'view')}
                    className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:border-orange-200 hover:bg-orange-50/40 cursor-pointer"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: (meta?.color ?? '#64748B') + '18' }}>
                      <i className={`ki-filled ${meta?.icon ?? 'ki-calendar'} text-xs`} style={{ color: meta?.color ?? '#64748B' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-semibold text-foreground">{ev.title}</div>
                        <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          {meta?.label ?? 'Событие'}
                        </span>
                      </div>
                      {ev.notes && <div className="mt-1 truncate text-[10px] text-muted-foreground">{ev.notes}</div>}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); onDeleteEvent(ev.id) }}
                      className="opacity-0 transition-opacity group-hover:opacity-100 kt-btn kt-btn-xs kt-btn-icon kt-btn-ghost shrink-0"
                    >
                      <i className="ki-filled ki-trash text-xs text-muted-foreground" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background/50 px-4 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
              <i className="ki-filled ki-calendar text-2xl" />
            </div>
            <p className="mt-4 text-sm font-semibold text-foreground">Нет событий на этот день</p>
            <p className="mt-1 max-w-[18rem] text-2xs leading-5 text-muted-foreground">
              Добавьте тренировку, встречу или заметку, чтобы день появился в календарной ленте.
            </p>
            <button onClick={() => onAddEvent(dateStr)} className="mt-4 kt-btn kt-btn-sm kt-btn-primary gap-1.5">
              <i className="ki-filled ki-plus text-xs" />Добавить событие
            </button>
          </div>
        ) : (
          <button onClick={() => onAddEvent(dateStr)} className="mt-auto kt-btn kt-btn-sm kt-btn-outline gap-1.5 w-full justify-center">
            <i className="ki-filled ki-plus text-xs" />Добавить событие
          </button>
        )}
      </div>
    </SurfaceFrame>
  )
}

// ── ADD EVENT DRAWER ───────────────────────────────────────────────────────────
function AddEventDrawer({ initialDate, ownerId, onClose, onCreated, mode = 'create', initialEvent, onUpdated, onDeleted }: {
  initialDate: string; ownerId: string; onClose: () => void; onCreated: (e: CalendarEvent) => void
  mode?: 'create'|'view'|'edit'; initialEvent?: CalendarEvent
  onUpdated?: (e: CalendarEvent) => void; onDeleted?: (id: string) => void
}) {
  const [mounted,setMounted]=useState(false); const [visible,setVisible]=useState(false)
  const [drawerMode,setDrawerMode]=useState<'create'|'view'|'edit'>(mode)
  const [saving,setSaving]=useState(false); const [error,setError]=useState('')
  const [confirmDelete,setConfirmDelete]=useState(false)
  const titleRef=useRef<HTMLInputElement>(null)
  const [form,setForm]=useState({ event_date:initialEvent?.event_date??initialDate, event_type:(initialEvent?.event_type??'workout') as EventType, title:initialEvent?.title??'', notes:initialEvent?.notes??'', start_time:initialEvent?.start_time??'', end_time:initialEvent?.end_time??'' })
  useEffect(()=>{setMounted(true);const t=setTimeout(()=>setVisible(true),10);return()=>clearTimeout(t)},[])
  useEffect(()=>{document.body.style.overflow='hidden';return()=>{document.body.style.overflow=''}},[])
  useEffect(()=>{if(visible&&drawerMode!=='view')setTimeout(()=>titleRef.current?.focus(),150)},[visible,drawerMode])
  useEffect(()=>{const h=(e:KeyboardEvent)=>{if(e.key==='Escape')handleClose()};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)})
  function handleClose(){setVisible(false);setTimeout(onClose,260)}
  async function handleCreate(e:React.FormEvent){
    e.preventDefault()
    if(!form.title.trim()){setError('Название обязательно');return}
    setSaving(true);setError('')
    // Создаём событие в calendar_events
    const r=await createCalendarEvent({owner_id:ownerId,event_date:form.event_date,event_type:form.event_type,title:form.title.trim(),notes:form.notes.trim()||null,start_time:form.start_time||null,end_time:form.end_time||null})
    if(!r){setError('Не удалось сохранить.');setSaving(false);return}
    // Если тип = тренировка — также создаём запись в workouts (для дневника)
    if(form.event_type === 'workout'){
      const {createBrowserClient} = await import('@supabase/ssr')
      const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      await sb.from('workouts').insert({
        athlete_id:    ownerId,
        event_date:    form.event_date,
        event_type:    'workout',
        activity_type: 'Другое',
        name:          form.title.trim(),
        description:   form.notes.trim()||null,
        start_time:    form.start_time||null,
        is_public:     false,
      })
    }
    onCreated(r);handleClose()
  }
  async function handleUpdate(e:React.FormEvent){e.preventDefault();if(!form.title.trim()||!initialEvent){setError('Название обязательно');return};setSaving(true);setError('');const r=await updateCalendarEvent(initialEvent.id,{event_date:form.event_date,event_type:form.event_type,title:form.title.trim(),notes:form.notes.trim()||null,start_time:form.start_time||null,end_time:form.end_time||null});if(!r){setError('Не удалось обновить.');setSaving(false);return};onUpdated?.(r);handleClose()}
  async function handleDelete(){if(!initialEvent)return;await deleteCalendarEvent(initialEvent.id);onDeleted?.(initialEvent.id);handleClose()}
  const selType=EVENT_TYPES.find(t=>t.value===form.event_type)
  if(!mounted)return null
  return createPortal(
    <div aria-modal="true" role="dialog" style={{position:'fixed',inset:0,zIndex:9999,display:'flex',justifyContent:'flex-end'}}>
      <div onClick={handleClose} style={{position:'absolute',inset:0,backgroundColor:'rgba(15,23,42,0.65)',backdropFilter:'blur(3px)',transition:'opacity 0.25s',opacity:visible?1:0}}/>
      <div style={{position:'relative',width:'100%',maxWidth:440,height:'100%',backgroundColor:'var(--card)',boxShadow:'-8px 0 40px rgba(0,0,0,0.18)',display:'flex',flexDirection:'column',transform:visible?'translateX(0)':'translateX(100%)',transition:'transform 0.26s cubic-bezier(0.4,0,0.2,1)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 24px 16px',borderBottom:'1px solid var(--border)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {selType&&<div style={{width:36,height:36,borderRadius:10,background:selType.color+'18',display:'flex',alignItems:'center',justifyContent:'center'}}><i className={`ki-filled ${selType.icon}`} style={{color:selType.color,fontSize:16}}/></div>}
            <div><p style={{fontSize:10,fontWeight:700,color:'var(--muted-foreground)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:1}}>Календарь</p>
            <h2 className="pf-num" style={{fontSize:22,color:'var(--foreground)',lineHeight:1}}>{drawerMode==='create'?'Добавить событие':drawerMode==='edit'?'Редактировать':(initialEvent?.title??'Событие')}</h2></div>
          </div>
          <button onClick={handleClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost"><i className="ki-filled ki-cross" style={{fontSize:14}}/></button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'20px 24px 24px'}}>
          {drawerMode==='view'&&initialEvent&&(
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              {selType&&<div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:20,background:selType.color+'12',border:`1.5px solid ${selType.color}30`,alignSelf:'flex-start'}}><i className={`ki-filled ${selType.icon}`} style={{color:selType.color,fontSize:12}}/><span style={{fontSize:12,fontWeight:700,color:selType.color}}>{selType.label}</span></div>}
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <InfoBlock label="Название" value={initialEvent.title}/>
                <InfoBlock label="Дата" value={parseLocalDate(initialEvent.event_date).toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}/>
                {(initialEvent.start_time||initialEvent.end_time)&&<InfoBlock label="Время" value={[initialEvent.start_time,initialEvent.end_time].filter(Boolean).join(' – ')}/>}
                {initialEvent.notes&&<InfoBlock label="Заметки" value={initialEvent.notes} multiline/>}
              </div>
              {confirmDelete?(
                <div style={{padding:'14px 16px',borderRadius:12,background:'#FEF2F2',border:'1px solid #FECACA'}}>
                  <p style={{fontSize:13,fontWeight:600,color:'#DC2626',marginBottom:10}}>Удалить это событие?</p>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={handleDelete} style={{flex:1,padding:'9px 0',borderRadius:10,background:'#DC2626',color:'#fff',fontSize:13,fontWeight:600,border:'none',cursor:'pointer'}}>Да, удалить</button>
                    <button onClick={()=>setConfirmDelete(false)} style={{padding:'9px 14px',borderRadius:10,background:'#F1F5F9',color:'#64748B',fontSize:13,fontWeight:600,border:'none',cursor:'pointer'}}>Отмена</button>
                  </div>
                </div>
              ):(
                <div style={{display:'flex',gap:8,paddingTop:4}}>
                  <button onClick={()=>setDrawerMode('edit')} style={{flex:1,padding:'11px 0',borderRadius:12,background:'#F97316',color:'#fff',fontSize:14,fontWeight:600,border:'none',cursor:'pointer'}}><i className="ki-filled ki-pencil" style={{marginRight:6,fontSize:12}}/>Изменить</button>
                  <button onClick={()=>setConfirmDelete(true)} style={{padding:'11px 14px',borderRadius:12,background:'#FEF2F2',color:'#DC2626',fontSize:14,fontWeight:600,border:'1.5px solid #FECACA',cursor:'pointer'}}><i className="ki-filled ki-trash" style={{fontSize:14}}/></button>
                </div>
              )}
            </div>
          )}
          {(drawerMode==='create'||drawerMode==='edit')&&(
            <>
              {error&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',borderRadius:12,marginBottom:16,background:'#FEF2F2',border:'1px solid #FECACA',fontSize:13,color:'#DC2626'}}><i className="ki-filled ki-information-5" style={{color:'#EF4444',flexShrink:0}}/>{error}</div>}
              <form onSubmit={drawerMode==='edit'?handleUpdate:handleCreate} style={{display:'flex',flexDirection:'column',gap:18}}>
                <div><label style={labelStyle}>Тип события</label>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                  {EVENT_TYPES.map(t=>{const a=form.event_type===t.value;return(<button key={t.value} type="button" onClick={()=>setForm(f=>({...f,event_type:t.value}))} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 10px',borderRadius:10,border:a?`2px solid ${t.color}`:'1.5px solid var(--border)',background:a?t.color+'12':'var(--background)',color:a?t.color:'var(--muted-foreground)',fontSize:11,fontWeight:600,cursor:'pointer'}}><i className={`ki-filled ${t.icon}`} style={{fontSize:12,color:a?t.color:'var(--muted-foreground)',flexShrink:0}}/>{t.label}</button>)})}
                </div></div>
                <div><label style={labelStyle}>Название *</label><input ref={titleRef} type="text" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} required placeholder="Утренняя пробежка…" style={inputStyle} onFocus={e=>(e.target.style.borderColor='#F97316')} onBlur={e=>(e.target.style.borderColor='var(--border)')}/></div>
                <div><label style={labelStyle}>Дата</label><input type="date" value={form.event_date} onChange={e=>setForm(f=>({...f,event_date:e.target.value}))} required style={inputStyle} onFocus={e=>(e.target.style.borderColor='#F97316')} onBlur={e=>(e.target.style.borderColor='var(--border)')}/></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div><label style={labelStyle}>Начало</label><input type="time" value={form.start_time} onChange={e=>setForm(f=>({...f,start_time:e.target.value}))} style={inputStyle} onFocus={e=>(e.target.style.borderColor='#F97316')} onBlur={e=>(e.target.style.borderColor='var(--border)')}/></div>
                  <div><label style={labelStyle}>Конец</label><input type="time" value={form.end_time} onChange={e=>setForm(f=>({...f,end_time:e.target.value}))} style={inputStyle} onFocus={e=>(e.target.style.borderColor='#F97316')} onBlur={e=>(e.target.style.borderColor='var(--border)')}/></div>
                </div>
                <div><label style={labelStyle}>Заметки</label><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={3} placeholder="Заметки…" style={{...inputStyle,resize:'none',fontFamily:'inherit'}} onFocus={e=>(e.target.style.borderColor='#F97316')} onBlur={e=>(e.target.style.borderColor='var(--border)')}/></div>
                <div style={{display:'flex',gap:8}}>
                  <button type="submit" disabled={saving} style={{flex:1,padding:'11px 0',borderRadius:12,background:saving?'#FDA96A':'#F97316',color:'#fff',fontSize:14,fontWeight:600,border:'none',cursor:saving?'not-allowed':'pointer'}}>{saving?'Сохранение…':drawerMode==='edit'?'Сохранить':'Сохранить событие'}</button>
                  <button type="button" onClick={()=>drawerMode==='edit'&&initialEvent?setDrawerMode('view'):handleClose()} style={{padding:'11px 14px',borderRadius:12,border:'1.5px solid var(--border)',background:'transparent',color:'var(--muted-foreground)',fontSize:14,fontWeight:600,cursor:'pointer'}}>Отмена</button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { user } = useUser()
  const now = new Date(); const _today = todayISO()

  const [view, setView]       = useState<ViewMode>('month')
  const [year, setYear]       = useState(now.getFullYear())
  const [month, setMonth]     = useState(now.getMonth())
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth()/3)+1)
  const [selected, setSelected] = useState<string|null>(_today)
  const [filterType, setFilterType] = useState('all')

  const [showAddEvent, setShowAddEvent] = useState(false)
  const [showAddCycle, setShowAddCycle] = useState(false)
  const [addEventDate, setAddEventDate] = useState(_today)
  const [savedEvents,  setSavedEvents]  = useState<CalendarEvent[]>([])
  const [monthWorkouts, setMonthWorkouts] = useState<Workout[]>([])
  const [cycles,       setCycles]       = useState<CycleBlock[]>([])
  const [cycleDays,    setCycleDays]    = useState<CycleDay[]>([])
  const [loading,      setLoading]      = useState(false)
  const [eventDrawer,  setEventDrawer]  = useState<CalendarEvent|null>(null)
  const [eventDrawerMode, setEventDrawerMode] = useState<'view'|'edit'>('view')
  const [cycleDrawer,  setCycleDrawer]  = useState<CycleBlock|null>(null)

  const cycleDaysMap = useMemo(() => {
    const m: Record<string,DayType>={}; cycleDays.forEach(cd=>{m[cd.day_date]=cd.day_type}); return m
  }, [cycleDays])

  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    const from = `${year}-${String(month+1).padStart(2,'0')}-01`
    const lastDay = new Date(year, month+1, 0).getDate()
    const to = `${year}-${String(month+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
    Promise.all([
      getCalendarEvents(user.id, from, to),
      getCycles(user.id, from, to),
      getCycleDays(user.id, from, to),
      getWorkoutsForMonth(user.id, from, to),
    ]).then(([evs, cs, cds, wks]) => { setSavedEvents(evs); setCycles(cs); setCycleDays(cds); setMonthWorkouts(wks) })
      .finally(() => setLoading(false))
  }, [user?.id, year, month])

  const openAddEvent = useCallback((date?: string) => { setAddEventDate(date ?? _today); setShowAddEvent(true) }, [_today])
  const openEventDrawer = useCallback((e: CalendarEvent, mode: 'view'|'edit' = 'view') => { setEventDrawer(e); setEventDrawerMode(mode) }, [])

  const handleEventCreated = useCallback((e: CalendarEvent) => {
    setSavedEvents(prev => [...prev, e])
    const d = parseLocalDate(e.event_date)
    if (d.getFullYear()!==year||d.getMonth()!==month) { setYear(d.getFullYear()); setMonth(d.getMonth()) }
    setSelected(e.event_date)
  }, [year, month])

  const handleEventUpdated = useCallback((u: CalendarEvent) => { setSavedEvents(prev=>prev.map(e=>e.id===u.id?u:e)) }, [])
  const handleDeleteEvent  = useCallback(async (id: string) => { await deleteCalendarEvent(id); setSavedEvents(prev=>prev.filter(e=>e.id!==id)); if(eventDrawer?.id===id)setEventDrawer(null) }, [eventDrawer])

  const handleCycleCreated = useCallback((c: CycleBlock) => {
    setCycles(prev => [...prev, c]); setSelected(c.start_date)
    const d = parseLocalDate(c.start_date); setYear(d.getFullYear()); setMonth(d.getMonth())
  }, [])

  const handleCycleUpdated = useCallback((updated: CycleBlock) => {
    setCycles(prev => prev.map(c => c.id === updated.id ? updated : c))
    if (user?.id) {
      const from = `${year}-${String(month+1).padStart(2,'0')}-01`
      const lastDay = new Date(year, month+1, 0).getDate()
      const to = `${year}-${String(month+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
      getCycleDays(user.id, from, to).then(cds => setCycleDays(cds))
    }
  }, [user?.id, year, month])

  const handleCycleDeleted = useCallback((id: string) => {
    setCycles(prev => prev.filter(c => c.id !== id))
    setCycleDays(prev => prev.filter(cd => {
      const cycle = cycles.find(c => c.id === id)
      if (!cycle) return true
      return !(cd.day_date >= cycle.start_date && cd.day_date <= cycle.end_date)
    }))
  }, [cycles])

  const weekStart = useMemo(() => {
    const base = selected ? parseLocalDate(selected) : new Date(year, month, now.getDate())
    const day = base.getDay(); const offset = (day+6)%7
    const d = new Date(base); d.setDate(d.getDate()-offset); return d
  }, [selected, year, month]) // eslint-disable-line

  const prevPeriod = () => {
    if (view==='year') setYear(y=>y-1)
    if (view==='quarter') { if(quarter===1){setYear(y=>y-1);setQuarter(4)}else setQuarter(q=>q-1) }
    if (view==='month') { if(month===0){setYear(y=>y-1);setMonth(11)}else setMonth(m=>m-1) }
  }
  const nextPeriod = () => {
    if (view==='year') setYear(y=>y+1)
    if (view==='quarter') { if(quarter===4){setYear(y=>y+1);setQuarter(1)}else setQuarter(q=>q+1) }
    if (view==='month') { if(month===11){setYear(y=>y+1);setMonth(0)}else setMonth(m=>m+1) }
  }
  const periodLabel = () => {
    if (view==='year')    return `${year}`
    if (view==='quarter') return `Q${quarter} ${year}`
    if (view==='month')   return `${MONTHS_RU[month]} ${year}`
    return `Неделя · ${MONTHS_RU[month]} ${year}`
  }

  const VIEWS: {id:ViewMode;label:string}[] = [{id:'week',label:'Неделя'},{id:'month',label:'Месяц'},{id:'quarter',label:'Квартал'},{id:'year',label:'Год'}]

  // ── ДИНАМИЧЕСКИЙ СЧЁТЧИК ТРЕНИРОВОК (реальные данные) ───────────────────────
  const periodSessions = useMemo(() => {
    try {
      if (view === 'month') {
        return monthWorkouts.filter(w => {
          if (!w.event_date) return false
          const d = parseLocalDate(w.event_date)
          return d.getFullYear() === year && d.getMonth() === month
        }).length
      }
      if (view === 'week') {
        const ws = weekStart
        const we = new Date(ws); we.setDate(we.getDate() + 6)
        const wsISO = `${ws.getFullYear()}-${String(ws.getMonth()+1).padStart(2,'0')}-${String(ws.getDate()).padStart(2,'0')}`
        const weISO = `${we.getFullYear()}-${String(we.getMonth()+1).padStart(2,'0')}-${String(we.getDate()).padStart(2,'0')}`
        return monthWorkouts.filter(w => w.event_date && w.event_date >= wsISO && w.event_date <= weISO).length
      }
      // quarter / year — используем DEMO_SESSIONS т.к. monthWorkouts загружается только за текущий месяц
      if (view === 'quarter') {
        const qStart = (quarter - 1) * 3; const qEnd = qStart + 2
        return DEMO_SESSIONS.filter(s => { const d = parseLocalDate(s.date); return d.getFullYear() === year && d.getMonth() >= qStart && d.getMonth() <= qEnd }).length
      }
      return DEMO_SESSIONS.filter(s => parseLocalDate(s.date).getFullYear() === year).length
    } catch { return 0 }
  }, [view, year, month, quarter, weekStart, monthWorkouts])

  // Подпись периода для KPI плашки «Тренировки»
  const kpiLabel = () => {
    switch (view) {
      case 'week':    return 'За неделю'
      case 'month':   return 'За месяц'
      case 'quarter': return 'За квартал'
      case 'year':    return 'За год'
      default:        return 'Тренировки'
    }
  }

  const selectedLabel = selected ? parseLocalDate(selected).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Сегодня'

  const periodCompetitions = useMemo(() => {
    try {
      if (view === 'week') {
        const ws = weekStart
        const we = new Date(ws); we.setDate(we.getDate() + 6)
        const wsISO = `${ws.getFullYear()}-${String(ws.getMonth()+1).padStart(2,'0')}-${String(ws.getDate()).padStart(2,'0')}`
        const weISO = `${we.getFullYear()}-${String(we.getMonth()+1).padStart(2,'0')}-${String(we.getDate()).padStart(2,'0')}`
        return savedEvents.filter(e => e.event_type === 'competition' && e.event_date >= wsISO && e.event_date <= weISO).length
      }
      if (view === 'month') {
        return savedEvents.filter(e => {
          if (e.event_type !== 'competition') return false
          const d = parseLocalDate(e.event_date)
          return d.getFullYear() === year && d.getMonth() === month
        }).length
      }
      if (view === 'quarter') {
        const qStart = (quarter - 1) * 3; const qEnd = qStart + 2
        return DEMO_COMPETITIONS.filter(c => { const d = parseLocalDate(c.date); return d.getFullYear() === year && d.getMonth() >= qStart && d.getMonth() <= qEnd }).length
      }
      return DEMO_COMPETITIONS.filter(c => parseLocalDate(c.date).getFullYear() === year).length
    } catch { return 0 }
  }, [view, year, month, quarter, weekStart, savedEvents])

  const periodCycles = useMemo(() => {
    try {
      let from: Date, to: Date
      if (view === 'week') {
        from = weekStart; to = new Date(weekStart); to.setDate(to.getDate() + 6)
      } else if (view === 'month') {
        from = new Date(year, month, 1); to = new Date(year, month + 1, 0)
      } else if (view === 'quarter') {
        from = new Date(year, (quarter - 1) * 3, 1); to = new Date(year, quarter * 3, 0)
      } else {
        from = new Date(year, 0, 1); to = new Date(year, 11, 31)
      }
      return cycles.filter(c => parseLocalDate(c.start_date) <= to && parseLocalDate(c.end_date) >= from).length
    } catch { return 0 }
  }, [view, year, month, quarter, weekStart, cycles])

  const diaryPeriodLink = useCallback(() => {
    let from: string, to: string
    if (view === 'week') {
      const ws = weekStart; const we = new Date(ws); we.setDate(we.getDate() + 6)
      from = `${ws.getFullYear()}-${String(ws.getMonth()+1).padStart(2,'0')}-${String(ws.getDate()).padStart(2,'0')}`
      to   = `${we.getFullYear()}-${String(we.getMonth()+1).padStart(2,'0')}-${String(we.getDate()).padStart(2,'0')}`
    } else if (view === 'month') {
      from = `${year}-${String(month+1).padStart(2,'0')}-01`
      to   = `${year}-${String(month+1).padStart(2,'0')}-${String(new Date(year, month+1, 0).getDate()).padStart(2,'0')}`
    } else if (view === 'quarter') {
      const qsm = (quarter-1)*3+1; const qem = quarter*3
      from = `${year}-${String(qsm).padStart(2,'0')}-01`
      to   = `${year}-${String(qem).padStart(2,'0')}-${String(new Date(year, qem, 0).getDate()).padStart(2,'0')}`
    } else {
      from = `${year}-01-01`; to = `${year}-12-31`
    }
    return `/diary?from=${from}&to=${to}`
  }, [view, year, month, quarter, weekStart])

  const periodRangeParams = useCallback(() => {
    let from: string, to: string
    if (view === 'week') {
      const ws = weekStart; const we = new Date(ws); we.setDate(we.getDate() + 6)
      from = `${ws.getFullYear()}-${String(ws.getMonth()+1).padStart(2,'0')}-${String(ws.getDate()).padStart(2,'0')}`
      to   = `${we.getFullYear()}-${String(we.getMonth()+1).padStart(2,'0')}-${String(we.getDate()).padStart(2,'0')}`
    } else if (view === 'month') {
      from = `${year}-${String(month+1).padStart(2,'0')}-01`
      to   = `${year}-${String(month+1).padStart(2,'0')}-${String(new Date(year, month+1, 0).getDate()).padStart(2,'0')}`
    } else if (view === 'quarter') {
      const qsm = (quarter-1)*3+1; const qem = quarter*3
      from = `${year}-${String(qsm).padStart(2,'0')}-01`
      to   = `${year}-${String(qem).padStart(2,'0')}-${String(new Date(year, qem, 0).getDate()).padStart(2,'0')}`
    } else {
      from = `${year}-01-01`; to = `${year}-12-31`
    }
    return `from=${from}&to=${to}`
  }, [view, year, month, quarter, weekStart])

  return (
    <div className="flex flex-col gap-5 pf-enter">
      <SurfaceFrame>
        <div className="bg-gradient-to-br from-orange-50 via-background to-background px-5 py-5 md:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex-1 min-w-0">
              <Tag tone="border-orange-200 bg-orange-50 text-orange-700">График тренировок</Tag>
              <h2 className="mt-3 text-[clamp(1.75rem,3.5vw,2.75rem)] font-semibold tracking-tight text-foreground leading-tight">Календарь</h2>
              <p className="mt-1 text-sm text-muted-foreground">{periodLabel()}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {/* KPI 1 — Тренировки → дневник с диапазоном дат */}
                <Link href={diaryPeriodLink()} className="no-underline group">
                  <div className="flex h-full items-start gap-3 rounded-2xl border border-border bg-background/75 p-4 transition-all hover:border-orange-200 hover:shadow-sm hover:-translate-y-0.5 cursor-pointer">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <i className="ki-filled ki-abstract-26 text-base" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Тренировки</p>
                      <div className="mt-1 flex items-end gap-1.5">
                        <span className="pf-num text-[clamp(1.8rem,3vw,2.45rem)] leading-none text-foreground">{periodSessions}</span>
                      </div>
                      <p className="mt-1.5 text-2xs leading-5 text-muted-foreground flex items-center gap-1">
                        {kpiLabel()}
                        <i className="ki-filled ki-right text-[9px] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </p>
                    </div>
                  </div>
                </Link>
                {/* KPI 2 — Соревнования → страница соревнований с диапазоном дат */}
                <Link href={`/competitions?${periodRangeParams()}`} className="no-underline group">
                  <div className="flex h-full items-start gap-3 rounded-2xl border border-border bg-background/75 p-4 transition-all hover:border-orange-200 hover:shadow-sm hover:-translate-y-0.5 cursor-pointer">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                      <i className="ki-filled ki-medal-star text-base" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Соревнования</p>
                      <div className="mt-1 flex items-end gap-1.5">
                        <span className="pf-num text-[clamp(1.8rem,3vw,2.45rem)] leading-none text-foreground">{periodCompetitions}</span>
                      </div>
                      <p className="mt-1.5 text-2xs leading-5 text-muted-foreground flex items-center gap-1">
                        {kpiLabel()}
                        <i className="ki-filled ki-right text-[9px] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </p>
                    </div>
                  </div>
                </Link>
                {/* KPI 3 — Циклы → страница циклов с диапазоном дат */}
                <Link href={`/cycles?${periodRangeParams()}`} className="no-underline group">
                  <div className="flex h-full items-start gap-3 rounded-2xl border border-border bg-background/75 p-4 transition-all hover:border-orange-200 hover:shadow-sm hover:-translate-y-0.5 cursor-pointer">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <i className="ki-filled ki-abstract-45 text-base" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Циклы</p>
                      <div className="mt-1 flex items-end gap-1.5">
                        <span className="pf-num text-[clamp(1.8rem,3vw,2.45rem)] leading-none text-foreground">{periodCycles}</span>
                      </div>
                      <p className="mt-1.5 text-2xs leading-5 text-muted-foreground flex items-center gap-1">
                        {kpiLabel()}
                        <i className="ki-filled ki-right text-[9px] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:w-[260px] xl:shrink-0">
              <div className="rounded-2xl border border-border bg-background/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Рабочая область</p>
                <p className="mt-2 text-lg font-semibold text-foreground capitalize">{selectedLabel}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Активный период: {periodLabel()}.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowAddCycle(true)}
                  className="kt-btn kt-btn-sm kt-btn-outline gap-1.5"
                >
                  <i className="ki-filled ki-abstract-26 text-xs" />
                  Создать цикл
                </button>
                <button
                  onClick={() => openAddEvent(selected ?? undefined)}
                  className="kt-btn kt-btn-sm kt-btn-primary gap-1.5"
                >
                  <i className="ki-filled ki-plus text-xs" />
                  Добавить событие
                </button>
              </div>
            </div>
          </div>
        </div>
      </SurfaceFrame>

      {cycles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {cycles.map(c => {
            const cc = CYCLE_TYPE_CFG[c.type]
            const total = diffDays(c.start_date, c.end_date) + 1
            const passed = Math.max(0, Math.min(total, diffDays(c.start_date, _today) + 1))
            return (
              <button
                key={c.id}
                onClick={() => setCycleDrawer(c)}
                className="flex items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm"
                style={{ background: cc.bg, borderColor: cc.border }}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cc.text }} />
                <div>
                  <div className="text-2xs font-bold uppercase tracking-[0.16em]" style={{ color: cc.text }}>{c.label}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{c.start_date} → {c.end_date} · {passed}/{total} дн.</div>
                </div>
                <i className="ki-filled ki-right text-[10px]" style={{ color: cc.text }} />
              </button>
            )
          })}
        </div>
      )}

      <SurfaceFrame className="p-4 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-2xl border border-border bg-background p-1">
              {VIEWS.map(v => (
                <SegmentedButton key={v.id} active={view === v.id} onClick={() => setView(v.id)}>
                  {v.label}
                </SegmentedButton>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2">
              <button onClick={prevPeriod} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost"><i className="ki-filled ki-left text-xs" /></button>
              <div className="min-w-[160px] text-center pf-num text-lg text-foreground">{periodLabel()}</div>
              <button onClick={nextPeriod} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost"><i className="ki-filled ki-right text-xs" /></button>
            </div>
            <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); setSelected(_today); setView('month') }} className="kt-btn kt-btn-sm kt-btn-outline gap-1.5">
              <i className="ki-filled ki-calendar text-xs" />
              Сегодня
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {['all', 'workout', 'competition', 'cycle'].map(f => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={[
                  'rounded-full border px-3 py-1.5 text-2xs font-semibold transition-all',
                  filterType === f ? 'border-orange-200 bg-orange-50 text-orange-700 shadow-sm' : 'border-border bg-background text-muted-foreground hover:border-orange-200 hover:text-foreground',
                ].join(' ')}
              >
                {f === 'all' ? 'Все' : f === 'workout' ? 'Тренировки' : f === 'competition' ? 'Соревнования' : 'Циклы'}
              </button>
            ))}
          </div>
        </div>
      </SurfaceFrame>

      {loading && (
        <div className="flex items-center gap-2 text-2xs text-muted-foreground">
          <div className="h-3 w-3 animate-spin rounded-full border border-orange-400 border-t-transparent" />
          Загрузка…
        </div>
      )}

      {view === 'year' ? (
        <div className="flex flex-col gap-4">
          <YearView year={year} onSelect={setSelected} cycles={cycles} selected={selected} />
          {selected && (
            <div className="pf-enter">
              <DetailPanel
                dateStr={selected}
                savedEvents={savedEvents}
                monthWorkouts={monthWorkouts}
                cycles={cycles}
                cycleDaysMap={cycleDaysMap}
                onAddEvent={openAddEvent}
                onDeleteEvent={handleDeleteEvent}
                onViewEvent={openEventDrawer}
                onOpenCycle={setCycleDrawer}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div>
            {view === 'quarter' && <QuarterView year={year} quarter={quarter} onSelect={setSelected} cycles={cycles} selected={selected} />}
            {view === 'month' && <MonthView year={year} month={month} onSelect={setSelected} selected={selected} savedEvents={savedEvents} monthWorkouts={monthWorkouts} cycles={cycles} cycleDaysMap={cycleDaysMap} />}
            {view === 'week' && <WeekView year={year} month={month} weekStart={weekStart} onSelect={setSelected} selected={selected} savedEvents={savedEvents} cycles={cycles} cycleDaysMap={cycleDaysMap} />}
          </div>
          {selected && (
            <DetailPanel
              dateStr={selected}
              savedEvents={savedEvents}
              monthWorkouts={monthWorkouts}
              cycles={cycles}
              cycleDaysMap={cycleDaysMap}
              onAddEvent={openAddEvent}
              onDeleteEvent={handleDeleteEvent}
              onViewEvent={openEventDrawer}
              onOpenCycle={setCycleDrawer}
            />
          )}
        </div>
      )}

      {savedEvents.length > 0 && (
        <SurfaceFrame className="p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Ваши события</p>
              <h3 className="mt-1 text-base font-semibold text-foreground">Лента событий</h3>
            </div>
            <Tag tone="border-border bg-background text-muted-foreground">{savedEvents.length}</Tag>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {savedEvents.slice().sort((a, b) => a.event_date.localeCompare(b.event_date)).map(ev => {
              const meta = EVENT_TYPES.find(t => t.value === ev.event_type)
              return (
                <div
                  key={ev.id}
                  onClick={() => openEventDrawer(ev, 'view')}
                  className="group flex items-center gap-3 rounded-2xl border border-border bg-background/70 px-3 py-2.5 transition-all hover:border-orange-200 hover:bg-orange-50/40 cursor-pointer"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: (meta?.color ?? '#64748B') + '18' }}>
                    <i className={`ki-filled ${meta?.icon ?? 'ki-calendar'} text-xs`} style={{ color: meta?.color ?? '#64748B' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{ev.title}</span>
                      <span className="inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {meta?.label ?? 'Событие'}
                      </span>
                    </div>
                    {ev.notes && <span className="mt-1 block truncate text-2xs text-muted-foreground">{ev.notes}</span>}
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {parseLocalDate(ev.event_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}{ev.start_time && ` · ${ev.start_time}`}
                  </span>
                  <button onClick={e => { e.stopPropagation(); handleDeleteEvent(ev.id) }} className="opacity-0 transition-opacity group-hover:opacity-100 kt-btn kt-btn-xs kt-btn-icon kt-btn-ghost shrink-0">
                    <i className="ki-filled ki-trash text-xs text-muted-foreground" />
                  </button>
                </div>
              )
            })}
          </div>
        </SurfaceFrame>
      )}

      <SurfaceFrame className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Легенда</span>
          {[
            { label: 'Тренировка', color: '#3B82F6', type: 'square' },
            { label: 'Соревнование', color: '#EA580C', type: 'circle' },
            ...(['macro', 'meso', 'micro'] as CycleType[]).map(t => ({ label: CYCLE_TYPE_CFG[t].label, color: CYCLE_TYPE_CFG[t].text, type: 'bar' })),
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className={`inline-block w-3 h-3 ${l.type === 'circle' ? 'rounded-full' : 'rounded-sm'}`} style={{ background: l.color }} />
              <span className="text-2xs text-muted-foreground">{l.label}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-2xs text-muted-foreground">Нагрузка:</span>
            {[['Низкая', '#DBEAFE'], ['Средняя', '#93C5FD'], ['Высокая', '#3B82F6'], ['Пик', '#1D4ED8']].map(([l, c]) => (
              <span key={l} className="flex items-center gap-0.5">
                <span className="inline-block h-3 w-4 rounded-sm" style={{ background: c }} />
                <span className="text-[9px] text-muted-foreground">{l}</span>
              </span>
            ))}
          </div>
        </div>
      </SurfaceFrame>

      {/* Drawers */}
      {showAddEvent && user && (
        <AddEventDrawer initialDate={addEventDate} ownerId={user.id} onClose={()=>setShowAddEvent(false)} onCreated={handleEventCreated}/>
      )}
      {eventDrawer && user && (
        <AddEventDrawer initialDate={eventDrawer.event_date} ownerId={user.id} mode={eventDrawerMode} initialEvent={eventDrawer}
          onClose={()=>setEventDrawer(null)} onCreated={handleEventCreated}
          onUpdated={e=>{handleEventUpdated(e);setEventDrawer(null)}}
          onDeleted={id=>{handleDeleteEvent(id);setEventDrawer(null)}}/>
      )}
      {showAddCycle && user && (
        <CycleCreateDrawer initialDate={selected??_today} userId={user.id} onClose={()=>setShowAddCycle(false)} onCreated={handleCycleCreated}/>
      )}
      {cycleDrawer && user && (
        <CycleDetailDrawer cycle={cycleDrawer} userId={user.id} onClose={()=>setCycleDrawer(null)}
          onUpdated={c=>{handleCycleUpdated(c);setCycleDrawer(null)}}
          onDeleted={id=>{handleCycleDeleted(id);setCycleDrawer(null)}}/>
      )}
    </div>
  )
}
