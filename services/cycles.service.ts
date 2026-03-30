import { createClient } from '@/lib/supabase/client'

export type CycleBlock = {
  id: string
  owner_id: string
  label: string
  type: 'macro' | 'meso' | 'micro'
  start_date: string
  end_date: string
  created_at: string
}

export type DayType = 'rest' | 'easy' | 'moderate' | 'hard' | 'competition' | 'recovery'

export type CycleDayType = {
  id: string
  owner_id: string
  date: string
  day_type: DayType
  notes: string | null
  created_at: string
}

export const DAY_TYPE_CONFIG: Record<DayType, { label: string; color: string; bg: string; border: string }> = {
  rest:        { label: 'Отдых',           color: '#64748B', bg: '#F8FAFC', border: '#CBD5E1' },
  easy:        { label: 'Лёгкий',          color: '#16A34A', bg: '#F0FDF4', border: '#86EFAC' },
  moderate:    { label: 'Средний',          color: '#2563EB', bg: '#EFF6FF', border: '#93C5FD' },
  hard:        { label: 'Тяжёлый',         color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' },
  competition: { label: 'Соревнование',    color: '#F97316', bg: '#FFF7ED', border: '#FDBA74' },
  recovery:    { label: 'Восстановление',  color: '#7C3AED', bg: '#FAF5FF', border: '#DDD6FE' },
}

// ── cycle blocks ──────────────────────────────────────────────────────────────

export async function getCycleBlocks(ownerId: string): Promise<CycleBlock[]> {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('cycle_blocks')
    .select('*')
    .eq('owner_id', ownerId)
    .order('start_date', { ascending: true })
  return data ?? []
}

export async function createCycleBlock(block: {
  owner_id: string
  label: string
  type: 'macro' | 'meso' | 'micro'
  start_date: string
  end_date: string
}): Promise<CycleBlock | null> {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('cycle_blocks')
    .insert(block)
    .select()
    .single() as { data: CycleBlock | null; error: { message: string } | null }
  if (error) { console.error('createCycleBlock:', error.message); return null }
  return data
}

export async function deleteCycleBlock(id: string): Promise<void> {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('cycle_blocks').delete().eq('id', id)
}

// ── day types ─────────────────────────────────────────────────────────────────

export async function getCycleDayTypes(
  ownerId: string,
  from: string,
  to: string,
): Promise<CycleDayType[]> {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('cycle_day_types')
    .select('*')
    .eq('owner_id', ownerId)
    .gte('date', from)
    .lte('date', to)
  return data ?? []
}

export async function setCycleDayType(
  ownerId: string,
  date: string,
  dayType: DayType,
  notes?: string | null,
): Promise<CycleDayType | null> {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('cycle_day_types')
    .upsert(
      { owner_id: ownerId, date, day_type: dayType, notes: notes ?? null },
      { onConflict: 'owner_id,date' },
    )
    .select()
    .single() as { data: CycleDayType | null; error: { message: string } | null }
  if (error) { console.error('setCycleDayType:', error.message); return null }
  return data
}

export async function deleteCycleDayType(ownerId: string, date: string): Promise<void> {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('cycle_day_types')
    .delete()
    .eq('owner_id', ownerId)
    .eq('date', date)
}
