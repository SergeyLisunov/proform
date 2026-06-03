import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, ChartCard } from '@/components/ui/metronic'
import ApexChart from '@/components/charts/ApexChart'

export default async function OrgAnalyticsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/auth/login')

  const { data: me } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', authUser.id)
    .single()
  if (!me) redirect('/auth/login')
  if (me.role !== 'organization' && me.role !== 'admin') redirect('/dashboard')

  const { data: org } = await supabase
    .from('organizations')
    .select('id, org_name, members_count, coaches_count')
    .eq('id', me.id)
    .maybeSingle()

  const { count: activeMembers } = await supabase
    .from('org_members')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', me.id)
    .eq('status', 'active')

  const { count: athleteMembers } = await supabase
    .from('org_members')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', me.id)
    .eq('member_role', 'athlete')
    .eq('status', 'active')

  const { count: coachMembers } = await supabase
    .from('org_members')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', me.id)
    .eq('member_role', 'coach')
    .eq('status', 'active')

  const { count: pendingMembers } = await supabase
    .from('org_members')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', me.id)
    .eq('status', 'pending')

  const kpis = [
    { label: 'Активных участников', value: activeMembers ?? 0, icon: 'ki-people',        color: '#2563EB' },
    { label: 'Атлетов',              value: athleteMembers ?? 0, icon: 'ki-abstract-26',  color: '#F35703' },
    { label: 'Тренеров',             value: coachMembers ?? 0, icon: 'ki-teacher',       color: '#16A34A' },
    { label: 'Ожидают подтвержд.',   value: pendingMembers ?? 0, icon: 'ki-time',         color: '#CA8A04' },
  ]

  return (
    <div className="flex flex-col gap-6 max-w-[1100px] mx-auto w-full">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-muted-foreground">Организация</p>
        <h1 className="pf-num text-[32px] leading-tight text-navy-500">Аналитика {org?.org_name ? `· ${org.org_name}` : ''}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Сводка по участникам, тренерам и заявкам. Углублённая статистика скоро появится в этом разделе.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="p-4 rounded-2xl">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `${k.color}18` }}>
                <i className={`ki-filled ${k.icon} text-[14px]`} style={{ color: k.color }} />
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{k.label}</div>
            </div>
            <div className="pf-num mt-2 text-2xl font-bold text-foreground">{k.value}</div>
          </Card>
        ))}
      </div>

      <ChartCard title="Состав организации" subtitle="Активные участники, атлеты, тренеры и заявки" accent>
        <ApexChart
          type="bar"
          options={{
            chart: { toolbar: { show: false }, animations: { enabled: true, speed: 500 } },
            colors: ['#2563EB', '#F35703', '#16A34A', '#CA8A04'],
            plotOptions: { bar: { borderRadius: 6, columnWidth: '55%', distributed: true } },
            dataLabels: { enabled: false },
            legend: { show: false },
            grid: { borderColor: '#F1F5F9', strokeDashArray: 3 },
            xaxis: {
              categories: ['Участники', 'Атлеты', 'Тренеры', 'Заявки'],
              labels: { style: { fontSize: '11px', colors: '#94A3B8' } },
              axisBorder: { show: false }, axisTicks: { show: false },
            },
            yaxis: { labels: { style: { fontSize: '10px', colors: '#94A3B8' } } },
            tooltip: { theme: 'light' },
          }}
          series={[{ name: 'Кол-во', data: kpis.map(k => k.value) }]}
          height={240}
          width="100%"
        />
      </ChartCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/org/members?role=coach" className="no-underline">
          <Card className="p-5 rounded-2xl hover:border-[#16A34A] hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0FDF4]">
                <i className="ki-filled ki-teacher text-[16px] text-[#16A34A]" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">Список тренеров</div>
                <div className="text-xs text-muted-foreground">Управление и права</div>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/org/members?role=athlete" className="no-underline">
          <Card className="p-5 rounded-2xl hover:border-[#F35703] hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF7ED]">
                <i className="ki-filled ki-abstract-26 text-[16px] text-[#F35703]" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">Список атлетов</div>
                <div className="text-xs text-muted-foreground">Участники команды</div>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/org/wall" className="no-underline">
          <Card className="p-5 rounded-2xl hover:border-[#7C3AED] hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F3FF]">
                <i className="ki-filled ki-message-text-2 text-[16px] text-[#7C3AED]" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">Стена и анонсы</div>
                <div className="text-xs text-muted-foreground">Обращения к команде</div>
              </div>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  )
}
