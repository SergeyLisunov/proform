'use client'
import { Suspense, useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import {
  getCycles, updateCycle, deleteCycle,
  getCycleDaysByCycle, upsertCycleDay, deleteCycleDay,
  CYCLE_TYPE_CFG, DAY_TYPE_CFG,
  type CycleBlock, type CycleType, type CycleDay, type DayType, type UpdateCycleInput,
} from '@/services/cycles.service'

function parseLocalDate(s: string): Date { return new Date(s + 'T00:00:00') }
function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function diffDays(a: string, b: string): number {
  return Math.round((parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / 86400000)
}
function enumerateDays(from: string, to: string): string[] {
  const days: string[] = []
  let cur = from
  while (cur <= to) {
    days.push(cur)
    const d = parseLocalDate(cur); d.setDate(d.getDate() + 1)
    cur = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }
  return days
}

function SurfaceFrame({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[28px] border border-border bg-card shadow-sm ${className}`}>
      {children}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%', borderRadius: 12, border: '1.5px solid var(--border)',
  padding: '10px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  background: 'var(--background)', color: 'var(--foreground)',
}

function InfoBlock({ label, value, color, multiline }: { label: string; value: string; color?: string; multiline?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={labelStyle}>{label}</span>
      {multiline
        ? <p style={{ fontSize: 14, color: color ?? 'var(--foreground)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{value}</p>
        : <span style={{ fontSize: 14, fontWeight: 500, color: color ?? 'var(--foreground)' }}>{value}</span>}
    </div>
  )
}

// ── DAY CELL (for cycle edit) ──────────────────────────────────────────────────
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

  const [label, setLabel]           = useState(cycle.label)
  const [type, setType]             = useState<CycleType>(cycle.type)
  const [startDate, setStartDate]   = useState(cycle.start_date)
  const [endDate, setEndDate]       = useState(cycle.end_date)
  const [description, setDescription] = useState(cycle.description ?? '')
  const [goal, setGoal]             = useState(cycle.goal ?? '')
  const [dayMap, setDayMap]         = useState<Record<string, DayType>>({})

  const today = todayISO()

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
      for (const d of cycleDaysList) { await deleteCycleDay(cycle.id, d.day_date) }
      const newDays = Object.entries(dayMap)
      if (newDays.length > 0) {
        for (const [day_date, day_type] of newDays) { await upsertCycleDay(userId, cycle.id, day_date, day_type) }
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
  const passed = Math.max(0, Math.min(total, diffDays(cycle.start_date, today) + 1))
  const progress = Math.round((passed / total) * 100)
  const dayStat = Object.values(dayMap).reduce((acc, t) => { acc[t] = (acc[t] ?? 0) + 1; return acc }, {} as Record<string, number>)

  return createPortal(
    <div aria-modal="true" role="dialog" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={handleClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(3px)', transition: 'opacity 0.25s', opacity: visible ? 1 : 0 }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 520, height: '100%', background: 'var(--card)', boxShadow: '-8px 0 40px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.26s cubic-bezier(0.4,0,0.2,1)' }}>
        {/* Header */}
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
                    <div style={{ fontSize: 22, fontWeight: 700, color: viewCfg.text, fontFamily: "var(--pf-font-sans)" }}>{passed} / {total} дн.</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: viewCfg.text, fontFamily: "var(--pf-font-sans)" }}>{progress}%</div>
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
                            <div style={{ fontSize: 16, fontWeight: 700, color: c.color, fontFamily: "var(--pf-font-sans)" }}>{count}</div>
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
                <button onClick={() => { if (!label.trim()) { setError('Введите название'); return }; setError(''); setEditStep('days') }}
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
                    style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: saving ? cfg.border : cfg.text, color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {saving ? 'Сохранение…' : <><i className="ki-filled ki-check" style={{ fontSize: 14 }} />Сохранить изменения</>}
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

// ── MAIN CONTENT ───────────────────────────────────────────────────────────────
function CyclesContent() {
  const { user } = useUser()
  const searchParams = useSearchParams()
  const today = todayISO()

  const urlFrom = searchParams.get('from')
  const urlTo   = searchParams.get('to')

  const [cycles, setCycles] = useState<CycleBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [drawer, setDrawer] = useState<CycleBlock | null>(null)

  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    getCycles(user.id).then(cs => setCycles(cs)).finally(() => setLoading(false))
  }, [user?.id])

  const filtered = useMemo(() => {
    let list = cycles
    if (urlFrom) list = list.filter(c => c.end_date >= urlFrom)
    if (urlTo)   list = list.filter(c => c.start_date <= urlTo)
    return list.sort((a, b) => a.start_date.localeCompare(b.start_date))
  }, [cycles, urlFrom, urlTo])

  const active  = filtered.filter(c => c.start_date <= today && c.end_date >= today)
  const upcoming = filtered.filter(c => c.start_date > today)
  const past    = filtered.filter(c => c.end_date < today)

  const handleUpdated = useCallback((u: CycleBlock) => {
    setCycles(prev => prev.map(c => c.id === u.id ? u : c))
    setDrawer(u)
  }, [])
  const handleDeleted = useCallback((id: string) => {
    setCycles(prev => prev.filter(c => c.id !== id))
    setDrawer(null)
  }, [])

  const periodLabel = urlFrom && urlTo
    ? `${urlFrom} — ${urlTo}`
    : 'Все циклы'

  function CycleSection({ items, title, accent }: { items: CycleBlock[]; title: string; accent?: string }) {
    if (!items.length) return null
    return (
      <SurfaceFrame className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ borderColor: accent ? `${accent}40` : 'var(--border)', background: accent ? `${accent}10` : 'var(--background)', color: accent ?? 'var(--muted-foreground)' }}>
            {accent && <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: accent }} />}
            {title}
          </span>
          <span className="text-2xs text-muted-foreground">{items.length}</span>
        </div>
        <div className="flex flex-col gap-2">
          {items.map(c => {
            const cc = CYCLE_TYPE_CFG[c.type]
            const total  = diffDays(c.start_date, c.end_date) + 1
            const passed = Math.max(0, Math.min(total, diffDays(c.start_date, today) + 1))
            const pct    = Math.round((passed / total) * 100)
            return (
              <button
                key={c.id}
                onClick={() => setDrawer(c)}
                className="group flex items-center gap-4 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm"
                style={{ background: cc.bg, borderColor: cc.border }}
              >
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl" style={{ background: cc.text + '20', border: `1px solid ${cc.border}` }}>
                  <span className="pf-num text-base leading-none font-bold" style={{ color: cc.text }}>{pct}%</span>
                  <span className="text-[9px] mt-0.5" style={{ color: cc.text }}>готов</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: cc.text }}>{c.label}</span>
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold" style={{ borderColor: cc.border, background: 'white', color: cc.text }}>{cc.label}</span>
                  </div>
                  <div className="mt-0.5 text-2xs text-muted-foreground">{c.start_date} → {c.end_date} · {total} дн.</div>
                  {c.goal && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{c.goal}</div>}
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: cc.text + '20' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cc.text, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
                <i className="ki-filled ki-right text-xs opacity-0 transition-opacity group-hover:opacity-100" style={{ color: cc.text }} />
              </button>
            )
          })}
        </div>
      </SurfaceFrame>
    )
  }

  return (
    <div className="flex flex-col gap-5 pf-enter">
      {/* Header */}
      <SurfaceFrame>
        <div className="bg-gradient-to-br from-emerald-50 via-background to-background px-5 py-5 md:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Тренировочные циклы
              </span>
              <h2 className="mt-3 text-[clamp(1.75rem,3.5vw,2.75rem)] font-semibold tracking-tight text-navy-500 leading-tight">
                Периодизация
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{periodLabel}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-background/75 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <i className="ki-filled ki-abstract-45 text-base" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Всего</p>
                    <div className="mt-1"><span className="pf-num text-[clamp(1.8rem,3vw,2.45rem)] leading-none text-foreground">{filtered.length}</span></div>
                    <p className="mt-1.5 text-2xs text-muted-foreground">{urlFrom ? 'За период' : 'Все'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-background/75 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-600">
                    <i className="ki-filled ki-abstract-26 text-base" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Активных</p>
                    <div className="mt-1"><span className="pf-num text-[clamp(1.8rem,3vw,2.45rem)] leading-none text-foreground">{active.length}</span></div>
                    <p className="mt-1.5 text-2xs text-muted-foreground">Сейчас идут</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-background/75 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <i className="ki-filled ki-calendar text-base" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Предстоящих</p>
                    <div className="mt-1"><span className="pf-num text-[clamp(1.8rem,3vw,2.45rem)] leading-none text-foreground">{upcoming.length}</span></div>
                    <p className="mt-1.5 text-2xs text-muted-foreground">Запланировано</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 xl:w-[200px] xl:shrink-0">
              <Link href="/calendar" className="kt-btn kt-btn-primary gap-2 no-underline justify-center">
                <i className="ki-filled ki-calendar text-xs" />
                Открыть календарь
              </Link>
              <Link href="/calendar#create-cycle" className="kt-btn kt-btn-outline gap-2 no-underline justify-center">
                <i className="ki-filled ki-plus text-xs" />
                Создать цикл
              </Link>
            </div>
          </div>
        </div>
      </SurfaceFrame>

      {loading && (
        <div className="flex items-center gap-2 text-2xs text-muted-foreground">
          <div className="h-3 w-3 animate-spin rounded-full border border-emerald-400 border-t-transparent" />
          Загрузка…
        </div>
      )}

      <CycleSection items={active} title="Активные сейчас" accent="#16A34A" />
      <CycleSection items={upcoming} title="Предстоящие" accent="#2563EB" />
      <CycleSection items={[...past].reverse()} title="Завершённые" />

      {!loading && filtered.length === 0 && (
        <SurfaceFrame className="p-12">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
              <i className="ki-filled ki-abstract-45 text-3xl" />
            </div>
            <p className="mt-4 text-base font-semibold text-foreground">Нет циклов</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Создайте первый тренировочный цикл в календаре, чтобы структурировать подготовку.
            </p>
            <Link href="/calendar" className="mt-5 kt-btn kt-btn-primary gap-2 no-underline">
              <i className="ki-filled ki-calendar text-xs" />Открыть календарь
            </Link>
          </div>
        </SurfaceFrame>
      )}

      {drawer && user && (
        <CycleDetailDrawer
          cycle={drawer}
          userId={user.id}
          onClose={() => setDrawer(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}

export default function CyclesPage() {
  return (
    <Suspense fallback={<div className="flex items-center gap-2 p-8 text-muted-foreground"><div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />Загрузка…</div>}>
      <CyclesContent />
    </Suspense>
  )
}
