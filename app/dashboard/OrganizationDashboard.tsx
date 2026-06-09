'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { createBrowserClient } from '@supabase/ssr'
import { Card, Alert } from '@/components/ui/metronic'

const OrgHeroBar       = dynamic(() => import('@/components/organization/OrgHeroBar'),       { ssr: false })
const OrgQuickActions  = dynamic(() => import('@/components/organization/OrgQuickActions'),  { ssr: false })
const OrgTodayEvents   = dynamic(() => import('@/components/organization/OrgTodayEvents'),   { ssr: false })

function getSB() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
        sb.from('wall_posts').select('id, title, post_type, is_pinned, created_at').eq('org_id', orgData.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(5),
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
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  if (!org) {
    return (
      <div className="flex flex-col gap-5 pf-page-enter">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Панель организации</p>
          <h2 className="pf-num text-3xl text-navy-500 mt-0.5">{name}</h2>
        </div>
        <Card className="p-10 text-center">
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <i className="ki-filled ki-office-bag text-2xl" style={{ color: '#2563EB' }} />
          </div>
          <p className="text-sm font-semibold text-foreground">Профиль организации не заполнен</p>
          <p className="text-xs text-muted-foreground mt-1">Заполните данные, чтобы получить полноценный дашборд.</p>
          <Link href="/settings" className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-2 text-sm font-semibold text-[#2563EB]">
            <i className="ki-filled ki-setting-2" />
            Перейти в настройки
          </Link>
        </Card>
      </div>
    )
  }

  const totalMembers = members.length
  const coaches = members.filter(m => m.member_role === 'coach').length
  const athletes = members.filter(m => m.member_role === 'athlete').length

  return (
    <div className="flex flex-col gap-5 pf-page-enter">

      {/* 1. HERO */}
      <OrgHeroBar
        orgName={org.org_name ?? name}
        meta={{ type: org.org_type, sport: org.sport_type, city: org.city }}
        stats={{
          membersCount: totalMembers,
          coachesCount: coaches,
          athletesCount: athletes,
          pendingRequests,
        }}
      />

      {/* 2. QUICK ACTIONS */}
      <OrgQuickActions />

      {/* 3. TODAY'S EVENTS */}
      <OrgTodayEvents orgId={org.id} />

      {/* 4. RECENT POSTS + NEWSLETTERS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E2E8F0]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Стена</p>
              <h3 className="text-base font-bold text-navy-500">Последние публикации</h3>
            </div>
            <Link href="/org/wall" className="text-[11px] font-semibold text-orange-600 hover:underline">Все →</Link>
          </div>
          {posts.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-slate-400">Публикаций пока нет.</p>
              <Link href="/org/wall" className="mt-2 inline-block text-xs text-orange-600 hover:underline">Создать первую →</Link>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {posts.map(p => (
                <Link key={p.id} href="/org/wall" className="block px-5 py-3 hover:bg-muted/40 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {p.is_pinned && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#B45309]"><i className="ki-filled ki-pin text-[10px]" /> закреп</span>
                        )}
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                          {p.post_type}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-foreground truncate">{p.title}</div>
                    </div>
                    <div className="shrink-0 text-[11px] text-muted-foreground">{formatRuDate(p.created_at)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E2E8F0]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Email</p>
              <h3 className="text-base font-bold text-navy-500">Рассылки</h3>
            </div>
            <Link href="/org/newsletters" className="text-[11px] font-semibold text-purple-600 hover:underline">Все →</Link>
          </div>
          {newsletters.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-slate-400">Рассылок пока нет.</p>
              <Link href="/org/newsletters" className="mt-2 inline-block text-xs text-purple-600 hover:underline">Создать первую →</Link>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {newsletters.map(nl => (
                <Link key={nl.id} href="/org/newsletters" className="block px-5 py-3 hover:bg-muted/40 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{nl.subject}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        <span className="font-semibold uppercase tracking-wider">{nl.status}</span>
                        <span> · {nl.recipients_count ?? 0} получателей</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-[11px] text-muted-foreground">
                      {formatRuDate(nl.sent_at ?? nl.created_at)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 5. ORG ADMIN BANNER */}
      <Alert variant="info" icon="ki-office-bag" title="Полное управление организацией">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <p className="min-w-0 flex-1">
            Структура команды, тренировочная база, профиль организации, публичная страница и история всех событий — в разделе /org.
          </p>
          <Link href="/org" className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm">
            Открыть /org
            <i className="ki-filled ki-right text-xs" />
          </Link>
        </div>
      </Alert>
    </div>
  )
}
