'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import { getNewsletter, getNewsletterStats } from '@/services/newsletter.service'
import type { Newsletter, NewsletterStats } from '@/types/org.types'

export default function NewsletterStatsPage() {
  const { id } = useParams<{ id: string }>()
  const { user, loading: userLoading } = useUser()
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null)
  const [stats, setStats] = useState<NewsletterStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userLoading) return
    async function load() {
      const [nl, s] = await Promise.all([
        getNewsletter(id),
        getNewsletterStats(id),
      ])
      setNewsletter(nl)
      setStats(s)
      setLoading(false)
    }
    load()
  }, [id, userLoading])

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
        <i className="ki-filled ki-shield-cross text-3xl text-red-400" />
        <p className="text-sm font-semibold text-foreground">Organization Access Required</p>
      </div>
    )
  }

  if (!newsletter) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <i className="ki-filled ki-information-5 text-3xl text-slate-400" />
        <p className="text-sm font-semibold text-foreground">Newsletter not found</p>
      </div>
    )
  }

  const openRate = stats && stats.delivered > 0 ? Math.round((stats.opened / stats.delivered) * 100) : 0
  const deliveryRate = stats && stats.sent > 0 ? Math.round((stats.delivered / stats.sent) * 100) : 0

  const STAT_CARDS = [
    { label: 'Sent',      value: stats?.sent ?? 0,      icon: 'ki-send',           bg: 'bg-blue-50 text-blue-600' },
    { label: 'Delivered', value: stats?.delivered ?? 0, icon: 'ki-check-circle',   bg: 'bg-green-50 text-green-600' },
    { label: 'Opened',    value: stats?.opened ?? 0,    icon: 'ki-eye',            bg: 'bg-orange-50 text-orange-600' },
    { label: 'Failed',    value: stats?.failed ?? 0,    icon: 'ki-shield-cross',   bg: 'bg-red-50 text-red-500' },
  ]

  return (
    <div className="flex flex-col gap-6 pf-enter">
      {/* Back */}
      <div>
        <Link href="/org/newsletters" className="inline-flex items-center gap-2 text-2sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <i className="ki-filled ki-left text-xs" />
          Back to newsletters
        </Link>
        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Newsletter stats</p>
        <h2 className="pf-num text-[32px] text-foreground leading-tight">{newsletter.subject}</h2>
        <p className="text-2sm text-muted-foreground mt-1">
          Sent {newsletter.sent_at
            ? new Date(newsletter.sent_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
            : '—'} · To: {newsletter.target_roles.join(', ')}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 pf-stagger">
        {STAT_CARDS.map(c => (
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

      {/* Rates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-foreground">Delivery rate</span>
            <span className="pf-num text-2xl text-green-600">{deliveryRate}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-2 rounded-full bg-green-500 transition-all duration-500"
              style={{ width: `${deliveryRate}%` }}
            />
          </div>
          <p className="text-2xs text-muted-foreground mt-2">{stats?.delivered} of {stats?.sent} recipients</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-foreground">Open rate</span>
            <span className="pf-num text-2xl text-orange-600">{openRate}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-2 rounded-full bg-orange-500 transition-all duration-500"
              style={{ width: `${openRate}%` }}
            />
          </div>
          <p className="text-2xs text-muted-foreground mt-2">{stats?.opened} of {stats?.delivered} delivered</p>
        </div>
      </div>

      {/* Content preview */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Newsletter content</h3>
        <p className="text-2sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{newsletter.body}</p>
      </div>
    </div>
  )
}
