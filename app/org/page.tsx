'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/lib/hooks/useUser'

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
  event:        { label: 'Событие',    style: { background: '#FFF7ED', color: '#F97316', border: '1px solid #FED7AA' } },
  news:         { label: 'Новость',    style: { background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' } },
  result:       { label: 'Результат',  style: { background: '#FAF5FF', color: '#9333EA', border: '1px solid #E9D5FF' } },
}

const NL_STATUS: Record<string, { label: string; style: React.CSSProperties }> = {
  sent:      { label: 'Отправлена',  style: { background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' } },
  draft:     { label: 'Черновик',    style: { background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' } },
  scheduled: { label: 'Запланирована', style: { background: '#FFF7ED', color: '#F97316', border: '1px solid #FED7AA' } },
  cancelled: { label: 'Отменена',    style: { background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' } },
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

  return (
    <div className="flex flex-col gap-6 pf-enter">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">Организация</p>
            {org.is_verified && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
                <i className="ki-filled ki-verify text-xs" />Проверено
              </span>
            )}
          </div>
          <h2 className="pf-num text-[36px] text-foreground leading-none">{org.org_name}</h2>
          {(org.sport_type || org.city) && (
            <p className="text-2sm text-muted-foreground mt-1">
              {[org.sport_type, org.city].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <Link href={`/${org.org_slug}`} target="_blank" style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '9px 18px', borderRadius: 12, textDecoration: 'none',
            border: '1.5px solid var(--border)', background: 'var(--card)',
            color: 'var(--muted-foreground)', fontSize: 13, fontWeight: 600,
            transition: 'all 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <i className="ki-filled ki-exit-right-corner" style={{ fontSize: 13 }} />
            Публичная страница
          </Link>
          <Link href="/org/wall" style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '9px 18px', borderRadius: 12, textDecoration: 'none',
            border: '1.5px solid #FED7AA',
            background: 'linear-gradient(135deg, #F97316, #EA580C)',
            color: 'white', fontSize: 13, fontWeight: 700,
            boxShadow: '0 2px 8px rgba(249,115,22,0.35)',
          }}>
            <i className="ki-filled ki-plus" style={{ fontSize: 14 }} />
            Новая публикация
          </Link>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Всего участников', value: stats.total,    icon: 'ki-people',       color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Тренеров',         value: stats.coaches,  icon: 'ki-notepad-edit', color: '#16A34A', bg: '#F0FDF4' },
          { label: 'Атлетов',          value: stats.athletes, icon: 'ki-abstract-26',  color: '#F97316', bg: '#FFF7ED' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
            <div style={{ width: 44, height: 44, borderRadius: 14, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`ki-filled ${s.icon} text-base`} style={{ color: s.color }} />
            </div>
            <div>
              <div className="pf-num text-3xl text-foreground leading-none">{s.value}</div>
              <div className="text-2xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Быстрые действия ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: '/org/members', icon: 'ki-people',     color: '#2563EB', bg: '#EFF6FF', label: 'Участники' },
          { href: '/org/wall',    icon: 'ki-abstract-45',color: '#F97316', bg: '#FFF7ED', label: 'Стена' },
          { href: '/org/newsletters', icon: 'ki-sms', color: '#9333EA', bg: '#FAF5FF', label: 'Рассылки' },
          { href: '/org/settings',    icon: 'ki-setting-2', color: '#64748B', bg: '#F8FAFC', label: 'Настройки' },
        ].map(a => (
          <Link key={a.href} href={a.href} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px', borderRadius: 14, textDecoration: 'none',
            background: 'var(--card)', border: '1px solid var(--border)',
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = a.color + '60'; (e.currentTarget as HTMLAnchorElement).style.background = a.bg }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLAnchorElement).style.background = 'var(--card)' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`ki-filled ${a.icon} text-sm`} style={{ color: a.color }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{a.label}</span>
            <i className="ki-filled ki-right text-xs text-muted-foreground ml-auto" />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Последние публикации ── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Последние публикации</h3>
            <Link href="/org/wall" style={{ fontSize: 11, fontWeight: 700, color: '#F97316', textDecoration: 'none' }}>
              Все →
            </Link>
          </div>
          <div className="divide-y divide-border">
            {posts.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <i className="ki-filled ki-abstract-45 text-2xl text-muted-foreground/30 block mb-2" />
                <p className="text-2sm text-muted-foreground">Публикаций пока нет</p>
                <Link href="/org/wall" style={{ fontSize: 12, color: '#F97316', fontWeight: 600, textDecoration: 'none', marginTop: 8, display: 'inline-block' }}>
                  Создать первую →
                </Link>
              </div>
            ) : posts.map(p => {
              const typeCfg = POST_TYPE_BADGE[p.post_type] ?? POST_TYPE_BADGE.announcement
              return (
                <div key={p.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-accent/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      {p.is_pinned && <span style={{ fontSize: 12 }}>📌</span>}
                      <span style={{ ...typeCfg.style, display: 'inline-flex', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>
                        {typeCfg.label}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-foreground truncate">{p.title}</div>
                    <div className="text-2xs text-muted-foreground truncate mt-0.5">
                      {p.body.slice(0, 90)}{p.body.length > 90 ? '…' : ''}
                    </div>
                  </div>
                  <div className="text-2xs text-muted-foreground shrink-0 whitespace-nowrap">
                    {new Date(p.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Рассылки ── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Рассылки</h3>
            <Link href="/org/newsletters" style={{ fontSize: 11, fontWeight: 700, color: '#F97316', textDecoration: 'none' }}>
              Все →
            </Link>
          </div>
          {newsletters.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <i className="ki-filled ki-sms text-2xl text-muted-foreground/30 block mb-2" />
              <p className="text-2sm text-muted-foreground">Рассылок пока нет</p>
              <Link href="/org/newsletters" style={{ fontSize: 12, color: '#F97316', fontWeight: 600, textDecoration: 'none', marginTop: 8, display: 'inline-block' }}>
                Создать рассылку →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {newsletters.map(nl => {
                const st = NL_STATUS[nl.status] ?? NL_STATUS.draft
                return (
                  <div key={nl.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-accent/30 transition-colors">
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FAF5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className="ki-filled ki-sms text-sm" style={{ color: '#9333EA' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{nl.subject}</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span style={{ ...st.style, display: 'inline-flex', padding: '1px 7px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{st.label}</span>
                        {nl.recipients_count > 0 && (
                          <span className="text-2xs text-muted-foreground">{nl.recipients_count} получателей</span>
                        )}
                      </div>
                    </div>
                    <div className="text-2xs text-muted-foreground shrink-0">
                      {new Date(nl.sent_at ?? nl.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </div>
                    {nl.status === 'sent' && (
                      <Link href={`/org/newsletters/${nl.id}/stats`} style={{ color: '#2563EB', textDecoration: 'none', flexShrink: 0 }} title="Статистика">
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
