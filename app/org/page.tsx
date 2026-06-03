'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/lib/hooks/useUser'

// Sprint W2 Day 11 — management widgets (dynamic-loaded to avoid bloating
// initial bundle and to keep org owners with empty data fast).
const OrgKpiTiles              = dynamic(() => import('@/components/organization/OrgKpiTiles'),              { ssr: false })
const OrgRosterMatrix          = dynamic(() => import('@/components/organization/OrgRosterMatrix'),          { ssr: false })
const OrgRecommendationsStream = dynamic(() => import('@/components/organization/OrgRecommendationsStream'), { ssr: false })
const OrgTeamsOverview         = dynamic(() => import('@/components/organization/OrgTeamsOverview'),         { ssr: false })

function getSB() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

type Org = {
  id: string; org_name: string; org_slug: string
  sport_type: string | null; city: string | null; is_verified: boolean
}
type WallPost = {
  id: string; title: string; body: string; post_type: string
  is_pinned: boolean; created_at: string
}
type Newsletter = {
  id: string; subject: string; status: string
  sent_at: string | null; created_at: string; recipients_count: number
}

const POST_TYPE_BADGE: Record<string, { label: string; style: React.CSSProperties }> = {
  announcement: { label: 'Объявление', style: { background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' } },
  event:        { label: 'Событие',    style: { background: '#FFF7ED', color: '#F35703', border: '1px solid #FED7AA' } },
  news:         { label: 'Новость',    style: { background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' } },
  result:       { label: 'Результат',  style: { background: '#FAF5FF', color: '#9333EA', border: '1px solid #E9D5FF' } },
}

const NL_STATUS: Record<string, { label: string; style: React.CSSProperties }> = {
  sent:      { label: 'Отправлена',  style: { background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' } },
  draft:     { label: 'Черновик',    style: { background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' } },
  scheduled: { label: 'Запланирована', style: { background: '#FFF7ED', color: '#F35703', border: '1px solid #FED7AA' } },
  cancelled: { label: 'Отменена',    style: { background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' } },
}

function formatRuDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('ru-RU', options).format(new Date(value))
}

export default function OrgDashboard() {
  const { user, loading: userLoading } = useUser()
  const [org, setOrg] = useState<Org | null>(null)
  const [stats, setStats] = useState({ total: 0, coaches: 0, athletes: 0 })
  const [posts, setPosts] = useState<WallPost[]>([])
  const [newsletters, setNewsletters] = useState<Newsletter[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userLoading || !user?.id) return
    if (user.role !== 'organization') { setLoading(false); return }
    load(user.id)
  }, [user, userLoading])

  async function load(userId: string) {
    const sb = getSB()
    try {
      // Загружаем организацию
      const { data: orgData } = await sb
        .from('organizations').select('*').eq('id', userId).maybeSingle()
      if (!orgData) { setLoading(false); return }
      setOrg(orgData)

      // Загружаем всё параллельно
      const [{ data: membersData }, { data: postsData }, { data: nlData }] = await Promise.all([
        sb.from('org_members').select('member_role, status').eq('org_id', orgData.id).neq('status', 'removed'),
        sb.from('wall_posts').select('id, title, body, post_type, is_pinned, created_at')
          .eq('org_id', orgData.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(4),
        sb.from('newsletters').select('id, subject, status, sent_at, created_at, recipients_count')
          .eq('org_id', orgData.id).order('created_at', { ascending: false }).limit(3),
      ])

      const members = membersData ?? []
      setStats({
        total:    members.length,
        coaches:  members.filter(m => m.member_role === 'coach').length,
        athletes: members.filter(m => m.member_role === 'athlete').length,
      })
      setPosts(postsData ?? [])
      setNewsletters(nlData ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (userLoading || loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
    </div>
  )

  if (user?.role !== 'organization') return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 pf-enter">
      <div style={{ width: 56, height: 56, borderRadius: 16, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <i className="ki-filled ki-office-bag text-2xl" style={{ color: '#2563EB' }} />
      </div>
      <p className="text-sm font-semibold text-foreground">Требуется доступ организации</p>
      <p className="text-2sm text-muted-foreground">Этот раздел доступен только аккаунтам организаций.</p>
    </div>
  )

  if (!org) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 pf-enter">
      <div style={{ width: 56, height: 56, borderRadius: 16, background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <i className="ki-filled ki-office-bag text-2xl text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-foreground">Организация не найдена</p>
      <p className="text-2sm text-muted-foreground">Профиль организации не удалось загрузить.</p>
    </div>
  )

  const pinnedCount = posts.filter(p => p.is_pinned).length
  const sentNewsletters = newsletters.filter(nl => nl.status === 'sent').length
  const draftNewsletters = newsletters.filter(nl => nl.status === 'draft').length
  const latestActivity = [posts[0]?.created_at, newsletters[0]?.sent_at ?? newsletters[0]?.created_at]
    .filter(Boolean)
    .sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())[0] as string | undefined

  const kpis = [
    { label: 'Участники', value: stats.total, hint: 'Активный состав', icon: 'ki-people', color: '#2563EB', bg: '#EFF6FF' },
    { label: 'Тренеры', value: stats.coaches, hint: 'Роль с доступом', icon: 'ki-notepad-edit', color: '#16A34A', bg: '#F0FDF4' },
    { label: 'Атлеты', value: stats.athletes, hint: 'Основная команда', icon: 'ki-abstract-26', color: '#F35703', bg: '#FFF7ED' },
    { label: 'Контент', value: posts.length + newsletters.length, hint: 'Публикации и рассылки', icon: 'ki-calendar-tick', color: '#9333EA', bg: '#FAF5FF' },
  ]

  const actions = [
    { href: '/org/members', icon: 'ki-people', color: '#2563EB', bg: '#EFF6FF', label: 'Участники', meta: 'Состав и статусы' },
    { href: '/org/wall', icon: 'ki-abstract-45', color: '#F35703', bg: '#FFF7ED', label: 'Стена', meta: 'Публикации и анонсы' },
    { href: '/org/newsletters', icon: 'ki-sms', color: '#9333EA', bg: '#FAF5FF', label: 'Рассылки', meta: 'Сообщения и охват' },
    { href: '/org/settings', icon: 'ki-setting-2', color: '#64748B', bg: '#F8FAFC', label: 'Настройки', meta: 'Профиль и права' },
  ]

  return (
    <div className="flex flex-col gap-6 pf-enter">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(249,115,22,0.13),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(37,99,235,0.08),_transparent_28%)]" />
        <div className="relative p-6 md:p-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-2xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Командный центр организации</span>
                {org.is_verified && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
                    <i className="ki-filled ki-verify text-xs" />
                    Проверено
                  </span>
                )}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}>
                  <i className="ki-filled ki-link text-xs" />
                  /{org.org_slug}
                </span>
              </div>
              <h2 className="pf-num text-[clamp(2.15rem,4vw,3.75rem)] text-foreground leading-[0.95] tracking-tight">
                {org.org_name}
              </h2>
              <p className="mt-4 max-w-xl text-sm md:text-base text-muted-foreground">
                {org.sport_type || org.city
                  ? [org.sport_type, org.city].filter(Boolean).join(' · ')
                  : 'Панель для управления составом, стеной и рассылками в одном месте.'}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <Link href={`/${org.org_slug}`} target="_blank" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 16px', borderRadius: 14, textDecoration: 'none',
                  border: '1px solid var(--border)', background: 'rgba(255,255,255,0.75)',
                  color: 'var(--foreground)', fontSize: 13, fontWeight: 700,
                  boxShadow: '0 8px 24px rgba(15,23,42,0.06)',
                }}>
                  <i className="ki-filled ki-exit-right-corner" style={{ fontSize: 13 }} />
                  Публичная страница
                </Link>
                <Link href="/org/wall" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 16px', borderRadius: 14, textDecoration: 'none',
                  border: '1px solid #FED7AA',
                  background: 'linear-gradient(135deg, #F35703, #D44A02)',
                  color: 'white', fontSize: 13, fontWeight: 700,
                  boxShadow: '0 10px 24px rgba(249,115,22,0.26)',
                }}>
                  <i className="ki-filled ki-plus" style={{ fontSize: 14 }} />
                  Новая публикация
                </Link>
                {/* W7 Day 37: cross-cutting activity feed */}
                <Link href="/org/activity" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 16px', borderRadius: 14, textDecoration: 'none',
                  border: '1px solid #BFDBFE',
                  background: 'rgba(239,246,255,0.85)',
                  color: '#1D4ED8', fontSize: 13, fontWeight: 700,
                }}>
                  <i className="ki-filled ki-rocket" style={{ fontSize: 14 }} />
                  Лента событий
                </Link>
                {/* W11 Day 54: org health snapshot one-pager */}
                <Link href="/org/health" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 16px', borderRadius: 14, textDecoration: 'none',
                  border: '1px solid #BAE6FD',
                  background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                  color: 'white', fontSize: 13, fontWeight: 700,
                  boxShadow: '0 10px 24px rgba(37,99,235,0.22)',
                }}>
                  <i className="ki-filled ki-chart-pie-simple" style={{ fontSize: 14 }} />
                  Health Snapshot
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
              <div className="rounded-2xl border border-border bg-background/80 p-4 shadow-sm">
                <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Последняя активность</div>
                <div className="mt-2 text-lg font-semibold text-foreground">{formatRuDate(latestActivity, { day: 'numeric', month: 'long' })}</div>
                <div className="mt-1 text-2xs text-muted-foreground">Последняя публикация или рассылка</div>
              </div>
              <div className="rounded-2xl border border-border bg-background/80 p-4 shadow-sm">
                <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Состояние канала</div>
                <div className="mt-2 text-lg font-semibold text-foreground">{pinnedCount} закрепл. · {sentNewsletters} отправл.</div>
                <div className="mt-1 text-2xs text-muted-foreground">
                  {draftNewsletters > 0 ? `${draftNewsletters} чернов.` : 'Черновиков нет'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sprint W2 Day 11 — Management widgets ленточка сверху ↓ */}
      <OrgKpiTiles orgId={org.id} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OrgRosterMatrix orgId={org.id} />
        <OrgRecommendationsStream orgId={org.id} />
      </div>

      <OrgTeamsOverview orgId={org.id} />
      {/* End Day 11 widgets ↑ */}

      <section className="rounded-3xl border border-border bg-card p-4 md:p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Быстрые действия</h3>
            <p className="text-2xs text-muted-foreground mt-1">Переходы к ключевым зонам управления</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {actions.map(action => (
            <Link key={action.href} href={action.href} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 18, textDecoration: 'none',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(248,250,252,0.8))',
              border: '1px solid var(--border)', transition: 'all 0.15s',
            }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLAnchorElement
                el.style.borderColor = action.color + '60'
                el.style.transform = 'translateY(-1px)'
                el.style.boxShadow = '0 12px 28px rgba(15,23,42,0.08)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLAnchorElement
                el.style.borderColor = 'var(--border)'
                el.style.transform = 'translateY(0)'
                el.style.boxShadow = 'none'
              }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: action.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`ki-filled ${action.icon} text-sm`} style={{ color: action.color }} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">{action.label}</div>
                <div className="text-2xs text-muted-foreground mt-0.5">{action.meta}</div>
              </div>
              <i className="ki-filled ki-right text-xs text-muted-foreground ml-auto" />
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">Последние публикации</h3>
                <span className="text-2xs text-muted-foreground">({posts.length})</span>
              </div>
              <p className="text-2xs text-muted-foreground mt-1">Что сейчас видно команде на стене</p>
            </div>
            <Link href="/org/wall" style={{ fontSize: 11, fontWeight: 700, color: '#F35703', textDecoration: 'none' }}>
              Все →
            </Link>
          </div>
          <div className="divide-y divide-border">
            {posts.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div style={{ width: 56, height: 56, borderRadius: 18, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <i className="ki-filled ki-abstract-45 text-2xl" style={{ color: '#F35703' }} />
                </div>
                <p className="text-sm font-semibold text-foreground">Публикаций пока нет</p>
                <p className="text-2xs text-muted-foreground mt-1">Добавьте первую новость, чтобы наполнить ленту организации.</p>
                <Link href="/org/wall" style={{ fontSize: 12, color: '#F35703', fontWeight: 700, textDecoration: 'none', marginTop: 10, display: 'inline-block' }}>
                  Создать первую →
                </Link>
              </div>
            ) : posts.map(p => {
              const typeCfg = POST_TYPE_BADGE[p.post_type] ?? POST_TYPE_BADGE.announcement
              return (
                <div key={p.id} className="px-5 py-4 flex items-start gap-4 hover:bg-accent/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {p.is_pinned && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 999, background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', fontSize: 10, fontWeight: 700 }}>
                          <span style={{ fontSize: 11 }}>📌</span>
                          Закреплено
                        </span>
                      )}
                      <span style={{ ...typeCfg.style, display: 'inline-flex', padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>
                        {typeCfg.label}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-foreground leading-snug">{p.title}</div>
                    <div className="mt-1 text-2xs text-muted-foreground leading-relaxed">
                      {p.body.slice(0, 110)}{p.body.length > 110 ? '…' : ''}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-2xs font-medium text-muted-foreground">{formatRuDate(p.created_at)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">Рассылки</h3>
                <span className="text-2xs text-muted-foreground">({newsletters.length})</span>
              </div>
              <p className="text-2xs text-muted-foreground mt-1">Статус отправок и охват аудитории</p>
            </div>
            <Link href="/org/newsletters" style={{ fontSize: 11, fontWeight: 700, color: '#F35703', textDecoration: 'none' }}>
              Все →
            </Link>
          </div>
          {newsletters.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div style={{ width: 56, height: 56, borderRadius: 18, background: '#FAF5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <i className="ki-filled ki-sms text-2xl" style={{ color: '#9333EA' }} />
              </div>
              <p className="text-sm font-semibold text-foreground">Рассылок пока нет</p>
              <p className="text-2xs text-muted-foreground mt-1">Запустите первое сообщение, чтобы держать участников в курсе.</p>
              <Link href="/org/newsletters" style={{ fontSize: 12, color: '#F35703', fontWeight: 700, textDecoration: 'none', marginTop: 10, display: 'inline-block' }}>
                Создать рассылку →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {newsletters.map(nl => {
                const st = NL_STATUS[nl.status] ?? NL_STATUS.draft
                return (
                  <div key={nl.id} className="px-5 py-4 flex items-start gap-4 hover:bg-accent/30 transition-colors">
                    <div style={{ width: 42, height: 42, borderRadius: 14, background: '#FAF5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className="ki-filled ki-sms text-sm" style={{ color: '#9333EA' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground leading-snug truncate">{nl.subject}</div>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span style={{ ...st.style, display: 'inline-flex', padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>
                          {st.label}
                        </span>
                        {nl.recipients_count > 0 && (
                          <span className="text-2xs text-muted-foreground">{nl.recipients_count} получателей</span>
                        )}
                        <span className="text-2xs text-muted-foreground">•</span>
                        <span className="text-2xs text-muted-foreground">{formatRuDate(nl.sent_at ?? nl.created_at)}</span>
                      </div>
                    </div>
                    {nl.status === 'sent' && (
                      <Link href={`/org/newsletters/${nl.id}/stats`} style={{ color: '#2563EB', textDecoration: 'none', flexShrink: 0, marginTop: 1 }} title="Статистика">
                        <i className="ki-filled ki-chart-line-up text-sm" />
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
