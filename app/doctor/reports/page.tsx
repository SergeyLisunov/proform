import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

type AthleteUser = {
  id: string
  first_name: string | null
  last_name: string | null
  nickname: string | null
  avatar_url: string | null
  sport: string | null
  city: string | null
}

type ConnRow = {
  id: string
  initiator_id: string
  recipient_id: string
  status: string
  initiated_at: string
  initiator: AthleteUser | null
  recipient: AthleteUser | null
}

function displayName(u: AthleteUser | null) {
  if (!u) return 'Атлет'
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.nickname || 'Атлет'
}

export default async function DoctorReportsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/auth/login')

  const { data: me } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', authUser.id)
    .single()
  if (!me) redirect('/auth/login')
  if (me.role !== 'doctor' && me.role !== 'admin') redirect('/dashboard')

  const { data: connsRaw } = await supabase
    .from('connections')
    .select(
      `id, initiator_id, recipient_id, status, initiated_at,
       initiator:users!connections_initiator_id_fkey(id, first_name, last_name, nickname, avatar_url, sport, city),
       recipient:users!connections_recipient_id_fkey(id, first_name, last_name, nickname, avatar_url, sport, city)`
    )
    .eq('connection_type', 'doctor_athlete')
    .eq('status', 'active')
    .or(`initiator_id.eq.${me.id},recipient_id.eq.${me.id}`)
    .order('initiated_at', { ascending: false })

  const conns = (connsRaw ?? []) as unknown as ConnRow[]
  const athletes = conns
    .map(c => (c.initiator_id === me.id ? c.recipient : c.initiator))
    .filter((u): u is AthleteUser => !!u)

  return (
    <div className="flex flex-col gap-6 max-w-[1040px] mx-auto w-full">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-muted-foreground">Врач</p>
        <h1 className="pf-num text-[32px] leading-tight text-navy-500">Отчёты по атлетам</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Мои пациенты — {athletes.length}. Откройте отчёт, чтобы увидеть медицинскую сводку и историю.
        </p>
      </div>

      {athletes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
          Пока нет связанных атлетов.
          <div className="mt-3">
            <Link href="/network?tab=find&type=people" className="text-[#2563EB] hover:underline font-semibold">
              Найти атлетов →
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {athletes.map(a => {
            const initials = ((a.first_name?.[0] ?? '') + (a.last_name?.[0] ?? '')).toUpperCase() || '—'
            return (
              <Link
                key={a.id}
                href={`/doctor/report/${a.id}`}
                className="rounded-2xl border border-border bg-card p-4 hover:border-[#DC2626] hover:shadow-md transition no-underline block"
              >
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl border border-border overflow-hidden shrink-0 bg-[#FEF2F2] flex items-center justify-center">
                    {a.avatar_url
                      ? <img src={a.avatar_url} alt="" className="h-full w-full object-cover" />
                      : <span className="text-sm font-bold text-[#DC2626]">{initials}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-bold text-foreground">{displayName(a)}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[a.sport, a.city].filter(Boolean).join(' · ') || 'Атлет'}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-[#DC2626]">
                  <span>Открыть отчёт</span>
                  <i className="ki-filled ki-arrow-right text-[10px]" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
