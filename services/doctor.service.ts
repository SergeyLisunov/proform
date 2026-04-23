import { createClient } from '@/lib/supabase/client'
import { notify } from './notifications.service'

export type CheckupType = 'general' | 'cardiology' | 'blood' | 'injury' | 'mobility' | 'return_to_sport' | 'nutrition' | 'other'
export type CheckupStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

export const CHECKUP_TYPE_LABELS: Record<CheckupType, string> = {
  general:         'Общий осмотр',
  cardiology:      'Кардио',
  blood:           'Анализы крови',
  injury:          'Травма',
  mobility:        'Мобильность',
  return_to_sport: 'Возврат в спорт',
  nutrition:       'Питание',
  other:           'Другое',
}

export interface MedicalCheckup {
  id: string
  doctor_id: string
  athlete_id: string
  checkup_date: string
  start_time: string | null
  end_time: string | null
  checkup_type: CheckupType
  status: CheckupStatus
  location: string | null
  findings: string | null
  recommendations: string | null
  follow_up_date: string | null
  created_at: string
  updated_at: string
}

export interface DoctorPatient {
  id: string
  name: string
}

export async function listDoctorPatients(doctorId: string): Promise<DoctorPatient[]> {
  const sb = createClient()
  const { data: connsRaw } = await sb
    .from('connections')
    .select('initiator_id, recipient_id, connection_type, status')
    .or(`initiator_id.eq.${doctorId},recipient_id.eq.${doctorId}`)
    .eq('status', 'active')
    .in('connection_type', ['doctor_athlete', 'coach_doctor', 'org_doctor'])
  const conns = (connsRaw ?? []) as Array<{ initiator_id: string; recipient_id: string }>
  const ids = Array.from(new Set(conns.map(c => c.initiator_id === doctorId ? c.recipient_id : c.initiator_id).filter(Boolean)))
  if (ids.length === 0) return []
  const { data: usersRaw } = await sb.from('users').select('id, name, role').in('id', ids)
  const users = (usersRaw ?? []) as Array<{ id: string; name: string | null; role: string | null }>
  // Только атлеты
  return users
    .filter(u => u.role === 'athlete')
    .map(u => ({ id: u.id, name: u.name ?? '—' }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function listCheckups(doctorId: string, from: string, to: string): Promise<MedicalCheckup[]> {
  const sb = createClient()
  const { data } = await sb
    .from('medical_checkups')
    .select('*')
    .eq('doctor_id', doctorId)
    .gte('checkup_date', from)
    .lte('checkup_date', to)
    .order('checkup_date', { ascending: true })
  return (data ?? []) as MedicalCheckup[]
}

// Athlete-side: мои осмотры от всех врачей.
export async function listMyCheckupsAsAthlete(athleteId: string, from: string, to: string): Promise<MedicalCheckup[]> {
  const sb = createClient()
  const { data } = await sb
    .from('medical_checkups')
    .select('*')
    .eq('athlete_id', athleteId)
    .gte('checkup_date', from)
    .lte('checkup_date', to)
    .order('checkup_date', { ascending: true })
  return (data ?? []) as MedicalCheckup[]
}

export async function createCheckup(input: {
  doctor_id: string
  athlete_id: string
  checkup_date: string
  checkup_type?: CheckupType
  start_time?: string | null
  end_time?: string | null
  location?: string | null
  findings?: string | null
  recommendations?: string | null
  follow_up_date?: string | null
  status?: CheckupStatus
}): Promise<MedicalCheckup | null> {
  const sb = createClient()
  const { data, error } = await (sb as any)
    .from('medical_checkups')
    .insert({
      doctor_id:       input.doctor_id,
      athlete_id:      input.athlete_id,
      checkup_date:    input.checkup_date,
      checkup_type:    input.checkup_type ?? 'general',
      start_time:      input.start_time ?? null,
      end_time:        input.end_time   ?? null,
      location:        input.location   ?? null,
      findings:        input.findings   ?? null,
      recommendations: input.recommendations ?? null,
      follow_up_date:  input.follow_up_date ?? null,
      status:          input.status ?? 'scheduled',
    })
    .select()
    .single()
  if (error) { console.error('createCheckup:', error.message); return null }
  const checkup = data as MedicalCheckup
  await notify({
    user_id: input.athlete_id,
    type: 'checkup_scheduled',
    title: 'Назначен медосмотр',
    body: `${CHECKUP_TYPE_LABELS[checkup.checkup_type]} · ${checkup.checkup_date}${checkup.start_time ? ' в ' + checkup.start_time.slice(0,5) : ''}`,
    entity_type: 'medical_checkup',
    entity_id: checkup.id,
    action_url: '/calendar',
  })
  return checkup
}

export async function updateCheckup(id: string, patch: Partial<Omit<MedicalCheckup, 'id' | 'doctor_id' | 'created_at' | 'updated_at'>>): Promise<MedicalCheckup | null> {
  const sb = createClient()
  const { data, error } = await (sb as any)
    .from('medical_checkups').update(patch).eq('id', id).select().single()
  if (error) { console.error('updateCheckup:', error.message); return null }
  return data as MedicalCheckup
}

export async function deleteCheckup(id: string): Promise<void> {
  const sb = createClient()
  await sb.from('medical_checkups').delete().eq('id', id)
}

export interface DoctorPatientSummary {
  athlete_id: string
  athlete_name: string
  upcoming_checkups: number
  last_checkup_date: string | null
  last_checkup_type: CheckupType | null
}

export async function getDoctorPatientSummaries(doctorId: string): Promise<DoctorPatientSummary[]> {
  const patients = await listDoctorPatients(doctorId)
  if (patients.length === 0) return []

  const today = new Date().toISOString().slice(0, 10)
  const in60  = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10)
  const y2    = new Date(Date.now() - 365 * 2 * 86400000).toISOString().slice(0, 10)

  const sb = createClient()
  const { data: upRaw } = await sb
    .from('medical_checkups')
    .select('athlete_id, status')
    .eq('doctor_id', doctorId)
    .in('athlete_id', patients.map(p => p.id))
    .eq('status', 'scheduled')
    .gte('checkup_date', today)
    .lte('checkup_date', in60)
  const up = (upRaw ?? []) as Array<{ athlete_id: string; status: CheckupStatus }>

  const { data: lastRaw } = await sb
    .from('medical_checkups')
    .select('athlete_id, checkup_type, checkup_date')
    .eq('doctor_id', doctorId)
    .in('athlete_id', patients.map(p => p.id))
    .eq('status', 'completed')
    .gte('checkup_date', y2)
    .order('checkup_date', { ascending: false })
  const last = (lastRaw ?? []) as Array<{ athlete_id: string; checkup_type: CheckupType; checkup_date: string }>

  const upcomingMap: Record<string, number> = {}
  for (const u of up) upcomingMap[u.athlete_id] = (upcomingMap[u.athlete_id] ?? 0) + 1

  const lastMap: Record<string, { date: string; type: CheckupType }> = {}
  for (const l of last) {
    if (!lastMap[l.athlete_id]) lastMap[l.athlete_id] = { date: l.checkup_date, type: l.checkup_type }
  }

  return patients.map(p => ({
    athlete_id: p.id,
    athlete_name: p.name,
    upcoming_checkups: upcomingMap[p.id] ?? 0,
    last_checkup_date: lastMap[p.id]?.date ?? null,
    last_checkup_type: lastMap[p.id]?.type ?? null,
  }))
}
