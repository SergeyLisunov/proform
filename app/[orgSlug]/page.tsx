'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getOrgBySlug } from '@/services/org.service'
import { getPublicWallPosts } from '@/services/wall.service'
import type { Organization, WallPost, PostType } from '@/types/org.types'

const POST_TYPE_BADGE: Record<PostType, string> = {
  announcement: 'bg-blue-50 text-blue-600 border border-blue-200',
  event:        'bg-orange-50 text-orange-600 border border-orange-200',
  news:         'bg-green-50 text-green-600 border border-green-200',
  result:       'bg-violet-50 text-violet-600 border border-violet-200',
}

const SPORT_LABELS: Record<string, string> = {
  athletics: 'Athletics', swimming: 'Swimming', cycling: 'Cycling',
  triathlon: 'Triathlon', football: 'Football', basketball: 'Basketball',
  tennis: 'Tennis', volleyball: 'Volleyball', wrestling: 'Wrestling', other: 'Sport',
}

export default function OrgPublicPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const [org, setOrg] = useState<Organization | null>(null)
  const [posts, setPosts] = useState<WallPost[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const orgData = await getOrgBySlug(orgSlug)
      if (!orgData) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setOrg(orgData)
      const p = await getPublicWallPosts(orgData.id)
      setPosts(p)
      setLoading(false)
    }
    load()
  }, [orgSlug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-background p-6">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
          <i className="ki-filled ki-office-bag text-2xl text-slate-400" />
        </div>
        <div className="text-center">
          <h1 className="pf-num text-3xl text-foreground mb-2">Organization not found</h1>
          <p className="text-muted-foreground text-sm">The page <code className="font-mono text-orange-600">/{orgSlug}</code> doesn&apos;t exist.</p>
        </div>
        <Link href="/auth/login" className="kt-btn kt-btn-primary">Go to ProForm</Link>
      </div>
    )
  }

  const pinned = posts.filter(p => p.is_pinned)
  const feed = posts.filter(p => !p.is_pinned)
  const initials = org!.org_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-3xl mx-auto px-5 py-8">
          <div className="flex items-start gap-5">
            {/* Logo placeholder */}
            <div className="w-16 h-16 rounded-2xl bg-orange-500 flex items-center justify-center shrink-0">
              <span className="pf-num text-2xl text-white">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="pf-num text-3xl text-foreground leading-tight">{org!.org_name}</h1>
                {org!.is_verified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                    <i className="ki-filled ki-verify text-xs" />
                    Verified
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {org!.sport_type && (
                  <span className="inline-flex items-center gap-1 text-2sm text-muted-foreground">
                    <i className="ki-filled ki-abstract-26 text-xs" />
                    {SPORT_LABELS[org!.sport_type] ?? org!.sport_type}
                  </span>
                )}
                {org!.city && (
                  <span className="inline-flex items-center gap-1 text-2sm text-muted-foreground">
                    <i className="ki-filled ki-geolocation text-xs" />
                    {org!.city}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-5 py-8 flex flex-col gap-8">
        {/* Pinned posts */}
        {pinned.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <span>📌</span>
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Pinned</h2>
            </div>
            <div className="flex flex-col gap-3">
              {pinned.map(p => <PublicPostCard key={p.id} post={p} />)}
            </div>
          </section>
        )}

        {/* Feed */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Latest posts</h2>
          </div>
          {feed.length === 0 && pinned.length === 0 ? (
            <div className="bg-card border border-border rounded-xl px-5 py-12 text-center text-muted-foreground text-2sm">
              No public posts yet.
            </div>
          ) : feed.length === 0 ? null : (
            <div className="flex flex-col gap-3">
              {feed.map(p => <PublicPostCard key={p.id} post={p} />)}
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <div className="border-t border-border mt-10">
        <div className="max-w-3xl mx-auto px-5 py-6 flex items-center justify-between text-2xs text-muted-foreground">
          <span>Powered by <Link href="/" className="text-orange-600 font-semibold hover:underline">ProForm</Link></span>
          <Link href="/auth/login" className="text-orange-600 font-semibold hover:underline">Sign in →</Link>
        </div>
      </div>
    </div>
  )
}

function PublicPostCard({ post }: { post: WallPost }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-2xs font-semibold capitalize ${POST_TYPE_BADGE[post.post_type]}`}>
              {post.post_type}
            </span>
            {post.event_date && (
              <span className="text-2xs text-muted-foreground flex items-center gap-1">
                <i className="ki-filled ki-calendar text-xs" />
                {new Date(post.event_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">{post.title}</h3>
          <p className="text-2sm text-muted-foreground leading-relaxed">{post.body}</p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-border">
        <span className="text-2xs text-muted-foreground">
          {new Date(post.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
      </div>
    </div>
  )
}
