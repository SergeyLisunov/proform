/**
 * /parent/dashboard — родительская панель (tenant refactor #4b-iv).
 *
 * Server component. Читает parent_links (parent_id = me), для каждого ребёнка
 * показывает: ближайшие тренировки, активные абонементы, последние коммент.
 * тренера. Доступ обеспечен SELECT-политиками родителя из migration 089:
 *   - calendar_events_parent_select
 *   - athlete_passes_parent_select
 *   - observation_diary_parent_select
 * Никаких мед-данных (HRV / recovery / risk_flag) — это намеренно (см. 089).
 * Прогресс-сводка за 7 дней — через admin client с строгим column-фильтром
 * (только event_date / activity_duration_min). Это безопасно потому что
 * child_id'ы уже отфильтрованы parent_links RLS перед admin-запросом, а
 * сами sensitive-колонки не SELECT'аются. См. [[RLS row-level не подходит
 * для column-sensitive surfaces]] в vault.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card } from '@/components/ui/metronic'

interface ChildLink {
  child_id: string
}

interface ChildUser {
  id: string
  name: string | null
  email: string | null
}

interface UpcomingEvent {
  id: string
  title: string | null
  event_date: string
  start_time: string | null
  activity_type: string | null
}

interface Pass {
  id: string
  title: string | null
  total_sessions: number | null
  used_sessions: number | null
  expires_at: string | null
  status: string | null
}

interface CoachNote {
  id: string
  date: string
  title: string | null
  note: string | null
  category: string | null
  risk_level: string | null
}

interface ProgressSummary {
  count:      number
  totalMin:   number
  byActivity: Array<{ activity_type: string; count: number; min: number }>
}

const STATUS_LABEL: Record<string, string> = {
  active:    'Активный',
  expired:   'Истёк',
  paused:    'Приостановлен',
  cancelled: 'Отменён',
}

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })
}

function fmtTime(t: string | null): string {
  return t ? t.slice(0, 5) : ''
}

function initials(name: string | null, fallback: string): string {
  const src = (name ?? fallback ?? '').trim()
  if (!src) return '?'
  return src.split(/\s+/).map((s) => s[0] ?? '').join('').slice(0, 2).toUpperCase()
}

export default async function ParentDashboardPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/auth/login')

  // Resolve my public.users.id (RLS helpers key off this).
  const { data: meRow } = await supabase
    .from('users').select('id, name').eq('auth_id', authUser.id).maybeSingle()
  if (!meRow) redirect('/auth/login')
  const meId = (meRow as { id: string }).id
  const meName = (meRow as { name: string | null }).name ?? 'Родитель'

  // 1. parent_links → child ids
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: linksRaw } = await (supabase as any)
    .from('parent_links')
    .select('child_id')
    .eq('parent_id', meId)
    .eq('status', 'active')
  const links = (linksRaw ?? []) as ChildLink[]
  const childIds = links.map((l) => l.child_id)

  if (childIds.length === 0) {
    return (
      <div className="flex flex-col gap-5 pf-enter">
        <header className="rounded-[28px] border border-orange-100 bg-[linear-gradient(135deg,#FFF8F1_0%,#FFFFFF_50%,#FFF4EC_100%)] p-7 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Кабинет родителя</p>
          <h1 className="mt-2 text-[clamp(1.75rem,3vw,2.5rem)] font-semibold tracking-tight text-navy-500">
            Здравствуйте, {meName}
          </h1>
        </header>
        <Card className="rounded-[28px] p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-400 shadow-sm">
            <i className="ki-filled ki-people text-3xl" />
          </div>
          <h2 className="mt-5 text-lg font-semibold text-foreground">Здесь будут ваши дети</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Пока к вашему аккаунту не подключён ни один ребёнок. Если ребёнок-атлет уже
            пользуется Sporteo, попросите его прислать вам приглашение через раздел «Сеть».
          </p>
          <Link
            href="/network"
            className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-orange-200 bg-white px-5 py-3 text-sm font-bold text-orange-700 transition-all hover:bg-orange-50"
          >
            <i className="ki-filled ki-arrow-right text-sm" />
            Перейти в «Сеть»
          </Link>
        </Card>
      </div>
    )
  }

  // 2. Children profiles
  const { data: childrenRaw } = await supabase
    .from('users').select('id, name, email').in('id', childIds)
  const children = ((childrenRaw ?? []) as ChildUser[])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  // 3. Per-child fetches: upcoming schedule, active passes, recent coach notes.
  // Cast through any — generated types in types/database.ts lag prod schema
  // (activity_type column on calendar_events; same pattern is used across the
  // codebase, see e.g. app/dashboard/page.tsx).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Admin client purely for the workouts progress summary — STRICT column
  // filter (no HRV/recovery/risk/strain/trainer_comment/mood). Safe because
  // childIds come from parent_links above (already RLS-filtered to me=parent).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminSb = createAdminClient() as any

  const sevenAgo = new Date(today)
  sevenAgo.setDate(today.getDate() - 6)  // 7 days incl. today
  const sevenAgoStr = sevenAgo.toISOString().slice(0, 10)

  const childData = await Promise.all(children.map(async (c) => {
    const [{ data: upcomingRaw }, { data: passesRaw }, { data: notesRaw }, { data: workoutsRaw }] = await Promise.all([
      sb.from('calendar_events')
        .select('id, title, event_date, start_time, activity_type')
        .eq('owner_id', c.id)
        .gte('event_date', todayStr)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(5),
      sb.from('athlete_passes')
        .select('id, title, total_sessions, used_sessions, expires_at, status')
        .eq('athlete_id', c.id)
        .in('status', ['active', 'paused'])
        .order('created_at', { ascending: false })
        .limit(5),
      sb.from('observation_diary')
        .select('id, date, title, note, category, risk_level')
        .eq('athlete_id', c.id)
        .order('date', { ascending: false })
        .limit(3),
      adminSb.from('workouts')
        // Strict column allow-list — no medical/personal fields.
        .select('event_date, activity_type, activity_duration_min')
        .eq('athlete_id', c.id)
        .gte('event_date', sevenAgoStr)
        .lte('event_date', todayStr)
        .limit(200),
    ])

    const rows = (workoutsRaw ?? []) as Array<{
      event_date: string | null
      activity_type: string | null
      activity_duration_min: number | null
    }>
    const byActivityMap = new Map<string, { count: number; min: number }>()
    let totalMin = 0
    for (const w of rows) {
      const m = Math.max(0, Number(w.activity_duration_min ?? 0) || 0)
      totalMin += m
      const k = (w.activity_type ?? 'Другое').trim() || 'Другое'
      const cur = byActivityMap.get(k) ?? { count: 0, min: 0 }
      byActivityMap.set(k, { count: cur.count + 1, min: cur.min + m })
    }
    const progress: ProgressSummary = {
      count:    rows.length,
      totalMin,
      byActivity: Array.from(byActivityMap.entries())
        .map(([activity_type, v]) => ({ activity_type, ...v }))
        .sort((a, b) => b.min - a.min)
        .slice(0, 3),
    }

    return {
      child:    c,
      upcoming: (upcomingRaw ?? []) as UpcomingEvent[],
      passes:   (passesRaw   ?? []) as Pass[],
      notes:    (notesRaw    ?? []) as CoachNote[],
      progress,
    }
  }))

  return (
    <div className="flex flex-col gap-5 pf-enter">
      <header className="rounded-[28px] border border-orange-100 bg-[linear-gradient(135deg,#FFF8F1_0%,#FFFFFF_50%,#FFF4EC_100%)] p-7 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Кабинет родителя</p>
        <h1 className="mt-2 text-[clamp(1.75rem,3vw,2.5rem)] font-semibold tracking-tight text-navy-500">
          Здравствуйте, {meName}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Расписание тренировок, абонементы и комментарии тренера по каждому ребёнку.
          Медицинские данные намеренно скрыты — только тренер и врач видят их.
        </p>
      </header>

      {childData.map(({ child, upcoming, passes, notes, progress }) => (
        <Card key={child.id} className="rounded-[28px] overflow-hidden">
          {/* Child header */}
          <div className="flex items-center gap-4 border-b border-border px-6 py-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-base font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#F35703,#D44A02)' }}
            >
              {initials(child.name, child.email ?? '')}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-foreground">{child.name ?? 'Без имени'}</h2>
              <p className="truncate font-mono text-2xs text-muted-foreground">{child.email ?? '—'}</p>
            </div>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-2xs font-semibold uppercase tracking-[0.22em] text-blue-700">
              Атлет
            </span>
          </div>

          <div className="grid gap-4 p-6 lg:grid-cols-2 xl:grid-cols-4">
            {/* Upcoming schedule */}
            <section>
              <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                Ближайшие тренировки
              </h3>
              {upcoming.length === 0 ? (
                <p className="text-2xs text-muted-foreground">Запланированных тренировок нет.</p>
              ) : (
                <ul className="space-y-2">
                  {upcoming.map((ev) => (
                    <li key={ev.id} className="rounded-2xl border border-border bg-background/60 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">{ev.title ?? 'Тренировка'}</span>
                        <span className="text-2xs font-semibold text-muted-foreground shrink-0">{fmtDate(ev.event_date)}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-2xs text-muted-foreground">
                        {ev.activity_type && <span>{ev.activity_type}</span>}
                        {ev.start_time && <span>· {fmtTime(ev.start_time)}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Passes */}
            <section>
              <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                Абонементы
              </h3>
              {passes.length === 0 ? (
                <p className="text-2xs text-muted-foreground">Активных абонементов нет.</p>
              ) : (
                <ul className="space-y-2">
                  {passes.map((p) => {
                    const used  = p.used_sessions ?? 0
                    const total = p.total_sessions ?? 0
                    const left  = Math.max(0, total - used)
                    return (
                      <li key={p.id} className="rounded-2xl border border-border bg-background/60 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-foreground truncate">{p.title ?? 'Абонемент'}</span>
                          <span className="text-2xs font-semibold text-muted-foreground shrink-0">
                            {STATUS_LABEL[p.status ?? ''] ?? p.status ?? '—'}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-2xs text-muted-foreground">
                          <span>Осталось {left} из {total}</span>
                          {p.expires_at && <span>· до {new Date(p.expires_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {/* Coach notes */}
            <section>
              <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                Комментарии тренера
              </h3>
              {notes.length === 0 ? (
                <p className="text-2xs text-muted-foreground">Записей нет.</p>
              ) : (
                <ul className="space-y-2">
                  {notes.map((n) => (
                    <li key={n.id} className="rounded-2xl border border-border bg-background/60 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">{n.title ?? n.category ?? 'Запись'}</span>
                        <span className="text-2xs font-semibold text-muted-foreground shrink-0">{fmtDate(n.date)}</span>
                      </div>
                      {n.note && <p className="mt-1 text-2xs leading-relaxed text-muted-foreground line-clamp-2">{n.note}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Progress (last 7 days) — strict column allow-list (event_date /
                activity_type / activity_duration_min). NO medical fields. */}
            <section>
              <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                Прогресс за 7 дней
              </h3>
              {progress.count === 0 ? (
                <p className="text-2xs text-muted-foreground">Тренировок не было.</p>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-border bg-background/60 px-3 py-2.5 text-center">
                      <div className="pf-num text-xl text-foreground">{progress.count}</div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        тренировок
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border bg-background/60 px-3 py-2.5 text-center">
                      <div className="pf-num text-xl text-foreground">
                        {(progress.totalMin / 60).toFixed(progress.totalMin >= 600 ? 0 : 1)}
                      </div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        часов
                      </div>
                    </div>
                  </div>
                  {progress.byActivity.length > 0 && (
                    <ul className="space-y-1.5">
                      {progress.byActivity.map((a) => (
                        <li key={a.activity_type} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background/60 px-3 py-1.5">
                          <span className="text-2xs font-semibold text-foreground truncate">{a.activity_type}</span>
                          <span className="text-2xs text-muted-foreground shrink-0">{a.count} · {a.min} мин</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
          </div>
        </Card>
      ))}
    </div>
  )
}
