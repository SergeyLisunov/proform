'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useDictation } from '@/hooks/useDictation'
import {
  listDiaryEntries, createDiaryEntry, updateDiaryEntry, deleteDiaryEntry,
  toggleShareWithAthlete, getHeatmapData,
  ENTRY_TYPE_META, RISK_LABELS, CATEGORY_LABELS, MOOD_EMOJI,
  type DiaryEntry, type DiaryEntryType, type RiskLevel, type DiaryCategory,
  type DiaryAttachment,
} from '@/services/coach-diary.service'
import { DIARY_TEMPLATES, type DiaryTemplate } from '@/lib/coach-diary/templates'
import { DiaryHeatmap } from '@/components/coach/DiaryHeatmap'
import { Card, Badge, ChartCard } from '@/components/ui/metronic'
import ApexChart from '@/components/charts/ApexChart'

type AthleteOpt = { id: string; name: string }

const ENTRY_TYPES: DiaryEntryType[] = [
  'observation', 'session_summary', 'competition_report', 'schedule', 'plan',
]
const RISK_LEVELS: RiskLevel[] = ['low', 'moderate', 'high']
const CATEGORIES:  DiaryCategory[] = ['performance', 'health', 'motivation', 'technique', 'tactical']

const MAX_ATTACH_FILES = 5
const MAX_IMG  = 10 * 1024 * 1024
const MAX_DOC  = 20 * 1024 * 1024

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function weekAgoISO() {
  const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10)
}
function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'short', weekday: 'short',
  })
}
function fmtSize(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} КБ`
  return `${(b / 1024 / 1024).toFixed(1)} МБ`
}

function useCoachAthletesLocal(coachId: string | null) {
  const [athletes, setAthletes] = useState<AthleteOpt[]>([])
  useEffect(() => {
    if (!coachId) return
    const sb = createClient()
    ;(async () => {
      const { data: linksRaw } = await sb
        .from('trainer_athletes')
        .select('athlete_id')
        .eq('trainer_id', coachId)
        .eq('status', 'accepted')
      const ids = ((linksRaw ?? []) as Array<{ athlete_id: string }>).map(l => l.athlete_id)
      if (ids.length === 0) { setAthletes([]); return }
      const { data: users } = await sb.from('users').select('id, name').in('id', ids)
      setAthletes(((users ?? []) as Array<{ id: string; name: string | null }>)
        .map(u => ({ id: u.id, name: u.name ?? '—' })))
    })()
  }, [coachId])
  return athletes
}

// ════════════════════════════════════════════════════════════════════════
//  Main component
// ════════════════════════════════════════════════════════════════════════

export default function CoachDiaryClient({ coachId }: { coachId: string }) {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [heatmap, setHeatmap] = useState<Record<string, number>>({})

  const [typeFilter,     setTypeFilter]     = useState<DiaryEntryType | 'all'>('all')
  const [riskFilter,     setRiskFilter]     = useState<RiskLevel | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<DiaryCategory | 'all'>('all')
  const [athleteFilter,  setAthleteFilter]  = useState<string | 'all'>('all')

  const [editing,  setEditing]  = useState<DiaryEntry | null>(null)
  const [creating, setCreating] = useState(false)
  const [template, setTemplate] = useState<DiaryTemplate | null>(null)

  const [aiOpen,   setAiOpen]   = useState(false)

  const [dragOverType, setDragOverType] = useState<DiaryEntryType | null>(null)

  const athletes = useCoachAthletesLocal(coachId)
  const athleteById = useMemo(() => {
    const m = new Map<string, string>()
    for (const a of athletes) m.set(a.id, a.name)
    return m
  }, [athletes])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, heat] = await Promise.all([
        listDiaryEntries({
          coachId,
          entryType:  typeFilter,
          riskLevel:  riskFilter,
          category:   categoryFilter,
          athleteId:  athleteFilter === 'all' ? undefined : athleteFilter,
        }),
        getHeatmapData(coachId, 12),
      ])
      setEntries(list)
      setHeatmap(heat)
    } finally { setLoading(false) }
  }, [coachId, typeFilter, riskFilter, categoryFilter, athleteFilter])

  useEffect(() => { load() }, [load])

  const counts = useMemo(() => {
    const byType: Record<DiaryEntryType, number> = {
      observation: 0, session_summary: 0, competition_report: 0, schedule: 0, plan: 0,
    }
    let high = 0, moderate = 0, low = 0
    const today = todayISO()
    let upcoming = 0
    for (const e of entries) {
      byType[e.entry_type]++
      if (e.risk_level === 'high' || e.risk_level === 'critical') high++
      else if (e.risk_level === 'moderate') moderate++
      else if (e.risk_level === 'low') low++
      if (e.entry_type === 'schedule' && e.date >= today) upcoming++
    }
    return { byType, high, moderate, low, upcoming, total: entries.length }
  }, [entries])

  /** Drag-drop: пользователь перетащил карточку на тип → меняем entry_type. */
  const handleTypeDrop = async (newType: DiaryEntryType, entryId: string) => {
    setDragOverType(null)
    const entry = entries.find(e => e.id === entryId)
    if (!entry || entry.entry_type === newType) return
    await updateDiaryEntry(entryId, { entry_type: newType })
    load()
  }

  const pdfHref = `/diary/export?from=${weekAgoISO()}&to=${todayISO()}${athleteFilter !== 'all' ? `&athlete=${athleteFilter}` : ''}`

  return (
    <div className="flex flex-col gap-5 pf-enter">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-[#FED7AA] bg-gradient-to-br from-[#FFF7ED] via-white to-[#EFF6FF] p-6 md:p-8">
        <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-orange-200/40 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FED7AA] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#EA580C]">
              <i className="ki-filled ki-notepad-edit text-[11px]" />
              Рабочий журнал
            </span>
            <h1 className="pf-num text-3xl md:text-4xl leading-tight text-foreground mt-2">Дневник тренера</h1>
            <p className="max-w-2xl text-sm md:text-base text-muted-foreground mt-1">
              Наблюдения, разборы, соревнования и планирование. Голосовой ввод, шаблоны,
              автосинк с календарём и AI-обзор недели.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setAiOpen(true)}
              className="rounded-xl border border-purple-200 bg-purple-50 text-purple-700 px-4 py-2.5 text-sm font-semibold hover:bg-purple-100">
              <i className="ki-filled ki-lots-shining text-xs mr-1" />
              Обзор недели (AI)
            </button>
            <Link href={pdfHref} target="_blank"
              className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-muted">
              <i className="ki-filled ki-printer text-xs mr-1" />
              Экспорт PDF
            </Link>
            <button onClick={() => { setCreating(true); setEditing(null); setTemplate(null) }}
              className="rounded-xl bg-orange-500 text-white px-5 py-2.5 text-sm font-semibold hover:bg-orange-600">
              <i className="ki-filled ki-plus text-xs mr-1" />
              Новая запись
            </button>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <DiaryHeatmap data={heatmap} weeks={12} />

      {/* Stat tiles (also drop targets for drag-drop type change) */}
      <div className="grid grid-cols-2 xl:grid-cols-6 gap-2">
        {ENTRY_TYPES.map(t => {
          const meta = ENTRY_TYPE_META[t]
          const active = typeFilter === t
          const hot = dragOverType === t
          return (
            <button key={t}
              onClick={() => setTypeFilter(active ? 'all' : t)}
              onDragOver={e => { e.preventDefault(); setDragOverType(t) }}
              onDragLeave={() => setDragOverType(prev => prev === t ? null : prev)}
              onDrop={e => {
                e.preventDefault()
                const id = e.dataTransfer.getData('text/plain')
                if (id) handleTypeDrop(t, id)
              }}
              className={`rounded-xl border p-3 text-left transition-all ${active ? 'ring-2 ring-offset-1' : hot ? 'scale-105' : 'hover:-translate-y-0.5 hover:shadow-sm'}`}
              style={{
                borderColor: hot ? meta.color : meta.border,
                background: hot ? meta.bg : meta.bg,
                borderWidth: hot ? 2 : 1,
                ...(active ? { boxShadow: `0 0 0 2px ${meta.color}` } : {}),
              }}>
              <div className="flex items-center gap-2">
                <i className={`ki-filled ${meta.icon} text-lg`} style={{ color: meta.color }} />
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: meta.color }}>
                  {meta.label}
                </span>
              </div>
              <div className="pf-num text-2xl mt-1" style={{ color: meta.color }}>{counts.byType[t]}</div>
            </button>
          )
        })}
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <i className="ki-filled ki-calendar-tick text-lg text-muted-foreground" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Впереди</span>
          </div>
          <div className="pf-num text-2xl mt-1 text-foreground">{counts.upcoming}</div>
        </Card>
      </div>

      {/* Entry-type distribution — derived from counts already in scope */}
      {counts.total > 0 && (
        <ChartCard title="Записи по типам" subtitle={`Всего ${counts.total} за текущий фильтр`}>
          <ApexChart
            type="bar"
            options={{
              chart: { type: 'bar' as const, toolbar: { show: false }, animations: { enabled: true, speed: 500 } },
              colors: ENTRY_TYPES.map(t => ENTRY_TYPE_META[t].color),
              plotOptions: { bar: { borderRadius: 4, columnWidth: '55%', distributed: true } },
              grid: { borderColor: '#F1F5F9', strokeDashArray: 3 },
              dataLabels: { enabled: false },
              legend: { show: false },
              stroke: { show: false },
              xaxis: {
                categories: ENTRY_TYPES.map(t => ENTRY_TYPE_META[t].label),
                labels: { style: { fontSize: '10px', colors: '#94A3B8' } },
                axisBorder: { show: false }, axisTicks: { show: false },
              },
              yaxis: { labels: { style: { fontSize: '10px', colors: '#94A3B8' } } },
              tooltip: { theme: 'light' },
            }}
            series={[{ name: 'Записей', data: ENTRY_TYPES.map(t => counts.byType[t]) }]}
            height={200}
            width="100%"
          />
        </ChartCard>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap rounded-xl bg-muted/20 border border-border p-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Риск:</span>
        <FilterPill active={riskFilter === 'all'} onClick={() => setRiskFilter('all')}>Все</FilterPill>
        {RISK_LEVELS.map(r => (
          <FilterPill key={r}
            active={riskFilter === r}
            color={RISK_LABELS[r].color}
            bg={RISK_LABELS[r].bg}
            border={RISK_LABELS[r].border}
            onClick={() => setRiskFilter(riskFilter === r ? 'all' : r)}>
            {RISK_LABELS[r].ru}
          </FilterPill>
        ))}

        <div className="mx-2 h-4 w-px bg-border" />

        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Категория:</span>
        <FilterPill active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>Все</FilterPill>
        {CATEGORIES.map(c => (
          <FilterPill key={c}
            active={categoryFilter === c}
            onClick={() => setCategoryFilter(categoryFilter === c ? 'all' : c)}>
            {CATEGORY_LABELS[c]}
          </FilterPill>
        ))}

        {athletes.length > 0 && (
          <>
            <div className="mx-2 h-4 w-px bg-border" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Атлет:</span>
            <select value={athleteFilter}
              onChange={e => setAthleteFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-1 text-xs">
              <option value="all">Все</option>
              {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </>
        )}
      </div>

      {/* Timeline list */}
      <div className="flex flex-col gap-3">
        {loading && entries.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-xs text-muted-foreground">
            Загрузка журнала…
          </div>
        ) : entries.length === 0 ? (
          <EmptyState onCreate={() => { setCreating(true); setEditing(null); setTemplate(null) }} />
        ) : (
          entries.map(e => (
            <EntryCard key={e.id} entry={e}
              athleteName={e.athlete_id ? athleteById.get(e.athlete_id) ?? '—' : null}
              onEdit={() => { setEditing(e); setCreating(false); setTemplate(null) }}
              onToggleShare={async () => {
                await toggleShareWithAthlete(e.id, !e.is_shared_with_athlete)
                load()
              }}
              onDelete={async () => {
                if (!confirm('Удалить запись? Связанное событие в календаре тоже удалится.')) return
                await deleteDiaryEntry(e.id)
                load()
              }}
            />
          ))
        )}
      </div>

      {(creating || editing) && (
        <EntryDrawer
          coachId={coachId}
          athletes={athletes}
          initial={editing}
          initialTemplate={template}
          onPickTemplate={setTemplate}
          onClose={() => { setCreating(false); setEditing(null); setTemplate(null) }}
          onSaved={() => { setCreating(false); setEditing(null); setTemplate(null); load() }}
        />
      )}

      {aiOpen && <AiWeeklySummaryModal onClose={() => setAiOpen(false)} />}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════

function FilterPill({
  active, onClick, color, bg, border, children,
}: {
  active: boolean
  onClick: () => void
  color?: string
  bg?: string
  border?: string
  children: React.ReactNode
}) {
  const style = active && bg && border && color
    ? { background: bg, color, borderColor: border }
    : undefined
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
        active ? (style ? '' : 'bg-orange-50 border-orange-200 text-orange-600')
               : 'bg-card border-border text-muted-foreground hover:border-orange-200'
      }`}
      style={style}>
      {children}
    </button>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-card/40 p-12 text-center">
      <i className="ki-filled ki-notepad-edit text-5xl text-muted-foreground/40 block mb-3" />
      <h3 className="text-base font-semibold text-foreground">Пока нет записей</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        Начните вести журнал — наблюдения, разборы, планы.
      </p>
      <button onClick={onCreate}
        className="rounded-xl bg-orange-500 text-white px-5 py-2.5 text-sm font-semibold hover:bg-orange-600">
        Первая запись →
      </button>
    </div>
  )
}

function EntryCard({
  entry, athleteName, onEdit, onDelete, onToggleShare,
}: {
  entry: DiaryEntry
  athleteName: string | null
  onEdit: () => void
  onDelete: () => void
  onToggleShare: () => void
}) {
  const meta = ENTRY_TYPE_META[entry.entry_type]
  const risk = entry.risk_level && entry.risk_level !== 'critical' ? RISK_LABELS[entry.risk_level] : null

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', entry.id) }}
      className="bg-card border border-border rounded-xl p-5 hover:border-orange-200 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing"
      title="Перетащите на плитку типа, чтобы изменить тип записи">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
          <i className={`ki-filled ${meta.icon} text-lg`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">
              {entry.title || meta.label}
            </span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
              {meta.label}
            </span>
            {risk && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: risk.bg, color: risk.color, border: `1px solid ${risk.border}` }}>
                {risk.ru}
              </span>
            )}
            {entry.category && (
              <Badge variant="secondary" size="sm">
                {CATEGORY_LABELS[entry.category]}
              </Badge>
            )}
            {entry.calendar_event_id && (
              <Link href="/calendar"
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200 inline-flex items-center gap-1 hover:bg-green-100">
                <i className="ki-filled ki-calendar-tick text-[10px]" />
                В календаре
              </Link>
            )}
            {entry.is_shared_with_athlete && (
              <Badge variant="info" size="sm">
                <i className="ki-filled ki-eye text-[10px]" />
                Видит атлет
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {fmtDate(entry.date)}
            {athleteName ? ` · ${athleteName}` : ''}
            {entry.mood ? ` · ${MOOD_EMOJI[entry.mood - 1]}` : ''}
            {entry.energy_level ? ` · энергия ${entry.energy_level}/10` : ''}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {entry.athlete_id && (
            <button onClick={onToggleShare}
              className="kt-btn kt-btn-xs kt-btn-icon kt-btn-ghost"
              title={entry.is_shared_with_athlete ? 'Скрыть от атлета' : 'Поделиться с атлетом'}>
              <i className={`ki-filled ${entry.is_shared_with_athlete ? 'ki-eye' : 'ki-eye-slash'} text-xs ${entry.is_shared_with_athlete ? 'text-blue-500' : 'text-muted-foreground'}`} />
            </button>
          )}
          <button onClick={onEdit} className="kt-btn kt-btn-xs kt-btn-icon kt-btn-ghost" title="Редактировать">
            <i className="ki-filled ki-pencil text-xs text-muted-foreground" />
          </button>
          <button onClick={onDelete} className="kt-btn kt-btn-xs kt-btn-icon kt-btn-ghost hover:!bg-red-50" title="Удалить">
            <i className="ki-filled ki-trash text-xs text-red-500" />
          </button>
        </div>
      </div>

      <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
        {entry.note}
      </p>

      {entry.entry_type === 'session_summary' && entry.session_data && (
        <MetricsRow items={[
          entry.session_data.duration_min ? { label: 'Длительность',  value: `${entry.session_data.duration_min} мин` } : null,
          entry.session_data.intensity    ? { label: 'Интенсивность', value: intensityRu(entry.session_data.intensity) } : null,
          entry.session_data.load_score   ? { label: 'RPE нагрузка',  value: `${entry.session_data.load_score}/10` } : null,
          entry.session_data.location     ? { label: 'Место',         value: entry.session_data.location } : null,
        ]} />
      )}
      {entry.entry_type === 'competition_report' && entry.competition_data && (
        <MetricsRow items={[
          entry.competition_data.event_name          ? { label: 'Соревнование',    value: entry.competition_data.event_name } : null,
          entry.competition_data.placement != null   ? { label: 'Место',           value: String(entry.competition_data.placement) } : null,
          entry.competition_data.result              ? { label: 'Результат',       value: entry.competition_data.result } : null,
          entry.competition_data.total_participants  ? { label: 'Участников',      value: String(entry.competition_data.total_participants) } : null,
        ]} />
      )}
      {entry.entry_type === 'schedule' && entry.schedule_data && (
        <MetricsRow items={[
          entry.schedule_data.start_time    ? { label: 'Начало',       value: entry.schedule_data.start_time } : null,
          entry.schedule_data.end_time      ? { label: 'Конец',        value: entry.schedule_data.end_time } : null,
          entry.schedule_data.duration_min  ? { label: 'Длительность', value: `${entry.schedule_data.duration_min} мин` } : null,
          entry.schedule_data.location      ? { label: 'Место',        value: entry.schedule_data.location } : null,
          entry.schedule_data.activity_type ? { label: 'Тип',          value: entry.schedule_data.activity_type } : null,
        ]} />
      )}
      {entry.session_data?.key_metrics && (
        <div className="mt-3 rounded-lg bg-muted/30 border border-border px-3 py-2 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap">
          {entry.session_data.key_metrics}
        </div>
      )}

      {entry.attachments && entry.attachments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {entry.attachments.map((att, i) => (
            <a key={i} href={att.url} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 hover:border-orange-300 hover:bg-orange-50 transition-colors"
              title={att.name}>
              <i className={`ki-filled ${att.type === 'image' ? 'ki-picture' : 'ki-document'} text-muted-foreground text-sm shrink-0`} />
              <div className="min-w-0">
                <div className="text-[11px] text-foreground truncate max-w-[160px]">{att.name}</div>
                <div className="text-[10px] text-muted-foreground">{fmtSize(att.size)}</div>
              </div>
            </a>
          ))}
        </div>
      )}

      {entry.tags && entry.tags.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          {entry.tags.map(t => (
            <Badge key={t} variant="secondary" size="sm" className="font-medium">
              #{t}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function MetricsRow({ items }: { items: Array<{ label: string; value: string } | null> }) {
  const real = items.filter(Boolean) as Array<{ label: string; value: string }>
  if (real.length === 0) return null
  return (
    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
      {real.map(it => (
        <div key={it.label} className="rounded-lg bg-muted/30 border border-border px-3 py-2">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{it.label}</div>
          <div className="text-sm font-semibold text-foreground truncate">{it.value}</div>
        </div>
      ))}
    </div>
  )
}

function intensityRu(i: 'low' | 'moderate' | 'high' | 'max'): string {
  return { low: 'Лёгкая', moderate: 'Средняя', high: 'Высокая', max: 'Максимум' }[i]
}

// ════════════════════════════════════════════════════════════════════════
//  AI weekly-summary modal
// ════════════════════════════════════════════════════════════════════════

interface AthleteSummary {
  athlete_id: string
  athlete_name: string
  summary: string
  highlights: string[]
  concerns: string[]
  focus_next: string
  entries_count: number
}
interface WeekSummary {
  overview: string
  athletes: AthleteSummary[]
  team_focus: string
}

function AiWeeklySummaryModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [data, setData]       = useState<WeekSummary | null>(null)
  const [days, setDays]       = useState(7)

  const run = useCallback(async (d: number) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/diary/weekly-summary?days=${d}`)
      const json = await res.json()
      if (!json.ok) { setError(json.error ?? 'AI_ERROR'); setLoading(false); return }
      setData(json.data as WeekSummary)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { run(days) }, [run, days])

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 py-12 overflow-y-auto" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div onClick={e => e.stopPropagation()}
        className="relative z-10 w-full max-w-3xl rounded-2xl bg-background shadow-2xl border border-purple-200">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-purple-700">AI · Claude</p>
            <h3 className="text-lg font-semibold text-foreground">Обзор за {days} дней</h3>
          </div>
          <div className="flex items-center gap-2">
            <select value={days} onChange={e => setDays(Number(e.target.value))}
              className="rounded-lg border border-border bg-background px-2 py-1 text-xs">
              <option value={7}>7 дней</option>
              <option value={14}>14 дней</option>
              <option value={30}>30 дней</option>
            </select>
            <button onClick={onClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
              <i className="ki-filled ki-cross text-xs" />
            </button>
          </div>
        </div>

        <div className="px-5 py-5 space-y-4">
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full pf-spin mx-auto mb-3" />
              Claude анализирует ваши записи…
            </div>
          ) : error ? (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
              Ошибка: {error === 'AI_NOT_CONFIGURED'
                ? 'AI не настроен (ANTHROPIC_API_KEY не задан)'
                : error === 'COACH_ONLY'
                ? 'Доступно только тренерам'
                : error}
            </div>
          ) : data ? (
            <>
              <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-700 mb-1">
                  Общий обзор
                </div>
                <p className="text-sm text-foreground leading-relaxed">{data.overview}</p>
              </div>

              {data.athletes.length > 0 && (
                <div className="space-y-3">
                  {data.athletes.map(a => (
                    <div key={a.athlete_id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-foreground">{a.athlete_name}</div>
                        <span className="text-[10px] text-muted-foreground">{a.entries_count} записей</span>
                      </div>
                      <p className="text-sm text-foreground/85 mb-3 leading-relaxed">{a.summary}</p>
                      {a.highlights.length > 0 && (
                        <div className="mb-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-green-700 mb-1">Победы</p>
                          <ul className="text-xs text-foreground/80 space-y-0.5 pl-4 list-disc marker:text-green-500">
                            {a.highlights.map((h, i) => <li key={i}>{h}</li>)}
                          </ul>
                        </div>
                      )}
                      {a.concerns.length > 0 && (
                        <div className="mb-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-red-700 mb-1">Риски</p>
                          <ul className="text-xs text-foreground/80 space-y-0.5 pl-4 list-disc marker:text-red-500">
                            {a.concerns.map((h, i) => <li key={i}>{h}</li>)}
                          </ul>
                        </div>
                      )}
                      <div className="rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 mt-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-700">Фокус</p>
                        <p className="text-xs text-foreground/85 mt-0.5">{a.focus_next}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-700 mb-1">
                  Общий акцент на следующую неделю
                </div>
                <p className="text-sm font-semibold text-foreground">{data.team_focus}</p>
              </div>
            </>
          ) : null}
        </div>

        <div className="border-t border-border px-5 py-3 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            AI-обзор — подсказка, не замена вашему профессиональному суждению.
          </span>
          <button onClick={onClose}
            className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 text-sm font-semibold">
            Понял
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
//  Drawer form (с шаблонами, голосовым вводом, шэрингом, вложениями)
// ════════════════════════════════════════════════════════════════════════

function EntryDrawer({
  coachId, athletes, initial, initialTemplate, onPickTemplate, onClose, onSaved,
}: {
  coachId: string
  athletes: AthleteOpt[]
  initial: DiaryEntry | null
  initialTemplate: DiaryTemplate | null
  onPickTemplate: (t: DiaryTemplate | null) => void
  onClose: () => void
  onSaved: () => void
}) {
  // Apply template overlay on first mount if no `initial`.
  const tpl = !initial && initialTemplate ? initialTemplate : null

  const [type, setType] = useState<DiaryEntryType>(initial?.entry_type ?? tpl?.entry_type ?? 'observation')
  const [athleteId, setAthleteId] = useState<string>(initial?.athlete_id ?? '')
  const [date, setDate] = useState<string>(initial?.date ?? todayISO())
  const [title, setTitle] = useState<string>(initial?.title ?? tpl?.title ?? '')
  const [note, setNote]   = useState<string>(initial?.note ?? tpl?.note ?? '')
  const [tagsInput, setTagsInput] = useState<string>((initial?.tags ?? tpl?.tags ?? []).join(', '))
  const [riskLevel, setRiskLevel] = useState<RiskLevel | ''>(initial?.risk_level ?? tpl?.risk_level ?? '')
  const [category,  setCategory]  = useState<DiaryCategory | ''>(initial?.category ?? tpl?.category ?? '')
  const [mood,       setMood]       = useState<number | ''>(initial?.mood ?? '')
  const [energy,     setEnergy]     = useState<number | ''>(initial?.energy_level ?? '')
  const [shared,     setShared]     = useState<boolean>(initial?.is_shared_with_athlete ?? false)
  const [attachments, setAttachments] = useState<DiaryAttachment[]>(initial?.attachments ?? [])
  const [uploadErr,   setUploadErr]   = useState<string | null>(null)
  const [uploading,   setUploading]   = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Session-summary fields
  const [sessDuration,  setSessDuration]  = useState<number | ''>(initial?.session_data?.duration_min ?? tpl?.session_data?.duration_min ?? '')
  const [sessIntensity, setSessIntensity] = useState<'' | 'low' | 'moderate' | 'high' | 'max'>(initial?.session_data?.intensity ?? tpl?.session_data?.intensity ?? '')
  const [sessLoad,      setSessLoad]      = useState<number | ''>(initial?.session_data?.load_score ?? tpl?.session_data?.load_score ?? '')
  const [sessKey,       setSessKey]       = useState<string>(initial?.session_data?.key_metrics ?? tpl?.session_data?.key_metrics ?? '')
  const [sessLoc,       setSessLoc]       = useState<string>(initial?.session_data?.location ?? tpl?.session_data?.location ?? '')

  // Competition fields
  const [compEvent,  setCompEvent]  = useState<string>(initial?.competition_data?.event_name ?? tpl?.competition_data?.event_name ?? '')
  const [compPlace,  setCompPlace]  = useState<string>(String(initial?.competition_data?.placement ?? tpl?.competition_data?.placement ?? ''))
  const [compResult, setCompResult] = useState<string>(initial?.competition_data?.result ?? tpl?.competition_data?.result ?? '')
  const [compTotal,  setCompTotal]  = useState<number | ''>(initial?.competition_data?.total_participants ?? '')

  // Schedule fields
  const [schStart,    setSchStart]    = useState<string>(initial?.schedule_data?.start_time ?? tpl?.schedule_data?.start_time ?? '')
  const [schEnd,      setSchEnd]      = useState<string>(initial?.schedule_data?.end_time ?? '')
  const [schDuration, setSchDuration] = useState<number | ''>(initial?.schedule_data?.duration_min ?? tpl?.schedule_data?.duration_min ?? '')
  const [schLoc,      setSchLoc]      = useState<string>(initial?.schedule_data?.location ?? '')
  const [schActivity, setSchActivity] = useState<string>(initial?.schedule_data?.activity_type ?? '')

  const [saving, setSaving] = useState(false)
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVisible(true), 10); return () => clearTimeout(t) }, [])
  const handleClose = () => { setVisible(false); setTimeout(onClose, 200) }

  // Voice dictation — appends to the note.
  const dict = useDictation({ lang: 'ru-RU' })
  const toggleDictation = () => {
    if (dict.state === 'listening') {
      dict.stop()
    } else {
      dict.start(text => setNote(prev => (prev ? prev + ' ' : '') + text))
    }
  }

  // Attachment upload via note-attachments bucket.
  const handleFilePick = async (files: FileList) => {
    setUploadErr(null)
    const remaining = MAX_ATTACH_FILES - attachments.length
    if (remaining <= 0) { setUploadErr(`Максимум ${MAX_ATTACH_FILES} файлов`); return }
    const toUpload = Array.from(files).slice(0, remaining)
    setUploading(true)
    try {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { setUploadErr('Не авторизован'); setUploading(false); return }
      const results: DiaryAttachment[] = []
      for (const f of toUpload) {
        const isImage = /^image\//.test(f.type)
        const maxSize = isImage ? MAX_IMG : MAX_DOC
        if (f.size > maxSize) { setUploadErr(`${f.name}: слишком большой (${fmtSize(f.size)})`); continue }
        const ext = f.name.split('.').pop() ?? 'bin'
        const path = `${user.id}/diary/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await sb.storage.from('note-attachments').upload(path, f, { upsert: false })
        if (upErr) { setUploadErr(upErr.message); continue }
        const { data: { publicUrl } } = sb.storage.from('note-attachments').getPublicUrl(path)
        results.push({
          name: f.name,
          url: publicUrl,
          type: isImage ? 'image' : 'document',
          size: f.size,
          mimeType: f.type,
        })
      }
      setAttachments(prev => [...prev, ...results])
    } finally { setUploading(false) }
  }

  const handleSave = async () => {
    if (!note.trim()) return
    setSaving(true)
    const tags = tagsInput
      .split(/[,\n]/).map(t => t.trim().replace(/^#/, '')).filter(Boolean)

    const payload = {
      coach_id:   coachId,
      athlete_id: athleteId || null,
      date,
      entry_type: type,
      title:      title || null,
      note,
      tags:       tags.length > 0 ? tags : null,
      risk_level: riskLevel || null,
      category:   category || null,
      mood:       typeof mood === 'number' ? mood : null,
      energy_level: typeof energy === 'number' ? energy : null,
      is_shared_with_athlete: shared,
      attachments: attachments.length > 0 ? attachments : null,
      session_data: type === 'session_summary' ? {
        duration_min: typeof sessDuration === 'number' ? sessDuration : undefined,
        intensity:    sessIntensity || undefined,
        load_score:   typeof sessLoad === 'number' ? sessLoad : undefined,
        key_metrics:  sessKey.trim() || undefined,
        location:     sessLoc.trim() || undefined,
      } : null,
      competition_data: type === 'competition_report' ? {
        event_name:         compEvent.trim() || undefined,
        placement:          compPlace.trim() ? (isNaN(Number(compPlace)) ? compPlace : Number(compPlace)) : undefined,
        result:             compResult.trim() || undefined,
        total_participants: typeof compTotal === 'number' ? compTotal : undefined,
      } : null,
      schedule_data: type === 'schedule' ? {
        start_time:    schStart || undefined,
        end_time:      schEnd   || undefined,
        duration_min:  typeof schDuration === 'number' ? schDuration : undefined,
        location:      schLoc.trim() || undefined,
        activity_type: schActivity.trim() || undefined,
      } : null,
    }

    if (initial) {
      await updateDiaryEntry(initial.id, payload as any)
    } else {
      await createDiaryEntry(payload as any)
    }
    setSaving(false)
    onSaved()
  }

  const meta = ENTRY_TYPE_META[type]

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" onClick={handleClose}>
      <div className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity ${visible ? 'opacity-100' : 'opacity-0'}`} />
      <div onClick={e => e.stopPropagation()}
        className={`relative z-10 h-full w-full max-w-[560px] bg-background shadow-2xl flex flex-col transition-transform duration-200 ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: meta.color }}>
              {meta.label}
            </p>
            <h3 className="text-lg font-semibold text-foreground">
              {initial ? 'Редактировать запись' : 'Новая запись в дневник'}
            </h3>
          </div>
          <button onClick={handleClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
            <i className="ki-filled ki-cross text-xs" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Templates */}
          {!initial && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Шаблоны — быстрый старт
              </label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {DIARY_TEMPLATES.map(t => (
                  <button key={t.id} type="button"
                    onClick={() => onPickTemplate(t)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium hover:border-orange-300 hover:bg-orange-50 transition-colors"
                    title={t.description}>
                    <i className={`ki-filled ${t.icon} text-[11px] text-muted-foreground`} />
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Type selector */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Тип записи</label>
            <div className="mt-1 grid grid-cols-5 gap-1.5">
              {ENTRY_TYPES.map(t => {
                const m = ENTRY_TYPE_META[t]
                const on = type === t
                return (
                  <button key={t} type="button" onClick={() => setType(t)}
                    className={`rounded-lg border p-2 text-center transition-all ${on ? 'ring-2 ring-offset-1' : 'hover:-translate-y-0.5'}`}
                    style={{ background: on ? m.bg : 'transparent', borderColor: m.border, color: m.color, ...(on ? { boxShadow: `0 0 0 2px ${m.color}` } : {}) }}>
                    <i className={`ki-filled ${m.icon} text-base`} />
                    <div className="text-[10px] font-semibold mt-1 leading-tight">{m.label}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Атлет</label>
              <select value={athleteId} onChange={e => setAthleteId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="">— без атлета —</option>
                {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Дата</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Заголовок</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Короткая тема"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>

          {/* Note with mic */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Запись</label>
              {dict.supported && (
                <button type="button" onClick={toggleDictation}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold border transition-all ${
                    dict.state === 'listening'
                      ? 'border-red-400 bg-red-50 text-red-600 animate-pulse'
                      : 'border-border bg-background text-muted-foreground hover:border-orange-300 hover:text-orange-600'
                  }`}
                  title={dict.state === 'listening' ? 'Остановить запись' : 'Диктовать запись'}>
                  <i className={`ki-filled ${dict.state === 'listening' ? 'ki-microphone-2' : 'ki-microphone'} text-xs`} />
                  {dict.state === 'listening' ? 'Слушаю…' : 'Диктовать'}
                </button>
              )}
            </div>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={6}
              placeholder="Свободно пишите или нажмите микрофон для диктовки"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none" />
            {dict.interim && (
              <div className="mt-1 text-[11px] text-muted-foreground italic">… {dict.interim}</div>
            )}
            {dict.error && (
              <div className="mt-1 text-[11px] text-red-500">Диктовка: {dict.error}</div>
            )}
            {!dict.supported && (
              <div className="mt-1 text-[10px] text-muted-foreground">
                Голосовой ввод доступен в Chrome / Edge / Safari (пока не поддержан вашим браузером).
              </div>
            )}
          </div>

          {/* State indicators */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Настроение атлета</label>
              <div className="mt-1 flex gap-1">
                {MOOD_EMOJI.map((emoji, i) => (
                  <button key={i} type="button"
                    onClick={() => setMood(mood === i + 1 ? '' : i + 1)}
                    className={`w-9 h-9 rounded-lg border text-lg transition-all ${mood === i + 1 ? 'border-orange-400 bg-orange-50 scale-110' : 'border-border bg-background hover:border-orange-200'}`}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Уровень энергии{typeof energy === 'number' ? ` — ${energy}/10` : ''}
              </label>
              <input type="range" min={0} max={10} step={1}
                value={typeof energy === 'number' ? energy : 0}
                onChange={e => setEnergy(e.target.value === '0' ? '' : Number(e.target.value))}
                className="mt-3 w-full accent-orange-500" />
            </div>
          </div>

          {/* Risk + category for subjective types */}
          {(type === 'observation' || type === 'session_summary' || type === 'competition_report') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Риск</label>
                <div className="mt-1 grid grid-cols-3 gap-1">
                  {RISK_LEVELS.map(r => (
                    <button key={r} type="button" onClick={() => setRiskLevel(riskLevel === r ? '' : r)}
                      className={`px-2 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${riskLevel === r ? '' : 'bg-background text-muted-foreground border-border hover:border-orange-200'}`}
                      style={riskLevel === r ? { background: RISK_LABELS[r].bg, color: RISK_LABELS[r].color, borderColor: RISK_LABELS[r].border } : undefined}>
                      {RISK_LABELS[r].ru.replace(' риск', '')}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Категория</label>
                <select value={category} onChange={e => setCategory(e.target.value as DiaryCategory | '')}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="">—</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Session data */}
          {type === 'session_summary' && (
            <div className="rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/60 p-3 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C2410C]">Детали тренировки</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Длительность, мин</label>
                  <input type="number" min={0} value={sessDuration}
                    onChange={e => setSessDuration(e.target.value === '' ? '' : Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Интенсивность</label>
                  <select value={sessIntensity} onChange={e => setSessIntensity(e.target.value as any)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm">
                    <option value="">—</option>
                    <option value="low">Лёгкая</option>
                    <option value="moderate">Средняя</option>
                    <option value="high">Высокая</option>
                    <option value="max">Максимум</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">RPE, 1–10</label>
                  <input type="number" min={0} max={10} value={sessLoad}
                    onChange={e => setSessLoad(e.target.value === '' ? '' : Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Место</label>
                <input value={sessLoc} onChange={e => setSessLoc(e.target.value)}
                  placeholder="Стадион, зал, бассейн…"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Ключевые показатели</label>
                <textarea value={sessKey} onChange={e => setSessKey(e.target.value)} rows={2}
                  placeholder="Напр. 5×1000 @3:45, средний пульс 168, лактат 4.2"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-mono resize-none" />
              </div>
            </div>
          )}

          {/* Competition data */}
          {type === 'competition_report' && (
            <div className="rounded-xl border border-[#E9D5FF] bg-[#FAF5FF]/60 p-3 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7C3AED]">Детали соревнования</p>
              <div>
                <label className="text-[10px] text-muted-foreground">Название</label>
                <input value={compEvent} onChange={e => setCompEvent(e.target.value)}
                  placeholder="Зимний кубок региона"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Место</label>
                  <input value={compPlace} onChange={e => setCompPlace(e.target.value)}
                    placeholder="3 / 1 / PB"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Участников</label>
                  <input type="number" min={0} value={compTotal}
                    onChange={e => setCompTotal(e.target.value === '' ? '' : Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Результат</label>
                  <input value={compResult} onChange={e => setCompResult(e.target.value)}
                    placeholder="42:15 / 185 кг"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                </div>
              </div>
            </div>
          )}

          {/* Schedule data */}
          {type === 'schedule' && (
            <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4]/60 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <i className="ki-filled ki-calendar-tick text-[#16A34A]" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#15803D]">
                  Попадает в календарь автоматически
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Начало</label>
                  <input type="time" value={schStart} onChange={e => setSchStart(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Конец</label>
                  <input type="time" value={schEnd} onChange={e => setSchEnd(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Мин</label>
                  <input type="number" min={0} value={schDuration}
                    onChange={e => setSchDuration(e.target.value === '' ? '' : Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Место</label>
                  <input value={schLoc} onChange={e => setSchLoc(e.target.value)}
                    placeholder="Где проводим"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Тип активности</label>
                  <input value={schActivity} onChange={e => setSchActivity(e.target.value)}
                    placeholder="Бег, силовая, техника…"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                </div>
              </div>
            </div>
          )}

          {/* Attachments */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Вложения · {attachments.length}/{MAX_ATTACH_FILES}
            </label>
            <div className="mt-1 flex flex-wrap gap-2 items-center">
              {attachments.map((att, i) => (
                <div key={i} className="relative group">
                  {att.type === 'image' ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={att.url} alt={att.name}
                      className="w-16 h-16 rounded-lg object-cover border border-border" />
                  ) : (
                    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 max-w-[180px]">
                      <i className="ki-filled ki-document text-muted-foreground text-sm" />
                      <div className="min-w-0">
                        <div className="text-[11px] truncate">{att.name}</div>
                        <div className="text-[10px] text-muted-foreground">{fmtSize(att.size)}</div>
                      </div>
                    </div>
                  )}
                  <button type="button"
                    onClick={() => setAttachments(prev => prev.filter((_, x) => x !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-foreground/85 text-background rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <i className="ki-filled ki-cross text-[9px]" />
                  </button>
                </div>
              ))}
              <button type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || attachments.length >= MAX_ATTACH_FILES}
                className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-orange-300 hover:text-orange-500 disabled:opacity-40 disabled:cursor-not-allowed">
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <i className="ki-filled ki-paper-clip text-base" />
                )}
              </button>
              <input ref={fileInputRef} type="file" multiple className="hidden"
                accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.txt"
                onChange={e => { if (e.target.files?.length) handleFilePick(e.target.files); e.target.value = '' }} />
            </div>
            {uploadErr && <p className="mt-1 text-[11px] text-red-500">{uploadErr}</p>}
          </div>

          {/* Share toggle */}
          {athleteId && (
            <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-border bg-muted/20 px-3 py-2.5">
              <input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-blue-500" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-foreground">Показать атлету</div>
                <div className="text-[11px] text-muted-foreground">
                  Атлет получит уведомление и сможет прочитать запись.
                </div>
              </div>
              <i className="ki-filled ki-eye text-blue-500" />
            </label>
          )}

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Теги</label>
            <input value={tagsInput} onChange={e => setTagsInput(e.target.value)}
              placeholder="Через запятую: восстановление, темп, база"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="border-t border-border px-5 py-3 flex items-center gap-2">
          <button onClick={handleSave} disabled={saving || !note.trim() || uploading}
            className="flex-1 rounded-xl text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            style={{ background: meta.color }}>
            {saving ? 'Сохраняем…' : initial ? 'Сохранить' : 'Добавить запись'}
          </button>
          <button onClick={handleClose}
            className="px-4 py-2.5 rounded-xl border border-border bg-background text-sm hover:bg-muted">
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}
