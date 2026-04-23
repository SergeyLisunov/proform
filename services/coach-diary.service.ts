import { createClient } from '@/lib/supabase/client'
import { notify } from './notifications.service'

export type DiaryEntryType =
  | 'observation'        // Наблюдение за атлетом
  | 'session_summary'    // Итог тренировки
  | 'competition_report' // Отчёт о соревновании
  | 'schedule'           // Запланированное занятие (синкается с календарём)
  | 'plan'               // Долгосрочный план / задача

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical'
export type DiaryCategory = 'performance' | 'health' | 'motivation' | 'technique' | 'tactical'

export interface SessionData {
  duration_min?: number
  intensity?: 'low' | 'moderate' | 'high' | 'max'
  load_score?: number    // RPE 1–10
  key_metrics?: string   // свободный текст: "5×1000 @3:45, ср. пульс 168"
  location?: string
}

export interface CompetitionData {
  event_name?: string
  placement?: number | string
  result?: string         // "42:15" / "3-я попытка 185 кг"
  total_participants?: number
  notes?: string
}

export interface ScheduleData {
  start_time?: string     // "HH:MM"
  end_time?: string
  duration_min?: number
  location?: string
  activity_type?: string
}

export interface DiaryEntry {
  id: string
  coach_id: string
  athlete_id: string | null
  date: string            // YYYY-MM-DD
  entry_type: DiaryEntryType
  title: string | null
  note: string
  tags: string[] | null
  risk_level: RiskLevel | null
  category: DiaryCategory | null
  mood: number | null
  energy_level: number | null
  session_data: SessionData | null
  competition_data: CompetitionData | null
  schedule_data: ScheduleData | null
  calendar_event_id: string | null
  created_at: string | null
  updated_at: string | null
}

export const ENTRY_TYPE_META: Record<DiaryEntryType, {
  label: string
  icon: string
  color: string
  bg: string
  border: string
}> = {
  observation: {
    label: 'Наблюдение',      icon: 'ki-eye',
    color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE',
  },
  session_summary: {
    label: 'Итог тренировки', icon: 'ki-flash-circle',
    color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA',
  },
  competition_report: {
    label: 'Соревнование',    icon: 'ki-medal-star',
    color: '#7C3AED', bg: '#FAF5FF', border: '#E9D5FF',
  },
  schedule: {
    label: 'Расписание',      icon: 'ki-calendar-tick',
    color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0',
  },
  plan: {
    label: 'План',            icon: 'ki-compass',
    color: '#CA8A04', bg: '#FEFCE8', border: '#FDE68A',
  },
}

export const RISK_LABELS: Record<RiskLevel, { ru: string; color: string; bg: string; border: string }> = {
  low:      { ru: 'Низкий риск',      color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  moderate: { ru: 'Умеренный риск',   color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' },
  high:     { ru: 'Высокий риск',     color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  critical: { ru: 'Критический риск', color: '#7F1D1D', bg: '#450A0A', border: '#991B1B' },
}

export const CATEGORY_LABELS: Record<DiaryCategory, string> = {
  performance: 'Результаты',
  health:      'Здоровье',
  motivation:  'Мотивация',
  technique:   'Техника',
  tactical:    'Тактика',
}

export const MOOD_EMOJI = ['😴', '😕', '😐', '🙂', '🔥'] as const

/** Загрузка журнала с фильтрами. Предполагает, что вызывающий — тренер. */
export async function listDiaryEntries(opts?: {
  coachId?: string
  entryType?: DiaryEntryType | 'all'
  riskLevel?: RiskLevel | 'all'
  category?: DiaryCategory | 'all'
  athleteId?: string
  limit?: number
}): Promise<DiaryEntry[]> {
  const sb = createClient()
  let q = sb
    .from('observation_diary')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 200)
  if (opts?.coachId)                                 q = q.eq('coach_id', opts.coachId)
  if (opts?.entryType && opts.entryType !== 'all')   q = q.eq('entry_type', opts.entryType)
  if (opts?.riskLevel && opts.riskLevel !== 'all')   q = q.eq('risk_level', opts.riskLevel)
  if (opts?.category && opts.category !== 'all')     q = q.eq('category', opts.category)
  if (opts?.athleteId)                               q = q.eq('athlete_id', opts.athleteId)
  const { data, error } = await q
  if (error) { console.warn('[listDiaryEntries]', error.message); return [] }
  return (data ?? []) as DiaryEntry[]
}

export interface DiaryInput {
  coach_id: string
  athlete_id?: string | null
  date: string
  entry_type: DiaryEntryType
  title?: string | null
  note: string
  tags?: string[] | null
  risk_level?: RiskLevel | null
  category?: DiaryCategory | null
  mood?: number | null
  energy_level?: number | null
  session_data?: SessionData | null
  competition_data?: CompetitionData | null
  schedule_data?: ScheduleData | null
}

/**
 * Создание записи. Для entry_type === 'schedule' автоматически
 * создаётся событие в calendar_events тренера и линкуется
 * через calendar_event_id. Если атлет выбран — отсылаем ему
 * уведомление.
 */
export async function createDiaryEntry(input: DiaryInput): Promise<DiaryEntry | null> {
  const sb = createClient()

  // 1. Если это расписание — сначала создаём calendar_event.
  let calendarEventId: string | null = null
  if (input.entry_type === 'schedule' && input.schedule_data) {
    const sd = input.schedule_data
    const { data: ev, error: evErr } = await (sb as any)
      .from('calendar_events')
      .insert({
        owner_id:   input.coach_id,
        event_date: input.date,
        start_date: input.date,
        event_type: 'coach_plan',
        title:      (input.title ?? 'Занятие').trim(),
        notes:      input.note.trim() || null,
        start_time: sd.start_time || null,
        end_time:   sd.end_time || null,
        location:   sd.location || null,
      })
      .select('id').single()
    if (!evErr && ev) calendarEventId = (ev as any).id
  }

  // 2. Основная запись дневника.
  const { data, error } = await (sb as any)
    .from('observation_diary')
    .insert({
      coach_id:         input.coach_id,
      athlete_id:       input.athlete_id ?? null,
      date:             input.date,
      entry_type:       input.entry_type,
      title:            input.title?.trim() || null,
      note:             input.note.trim(),
      tags:             input.tags && input.tags.length > 0 ? input.tags : null,
      risk_level:       input.risk_level ?? null,
      category:         input.category ?? null,
      mood:             input.mood ?? null,
      energy_level:     input.energy_level ?? null,
      session_data:     input.session_data ?? null,
      competition_data: input.competition_data ?? null,
      schedule_data:    input.schedule_data ?? null,
      calendar_event_id: calendarEventId,
    })
    .select().single()
  if (error) { console.error('createDiaryEntry:', error.message); return null }
  const row = data as DiaryEntry

  // 3. Уведомление атлету (если указан) и если запись не приватна.
  if (row.athlete_id && (row.entry_type === 'schedule' || row.entry_type === 'competition_report')) {
    const typeLabel = ENTRY_TYPE_META[row.entry_type].label
    await notify({
      user_id: row.athlete_id,
      type: row.entry_type === 'schedule' ? 'session_scheduled' : 'broadcast',
      title: row.entry_type === 'schedule' ? 'Тренер добавил занятие' : `Тренер записал: ${typeLabel.toLowerCase()}`,
      body: (row.title ?? row.note).slice(0, 120),
      entity_type: 'diary_entry',
      entity_id: row.id,
      action_url: row.entry_type === 'schedule' ? '/calendar' : '/dashboard',
    })
  }

  return row
}

export async function updateDiaryEntry(
  id: string,
  patch: Partial<Omit<DiaryEntry, 'id' | 'coach_id' | 'created_at' | 'updated_at' | 'calendar_event_id'>>,
): Promise<DiaryEntry | null> {
  const sb = createClient()
  // Снимок до: нужно понять, изменилось ли расписание.
  const { data: prevRaw } = await (sb as any)
    .from('observation_diary').select('*').eq('id', id).maybeSingle()
  const prev = prevRaw as DiaryEntry | null

  const { data, error } = await (sb as any)
    .from('observation_diary')
    .update(patch)
    .eq('id', id)
    .select().single()
  if (error) { console.warn('[updateDiaryEntry]', error.message); return null }
  const next = data as DiaryEntry

  // Если запись расписания имеет связанное событие, обновим его тоже.
  if (prev?.calendar_event_id && next.entry_type === 'schedule' && next.schedule_data) {
    const sd = next.schedule_data
    await (sb as any)
      .from('calendar_events')
      .update({
        event_date: next.date,
        start_date: next.date,
        title:      (next.title ?? 'Занятие').trim(),
        notes:      next.note.trim() || null,
        start_time: sd.start_time || null,
        end_time:   sd.end_time   || null,
        location:   sd.location   || null,
      })
      .eq('id', prev.calendar_event_id)
  }

  return next
}

export async function deleteDiaryEntry(id: string): Promise<boolean> {
  const sb = createClient()
  const { data: prevRaw } = await (sb as any)
    .from('observation_diary').select('calendar_event_id').eq('id', id).maybeSingle()
  const prev = prevRaw as { calendar_event_id: string | null } | null
  const { error } = await sb.from('observation_diary').delete().eq('id', id)
  if (error) { console.warn('[deleteDiaryEntry]', error.message); return false }
  if (prev?.calendar_event_id) {
    await sb.from('calendar_events').delete().eq('id', prev.calendar_event_id)
  }
  return true
}
