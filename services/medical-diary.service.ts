import { createClient } from '@/lib/supabase/client'
import { notify } from './notifications.service'

// ── Types ──────────────────────────────────────────────────────────────────

export type MedicalEntryType =
  | 'consultation'       // Консультация / приём
  | 'rehab_progress'     // Прогресс реабилитации
  | 'prescription'       // Назначение / рецепт
  | 'lab_results'        // Анализы, результаты исследований
  | 'nutrition_plan'     // План питания
  | 'injury_note'        // Запись о травме
  | 'observation'        // Свободное наблюдение
  | 'schedule'           // Плановый приём — синкается с календарём

export type MedicalSeverity = 'low' | 'moderate' | 'high' | 'critical'

export interface Vitals {
  bp_systolic?: number     // мм рт.ст.
  bp_diastolic?: number
  hr?: number              // уд/мин
  temperature?: number     // °C
  spo2?: number            // %
  weight_kg?: number
  height_cm?: number
  bmi?: number
  respiration_rate?: number
  notes?: string
}

export interface PrescriptionItem {
  name: string
  dose?: string            // "10 мг"
  frequency?: string       // "2 раза в день"
  duration?: string        // "14 дней"
  notes?: string
}
export interface PrescriptionData {
  medications?: PrescriptionItem[]
  warnings?: string
}

export interface LabTest {
  name: string
  value?: string
  unit?: string
  reference?: string
  flag?: 'normal' | 'low' | 'high' | 'critical'
}
export interface LabData {
  tests?: LabTest[]
  lab_name?: string
  sample_date?: string
}

export interface RehabData {
  exercises?: string       // свободный текст
  pain_level?: number      // 0–10
  mobility_score?: number  // 0–100 %
  recovery_pct?: number    // 0–100 %
  next_milestone?: string
  return_to_sport_date?: string
}

export interface ScheduleData {
  start_time?: string
  end_time?: string
  duration_min?: number
  location?: string
  appointment_type?: string   // 'осмотр' / 'контрольный приём'
}

export interface MedicalAttachment {
  name: string
  url: string
  type: 'image' | 'document'
  size: number
  mimeType?: string
}

export interface MedicalEntry {
  id: string
  doctor_id: string
  athlete_id: string | null
  date: string                // YYYY-MM-DD
  entry_type: MedicalEntryType
  title: string | null
  note: string
  tags: string[] | null
  severity: MedicalSeverity | null
  body_part: string | null
  mood: number | null
  pain_level: number | null
  vitals: Vitals | null
  prescription_data: PrescriptionData | null
  lab_data: LabData | null
  rehab_data: RehabData | null
  schedule_data: ScheduleData | null
  attachments: MedicalAttachment[] | null
  is_shared_with_athlete: boolean
  is_shared_with_coach: boolean
  calendar_event_id: string | null
  created_at: string | null
  updated_at: string | null
}

// ── UI metadata ────────────────────────────────────────────────────────────

export const MED_TYPE_META: Record<MedicalEntryType, {
  label: string
  icon: string
  color: string
  bg: string
  border: string
}> = {
  consultation:    { label: 'Консультация',   icon: 'ki-people',         color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  rehab_progress:  { label: 'Реабилитация',   icon: 'ki-heart-circle',   color: '#D44A02', bg: '#FFF7ED', border: '#FED7AA' },
  prescription:    { label: 'Назначения',     icon: 'ki-pill',           color: '#7C3AED', bg: '#FAF5FF', border: '#E9D5FF' },
  lab_results:     { label: 'Анализы',        icon: 'ki-dropper',        color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC' },
  nutrition_plan:  { label: 'Питание',        icon: 'ki-cup',            color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  injury_note:     { label: 'Травма',         icon: 'ki-shield-cross',   color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  observation:     { label: 'Наблюдение',     icon: 'ki-eye',            color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0' },
  schedule:        { label: 'Плановый приём', icon: 'ki-calendar-tick',  color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
}

export const SEVERITY_LABELS: Record<MedicalSeverity, { ru: string; color: string; bg: string; border: string }> = {
  low:      { ru: 'Низкая',       color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  moderate: { ru: 'Умеренная',    color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' },
  high:     { ru: 'Высокая',      color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  critical: { ru: 'Критическая',  color: '#7F1D1D', bg: '#FEE2E2', border: '#FCA5A5' },
}

export const MOOD_EMOJI = ['😴', '😕', '😐', '🙂', '🔥'] as const

export const BODY_PARTS_RU: Record<string, string> = {
  knee:        'Колено',
  ankle:       'Голеностоп',
  hamstring:   'Задняя поверхность бедра',
  quadriceps:  'Квадрицепс',
  calf:        'Икроножная',
  groin:       'Пах',
  hip:         'Бедро',
  lower_back:  'Поясница',
  upper_back:  'Верхняя спина',
  neck:        'Шея',
  shoulder:    'Плечо',
  elbow:       'Локоть',
  wrist:       'Запястье',
  foot:        'Стопа',
  achilles:    'Ахилл',
  chest:       'Грудная клетка',
  head:        'Голова',
  abdomen:     'Живот',
  other:       'Другое',
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function listMedicalEntries(opts?: {
  doctorId?: string
  entryType?: MedicalEntryType | 'all'
  severity?: MedicalSeverity | 'all'
  athleteId?: string
  limit?: number
}): Promise<MedicalEntry[]> {
  const sb = createClient()
  let q = sb.from('medical_diary')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 200)
  if (opts?.doctorId)                              q = q.eq('doctor_id', opts.doctorId)
  if (opts?.entryType && opts.entryType !== 'all') q = q.eq('entry_type', opts.entryType)
  if (opts?.severity  && opts.severity  !== 'all') q = q.eq('severity',   opts.severity)
  if (opts?.athleteId)                             q = q.eq('athlete_id', opts.athleteId)
  const { data, error } = await q
  if (error) { console.warn('[listMedicalEntries]', error.message); return [] }
  return (data ?? []) as MedicalEntry[]
}

export async function getMedicalHeatmap(doctorId: string, weeks = 12): Promise<Record<string, number>> {
  const sb = createClient()
  const from = new Date(Date.now() - weeks * 7 * 86400000).toISOString().slice(0, 10)
  const { data } = await sb
    .from('medical_diary')
    .select('date')
    .eq('doctor_id', doctorId)
    .gte('date', from)
  const counts: Record<string, number> = {}
  for (const r of ((data ?? []) as Array<{ date: string }>)) {
    counts[r.date] = (counts[r.date] ?? 0) + 1
  }
  return counts
}

// ── Mutations ──────────────────────────────────────────────────────────────

export interface MedicalInput {
  doctor_id: string
  athlete_id?: string | null
  date: string
  entry_type: MedicalEntryType
  title?: string | null
  note: string
  tags?: string[] | null
  severity?: MedicalSeverity | null
  body_part?: string | null
  mood?: number | null
  pain_level?: number | null
  vitals?: Vitals | null
  prescription_data?: PrescriptionData | null
  lab_data?: LabData | null
  rehab_data?: RehabData | null
  schedule_data?: ScheduleData | null
  attachments?: MedicalAttachment[] | null
  is_shared_with_athlete?: boolean
  is_shared_with_coach?: boolean
}

/**
 * Создание медицинской записи. Для entry_type='schedule' создаёт событие
 * в calendar_events врача и линкует через calendar_event_id. Уведомляет
 * атлета когда запись шэрится или это плановый приём.
 */
export async function createMedicalEntry(input: MedicalInput): Promise<MedicalEntry | null> {
  const sb = createClient()

  let calendarEventId: string | null = null
  if (input.entry_type === 'schedule' && input.schedule_data) {
    const sd = input.schedule_data
    const { data: ev } = await (sb as any)
      .from('calendar_events')
      .insert({
        owner_id:   input.doctor_id,
        event_date: input.date,
        start_date: input.date,
        event_type: 'medical_appointment',
        title:      (input.title ?? 'Приём').trim(),
        notes:      input.note.trim() || null,
        start_time: sd.start_time || null,
        end_time:   sd.end_time   || null,
        location:   sd.location   || null,
      })
      .select('id').single()
    if (ev) calendarEventId = (ev as any).id
  }

  const { data, error } = await (sb as any)
    .from('medical_diary')
    .insert({
      doctor_id:         input.doctor_id,
      athlete_id:        input.athlete_id ?? null,
      date:              input.date,
      entry_type:        input.entry_type,
      title:             input.title?.trim() || null,
      note:              input.note.trim(),
      tags:              input.tags && input.tags.length > 0 ? input.tags : null,
      severity:          input.severity ?? null,
      body_part:         input.body_part ?? null,
      mood:              input.mood ?? null,
      pain_level:        input.pain_level ?? null,
      vitals:            input.vitals ?? null,
      prescription_data: input.prescription_data ?? null,
      lab_data:          input.lab_data ?? null,
      rehab_data:        input.rehab_data ?? null,
      schedule_data:     input.schedule_data ?? null,
      attachments:       input.attachments && input.attachments.length > 0 ? input.attachments : null,
      is_shared_with_athlete: !!input.is_shared_with_athlete,
      is_shared_with_coach:   !!input.is_shared_with_coach,
      calendar_event_id: calendarEventId,
    })
    .select().single()
  if (error) { console.error('createMedicalEntry:', error.message); return null }
  const row = data as MedicalEntry

  const shouldNotify =
    row.athlete_id && (row.is_shared_with_athlete || row.entry_type === 'schedule')
  if (shouldNotify) {
    const meta = MED_TYPE_META[row.entry_type]
    await notify({
      user_id: row.athlete_id!,
      type: row.entry_type === 'schedule' ? 'checkup_scheduled' : 'broadcast',
      title: row.entry_type === 'schedule' ? 'Врач назначил приём' : `Врач поделился: ${meta.label.toLowerCase()}`,
      body: (row.title ?? row.note).slice(0, 120),
      entity_type: 'medical_diary',
      entity_id: row.id,
      action_url: row.entry_type === 'schedule' ? '/calendar' : '/dashboard',
    })
  }

  return row
}

export async function updateMedicalEntry(
  id: string,
  patch: Partial<Omit<MedicalEntry, 'id' | 'doctor_id' | 'created_at' | 'updated_at' | 'calendar_event_id'>>,
): Promise<MedicalEntry | null> {
  const sb = createClient()
  const { data: prevRaw } = await (sb as any)
    .from('medical_diary').select('*').eq('id', id).maybeSingle()
  const prev = prevRaw as MedicalEntry | null
  const { data, error } = await (sb as any)
    .from('medical_diary')
    .update(patch).eq('id', id).select().single()
  if (error) { console.warn('[updateMedicalEntry]', error.message); return null }
  const next = data as MedicalEntry

  // Sync calendar event for schedule entries.
  if (prev?.calendar_event_id && next.entry_type === 'schedule' && next.schedule_data) {
    const sd = next.schedule_data
    await (sb as any).from('calendar_events').update({
      event_date: next.date,
      start_date: next.date,
      title:      (next.title ?? 'Приём').trim(),
      notes:      next.note.trim() || null,
      start_time: sd.start_time || null,
      end_time:   sd.end_time   || null,
      location:   sd.location   || null,
    }).eq('id', prev.calendar_event_id)
  }

  return next
}

export async function deleteMedicalEntry(id: string): Promise<boolean> {
  const sb = createClient()
  const { data: prevRaw } = await (sb as any)
    .from('medical_diary').select('calendar_event_id').eq('id', id).maybeSingle()
  const prev = prevRaw as { calendar_event_id: string | null } | null
  const { error } = await sb.from('medical_diary').delete().eq('id', id)
  if (error) { console.warn('[deleteMedicalEntry]', error.message); return false }
  if (prev?.calendar_event_id) {
    await sb.from('calendar_events').delete().eq('id', prev.calendar_event_id)
  }
  return true
}

export async function toggleShareWithAthlete(id: string, next: boolean): Promise<MedicalEntry | null> {
  const sb = createClient()
  const { data: prevRaw } = await (sb as any)
    .from('medical_diary').select('*').eq('id', id).maybeSingle()
  const prev = prevRaw as MedicalEntry | null
  const { data, error } = await (sb as any)
    .from('medical_diary').update({ is_shared_with_athlete: next }).eq('id', id)
    .select().single()
  if (error) { console.warn('[toggleShareWithAthlete]', error.message); return null }
  const row = data as MedicalEntry
  if (next && !prev?.is_shared_with_athlete && row.athlete_id) {
    const meta = MED_TYPE_META[row.entry_type]
    await notify({
      user_id: row.athlete_id,
      type: 'broadcast',
      title: `Врач поделился: ${meta.label.toLowerCase()}`,
      body: (row.title ?? row.note).slice(0, 120),
      entity_type: 'medical_diary',
      entity_id: row.id,
      action_url: '/dashboard',
    })
  }
  return row
}

/**
 * Toggle is_shared_with_coach. When set to true, ALL active coaches of the
 * athlete (linked via trainer_athletes status='accepted') receive a
 * notification about the new restriction/note. RLS controls visibility on
 * the coach side via the medical_diary_coach_shared policy added in
 * migration 048.
 */
export async function toggleShareWithCoach(id: string, next: boolean): Promise<MedicalEntry | null> {
  const sb = createClient()
  const { data: prevRaw } = await (sb as any)
    .from('medical_diary').select('*').eq('id', id).maybeSingle()
  const prev = prevRaw as MedicalEntry | null
  const { data, error } = await (sb as any)
    .from('medical_diary').update({ is_shared_with_coach: next }).eq('id', id)
    .select().single()
  if (error) { console.warn('[toggleShareWithCoach]', error.message); return null }
  const row = data as MedicalEntry
  if (next && !prev?.is_shared_with_coach && row.athlete_id) {
    // Notify every active coach of this athlete.
    const { data: linksRaw } = await sb
      .from('trainer_athletes')
      .select('trainer_id')
      .eq('athlete_id', row.athlete_id)
      .eq('status', 'accepted')
    const coachIds = ((linksRaw ?? []) as Array<{ trainer_id: string }>).map(r => r.trainer_id)
    const meta = MED_TYPE_META[row.entry_type]
    await Promise.all(coachIds.map(coachId => notify({
      user_id: coachId,
      type: 'broadcast',
      title: `Медотметка для тренера: ${meta.label.toLowerCase()}`,
      body: (row.title ?? row.note).slice(0, 140),
      entity_type: 'medical_diary',
      entity_id: row.id,
      action_url: '/dashboard',
    })))
  }
  return row
}

/**
 * Coach-side query: returns medical_diary entries that have been
 * explicitly shared with the coach by a doctor/specialist. RLS
 * ensures only entries for connected athletes leak through (see
 * policy `medical_diary_coach_shared` in migration 048).
 *
 * The coach uses this to surface medical restrictions (e.g.
 * "no jumping 2 weeks", "восстановление после массажа 3 дня") on
 * the dashboard so they can adjust workload accordingly.
 */
export async function listCoachVisibleMedicalEntries(
  athleteIds: string[],
  limit = 20,
): Promise<MedicalEntry[]> {
  if (athleteIds.length === 0) return []
  const sb = createClient()
  const { data, error } = await sb
    .from('medical_diary')
    .select('*')
    .eq('is_shared_with_coach', true)
    .in('athlete_id', athleteIds)
    .order('date', { ascending: false })
    .limit(limit)
  if (error) { console.warn('[listCoachVisibleMedicalEntries]', error.message); return [] }
  return (data ?? []) as MedicalEntry[]
}

// ── Patient linkage ────────────────────────────────────────────────────────

export interface DoctorPatient { id: string; name: string }

/** Список пациентов врача — через connections.doctor_athlete active. */
export async function listMyPatients(doctorId: string): Promise<DoctorPatient[]> {
  const sb = createClient()
  const { data: connsRaw } = await sb
    .from('connections')
    .select('initiator_id, recipient_id')
    .eq('connection_type', 'doctor_athlete')
    .eq('status', 'active')
    .or(`initiator_id.eq.${doctorId},recipient_id.eq.${doctorId}`)
  const ids = new Set<string>()
  for (const c of ((connsRaw ?? []) as Array<{ initiator_id: string; recipient_id: string }>)) {
    ids.add(c.initiator_id === doctorId ? c.recipient_id : c.initiator_id)
  }
  if (ids.size === 0) return []
  const { data: usersRaw } = await sb.from('users').select('id, name').in('id', [...ids])
  return ((usersRaw ?? []) as Array<{ id: string; name: string | null }>)
    .map(u => ({ id: u.id, name: u.name ?? '—' }))
}

// ── Patient data snapshot (workouts, injuries, checkups, metrics) ─────────

export interface PatientSnapshot {
  recent_workouts: Array<{
    id: string
    event_date: string
    activity_type: string | null
    name: string | null
    activity_duration_min: number | null
    activity_strain: number | null
    mood: number | null
  }>
  recent_metrics: Array<{
    date: string
    recovery_score: number | null
    hrv: number | null
    resting_heart_rate: number | null
    sleep_hours: number | null
    day_strain: number | null
  }>
  active_injuries: Array<{
    id: string
    onset_date: string
    body_part: string
    side: string
    severity: string
    status: string
    description: string | null
  }>
  recent_checkups: Array<{
    id: string
    checkup_date: string
    checkup_type: string
    status: string
    findings: string | null
  }>
  avg_recovery_7d: number | null
  avg_strain_7d: number | null
}

/** Сжатая выжимка по пациенту — агрегирует тренировки, метрики, травмы, осмотры за 14 дней. */
export async function getPatientSnapshot(athleteId: string): Promise<PatientSnapshot> {
  const sb = createClient()
  const from14 = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
  const from7  = new Date(Date.now() -  7 * 86400000).toISOString().slice(0, 10)

  const [wRes, mRes, iRes, cRes] = await Promise.all([
    sb.from('workouts')
      .select('id, event_date, activity_type, name, activity_duration_min, activity_strain, mood')
      .eq('athlete_id', athleteId)
      .gte('event_date', from14)
      .order('event_date', { ascending: false }).limit(10),
    sb.from('daily_metrics')
      .select('date, recovery_score, hrv, resting_heart_rate, sleep_hours, day_strain')
      .eq('athlete_id', athleteId)
      .gte('date', from14)
      .order('date', { ascending: false }).limit(14),
    sb.from('injuries')
      .select('id, onset_date, body_part, side, severity, status, description')
      .eq('athlete_id', athleteId)
      .neq('status', 'recovered')
      .order('onset_date', { ascending: false }),
    sb.from('medical_checkups')
      .select('id, checkup_date, checkup_type, status, findings')
      .eq('athlete_id', athleteId)
      .gte('checkup_date', new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10))
      .order('checkup_date', { ascending: false }).limit(10),
  ])

  const metrics = (mRes.data ?? []) as PatientSnapshot['recent_metrics']
  const metrics7d = metrics.filter(m => m.date >= from7)
  const recSum = metrics7d.reduce((s, m) => s + (m.recovery_score ?? 0), 0)
  const recCnt = metrics7d.filter(m => m.recovery_score != null).length
  const strSum = metrics7d.reduce((s, m) => s + (Number(m.day_strain) || 0), 0)
  const strCnt = metrics7d.filter(m => m.day_strain != null).length

  return {
    recent_workouts:  (wRes.data ?? []) as PatientSnapshot['recent_workouts'],
    recent_metrics:   metrics,
    active_injuries:  (iRes.data ?? []) as PatientSnapshot['active_injuries'],
    recent_checkups:  (cRes.data ?? []) as PatientSnapshot['recent_checkups'],
    avg_recovery_7d:  recCnt > 0 ? Math.round(recSum / recCnt) : null,
    avg_strain_7d:    strCnt > 0 ? Number((strSum / strCnt).toFixed(1)) : null,
  }
}
