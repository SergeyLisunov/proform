'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { useToast } from '@/lib/hooks/useToast'
import ReactDOM from 'react-dom'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/lib/hooks/useUser'
import { getErrorMessage } from '@/lib/utils/errors'

// ── Типы ──────────────────────────────────────────────────────────────────────
type Workout = {
  id: string
  athlete_id: string
  event_date: string | null
  activity_type: string | null
  name: string | null
  description: string | null
  activity_duration_min: number | null
  activity_strain: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  activity_calories: number | null
  mood: number | null
  created_at: string | null
}

type PeriodPreset = '1d' | '7d' | '30d' | '90d' | '365d' | 'custom'

// ── Helpers ───────────────────────────────────────────────────────────────────
function getSB() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function fmtDateRu(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtDateShort(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function fmtDuration(min: number | null): string {
  if (!min) return '—'
  if (min < 60) return `${min} мин`
  const h = Math.floor(min / 60); const m = min % 60
  return m ? `${h}ч ${m}м` : `${h}ч`
}

function strainLabel(v: number): string {
  if (v < 3) return 'Отдых'
  if (v < 8) return 'Лёгкая'
  if (v < 14) return 'Умеренная'
  if (v < 18) return 'Высокая'
  return 'Максимум'
}

function strainColor(v: number): string {
  if (v < 3) return '#22c55e'
  if (v < 8) return '#84cc16'
  if (v < 14) return '#eab308'
  if (v < 18) return '#F35703'
  return '#ef4444'
}

const MOODS = ['😴', '😕', '😐', '🙂', '🔥']
const MOOD_LABELS = ['Очень плохо', 'Плохо', 'Нейтрально', 'Хорошо', 'Отлично']

const ACTIVITY_COLORS: Record<string, string> = {
  'Бег': '#2563EB', 'Велоспорт': '#D44A02', 'Плавание': '#0284C7',
  'Силовые': '#9333EA', 'Ходьба': '#16A34A',
}

// ── PDF генератор (print API) ─────────────────────────────────────────────────
function generatePDF(workouts: Workout[], fromDate: string, toDate: string, athleteName: string) {
  const totalMin = workouts.reduce((s, w) => s + (w.activity_duration_min ?? 0), 0)
  const totalCal = workouts.reduce((s, w) => s + (w.activity_calories ?? 0), 0)
  const avgStrain = workouts.length
    ? (workouts.reduce((s, w) => s + (w.activity_strain ?? 0), 0) / workouts.length).toFixed(1)
    : '—'
  const byType: Record<string, number> = {}
  workouts.forEach(w => { const t = w.activity_type ?? 'Другое'; byType[t] = (byType[t] ?? 0) + 1 })
  const topType = Object.entries(byType).sort((a,b) => b[1]-a[1])[0]?.[0] ?? '—'

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Sporteo — Отчёт по тренировкам</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, sans-serif; color: #0f172a; background: #fff; font-size: 11px; line-height: 1.5; }
  
  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 32px 40px 24px; border-bottom: 3px solid #F35703; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand-logo { width: 36px; height: 36px; background: linear-gradient(135deg, #F35703, #D44A02); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 16px; }
  .brand-name { font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.03em; }
  .brand-sub { font-size: 10px; color: #94a3b8; font-weight: 500; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 1px; }
  .header-meta { text-align: right; }
  .header-title { font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: -0.03em; }
  .header-sub { font-size: 10px; color: #94a3b8; margin-top: 3px; }
  .header-period { font-size: 13px; font-weight: 700; color: #F35703; margin-top: 2px; }
  
  /* Summary KPI */
  .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0; margin: 20px 40px; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; }
  .kpi-item { padding: 16px 14px; border-right: 1px solid #e2e8f0; background: #f8fafc; }
  .kpi-item:last-child { border-right: none; }
  .kpi-label { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
  .kpi-value { font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: -0.03em; line-height: 1; }
  .kpi-unit { font-size: 10px; color: #64748b; font-weight: 500; margin-top: 2px; }
  
  /* Section */
  .section { margin: 0 40px 24px; }
  .section-title { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
  
  /* Workout cards */
  .workout-list { display: flex; flex-direction: column; gap: 10px; }
  .workout-card { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; page-break-inside: avoid; }
  .workout-card-header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
  .workout-date { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; min-width: 80px; }
  .workout-type-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .workout-name { font-size: 13px; font-weight: 700; color: #0f172a; flex: 1; }
  .workout-type-badge { font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.06em; }
  .workout-card-body { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0; padding: 10px 16px; }
  .workout-metric { border-right: 1px solid #f1f5f9; padding-right: 14px; margin-right: 14px; }
  .workout-metric:last-child { border-right: none; }
  .metric-label { font-size: 9px; color: #94a3b8; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px; }
  .metric-value { font-size: 14px; font-weight: 800; color: #0f172a; }
  .metric-unit { font-size: 9px; color: #64748b; }
  .workout-notes { padding: 8px 16px 12px; font-size: 10px; color: #64748b; line-height: 1.6; border-top: 1px solid #f1f5f9; font-style: italic; }
  
  /* Stats chart (bar) */
  .bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .bar-label { font-size: 10px; font-weight: 600; color: #475569; min-width: 80px; }
  .bar-track { flex: 1; height: 8px; background: #f1f5f9; border-radius: 99px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 99px; }
  .bar-count { font-size: 10px; font-weight: 700; color: #0f172a; min-width: 24px; text-align: right; }
  
  /* Footer */
  .footer { margin: 0 40px; padding: 16px 0; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
  .footer-left { font-size: 9px; color: #94a3b8; }
  .footer-right { font-size: 9px; color: #94a3b8; }
  
  /* Empty state */
  .empty { text-align: center; padding: 40px; color: #94a3b8; font-size: 12px; }
  
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .workout-card { page-break-inside: avoid; }
    .no-break { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="brand">
    <div class="brand-logo">P</div>
    <div>
      <div class="brand-name">Sporteo</div>
      <div class="brand-sub">Дневник тренировок</div>
    </div>
  </div>
  <div class="header-meta">
    <div class="header-title">Отчёт по тренировкам</div>
    <div class="header-sub">Атлет: ${athleteName}</div>
    <div class="header-period">
      ${fmtDateRu(fromDate)} — ${fmtDateRu(toDate)}
    </div>
  </div>
</div>

<div class="kpi-grid">
  <div class="kpi-item">
    <div class="kpi-label">Тренировок</div>
    <div class="kpi-value">${workouts.length}</div>
    <div class="kpi-unit">записей</div>
  </div>
  <div class="kpi-item">
    <div class="kpi-label">Часов</div>
    <div class="kpi-value">${totalMin >= 60 ? (totalMin/60).toFixed(1) : totalMin}</div>
    <div class="kpi-unit">${totalMin >= 60 ? 'часов' : 'минут'}</div>
  </div>
  <div class="kpi-item">
    <div class="kpi-label">Калории</div>
    <div class="kpi-value">${totalCal > 0 ? totalCal.toLocaleString('ru-RU') : '—'}</div>
    <div class="kpi-unit">ккал</div>
  </div>
  <div class="kpi-item">
    <div class="kpi-label">Ср. нагрузка</div>
    <div class="kpi-value">${avgStrain}</div>
    <div class="kpi-unit">из 21</div>
  </div>
  <div class="kpi-item">
    <div class="kpi-label">Осн. вид</div>
    <div class="kpi-value" style="font-size:13px">${topType}</div>
    <div class="kpi-unit">${byType[topType] ?? 0} трен.</div>
  </div>
</div>

${Object.keys(byType).length > 1 ? `
<div class="section no-break">
  <div class="section-title">По видам активности</div>
  ${Object.entries(byType).sort((a,b) => b[1]-a[1]).map(([type, count]) => {
    const pct = Math.round((count / workouts.length) * 100)
    const color = ACTIVITY_COLORS[type] ?? '#64748B'
    return `<div class="bar-row">
      <div class="bar-label">${type}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="bar-count">${count}</div>
    </div>`
  }).join('')}
</div>` : ''}

<div class="section">
  <div class="section-title">Детали тренировок</div>
  ${workouts.length === 0
    ? '<div class="empty">Нет тренировок за выбранный период</div>'
    : `<div class="workout-list">
    ${workouts.map(w => {
      const color = ACTIVITY_COLORS[w.activity_type ?? ''] ?? '#64748B'
      const hasMetrics = w.activity_duration_min || w.activity_strain != null || w.avg_heart_rate || w.activity_calories || w.mood != null
      return `<div class="workout-card">
        <div class="workout-card-header">
          <div class="workout-date">${w.event_date ? fmtDateShort(w.event_date) : '—'}</div>
          <div class="workout-type-dot" style="background:${color}"></div>
          <div class="workout-name">${w.name ?? w.activity_type ?? 'Тренировка'}</div>
          ${w.activity_type ? `<div class="workout-type-badge" style="background:${color}18;color:${color}">${w.activity_type}</div>` : ''}
          ${w.mood != null && w.mood >= 0 ? `<div style="font-size:14px;margin-left:4px">${MOODS[w.mood] ?? ''}</div>` : ''}
        </div>
        ${hasMetrics ? `<div class="workout-card-body">
          <div class="workout-metric">
            <div class="metric-label">Длит.</div>
            <div class="metric-value">${fmtDuration(w.activity_duration_min)}</div>
          </div>
          <div class="workout-metric">
            <div class="metric-label">Нагрузка</div>
            <div class="metric-value" style="color:${w.activity_strain != null ? strainColor(Number(w.activity_strain)) : '#94a3b8'}">${w.activity_strain != null ? Number(w.activity_strain).toFixed(1) : '—'}</div>
            <div class="metric-unit">${w.activity_strain != null ? strainLabel(Number(w.activity_strain)) : ''}</div>
          </div>
          <div class="workout-metric">
            <div class="metric-label">Ср. ЧСС</div>
            <div class="metric-value">${w.avg_heart_rate ? Math.round(Number(w.avg_heart_rate)) : '—'}</div>
            <div class="metric-unit">${w.avg_heart_rate ? 'уд/мин' : ''}</div>
          </div>
          <div class="workout-metric">
            <div class="metric-label">Калории</div>
            <div class="metric-value">${w.activity_calories ?? '—'}</div>
            <div class="metric-unit">${w.activity_calories ? 'ккал' : ''}</div>
          </div>
          <div class="workout-metric">
            <div class="metric-label">Самочувствие</div>
            <div class="metric-value" style="font-size:16px">${w.mood != null && w.mood >= 0 ? MOODS[w.mood] ?? '—' : '—'}</div>
            <div class="metric-unit">${w.mood != null && w.mood >= 0 ? MOOD_LABELS[w.mood] ?? '' : ''}</div>
          </div>
        </div>` : ''}
        ${w.description ? `<div class="workout-notes">${w.description}</div>` : ''}
      </div>`
    }).join('')}
  </div>`
  }
</div>

<div class="footer">
  <div class="footer-left">Сгенерировано Sporteo · ${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
  <div class="footer-right">proform-delta.vercel.app</div>
</div>

</body>
</html>`

  // Открываем новое окно и печатаем
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) { throw new Error('Разрешите всплывающие окна для этого сайта') }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); }, 600)
}

// ── Основной компонент экспорта ───────────────────────────────────────────────
export default function WorkoutPDFExport({ onClose }: { onClose: () => void }) {
  const { user } = useUser()
  const { warning } = useToast()
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  // Режим выбора
  const [mode, setMode] = useState<'range' | 'manual'>('range')

  // Range mode
  const [preset, setPreset] = useState<PeriodPreset>('30d')
  const [fromDate, setFromDate] = useState(() => addDays(todayISO(), -29))
  const [toDate, setToDate] = useState(todayISO)

  // Manual mode — массив выбранных дат
  const [manualDates, setManualDates] = useState<string[]>([])
  const [manualMonth, setManualMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })

  // Data
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    setMounted(true)
    requestAnimationFrame(() => setVisible(true))
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, []) // eslint-disable-line

  function handleClose() { setVisible(false); setTimeout(onClose, 260) }

  // Обновляем даты при выборе preset
  function applyPreset(p: PeriodPreset) {
    setPreset(p)
    const today = todayISO()
    setToDate(today)
    if (p === '1d') setFromDate(today)
    else if (p === '7d') setFromDate(addDays(today, -6))
    else if (p === '30d') setFromDate(addDays(today, -29))
    else if (p === '90d') setFromDate(addDays(today, -89))
    else if (p === '365d') setFromDate(addDays(today, -364))
  }

  // Загружаем тренировки для preview
  const loadWorkouts = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const sb = getSB()
    let query = sb.from('workouts').select('*').eq('athlete_id', user.id)
    if (mode === 'range') {
      query = query.gte('event_date', fromDate).lte('event_date', toDate)
    } else {
      if (manualDates.length === 0) { setWorkouts([]); setLoading(false); return }
      query = query.in('event_date', manualDates)
    }
    const { data } = await query.order('event_date', { ascending: false })
    setWorkouts((data ?? []) as Workout[])
    setLoading(false)
  }, [user?.id, mode, fromDate, toDate, manualDates])

  useEffect(() => { loadWorkouts() }, [loadWorkouts])

  // Manual calendar
  const manualCalendar = useMemo(() => {
    const [y, m] = manualMonth.split('-').map(Number)
    const firstDay = new Date(y, m-1, 1).getDay()
    const offset = (firstDay + 6) % 7
    const daysInMonth = new Date(y, m, 0).getDate()
    return { year: y, month: m, offset, daysInMonth }
  }, [manualMonth])

  function toggleManualDate(iso: string) {
    setManualDates(prev => prev.includes(iso) ? prev.filter(d => d !== iso) : [...prev, iso])
  }

  function selectAllMonth() {
    const { year, month, daysInMonth } = manualCalendar
    const dates = Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      return `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    })
    // Фильтруем только дни с тренировками (или добавляем все)
    setManualDates(prev => {
      const existing = prev.filter(d => !d.startsWith(`${year}-${String(month).padStart(2,'0')}`))
      return [...existing, ...dates]
    })
  }

  function clearMonth() {
    const { year, month } = manualCalendar
    setManualDates(prev => prev.filter(d => !d.startsWith(`${year}-${String(month).padStart(2,'0')}`)))
  }

  function handleGenerate() {
    setGenerating(true)
    const effectiveFrom = mode === 'range' ? fromDate : (manualDates.length > 0 ? [...manualDates].sort()[0] : todayISO())
    const effectiveTo = mode === 'range' ? toDate : (manualDates.length > 0 ? [...manualDates].sort().pop()! : todayISO())
    setTimeout(() => {
      try {
        generatePDF(workouts, effectiveFrom, effectiveTo, user?.name ?? user?.email ?? 'Атлет')
      } catch (e: unknown) {
        warning(getErrorMessage(e, 'Ошибка генерации PDF'))
      } finally {
        setGenerating(false)
      }
    }, 100)
  }

  const DAYS_RU = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
  const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

  const totalMin = workouts.reduce((s, w) => s + (w.activity_duration_min ?? 0), 0)
  const totalCal = workouts.reduce((s, w) => s + (w.activity_calories ?? 0), 0)

  if (!mounted) return null

  return ReactDOM.createPortal(
    <div style={{ position:'fixed',inset:0,zIndex:9999,display:'flex',alignItems:'flex-start',justifyContent:'flex-end' }}>
      {/* Backdrop */}
      <div onClick={handleClose} style={{ position:'absolute',inset:0,background:'rgba(15,23,42,0.65)',backdropFilter:'blur(4px)',transition:'opacity 0.26s',opacity:visible?1:0 }} />

      {/* Panel */}
      <div style={{
        position:'relative',width:'100%',maxWidth:560,height:'100%',background:'var(--card)',
        borderLeft:'1px solid var(--border)',display:'flex',flexDirection:'column',
        boxShadow:'-12px 0 48px rgba(0,0,0,0.18)',
        transform:visible?'translateX(0)':'translateX(100%)',
        transition:'transform 0.26s cubic-bezier(0.4,0,0.2,1)',
      }}>

        {/* Header */}
        <div style={{ padding:'20px 24px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
          <div style={{ display:'flex',alignItems:'center',gap:12 }}>
            <div style={{ width:38,height:38,borderRadius:10,background:'linear-gradient(135deg,#F35703,#D44A02)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
              <i className="ki-filled ki-file-down text-white text-base" />
            </div>
            <div>
              <p style={{ fontSize:10,fontWeight:700,color:'var(--muted-foreground)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:2 }}>Экспорт данных</p>
              <h2 style={{ fontSize:19,fontWeight:800,color:'var(--foreground)',letterSpacing:'-0.02em',lineHeight:1 }}>Отчёт PDF</h2>
            </div>
          </div>
          <button onClick={handleClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
            <i className="ki-filled ki-cross text-sm" />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex:1,overflowY:'auto',padding:'20px 24px',display:'flex',flexDirection:'column',gap:20 }}>

          {/* Mode switch */}
          <div>
            <div style={{ fontSize:10,fontWeight:700,color:'var(--muted-foreground)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10 }}>Выбор периода</div>
            <div style={{ display:'flex',gap:6,padding:4,background:'var(--accent)',borderRadius:12,border:'1px solid var(--border)' }}>
              {[{id:'range',label:'Диапазон дат'},{id:'manual',label:'Конкретные дни'}].map(m => (
                <button key={m.id} onClick={() => setMode(m.id as any)}
                  style={{ flex:1,padding:'9px 14px',borderRadius:9,fontSize:13,fontWeight:600,border:'none',cursor:'pointer',transition:'all 0.15s',
                    background:mode===m.id?'var(--card)':'transparent',
                    color:mode===m.id?'var(--foreground)':'var(--muted-foreground)',
                    boxShadow:mode===m.id?'0 1px 4px rgba(0,0,0,0.08)':'none' }}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Range mode */}
          {mode === 'range' && (
            <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
              {/* Presets */}
              <div>
                <div style={{ fontSize:10,fontWeight:600,color:'var(--muted-foreground)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8 }}>Быстрый выбор</div>
                <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
                  {[
                    {id:'1d',label:'Сегодня'},
                    {id:'7d',label:'7 дней'},
                    {id:'30d',label:'30 дней'},
                    {id:'90d',label:'3 месяца'},
                    {id:'365d',label:'Год'},
                    {id:'custom',label:'Свой'},
                  ].map(p => (
                    <button key={p.id} onClick={() => p.id === 'custom' ? setPreset('custom') : applyPreset(p.id as PeriodPreset)}
                      style={{ padding:'7px 14px',borderRadius:10,fontSize:12,fontWeight:600,cursor:'pointer',transition:'all 0.15s',
                        background:preset===p.id?'#FEF0E7':'var(--card)',
                        border:`1.5px solid ${preset===p.id?'#FBC1A0':'var(--border)'}`,
                        color:preset===p.id?'#D44A02':'var(--muted-foreground)' }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Date inputs */}
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
                <div>
                  <label style={{ fontSize:10,fontWeight:600,color:'var(--muted-foreground)',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:6 }}>От</label>
                  <input type="date" value={fromDate} max={toDate}
                    onChange={e => { setFromDate(e.target.value); setPreset('custom') }}
                    style={{ width:'100%',borderRadius:12,border:'1.5px solid var(--border)',padding:'10px 14px',fontSize:14,outline:'none',background:'var(--background)',color:'var(--foreground)',boxSizing:'border-box' }}
                    onFocus={e=>(e.target.style.borderColor='#F35703')} onBlur={e=>(e.target.style.borderColor='var(--border)')} />
                </div>
                <div>
                  <label style={{ fontSize:10,fontWeight:600,color:'var(--muted-foreground)',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:6 }}>До</label>
                  <input type="date" value={toDate} min={fromDate}
                    onChange={e => { setToDate(e.target.value); setPreset('custom') }}
                    style={{ width:'100%',borderRadius:12,border:'1.5px solid var(--border)',padding:'10px 14px',fontSize:14,outline:'none',background:'var(--background)',color:'var(--foreground)',boxSizing:'border-box' }}
                    onFocus={e=>(e.target.style.borderColor='#F35703')} onBlur={e=>(e.target.style.borderColor='var(--border)')} />
                </div>
              </div>
            </div>
          )}

          {/* Manual mode */}
          {mode === 'manual' && (
            <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
              <p style={{ fontSize:12,color:'var(--muted-foreground)',margin:0 }}>Кликайте по дням чтобы выбрать конкретные тренировки для отчёта.</p>

              {/* Month nav */}
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                <button onClick={() => {
                  const [y,m] = manualMonth.split('-').map(Number)
                  const prev = m === 1 ? `${y-1}-12` : `${y}-${String(m-1).padStart(2,'0')}`
                  setManualMonth(prev)
                }} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-outline"><i className="ki-filled ki-left text-xs"/></button>
                <span style={{ fontSize:15,fontWeight:700,color:'var(--foreground)' }}>
                  {MONTHS_RU[manualCalendar.month-1]} {manualCalendar.year}
                </span>
                <button onClick={() => {
                  const [y,m] = manualMonth.split('-').map(Number)
                  const next = m === 12 ? `${y+1}-01` : `${y}-${String(m+1).padStart(2,'0')}`
                  setManualMonth(next)
                }} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-outline"><i className="ki-filled ki-right text-xs"/></button>
              </div>

              {/* Month controls */}
              <div style={{ display:'flex',gap:6 }}>
                <button onClick={selectAllMonth} style={{ flex:1,padding:'6px 12px',borderRadius:9,fontSize:11,fontWeight:600,border:'1.5px solid var(--border)',background:'transparent',color:'var(--muted-foreground)',cursor:'pointer' }}>
                  Весь месяц
                </button>
                <button onClick={clearMonth} style={{ flex:1,padding:'6px 12px',borderRadius:9,fontSize:11,fontWeight:600,border:'1.5px solid var(--border)',background:'transparent',color:'var(--muted-foreground)',cursor:'pointer' }}>
                  Снять месяц
                </button>
              </div>

              {/* Calendar grid */}
              <div style={{ background:'var(--accent)',borderRadius:16,padding:14,border:'1px solid var(--border)' }}>
                <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',marginBottom:8 }}>
                  {DAYS_RU.map(d => (
                    <div key={d} style={{ textAlign:'center',fontSize:9,fontWeight:700,color:'var(--muted-foreground)',textTransform:'uppercase',letterSpacing:'0.08em',paddingBottom:6 }}>{d}</div>
                  ))}
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3 }}>
                  {Array.from({length: manualCalendar.offset}).map((_,i) => <div key={`e-${i}`} />)}
                  {Array.from({length: manualCalendar.daysInMonth}).map((_,i) => {
                    const day = i + 1
                    const iso = `${manualCalendar.year}-${String(manualCalendar.month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                    const selected = manualDates.includes(iso)
                    const isToday = iso === todayISO()
                    return (
                      <button key={iso} onClick={() => toggleManualDate(iso)}
                        style={{ aspectRatio:'1',borderRadius:8,fontSize:12,fontWeight:selected?700:500,
                          border:`2px solid ${selected?'#F35703':isToday?'#FDA96A':'transparent'}`,
                          background:selected?'#F35703':isToday?'#FEF0E7':'var(--background)',
                          color:selected?'white':isToday?'#D44A02':'var(--foreground)',
                          cursor:'pointer',transition:'all 0.12s',display:'flex',alignItems:'center',justifyContent:'center' }}>
                        {day}
                      </button>
                    )
                  })}
                </div>
              </div>

              {manualDates.length > 0 && (
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',borderRadius:10,background:'#FEF0E7',border:'1px solid #FBC1A0' }}>
                  <span style={{ fontSize:12,fontWeight:600,color:'#D44A02' }}>
                    Выбрано дней: {manualDates.length}
                  </span>
                  <button onClick={() => setManualDates([])} style={{ fontSize:11,color:'#D44A02',background:'none',border:'none',cursor:'pointer',fontWeight:600 }}>
                    Очистить всё
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          <div>
            <div style={{ fontSize:10,fontWeight:700,color:'var(--muted-foreground)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12 }}>
              Предпросмотр отчёта
            </div>
            {loading ? (
              <div style={{ display:'flex',alignItems:'center',justifyContent:'center',padding:'32px 0',gap:10 }}>
                <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <span style={{ fontSize:13,color:'var(--muted-foreground)' }}>Загрузка данных…</span>
              </div>
            ) : (
              <div style={{ background:'var(--accent)',borderRadius:16,border:'1px solid var(--border)',overflow:'hidden' }}>
                {/* KPI row */}
                <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',borderBottom:'1px solid var(--border)' }}>
                  {[
                    {label:'Тренировок', value: workouts.length, sub: 'записей'},
                    {label:'Время', value: totalMin >= 60 ? `${(totalMin/60).toFixed(1)}ч` : `${totalMin}м`, sub: 'суммарно'},
                    {label:'Калории', value: totalCal > 0 ? totalCal.toLocaleString('ru-RU') : '—', sub: 'ккал'},
                    {label:'Ср. нагрузка', value: workouts.length ? (workouts.reduce((s,w)=>s+(w.activity_strain??0),0)/workouts.length).toFixed(1) : '—', sub: 'из 21'},
                  ].map((k, ki) => (
                    <div key={ki} style={{ padding:'14px 12px',borderRight:ki<3?'1px solid var(--border)':'none' }}>
                      <div style={{ fontSize:9,fontWeight:700,color:'var(--muted-foreground)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4 }}>{k.label}</div>
                      <div style={{ fontSize:22,fontWeight:900,color:'var(--foreground)',letterSpacing:'-0.03em',lineHeight:1 }}>{k.value}</div>
                      <div style={{ fontSize:10,color:'var(--muted-foreground)',marginTop:2 }}>{k.sub}</div>
                    </div>
                  ))}
                </div>
                {/* Workout list preview */}
                {workouts.length === 0 ? (
                  <div style={{ padding:'24px',textAlign:'center',color:'var(--muted-foreground)',fontSize:13 }}>
                    Нет тренировок за выбранный период
                  </div>
                ) : (
                  <div style={{ maxHeight:240,overflowY:'auto' }}>
                    {workouts.slice(0,20).map((w, i) => {
                      const color = ACTIVITY_COLORS[w.activity_type ?? ''] ?? '#64748B'
                      return (
                        <div key={w.id} style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 16px',borderBottom:i<workouts.length-1?'1px solid var(--border)':'none' }}>
                          <div style={{ width:6,height:6,borderRadius:'50%',background:color,flexShrink:0 }} />
                          <div style={{ flex:1,minWidth:0 }}>
                            <div style={{ fontSize:12,fontWeight:600,color:'var(--foreground)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                              {w.name ?? w.activity_type ?? 'Тренировка'}
                            </div>
                            <div style={{ fontSize:10,color:'var(--muted-foreground)' }}>
                              {[
                                w.activity_type,
                                w.activity_duration_min && fmtDuration(w.activity_duration_min),
                                w.activity_calories && `${w.activity_calories} ккал`,
                              ].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                          <div style={{ fontSize:11,color:'var(--muted-foreground)',flexShrink:0 }}>
                            {w.event_date ? fmtDateShort(w.event_date) : ''}
                          </div>
                          {w.activity_strain != null && (
                            <div style={{ fontSize:13,fontWeight:800,color:strainColor(Number(w.activity_strain)),flexShrink:0 }}>
                              {Number(w.activity_strain).toFixed(1)}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {workouts.length > 20 && (
                      <div style={{ padding:'10px 16px',fontSize:11,color:'var(--muted-foreground)',textAlign:'center' }}>
                        + ещё {workouts.length - 20} тренировок будут включены в PDF
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'16px 24px',borderTop:'1px solid var(--border)',flexShrink:0,display:'flex',flexDirection:'column',gap:10 }}>
          {workouts.length === 0 && !loading && (
            <div style={{ display:'flex',alignItems:'center',gap:8,padding:'10px 14px',borderRadius:12,background:'#FEF9C3',border:'1px solid #FDE047',fontSize:12,color:'#854D0E' }}>
              <i className="ki-filled ki-information-4 shrink-0" />
              Нет тренировок за выбранный период. Выберите другой диапазон.
            </div>
          )}
          <div style={{ display:'flex',gap:10 }}>
            <button
              onClick={handleGenerate}
              disabled={generating || loading || workouts.length === 0}
              style={{ flex:1,padding:'12px 0',borderRadius:12,border:'none',cursor:workouts.length===0?'not-allowed':'pointer',
                background:workouts.length===0?'var(--border)':'linear-gradient(135deg,#F35703,#D44A02)',
                color:workouts.length===0?'var(--muted-foreground)':'white',fontSize:14,fontWeight:700,
                display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                opacity:generating?0.7:1,transition:'all 0.15s' }}>
              {generating ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Генерация…</>
              ) : (
                <><i className="ki-filled ki-file-down text-sm" />Скачать PDF ({workouts.length} трен.)</>
              )}
            </button>
            <button onClick={handleClose}
              style={{ padding:'12px 16px',borderRadius:12,border:'1.5px solid var(--border)',background:'transparent',color:'var(--muted-foreground)',fontSize:14,fontWeight:600,cursor:'pointer' }}>
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
