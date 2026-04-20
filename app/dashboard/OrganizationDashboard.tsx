'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { StatCard } from '@/components/ui/StatCard'

function getSB() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

type OrgRow = {
  id: string
  org_name: string | null
  org_slug: string | null
  sport_type: string | null
  city: string | null
  org_type: string | null
  is_verified: boolean | null
  members_count: number | null
  coaches_count: number | null
}

type MemberRow = { member_role: string | null; status: string | null }
type PostRow = { id: string; title: string; post_type: string; is_pinned: boolean; created_at: string }
type NewsletterRow = { id: string; subject: string; status: string; sent_at: string | null; created_at: string; recipients_count: number | null }

function formatRuDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(value))
}

export default function OrganizationDashboard({ userId, name }: { userId: string; name: string }) {
  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState<OrgRow | null>(null)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [posts, setPosts] = useState<PostRow[]>([])
  const [newsletters, setNewsletters] = useState<NewsletterRow[]>([])
  const [pendingRequests, setPendingRequests] = useState(0)

  useEffect(() => {
    (async () => {
      const sb = getSB()
      const { data: orgData } = await sb
        .from('organizations')
        .select('id, org_name, org_slug, sport_type, city, org_type, is_verified, members_count, coaches_count')
        .eq('id', userId)
        .maybeSingle()
      if (!orgData) { setLoading(false); return }
      setOrg(orgData as OrgRow)

      const [mRes, pRes, nRes, cRes] = await Promise.all([
        sb.from('org_members').select('member_role, status').eq('org_id', orgData.id).neq('status', 'removed'),
        sb.from('wall_posts').select('id, title, post_type, is_pinned, created_at').eq('org_id', orgData.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(4),
        sb.from('newsletters').select('id, subject, status, sent_at, created_at, recipients_count').eq('org_id', orgData.id).order('created_at', { ascending: false }).limit(3),
        sb.from('connections').select('id', { count: 'exact', head: true }).eq('recipient_id', userId).eq('status', 'pending'),
      ])
      setMembers((mRes.data ?? []) as MemberRow[])
      setPosts((pRes.data ?? []) as PostRow[])
      setNewsletters((nRes.data ?? []) as NewsletterRow[])
      setPendingRequests(cRes.count ?? 0)
      setLoading(false)
    })()
  }, [userId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  if (!org) {
    return (
      <div className="flex flex-col gap-6 pf-page-enter">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Панель организации</p>
          <h2 className="pf-num text-3xl text-slate-900 mt-0.5">{name}</h2>
        </div>
        <div className="card bg-white border border-[#E2E8F0] rounded-2xl p-10 text-center">
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <i className="ki-filled ki-office-bag text-2xl" style={{ color: '#2563EB' }} />
          </div>
          <p className="text-sm font-semibold text-foreground">Профиль организации не заполнен</p>
          <p className="text-xs text-muted-foreground mt-1">Заполните данные, чтобы получить полноценный дашборд.</p>
          <Link href="/settings" className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-2 text-sm font-semibold text-[#2563EB]">
            <i className="ki-filled ki-setting-2" />
            Перейти в настройки
          </Link>
        </div>
      </div>
    )
  }

  const totalMembers = members.length
  const coaches = members.filter(m => m.member_role === 'coach').length
  const athletes = members.filter(m => m.member_role === 'athlete').length
  const sentCount = newsletters.filter(nl => nl.status === 'sent').length
  const draftCount = newsletters.filter(nl => nl.status === 'draft').length

  return (
    <div className="flex flex-col gap-6 pf-page-enter">
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Панель организации</p>
        <h2 className="pf-num text-3xl text-slate-900 mt-0.5">{org.org_name ?? name}</h2>
        <p className="text-xs text-slate-400 mt-1">
          {[org.org_type, org.sport_type, org.city].filter(Boolean).join(' · ') || 'Команда на базе ProForm'}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pf-stagger">
        <StatCard label="Активный состав" value={totalMembers} icon="ki-people" iconColor="#2563EB" />
        <StatCard label="Тренеров" value={coaches} icon="ki-award" iconColor="#16A34A" />
        <StatCard label="Атлетов" value={athletes} icon="ki-abstract-26" iconColor="#F97316" />
        <StatCard label="Запросы в связи" value={pendingRequests} icon="ki-message-question" iconColor="#9333EA" sub={pendingRequests > 0 ? 'ждут ответа' : 'новых нет'} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/org/members" className="group flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 transition hover:border-[#2563EB]/60 hover:shadow-sm">
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ki-filled ki-people text-[15px]" style={{ color: '#2563EB' }} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">Участники</div>
            <div className="text-[11px] text-muted-foreground">Состав и приглашения</div>
          </div>
          <i className="ki-filled ki-right text-xs text-muted-foreground ml-auto" />
        </Link>
        <Link href="/org/wall" className="group flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 transition hover:border-[#F97316]/60 hover:shadow-sm">
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ki-filled ki-abstract-45 text-[15px]" style={{ color: '#F97316' }} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">Стена</div>
            <div className="text-[11px] text-muted-foreground">Новости и анонсы</div>
          </div>
          <i className="ki-filled ki-right text-xs text-muted-foreground ml-auto" />
        </Link>
        <Link href="/org/newsletters" className="group flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 transition hover:border-[#9333EA]/60 hover:shadow-sm">
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FAF5FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ki-filled ki-sms text-[15px]" style={{ color: '#9333EA' }} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">Рассылки</div>
            <div className="text-[11px] text-muted-foreground">{sentCount} отпр. · {draftCount} черн.</div>
          </div>
          <i className="ki-filled ki-right text-xs text-muted-foreground ml-auto" />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
            <p className="pf-num text-lg text-slate-900">Последние публикации</p>
            <Link href="/org/wall" className="text-xs font-semibold text-[#F97316] hover:underline">Все →</Link>
          </div>
          {posts.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">
              Публикаций пока нет.
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {posts.map(p => (
                <div key={p.id} className="px-5 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {p.is_pinned && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#B45309]">📌 закреп</span>
                      )}
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                        {p.post_type}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-foreground truncate">{p.title}</div>
                  </div>
                  <div className="shrink-0 text-[11px] text-muted-foreground">{formatRuDate(p.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
            <p className="pf-num text-lg text-slate-900">Рассылки</p>
            <Link href="/org/newsletters" className="text-xs font-semibold text-[#9333EA] hover:underline">Все →</Link>
          </div>
          {newsletters.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">
              Рассылок пока нет.
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {newsletters.map(nl => (
                <div key={nl.id} className="px-5 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{nl.subject}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {nl.status} · {nl.recipients_count ?? 0} получателей
                    </div>
                  </div>
                  <div className="shrink-0 text-[11px] text-muted-foreground">
                    {formatRuDate(nl.sent_at ?? nl.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
        <div className="flex items-start gap-3">
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="ki-filled ki-office-bag text-[15px]" style={{ color: '#2563EB' }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">Полное управление организацией</div>
            <p className="text-xs text-muted-foreground mt-1">
              Настройки профиля, структура команды, тренировочная база и публичная страница доступны в разделе /org.
            </p>
          </div>
          <Link href="/org" className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] px-4 py-2 text-sm font-semibold text-white shadow-sm">
            Открыть /org
            <i className="ki-filled ki-right text-xs" />
          </Link>
        </div>
      </div>
    </div>
  )
}
