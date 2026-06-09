/**
 * /doctor/clearances — overview всех допусков (светофор) выданных доктором
 * + клавишных для тренеров атлетов которые у него под наблюдением.
 *
 * Этап 5 sidebar-rebuild — заполняет пробел из P3 эпика светофора: foundation
 * + doctor write UI + coach badges были, но обзорной страницы для самого
 * доктора не существовало. Без неё доктор не мог быстро увидеть «кто из моих
 * пациентов на light/banned» или «у кого истёк valid_until».
 *
 * Server component. Читает current_clearances view (LATEST per athlete +
 * derived review_needed). RLS (миграция 092) гарантирует:
 *   - doctor видит свой clearance row (doctor_id = me)
 *   - doctor видит row для атлета с которым active doctor_athlete connection
 * Сортировка: review_needed → banned → light_only → limited → full, далее
 * по дате.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/metronic'

interface Row {
  athlete_id:    string
  status:        'full' | 'limited' | 'light_only' | 'banned'
  note:          string | null
  valid_until:   string | null
  review_needed: boolean
  created_at:    string
}

interface AthleteUser {
  id:    string
  name:  string | null
  email: string | null
}

const STATUS_META: Record<Row['status'], { label: string; dot: string; color: string; bg: string; border: string }> = {
  full:       { label: 'Полный',      dot: '#16A34A', color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  limited:    { label: 'Ограниченный', dot: '#CA8A04', color: '#A16207', bg: '#FEFCE8', border: '#FDE68A' },
  light_only: { label: 'Лёгкий',      dot: '#F35703', color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' },
  banned:     { label: 'Запрет',      dot: '#DC2626', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
}

const PRIORITY_ORDER: Record<Row['status'], number> = {
  banned: 0, light_only: 1, limited: 2, full: 3,
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
}

function initials(name: string | null, email: string | null): string {
  const src = (name ?? email ?? '').trim()
  if (!src) return '?'
  return src.split(/\s+/).map((s) => s[0] ?? '').join('').slice(0, 2).toUpperCase()
}

export const dynamic = 'force-dynamic'

export default async function DoctorClearancesPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/auth/login')

  const { data: meRow } = await supabase
    .from('users').select('id, role').eq('auth_id', authUser.id).maybeSingle()
  if (!meRow) redirect('/auth/login')
  if ((meRow as { role: string }).role !== 'doctor' && (meRow as { role: string }).role !== 'admin') {
    redirect('/dashboard')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data: rowsRaw } = await sb
    .from('current_clearances')
    .select('athlete_id, status, note, valid_until, review_needed, created_at')
  const rows = ((rowsRaw ?? []) as Row[])

  const athleteIds = rows.map((r) => r.athlete_id)
  const { data: athletesRaw } = athleteIds.length > 0
    ? await sb.from('users').select('id, name, email').in('id', athleteIds)
    : { data: [] as AthleteUser[] }
  const athletesById = new Map(((athletesRaw ?? []) as AthleteUser[]).map((u) => [u.id, u]))

  // Sort: review_needed first, then banned > light_only > limited > full, then date desc.
  const sorted = [...rows].sort((a, b) => {
    if (a.review_needed !== b.review_needed) return a.review_needed ? -1 : 1
    const ap = PRIORITY_ORDER[a.status], bp = PRIORITY_ORDER[b.status]
    if (ap !== bp) return ap - bp
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const reviewCount = rows.filter((r) => r.review_needed).length
  const bannedCount = rows.filter((r) => r.status === 'banned' && !r.review_needed).length

  return (
    <div className="flex flex-col gap-5 pf-enter">
      <header className="rounded-[28px] border border-red-100 bg-[linear-gradient(135deg,#FEF2F2_0%,#FFFFFF_50%,#FFF4F4_100%)] p-7 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-red-700">Светофор допусков</p>
        <h1 className="mt-2 text-[clamp(1.75rem,3vw,2.5rem)] font-semibold tracking-tight text-navy-500">
          Допуски пациентов
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Текущие допуски атлетов под вашим наблюдением. <strong className="text-red-700">{reviewCount}</strong> требуют review (истёк срок действия), <strong className="text-red-700">{bannedCount}</strong> с действующим запретом.
        </p>
      </header>

      {sorted.length === 0 ? (
        <Card className="rounded-[28px] p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-400 shadow-sm">
            <i className="ki-filled ki-shield-tick text-3xl" />
          </div>
          <h2 className="mt-5 text-lg font-semibold text-foreground">Пока нет выставленных допусков</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Выставите первый допуск через карточку пациента — секция «Светофор» в отчёте по атлету.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-[28px]">
          <div className="border-b border-border bg-background/60 px-6 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {sorted.length} пациент{sorted.length === 1 ? '' : sorted.length < 5 ? 'а' : 'ов'}
            </p>
          </div>
          <ul className="divide-y divide-border">
            {sorted.map((r) => {
              const a   = athletesById.get(r.athlete_id)
              const m   = STATUS_META[r.status]
              const ini = initials(a?.name ?? null, a?.email ?? null)
              return (
                <li key={r.athlete_id} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-accent/30">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white"
                       style={{ background: 'linear-gradient(135deg,#DC2626,#B91C1C)' }}>
                    {ini}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/doctor/report/${r.athlete_id}`}
                      className="text-sm font-semibold text-foreground no-underline hover:underline">
                      {a?.name ?? 'Без имени'}
                    </Link>
                    <p className="truncate font-mono text-2xs text-muted-foreground">{a?.email ?? '—'}</p>
                    {r.note && <p className="mt-1 text-2xs leading-relaxed text-muted-foreground line-clamp-1">{r.note}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {r.review_needed ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-2xs font-bold uppercase tracking-wider text-slate-700">
                        <i className="ki-filled ki-time text-2xs text-slate-500" />требуется review
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-2xs font-bold"
                            style={{ background: m.bg, color: m.color, borderColor: m.border }}>
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: m.dot }} />{m.label}
                      </span>
                    )}
                    {r.valid_until && (
                      <span className="text-[10px] text-muted-foreground">
                        до {fmtDate(r.valid_until)}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
