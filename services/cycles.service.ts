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
  user_id:     string
  label:       string
  type:        CycleType
  start_date:  string
  end_date:    string
  description: string | null
  goal:        string | null
  color:       string | null
  created_at:  string
  updated_at:  string
}

export type CycleDay = {
  id:       string
  cycle_id: string
  user_id:  string
  day_date: string
  day_type: DayType
  notes:    string | null
}

export type CreateCycleInput = {
  user_id:     string
  label:       string
  type:        CycleType
  start_date:  string
  end_date:    string
  description?: string
  goal?:       string
  days?:       { day_date: string; day_type: DayType; notes?: string }[]
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function getCycles(userId: string, from?: string, to?: string): Promise<CycleBlock[]> {
  let q = sb().from('cycle_blocks').select('*').eq('user_id', userId)
  if (from) q = q.gte('end_date', from)
  if (to)   q = q.lte('start_date', to)
  const { data, error } = await q.order('start_date', { ascending: true })
  if (error) { console.error('getCycles error:', error); return [] }
  return (data ?? []) as CycleBlock[]
}

export async function getCycleDays(userId: string, from?: string, to?: string): Promise<CycleDay[]> {
  let q = sb().from('cycle_days').select('*').eq('user_id', userId)
  if (from) q = q.gte('day_date', from)
  if (to)   q = q.lte('day_date', to)
  const { data, error } = await q
  if (error) { console.error('getCycleDays error:', error); return [] }
  return (data ?? []) as CycleDay[]
}

export async function createCycle(input: CreateCycleInput): Promise<CycleBlock | null> {
  const { days, ...cycleData } = input
  const { data, error } = await sb()
    .from('cycle_blocks')
    .insert({ ...cycleData, description: cycleData.description || null, goal: cycleData.goal || null })
    .select()
    .single()
  if (error) { console.error('createCycle error:', error); return null }
  const cycle = data as CycleBlock

  // Вставляем дни если переданы
  if (days && days.length > 0) {
    const rows = days.map(d => ({
      cycle_id: cycle.id,
      user_id:  input.user_id,
      day_date: d.day_date,
      day_type: d.day_type,
      notes:    d.notes || null,
    }))
    const { error: daysErr } = await sb().from('cycle_days').insert(rows)
    if (daysErr) console.error('createCycleDays error:', daysErr)
  }
  return cycle
}

export async function updateCycle(id: string, updates: Partial<Omit<CycleBlock, 'id' | 'user_id' | 'created_at'>>): Promise<CycleBlock | null> {
  const { data, error } = await sb()
    .from('cycle_blocks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) { console.error('updateCycle error:', error); return null }
  return data as CycleBlock
}

export async function deleteCycle(id: string): Promise<boolean> {
  const { error } = await sb().from('cycle_blocks').delete().eq('id', id)
  if (error) { console.error('deleteCycle error:', error); return false }
  return true
}

export async function upsertCycleDay(
  userId: string, cycleId: string, dayDate: string, dayType: DayType, notes?: string
): Promise<CycleDay | null> {
  const { data, error } = await sb()
    .from('cycle_days')
    .upsert({ cycle_id: cycleId, user_id: userId, day_date: dayDate, day_type: dayType, notes: notes || null }, { onConflict: 'cycle_id,day_date' })
    .select()
    .single()
  if (error) { console.error('upsertCycleDay error:', error); return null }
  return data as CycleDay
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

export const CYCLE_TYPE_CFG: Record<CycleType, { label: string; bg: string; text: string; border: string; desc: string }> = {
  macro: { label: 'Макроцикл', bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE', desc: 'Большой период: сезон, год' },
  meso:  { label: 'Мезоцикл', bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA', desc: 'Средний период: 3–6 недель' },
  micro: { label: 'Микроцикл', bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0', desc: 'Малый период: 1–2 недели' },
}

export const DAY_TYPE_CFG: Record<DayType, { label: string; icon: string; color: string; bg: string }> = {
  training:    { label: 'Тренировка',    icon: 'ki-abstract-26',  color: '#2563EB', bg: '#EFF6FF' },
  competition: { label: 'Соревнование',  icon: 'ki-award',        color: '#DC2626', bg: '#FEF2F2' },
  rest:        { label: 'Отдых',         icon: 'ki-moon',         color: '#16A34A', bg: '#F0FDF4' },
  travel:      { label: 'В дороге',      icon: 'ki-map',          color: '#7C3AED', bg: '#F5F3FF' },
  active_rest: { label: 'Актив. отдых',  icon: 'ki-heart',        color: '#0891B2', bg: '#ECFEFF' },
}
