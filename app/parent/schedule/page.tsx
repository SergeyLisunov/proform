/**
 * /parent/schedule — кросс-детский календарь родителя (sidebar этап 8a).
 *
 * Dashboard уже показывает расписание, но в форме «карточка на ребёнка → его
 * 3 ближайшие тренировки». При нескольких детях родителю неудобно: чтобы
 * понять «что сегодня у всех» — нужно прокрутить все карточки.
 *
 * Эта страница — обратная орг-структура: события агрегированы по дате,
 * каждая запись помечена именем ребёнка. Окно — 28 дней вперёд.
 *
 * Доступ: parent_links → child_ids → calendar_events. RLS policy
 * `calendar_events_parent_select` (migration 089) уже разрешает SELECT.
 * Медицинские поля не запрашиваются — page показывает только title,
 * event_date, start_time, activity_type — те же столбцы, что dashboard.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/metronic'

interface ChildLink {
  child_id: string
}

interface ChildUser {
  id:   string
  name: string | null
}

interface Event {
  id:            string
  child_id:      string
  child_name:    string
  title:         string | null
  event_date:    string
  start_time:    string | null
  activity_type: string | null
}

interface DayGroup {
  date:   string
  events: Event[]
}

function fmtDayLabel(d: string): string {
  const dt = new Date(d + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  if (dt.getTime() === today.getTime())    return 'Сегодня'
  if (dt.getTime() === tomorrow.getTime()) return 'Завтра'
  return dt.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
}

function fmtTime(t: string | null): string {
  return t ? t.slice(0, 5) : '—'
}

const ACTIVITY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  workout:     { bg: '#FEF0E7', color: '#F35703', border: '#FBC1A0' },
  game:        { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
  competition: { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
  recovery:    { bg: '#F0F9FF', color: '#0EA5E9', border: '#BAE6FD' },
}

function activityChip(t: string | null) {
  const fallback = { bg: '#F1F5F9', color: '#64748B', border: '#CBD5E1' }
  const cfg = t ? (ACTIVITY_COLORS[t] ?? fallback) : fallback
  return (
    <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {t ?? 'событие'}
    </span>
  )
}

export default async function ParentSchedulePage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/auth/login')

  const { data: meRow } = await supabase
    .from('users').select('id, name').eq('auth_id', authUser.id).maybeSingle()
  if (!meRow) redirect('/auth/login')
  const meId = (meRow as { id: string }).id

  // parent_links → child ids
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: linksRaw } = await (supabase as any)
    .from('parent_links')
    .select('child_id')
    .eq('parent_id', meId)
    .eq('status', 'active')
  const childIds = ((linksRaw ?? []) as ChildLink[]).map(l => l.child_id)

  if (childIds.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <Card className="rounded-[28px] p-12 text-center">
          <h2 className="text-lg font-semibold text-foreground">Здесь будет расписание ваших детей</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Пока к аккаунту не подключён ни один ребёнок. Подключите ребёнка на странице{' '}
            <Link href="/parent/dashboard" className="font-semibold text-orange-700 underline">«Дети»</Link>.
          </p>
        </Card>
      </div>
    )
  }

  // Children profiles
  const { data: childrenRaw } = await supabase
    .from('users').select('id, name').in('id', childIds)
  const childMap = new Map<string, string>(
    ((childrenRaw ?? []) as ChildUser[]).map(c => [c.id, c.name ?? 'Без имени'])
  )

  // Window: today + 27 days
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const horizon = new Date(today); horizon.setDate(today.getDate() + 27)
  const todayStr   = today.toISOString().slice(0, 10)
  const horizonStr = horizon.toISOString().slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data: eventsRaw } = await sb
    .from('calendar_events')
    .select('id, owner_id, title, event_date, start_time, activity_type')
    .in('owner_id', childIds)
    .gte('event_date', todayStr)
    .lte('event_date', horizonStr)
    .order('event_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(200)

  const events: Event[] = ((eventsRaw ?? []) as Array<{
    id: string; owner_id: string; title: string | null;
    event_date: string; start_time: string | null; activity_type: string | null;
  }>).map(e => ({
    id:            e.id,
    child_id:      e.owner_id,
    child_name:    childMap.get(e.owner_id) ?? '—',
    title:         e.title,
    event_date:    e.event_date,
    start_time:    e.start_time,
    activity_type: e.activity_type,
  }))

  // Group by date
  const byDate = new Map<string, Event[]>()
  for (const ev of events) {
    if (!byDate.has(ev.event_date)) byDate.set(ev.event_date, [])
    byDate.get(ev.event_date)!.push(ev)
  }
  const days: DayGroup[] = Array.from(byDate.entries()).map(([date, list]) => ({ date, events: list }))

  return (
    <div className="flex flex-col gap-5 pf-enter">
      <header className="rounded-[28px] border border-orange-100 bg-[linear-gradient(135deg,#FFF8F1_0%,#FFFFFF_50%,#FFF4EC_100%)] p-7 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Кабинет родителя</p>
        <h1 className="mt-2 text-[clamp(1.75rem,3vw,2.5rem)] font-semibold tracking-tight text-navy-500">
          Расписание · 4 недели
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          События по {childMap.size === 1 ? 'ребёнку' : `${childMap.size} детям`} в хронологическом порядке.
          Подробности и медицинские данные — в индивидуальных карточках на странице{' '}
          <Link href="/parent/dashboard" className="font-semibold text-orange-700 underline">«Дети»</Link>.
        </p>
      </header>

      {days.length === 0 ? (
        <Card className="rounded-[28px] p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-400 shadow-sm">
            <i className="ki-filled ki-calendar text-3xl" />
          </div>
          <h2 className="mt-5 text-lg font-semibold text-foreground">Ближайших событий нет</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            В ближайшие 4 недели в расписании детей ничего не запланировано.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {days.map(d => (
            <Card key={d.date} className="rounded-[20px] p-5">
              <div className="mb-3 flex items-baseline justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wide text-navy-500">
                  {fmtDayLabel(d.date)}
                </h3>
                <span className="font-mono text-xs text-muted-foreground">{d.date}</span>
              </div>
              <ul className="divide-y divide-border">
                {d.events.map(ev => (
                  <li key={ev.id} className="flex items-center gap-4 py-3">
                    <div className="w-12 font-mono text-sm font-semibold text-navy-500">
                      {fmtTime(ev.start_time)}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {ev.title ?? 'Без названия'}
                        </span>
                        {activityChip(ev.activity_type)}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        <i className="ki-filled ki-user mr-1 text-[10px]" />
                        {ev.child_name}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
