import { createBrowserClient } from '@supabase/ssr'

function sb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export type CycleType = 'macro' | 'meso' | 'micro'
export type DayType = 'training' | 'competition' | 'rest' | 'travel' | 'active_rest'

export type CycleBlock = {
  id:          string
  athlete_id:  string
  label:       string
  cycle_type:  CycleType
  start_date:  string
  end_date:    string
  description: string | null
  goal:        string | null
  color:       string | null
  created_at:  string
  // алиасы для совместимости с UI
  type:        CycleType
  user_id:     string
}

export type CycleDay = {
  id:         string
  cycle_id:   string
  /** W18 Day 97 — renamed от user_id (which referenced auth.users) к
   *  athlete_id (REFERENCES public.users) per migration 077. */
  athlete_id: string
  day_date:   string
  day_type:   DayType
  notes:      string | null
}

export type CreateCycleInput = {
  user_id:      string
  label:        string
  type:         CycleType
  start_date:   string
  end_date:     string
  description?: string
  goal?:        string
  days?:        { day_date: string; day_type: DayType; notes?: string }[]
}

export type UpdateCycleInput = {
  label?:       string
  type?:        CycleType
  start_date?:  string
  end_date?:    string
  description?: string | null
  goal?:        string | null
}

function normalizeCycle(raw: any): CycleBlock {
  return { ...raw, type: raw.cycle_type, user_id: raw.athlete_id }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function getCycles(userId: string, from?: string, to?: string): Promise<CycleBlock[]> {
  let q = sb().from('cycle_blocks').select('*').eq('athlete_id', userId)
  if (from) q = q.gte('end_date', from)
  if (to)   q = q.lte('start_date', to)
  const { data, error } = await q.order('start_date', { ascending: true })
  if (error) { console.error('getCycles error:', error); return [] }
  return (data ?? []).map(normalizeCycle)
}

export async function getCycleDays(userId: string, from?: string, to?: string): Promise<CycleDay[]> {
  // W18 Day 97 — migration 077: cycle_days.user_id → athlete_id (REFERENCES public.users)
  let q = sb().from('cycle_days').select('*').eq('athlete_id', userId)
  if (from) q = q.gte('day_date', from)
  if (to)   q = q.lte('day_date', to)
  const { data, error } = await q
  if (error) { console.error('getCycleDays error:', error); return [] }
  return (data ?? []) as CycleDay[]
}

export async function getCycleDaysByCycle(cycleId: string): Promise<CycleDay[]> {
  const { data, error } = await sb().from('cycle_days').select('*').eq('cycle_id', cycleId)
  if (error) { console.error('getCycleDaysByCycle error:', error); return [] }
  return (data ?? []) as CycleDay[]
}

export async function createCycle(input: CreateCycleInput): Promise<CycleBlock | null> {
  const { days, user_id, type, ...rest } = input
  const { data, error } = await sb()
    .from('cycle_blocks')
    .insert({
      athlete_id:  user_id,
      cycle_type:  type,
      label:       rest.label,
      start_date:  rest.start_date,
      end_date:    rest.end_date,
      description: rest.description || null,
      goal:        rest.goal || null,
    })
    .select().single()
  if (error) { console.error('createCycle error:', error); return null }
  const cycle = normalizeCycle(data)
  if (days && days.length > 0) {
    // W18 Day 97 — migration 077: cycle_days.user_id → athlete_id
    const rows = days.map(d => ({ cycle_id: cycle.id, athlete_id: user_id, day_date: d.day_date, day_type: d.day_type, notes: d.notes || null }))
    const { error: daysErr } = await sb().from('cycle_days').insert(rows)
    if (daysErr) console.error('createCycleDays error:', daysErr)
  }
  return cycle
}

export async function updateCycle(id: string, input: UpdateCycleInput): Promise<CycleBlock | null> {
  const payload: any = { updated_at: new Date().toISOString() }
  if (input.label       !== undefined) payload.label       = input.label
  if (input.type        !== undefined) payload.cycle_type  = input.type
  if (input.start_date  !== undefined) payload.start_date  = input.start_date
  if (input.end_date    !== undefined) payload.end_date    = input.end_date
  if (input.description !== undefined) payload.description = input.description
  if (input.goal        !== undefined) payload.goal        = input.goal
  const { data, error } = await sb().from('cycle_blocks').update(payload).eq('id', id).select().single()
  if (error) { console.error('updateCycle error:', error); return null }
  return normalizeCycle(data)
}

export async function deleteCycle(id: string): Promise<boolean> {
  const { error } = await sb().from('cycle_blocks').delete().eq('id', id)
  if (error) { console.error('deleteCycle error:', error); return false }
  return true
}

export async function upsertCycleDay(userId: string, cycleId: string, dayDate: string, dayType: DayType, notes?: string): Promise<CycleDay | null> {
  const { data, error } = await sb()
    .from('cycle_days')
    // W18 Day 97 — migration 077: cycle_days.user_id → athlete_id
    .upsert({ cycle_id: cycleId, athlete_id: userId, day_date: dayDate, day_type: dayType, notes: notes || null }, { onConflict: 'cycle_id,day_date' })
    .select().single()
  if (error) { console.error('upsertCycleDay error:', error); return null }
  return data as CycleDay
}

export async function deleteCycleDay(cycleId: string, dayDate: string): Promise<boolean> {
  const { error } = await sb().from('cycle_days').delete().eq('cycle_id', cycleId).eq('day_date', dayDate)
  if (error) { console.error('deleteCycleDay error:', error); return false }
  return true
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

export const CYCLE_TYPE_CFG: Record<CycleType, { label: string; bg: string; text: string; border: string; desc: string }> = {
  macro: { label: 'Макроцикл', bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE', desc: 'Большой период: сезон, год' },
  meso:  { label: 'Мезоцикл', bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA', desc: 'Средний период: 3–6 недель' },
  micro: { label: 'Микроцикл', bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0', desc: 'Малый период: 1–2 недели' },
}

export const DAY_TYPE_CFG: Record<DayType, { label: string; icon: string; color: string; bg: string }> = {
  training:    { label: 'Тренировка',   icon: 'ki-abstract-26', color: '#2563EB', bg: '#EFF6FF' },
  competition: { label: 'Соревнование', icon: 'ki-award',       color: '#DC2626', bg: '#FEF2F2' },
  rest:        { label: 'Отдых',        icon: 'ki-moon',        color: '#16A34A', bg: '#F0FDF4' },
  travel:      { label: 'В дороге',     icon: 'ki-map',         color: '#7C3AED', bg: '#F5F3FF' },
  active_rest: { label: 'Актив. отдых', icon: 'ki-heart',       color: '#0891B2', bg: '#ECFEFF' },
}
