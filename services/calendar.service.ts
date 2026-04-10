import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

export type CalendarEvent = Database['public']['Tables']['calendar_events']['Row']
export type EventType = CalendarEvent['event_type']

export const EVENT_TYPES: { value: EventType; label: string; icon: string; color: string }[] = [
  { value: 'workout',     label: 'Тренировка',  icon: 'ki-abstract-26',  color: '#2563EB' },
  { value: 'competition', label: 'Соревнование', icon: 'ki-crown',        color: '#F97316' },
  { value: 'rest',        label: 'Отдых',       icon: 'ki-moon',         color: '#16A34A' },
  { value: 'note',        label: 'Заметка',     icon: 'ki-notepad-edit', color: '#64748B' },
  { value: 'travel',      label: 'Поездка',     icon: 'ki-airplane',     color: '#7C3AED' },
  { value: 'medical',     label: 'Медицина',    icon: 'ki-heart',        color: '#DC2626' },
  { value: 'test',        label: 'Тест',        icon: 'ki-chart-line-up',color: '#D97706' },
  { value: 'camp',        label: 'Сборы',       icon: 'ki-map',          color: '#0D9488' },
  { value: 'other',       label: 'Другое',      icon: 'ki-calendar',     color: '#94A3B8' },
]

export async function getCalendarEvents(ownerId: string, from: string, to: string): Promise<CalendarEvent[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('owner_id', ownerId)
    .gte('event_date', from)
    .lte('event_date', to)
    .order('event_date', { ascending: true })

  return data ?? []
}

export async function createCalendarEvent(event: {
  owner_id: string
  event_date: string
  event_type: EventType
  title: string
  notes?: string | null
  start_time?: string | null
  end_time?: string | null
}): Promise<CalendarEvent | null> {
  const supabase = createClient()
  const { data, error } = await (supabase as any)
    .from('calendar_events')
    .insert({
      owner_id:   event.owner_id,
      event_date: event.event_date,
      event_type: event.event_type,
      title:      event.title,
      notes:      event.notes ?? null,
      start_time: event.start_time ?? null,
      end_time:   event.end_time ?? null,
    })
    .select()
    .single() as { data: CalendarEvent | null; error: { message: string } | null }

  if (error) {
    console.error('createCalendarEvent error:', error.message)
    return null
  }
  return data
}

export async function updateCalendarEvent(id: string, data: {
  event_date?: string
  event_type?: EventType
  title?: string
  notes?: string | null
  start_time?: string | null
  end_time?: string | null
}): Promise<CalendarEvent | null> {
  const supabase = createClient()
  const { data: result, error } = await (supabase as any)
    .from('calendar_events')
    .update(data)
    .eq('id', id)
    .select()
    .single() as { data: CalendarEvent | null; error: { message: string } | null }

  if (error) {
    console.error('updateCalendarEvent error:', error.message)
    return null
  }
  return result
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('calendar_events').delete().eq('id', id)
}
