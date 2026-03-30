'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import { getMyOrg, getOrgStats } from '@/services/org.service'
import { getWallPosts } from '@/services/wall.service'
import { getNewsletters } from '@/services/newsletter.service'
import type { Organization } from '@/types/org.types'
import type { WallPost } from '@/types/org.types'
import type { Newsletter } from '@/types/org.types'

const POST_TYPE_BADGE: Record<string, string> = {
  announcement: 'bg-blue-50 text-blue-600 border border-blue-200',
  event:        'bg-orange-50 text-orange-600 border border-orange-200',
  news:         'bg-green-50 text-green-600 border border-green-200',
  result:       'bg-violet-50 text-violet-600 border border-violet-200',
}

export default function OrgDashboard() {
  const { user, loading: userLoading } = useUser()
  const [org, setOrg] = useState<Organization | null>(null)
  const [stats, setStats] = useState({ total: 0, coaches: 0, athletes: 0 })
  const [posts, setPosts] = useState<WallPost[]>([])
  const [newsletters, setNewsletters] = useState<Newsletter[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userLoading) return
    if (user?.role !== 'organization') { setLoading(false); return }

    async function load() {
      const orgData = await getMyOrg()
      if (!orgData) { setLoading(false); return }
      setOrg(orgData)

      const [statsData, postsData, nlData] = await Promise.all([
        getOrgStats(orgData.id),
        getWallPosts(orgData.id),
        getNewsletters(orgData.id),
      ])
      setStats(statsData)
      setPosts(postsData.slice(0, 3))
      setNewsletters(nlData.slice(0, 1))
      setLoading(false)
    }
    load()
  }, [user, userLoading])

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  if (user?.role !== 'organization') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
          <i className="ki-filled ki-office-bag text-2xl text-blue-400" />
        </div>
        <p className="text-sm font-semibold text-foreground">Organization Access Required</p>
        <p className="text-2sm text-muted-foreground">This section is only available for Organization accounts.</p>
      </div>
    )
  }

  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
          <i className="ki-filled ki-office-bag text-2xl text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-foreground">Organization not found</p>
        <p className="text-2sm text-muted-foreground">Your organization profile could not be loaded.</p>
      </div>
    )
  }

  const lastNl = newsletters[0]

  return (
    <div className="flex flex-col gap-6 pf-enter">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">Organization</p>
            {org.is_verified && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                <i className="ki-filled ki-verify text-xs" />
                Verified
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
        <div className="flex gap-2 flex-wrap">
          <Link href={`/${org.org_slug}`} target="_blank"
            className="kt-btn kt-btn-outline gap-2 text-sm">
            <i className="ki-filled ki-exit-right-corner text-xs" />
            Public page
          </Link>
          <Link href="/org/wall" className="kt-btn kt-btn-primary gap-2 text-sm">
            <i className="ki-filled ki-plus text-xs" />
            New post
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 pf-stagger">
        {[
          { label: 'Total members',   value: stats.total,    icon: 'ki-people',        bg: 'bg-blue-50 text-blue-600' },
          { label: 'Active coaches',  value: stats.coaches,  icon: 'ki-notepad-edit',  bg: 'bg-green-50 text-green-600' },
          { label: 'Athletes',        value: stats.athletes, icon: 'ki-abstract-26',   bg: 'bg-orange-50 text-orange-600' },
        ].map(c => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.bg}`}>
              <i className={`ki-filled ${c.icon} text-base`} />
            </div>
            <div>
              <div className="pf-num text-3xl text-foreground">{c.value}</div>
              <div className="text-2xs text-muted-foreground">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent posts */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Recent posts</h3>
            <Link href="/org/wall" className="text-2xs font-semibold text-orange-600 hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-border">
            {posts.length === 0 ? (
              <div className="px-5 py-8 text-center text-2sm text-muted-foreground">No posts yet</div>
            ) : posts.map(p => (
              <div key={p.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-accent/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {p.is_pinned && <span className="text-xs">📌</span>}
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-2xs font-semibold capitalize ${POST_TYPE_BADGE[p.post_type] ?? 'bg-slate-100 text-slate-500'}`}>
                      {p.post_type}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-foreground truncate">{p.title}</div>
                  <div className="text-2xs text-muted-foreground truncate mt-0.5">{p.body.slice(0, 80)}{p.body.length > 80 ? '…' : ''}</div>
                </div>
                <div className="text-2xs text-muted-foreground shrink-0 whitespace-nowrap">
                  {new Date(p.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Last newsletter */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Last newsletter</h3>
            <Link href="/org/newsletters" className="text-2xs font-semibold text-orange-600 hover:underline">View all →</Link>
          </div>
          {!lastNl ? (
            <div className="px-5 py-8 text-center text-2sm text-muted-foreground">No newsletters yet</div>
          ) : (
            <div className="p-5 flex flex-col gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-2xs font-semibold capitalize ${
                    lastNl.status === 'sent' ? 'bg-green-50 text-green-600 border border-green-200' :
                    lastNl.status === 'draft' ? 'bg-slate-100 text-slate-500' :
                    'bg-orange-50 text-orange-600 border border-orange-200'
                  }`}>{lastNl.status}</span>
                </div>
                <div className="text-sm font-semibold text-foreground">{lastNl.subject}</div>
                <div className="text-2xs text-muted-foreground mt-0.5">
                  {lastNl.sent_at
                    ? `Sent ${new Date(lastNl.sent_at).toLocaleDateString('ru-RU')}`
                    : `Created ${new Date(lastNl.created_at).toLocaleDateString('ru-RU')}`}
                </div>
              </div>
              {lastNl.status === 'sent' && (
                <Link
                  href={`/org/newsletters/${lastNl.id}/stats`}
                  className="text-2xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <i className="ki-filled ki-chart-line-up text-xs" />
                  View delivery stats →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
