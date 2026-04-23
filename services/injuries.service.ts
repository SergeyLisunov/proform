import { createClient } from '@/lib/supabase/client'
import { notify, notifyMany } from './notifications.service'

export type InjurySide = 'left' | 'right' | 'both' | 'n/a'
export type InjurySeverity = 'minor' | 'moderate' | 'severe'
export type InjuryMechanism = 'acute' | 'overuse' | 'contact' | 'unknown'
export type InjuryStatus = 'active' | 'recovering' | 'recovered'

export interface Injury {
  id: string
  athlete_id: string
  reported_by: string
  onset_date: string
  body_part: string
  side: InjurySide
  severity: InjurySeverity
  mechanism: InjuryMechanism
  status: InjuryStatus
  description: string | null
  expected_recovery_days: number | null
  recovered_at: string | null
  created_at: string
  updated_at: string
}

export const BODY_PART_PRESETS = [
  'knee', 'ankle', 'hamstring', 'quadriceps', 'calf', 'groin',
  'hip', 'lower_back', 'upper_back', 'neck', 'shoulder', 'elbow',
  'wrist', 'foot', 'achilles', 'other',
] as const

export const BODY_PART_LABELS: Record<string, string> = {
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
  other:       'Другое',
}

export const SEVERITY_LABELS: Record<InjurySeverity, string> = {
  minor: 'Лёгкая', moderate: 'Средняя', severe: 'Тяжёлая',
}
export const MECHANISM_LABELS: Record<InjuryMechanism, string> = {
  acute: 'Острая', overuse: 'Перегрузка', contact: 'Контактная', unknown: 'Не указан',
}
export const STATUS_LABELS: Record<InjuryStatus, string> = {
  active: 'Активная', recovering: 'Восстановление', recovered: 'Восстановлен',
}
export const SIDE_LABELS: Record<InjurySide, string> = {
  left: 'Левая', right: 'Правая', both: 'Обе', 'n/a': '—',
}

/** Fetch injuries visible to the signed-in user (RLS handles the filter). */
export async function listInjuries(opts?: { athleteId?: string; status?: InjuryStatus }): Promise<Injury[]> {
  const sb = createClient()
  let q = sb.from('injuries').select('*').order('onset_date', { ascending: false }).limit(200)
  if (opts?.athleteId) q = q.eq('athlete_id', opts.athleteId)
  if (opts?.status)    q = q.eq('status', opts.status)
  const { data, error } = await q
  if (error) { console.warn('[listInjuries]', error.message); return [] }
  return (data ?? []) as Injury[]
}

export async function createInjury(input: {
  athlete_id: string
  reported_by: string
  onset_date: string
  body_part: string
  side?: InjurySide
  severity?: InjurySeverity
  mechanism?: InjuryMechanism
  description?: string | null
  expected_recovery_days?: number | null
}): Promise<Injury | null> {
  const sb = createClient()
  const { data, error } = await (sb as any).from('injuries')
    .insert({
      athlete_id:   input.athlete_id,
      reported_by:  input.reported_by,
      onset_date:   input.onset_date,
      body_part:    input.body_part,
      side:         input.side     ?? 'n/a',
      severity:     input.severity ?? 'moderate',
      mechanism:    input.mechanism ?? 'unknown',
      description:  input.description ?? null,
      expected_recovery_days: input.expected_recovery_days ?? null,
      status: 'active',
    })
    .select().single()
  if (error) { console.error('createInjury:', error.message); return null }
  const row = data as Injury

  // Notify the other side of the care team.
  const label = `${BODY_PART_LABELS[row.body_part] ?? row.body_part} · ${SEVERITY_LABELS[row.severity]}`
  if (input.reported_by !== input.athlete_id) {
    // Someone else reported — notify the athlete.
    await notify({
      user_id: input.athlete_id,
      type: 'broadcast',
      title: 'Зафиксирована травма',
      body: label,
      entity_type: 'injury',
      entity_id: row.id,
      action_url: '/injuries',
    })
  } else {
    // Athlete reported — notify linked coaches + doctors.
    const { data: trainersRaw } = await sb
      .from('trainer_athletes').select('trainer_id')
      .eq('athlete_id', input.athlete_id).eq('status', 'accepted')
    const { data: connsRaw } = await sb
      .from('connections').select('initiator_id, recipient_id')
      .eq('connection_type', 'doctor_athlete').eq('status', 'active')
      .or(`initiator_id.eq.${input.athlete_id},recipient_id.eq.${input.athlete_id}`)
    const ids = new Set<string>()
    for (const t of (trainersRaw ?? []) as Array<{ trainer_id: string }>) ids.add(t.trainer_id)
    for (const c of (connsRaw ?? []) as Array<{ initiator_id: string; recipient_id: string }>) {
      const other = c.initiator_id === input.athlete_id ? c.recipient_id : c.initiator_id
      ids.add(other)
    }
    if (ids.size > 0) {
      await notifyMany([...ids].map(uid => ({
        user_id: uid,
        type: 'broadcast' as const,
        title: 'Атлет сообщил о травме',
        body: label,
        entity_type: 'injury',
        entity_id: row.id,
        action_url: '/injuries',
      })))
    }
  }
  return row
}

export async function updateInjury(id: string, patch: Partial<Pick<Injury,
  'onset_date' | 'body_part' | 'side' | 'severity' | 'mechanism' | 'status' | 'description' | 'expected_recovery_days' | 'recovered_at'
>>): Promise<Injury | null> {
  const sb = createClient()
  const { data, error } = await (sb as any).from('injuries')
    .update(patch).eq('id', id).select().single()
  if (error) { console.warn('[updateInjury]', error.message); return null }
  return data as Injury
}

/** Convenience: mark an injury as recovered. */
export async function markRecovered(id: string): Promise<boolean> {
  const res = await updateInjury(id, { status: 'recovered', recovered_at: new Date().toISOString() })
  return !!res
}

export async function deleteInjury(id: string): Promise<boolean> {
  const sb = createClient()
  const { error } = await sb.from('injuries').delete().eq('id', id)
  if (error) { console.warn('[deleteInjury]', error.message); return false }
  return true
}
