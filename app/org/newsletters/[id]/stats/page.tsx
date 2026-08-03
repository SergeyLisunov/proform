'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useOrgContext } from '@/lib/hooks/useOrgContext'
import { getNewsletter, getNewsletterStats } from '@/services/newsletter.service'
import type { Newsletter, NewsletterStats } from '@/types/org.types'
import { Card, ChartCard } from '@/components/ui/metronic'
import ApexChart from '@/components/charts/ApexChart'

function formatDate(value: string | null, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('ru-RU', options).format(new Date(value))
}

function formatAudience(targetRoles: Newsletter['target_roles']) {
  return targetRoles.map(role => role === 'athlete' ? 'атлеты' : 'тренеры').join(', ')
}

export default function NewsletterStatsPage() {
  const { id } = useParams<{ id: string }>()
  // P1: гейт по глобальной роли отбрасывал org_admin — статистика клуба
  // должна быть доступна и администратору клуба.
  const { canManage, orgId, loading: ctxLoading } = useOrgContext()
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null)
  const [stats, setStats] = useState<NewsletterStats | null>(null)
  const [loading, setLoading] = useState(true)
  /** Рассылка существует, но принадлежит другому клубу — см. сверку ниже. */
  const [foreignOrg, setForeignOrg] = useState(false)

  useEffect(() => {
    if (ctxLoading) return
    if (!canManage || !orgId) { setLoading(false); return }
    let cancelled = false
    async function load() {
      const [nl, s] = await Promise.all([
        getNewsletter(id),
        getNewsletterStats(id),
      ])
      if (cancelled) return

      // canManage отвечает лишь на вопрос «управляю ли я ХОТЬ КАКИМ-ТО клубом»,
      // а id рассылки приходит из URL. Без сверки org_id страница логически
      // разрешала запросить чужую рассылку, и вся защита держалась на одном
      // рубеже — RLS newsletters_manager_manage (миграция 110). Один рубеж
      // ошибается молча: ослабнет политика — утечка пройдёт незамеченной.
      if (nl && nl.org_id !== orgId) {
        setForeignOrg(true)
        setNewsletter(null)
        setStats(null)
        setLoading(false)
        return
      }

      setForeignOrg(false)
      setNewsletter(nl)
      setStats(s)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [id, ctxLoading, canManage, orgId])

  if (ctxLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <i className="ki-filled ki-shield-cross text-3xl text-red-400" />
        <p className="text-sm font-semibold text-foreground">Требуется доступ к управлению клубом</p>
      </div>
    )
  }

  if (foreignOrg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <i className="ki-filled ki-shield-cross text-3xl text-red-400" />
        <p className="text-sm font-semibold text-foreground">Рассылка принадлежит другому клубу</p>
        <p className="max-w-sm text-center text-2sm text-muted-foreground">
          Статистика доступна только по рассылкам того клуба, которым вы управляете.
        </p>
        <Link href="/org/newsletters" className="text-2sm font-semibold text-orange-600 hover:text-orange-700">
          К рассылкам моего клуба
        </Link>
      </div>
    )
  }

  if (!newsletter) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <i className="ki-filled ki-information-4 text-3xl text-slate-400" />
        <p className="text-sm font-semibold text-foreground">Рассылка не найдена</p>
      </div>
    )
  }

  const openRate = stats && stats.delivered > 0 ? Math.round((stats.opened / stats.delivered) * 100) : 0
  const deliveryRate = stats && stats.sent > 0 ? Math.round((stats.delivered / stats.sent) * 100) : 0

  const STAT_CARDS = [
    { label: 'Отправлено',  value: stats?.sent ?? 0,      icon: 'ki-paper-plane',         color: '#2563EB', bg: '#EFF6FF', hint: 'Все отправленные письма' },
    { label: 'Доставлено',  value: stats?.delivered ?? 0, icon: 'ki-check-circle', color: '#16A34A', bg: '#F0FDF4', hint: 'Успешно дошли до адресатов' },
    { label: 'Открыто',     value: stats?.opened ?? 0,    icon: 'ki-eye',          color: '#F35703', bg: '#FEF0E7', hint: 'Получатели открыли письмо' },
    { label: 'Ошибки',      value: stats?.failed ?? 0,    icon: 'ki-shield-cross', color: '#DC2626', bg: '#FEF2F2', hint: 'Неуспешные доставки' },
  ]

  return (
    <div className="flex flex-col gap-6 pf-enter">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(147,51,234,0.12),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(243,87,3,0.08),_transparent_28%)]" />
        <div className="relative p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <Link href="/org/newsletters" className="mb-4 inline-flex items-center gap-2 text-2sm text-muted-foreground transition-colors hover:text-foreground">
                <i className="ki-filled ki-left text-xs" />
                К рассылкам
              </Link>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-orange-700">
                  Организация
                </span>
                <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-700">
                  Статистика
                </span>
                <span className="inline-flex items-center rounded-full border border-border bg-background/80 px-3 py-1 text-[10px] font-semibold text-muted-foreground">
                  {formatAudience(newsletter.target_roles)}
                </span>
              </div>
              <h2 className="pf-num text-[clamp(2rem,4vw,3.3rem)] leading-[0.95] tracking-tight text-navy-500">
                {newsletter.subject}
              </h2>
              <p className="mt-4 max-w-xl text-sm md:text-base text-muted-foreground">
                Аналитика по доставке и открытию рассылки, чтобы быстро оценить охват и качество коммуникации.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
              <div className="rounded-2xl border border-border bg-background/80 p-4 shadow-sm">
                <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Дата отправки</div>
                <div className="mt-2 text-lg font-semibold text-foreground">{formatDate(newsletter.sent_at)}</div>
                <div className="mt-1 text-2xs text-muted-foreground">Фактический момент последней отправки</div>
              </div>
              <div className="rounded-2xl border border-border bg-background/80 p-4 shadow-sm">
                <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Аудитория</div>
                <div className="mt-2 text-lg font-semibold text-foreground">{formatAudience(newsletter.target_roles)}</div>
                <div className="mt-1 text-2xs text-muted-foreground">Роли получателей этой коммуникации</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STAT_CARDS.map(c => (
          <Card key={c.label} className="p-5 rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{c.label}</div>
                <div className="pf-num mt-2 text-3xl text-foreground">{c.value}</div>
                <div className="mt-2 text-2xs text-muted-foreground">{c.hint}</div>
              </div>
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: c.bg }}
              >
                <i className={`ki-filled ${c.icon} text-base`} style={{ color: c.color }} />
              </div>
            </div>
          </Card>
        ))}
      </section>

      <ChartCard title="Воронка доставки" subtitle="Отправлено → доставлено → открыто → ошибки" accent>
        <ApexChart
          type="bar"
          options={{
            chart: { toolbar: { show: false }, animations: { enabled: true, speed: 500 } },
            colors: STAT_CARDS.map(c => c.color),
            plotOptions: { bar: { borderRadius: 6, columnWidth: '55%', distributed: true } },
            dataLabels: { enabled: false },
            legend: { show: false },
            grid: { borderColor: '#F1F5F9', strokeDashArray: 3 },
            xaxis: {
              categories: STAT_CARDS.map(c => c.label),
              labels: { style: { fontSize: '11px', colors: '#94A3B8' } },
              axisBorder: { show: false }, axisTicks: { show: false },
            },
            yaxis: { labels: { style: { fontSize: '10px', colors: '#94A3B8' } } },
            tooltip: { theme: 'light' },
          }}
          series={[{ name: 'Письма', data: STAT_CARDS.map(c => c.value) }]}
          height={240}
          width="100%"
        />
      </ChartCard>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-3xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Доставляемость</div>
              <div className="mt-2 text-sm text-muted-foreground">Сколько писем дошли до получателей без ошибок</div>
            </div>
            <span className="pf-num text-3xl text-green-600">{deliveryRate}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-3 rounded-full bg-green-500 transition-all duration-500"
              style={{ width: `${deliveryRate}%` }}
            />
          </div>
          <p className="mt-3 text-2sm text-muted-foreground">{stats?.delivered} из {stats?.sent} получателей получили письмо успешно.</p>
        </Card>

        <Card className="rounded-3xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Открываемость</div>
              <div className="mt-2 text-sm text-muted-foreground">Доля доставленных писем, которые были открыты адресатами</div>
            </div>
            <span className="pf-num text-3xl text-orange-600">{openRate}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-3 rounded-full bg-orange-500 transition-all duration-500"
              style={{ width: `${openRate}%` }}
            />
          </div>
          <p className="mt-3 text-2sm text-muted-foreground">{stats?.opened} из {stats?.delivered} доставленных писем были открыты.</p>
        </Card>
      </section>

      <Card className="rounded-3xl p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-700">
            Контент
          </span>
          <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            {formatAudience(newsletter.target_roles)}
          </span>
        </div>
        <h3 className="text-base font-semibold text-navy-500">Содержание рассылки</h3>
        <p className="mt-3 whitespace-pre-wrap text-2sm leading-relaxed text-muted-foreground">{newsletter.body}</p>
      </Card>
    </div>
  )
}
