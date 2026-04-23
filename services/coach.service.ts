import { createClient } from '@/lib/supabase/client'
import { notify } from './notifications.service'

export interface CoachPassPlan {
  id: string
  coach_id: string
  title: string
  description: string | null
  total_sessions: number
  period_days: number
  price_cents: number
  currency: string
  is_active: boolean
  created_at: string
}

export type PassStatus = 'active' | 'expired' | 'paused' | 'cancelled' | 'finished'

export interface AthletePass {
  id: string
  coach_id: string
  athlete_id: string
  plan_id: string | null
  title: string
  total_sessions: number
  used_sessions: number
  starts_at: string
  expires_at: string
  price_cents: number
  currency: string
  status: PassStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export type SessionStatus = 'planned' | 'completed' | 'no_show' | 'cancelled'

export interface CoachSession {
  id: string
  coach_id: string
  athlete_id: string
  pass_id: string | null
  session_date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  title: string | null
  notes: string | null
  status: SessionStatus
  created_at: string
  updated_at: string
}

export interface AthletePassSummary {
  athlete_id: string
  athlete_name: string
  total_sessions: number
  used_sessions: number
  active_pass_id: string | null
  expires_at: string | null
  upcoming_sessions: number
}

// ─── Pass Plans (шаблоны тарифов) ────────────────────────────────────────
export async function listCoachPlans(coachId: string): Promise<CoachPassPlan[]> {
  const sb = createClient()
  const { data } = await sb
    .from('coach_pass_plans')
    .select('*')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })
  return (data ?? []) as CoachPassPlan[]
}

export async function createCoachPlan(input: {
  coach_id: string
  title: string
  description?: string | null
  total_sessions: number
  period_days: number
  price_cents?: number
  currency?: string
}): Promise<CoachPassPlan | null> {
  const sb = createClient()
  const { data, error } = await (sb as any)
    .from('coach_pass_plans')
    .insert({
      coach_id:       input.coach_id,
      title:          input.title,
      description:    input.description ?? null,
      total_sessions: input.total_sessions,
      period_days:    input.period_days,
      price_cents:    input.price_cents ?? 0,
      currency:       input.currency ?? 'RUB',
    })
    .select()
    .single()
  if (error) { console.error('createCoachPlan:', error.message); return null }
  return data as CoachPassPlan
}

export async function updateCoachPlan(id: string, patch: Partial<Omit<CoachPassPlan,'id'|'coach_id'|'created_at'>>): Promise<CoachPassPlan | null> {
  const sb = createClient()
  const { data, error } = await (sb as any)
    .from('coach_pass_plans').update(patch).eq('id', id).select().single()
  if (error) { console.error('updateCoachPlan:', error.message); return null }
  return data as CoachPassPlan
}

export async function deleteCoachPlan(id: string): Promise<void> {
  const sb = createClient()
  await sb.from('coach_pass_plans').delete().eq('id', id)
}

// ─── Athlete Passes ──────────────────────────────────────────────────────
export async function listAthletePasses(coachId: string): Promise<AthletePass[]> {
  const sb = createClient()
  const { data } = await sb
    .from('athlete_passes')
    .select('*')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })
  return (data ?? []) as AthletePass[]
}

export async function listPassesForAthlete(coachId: string, athleteId: string): Promise<AthletePass[]> {
  const sb = createClient()
  const { data } = await sb
    .from('athlete_passes')
    .select('*')
    .eq('coach_id', coachId)
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })
  return (data ?? []) as AthletePass[]
}

export async function issuePass(input: {
  coach_id: string
  athlete_id: string
  plan_id?: string | null
  title: string
  total_sessions: number
  starts_at: string
  expires_at: string
  price_cents?: number
  currency?: string
  notes?: string | null
}): Promise<AthletePass | null> {
  const sb = createClient()
  const { data, error } = await (sb as any)
    .from('athlete_passes')
    .insert({
      coach_id:       input.coach_id,
      athlete_id:     input.athlete_id,
      plan_id:        input.plan_id ?? null,
      title:          input.title,
      total_sessions: input.total_sessions,
      used_sessions:  0,
      starts_at:      input.starts_at,
      expires_at:     input.expires_at,
      price_cents:    input.price_cents ?? 0,
      currency:       input.currency ?? 'RUB',
      status:         'active',
      notes:          input.notes ?? null,
    })
    .select()
    .single()
  if (error) { console.error('issuePass:', error.message); return null }
  const pass = data as AthletePass
  await notify({
    user_id: input.athlete_id,
    type: 'pass_issued',
    title: 'Выдан абонемент',
    body: `${input.title} · ${input.total_sessions} занятий (до ${input.expires_at})`,
    entity_type: 'athlete_pass',
    entity_id: pass.id,
    action_url: '/calendar',
  })
  return pass
}

export async function updatePass(id: string, patch: Partial<Omit<AthletePass,'id'|'coach_id'|'created_at'|'updated_at'>>): Promise<AthletePass | null> {
  const sb = createClient()
  const { data, error } = await (sb as any)
    .from('athlete_passes').update(patch).eq('id', id).select().single()
  if (error) { console.error('updatePass:', error.message); return null }
  return data as AthletePass
}

export async function deletePass(id: string): Promise<void> {
  const sb = createClient()
  await sb.from('athlete_passes').delete().eq('id', id)
}

// ─── Coach Sessions (занятия) ────────────────────────────────────────────
export async function listCoachSessions(coachId: string, from: string, to: string): Promise<CoachSession[]> {
  const sb = createClient()
  const { data } = await sb
    .from('coach_sessions')
    .select('*')
    .eq('coach_id', coachId)
    .gte('session_date', from)
    .lte('session_date', to)
    .order('session_date', { ascending: true })
  return (data ?? []) as CoachSession[]
}

export async function listSessionsForAthlete(coachId: string, athleteId: string, from: string, to: string): Promise<CoachSession[]> {
  const sb = createClient()
  const { data } = await sb
    .from('coach_sessions')
    .select('*')
    .eq('coach_id', coachId)
    .eq('athlete_id', athleteId)
    .gte('session_date', from)
    .lte('session_date', to)
    .order('session_date', { ascending: true })
  return (data ?? []) as CoachSession[]
}

// Athlete-side: все сессии, где я участвую (от всех тренеров).
export async function listMySessionsAsAthlete(athleteId: string, from: string, to: string): Promise<CoachSession[]> {
  const sb = createClient()
  const { data } = await sb
    .from('coach_sessions')
    .select('*')
    .eq('athlete_id', athleteId)
    .gte('session_date', from)
    .lte('session_date', to)
    .order('session_date', { ascending: true })
  return (data ?? []) as CoachSession[]
}

// Athlete-side: мои активные абонементы (от всех тренеров).
export async function listMyPassesAsAthlete(athleteId: string): Promise<AthletePass[]> {
  const sb = createClient()
  const { data } = await sb
    .from('athlete_passes')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('starts_at', { ascending: false })
  return (data ?? []) as AthletePass[]
}

export async function createCoachSession(input: {
  coach_id: string
  athlete_id: string
  pass_id?: string | null
  session_date: string
  start_time?: string | null
  end_time?: string | null
  location?: string | null
  title?: string | null
  notes?: string | null
  status?: SessionStatus
}): Promise<CoachSession | null> {
  const sb = createClient()
  const { data, error } = await (sb as any)
    .from('coach_sessions')
    .insert({
      coach_id:     input.coach_id,
      athlete_id:   input.athlete_id,
      pass_id:      input.pass_id ?? null,
      session_date: input.session_date,
      start_time:   input.start_time ?? null,
      end_time:     input.end_time ?? null,
      location:     input.location ?? null,
      title:        input.title ?? null,
      notes:        input.notes ?? null,
      status:       input.status ?? 'planned',
    })
    .select()
    .single()
  if (error) { console.error('createCoachSession:', error.message); return null }
  const session = data as CoachSession
  await notify({
    user_id: input.athlete_id,
    type: 'session_scheduled',
    title: 'Назначена тренировка',
    body: `${input.title ?? 'Занятие с тренером'} · ${input.session_date}${input.start_time ? ' в ' + input.start_time.slice(0,5) : ''}`,
    entity_type: 'coach_session',
    entity_id: session.id,
    action_url: '/calendar',
  })
  return session
}

export async function updateCoachSession(id: string, patch: Partial<Omit<CoachSession,'id'|'coach_id'|'created_at'|'updated_at'>>): Promise<CoachSession | null> {
  const sb = createClient()
  // Снимок до апдейта — чтобы отправить уведомление при смене статуса/переносе.
  const { data: prevRaw } = await (sb as any)
    .from('coach_sessions').select('*').eq('id', id).maybeSingle()
  const prev = prevRaw as CoachSession | null

  const { data, error } = await (sb as any)
    .from('coach_sessions').update(patch).eq('id', id).select().single()
  if (error) { console.error('updateCoachSession:', error.message); return null }
  const next = data as CoachSession

  if (prev) {
    const cancelledNow = prev.status !== 'cancelled' && next.status === 'cancelled'
    const dateChanged  = prev.session_date !== next.session_date
    const timeChanged  = (prev.start_time ?? '') !== (next.start_time ?? '')
                       || (prev.end_time   ?? '') !== (next.end_time   ?? '')

    if (cancelledNow) {
      await notify({
        user_id: next.athlete_id,
        type: 'session_cancelled',
        title: 'Тренировка отменена',
        body: `${next.title ?? 'Занятие с тренером'} · ${next.session_date}${next.start_time ? ' в ' + next.start_time.slice(0,5) : ''}`,
        entity_type: 'coach_session',
        entity_id: next.id,
        action_url: '/calendar',
      })
    } else if ((dateChanged || timeChanged) && next.status !== 'cancelled') {
      await notify({
        user_id: next.athlete_id,
        type: 'session_scheduled',
        title: 'Тренировка перенесена',
        body: `${next.title ?? 'Занятие с тренером'} · ${next.session_date}${next.start_time ? ' в ' + next.start_time.slice(0,5) : ''}`,
        entity_type: 'coach_session',
        entity_id: next.id,
        action_url: '/calendar',
      })
    }
  }

  return next
}

export async function setSessionStatus(id: string, status: SessionStatus): Promise<CoachSession | null> {
  return updateCoachSession(id, { status })
}

export async function deleteCoachSession(id: string): Promise<void> {
  const sb = createClient()
  // Снимок до удаления — чтобы уведомить атлета об отмене.
  const { data: prevRaw } = await (sb as any)
    .from('coach_sessions').select('*').eq('id', id).maybeSingle()
  const prev = prevRaw as CoachSession | null

  await sb.from('coach_sessions').delete().eq('id', id)

  if (prev) {
    await notify({
      user_id: prev.athlete_id,
      type: 'session_cancelled',
      title: 'Тренировка отменена',
      body: `${prev.title ?? 'Занятие с тренером'} · ${prev.session_date}${prev.start_time ? ' в ' + prev.start_time.slice(0,5) : ''}`,
      entity_type: 'coach_session',
      entity_id: prev.id,
      action_url: '/calendar',
    })
  }
}

// ─── Агрегаты: свёрнутая сводка по каждому атлету ────────────────────────
export async function getAthletePassSummaries(coachId: string): Promise<AthletePassSummary[]> {
  const sb = createClient()

  const { data: linksRaw } = await sb
    .from('trainer_athletes')
    .select('athlete_id')
    .eq('trainer_id', coachId)
    .eq('status', 'accepted')
  const links = (linksRaw ?? []) as Array<{ athlete_id: string }>
  const athleteIds = links.map(l => l.athlete_id)
  if (athleteIds.length === 0) return []

  const { data: usersRaw } = await sb.from('users').select('id, name').in('id', athleteIds)
  const users = (usersRaw ?? []) as Array<{ id: string; name: string | null }>
  const nameById = new Map(users.map(u => [u.id, u.name ?? '—']))

  const { data: passesRaw } = await sb
    .from('athlete_passes')
    .select('id, athlete_id, total_sessions, used_sessions, expires_at, status')
    .eq('coach_id', coachId)
    .eq('status', 'active')
    .in('athlete_id', athleteIds)
  const passes = (passesRaw ?? []) as Array<{ id: string; athlete_id: string; total_sessions: number; used_sessions: number; expires_at: string; status: PassStatus }>

  const today = new Date().toISOString().slice(0, 10)
  const in30 = new Date(Date.now() + 30*86400000).toISOString().slice(0, 10)
  const { data: sessionsRaw } = await sb
    .from('coach_sessions')
    .select('id, athlete_id, status')
    .eq('coach_id', coachId)
    .in('athlete_id', athleteIds)
    .eq('status', 'planned')
    .gte('session_date', today)
    .lte('session_date', in30)
  const sessions = (sessionsRaw ?? []) as Array<{ id: string; athlete_id: string; status: SessionStatus }>

  const byAthlete: Record<string, AthletePassSummary> = {}
  for (const id of athleteIds) {
    byAthlete[id] = {
      athlete_id: id,
      athlete_name: nameById.get(id) ?? '—',
      total_sessions: 0,
      used_sessions: 0,
      active_pass_id: null,
      expires_at: null,
      upcoming_sessions: 0,
    }
  }
  for (const p of passes) {
    const s = byAthlete[p.athlete_id]
    if (!s) continue
    s.total_sessions += p.total_sessions
    s.used_sessions  += p.used_sessions
    if (!s.active_pass_id) { s.active_pass_id = p.id; s.expires_at = p.expires_at }
  }
  for (const se of sessions) {
    const s = byAthlete[se.athlete_id]
    if (s) s.upcoming_sessions += 1
  }
  return Object.values(byAthlete).sort((a, b) => a.athlete_name.localeCompare(b.athlete_name))
}
