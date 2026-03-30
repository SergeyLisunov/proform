'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@/lib/hooks/useUser'
import { getMyOrg } from '@/services/org.service'
import { getWallPosts, createWallPost, togglePin, softDeletePost } from '@/services/wall.service'
import type { Organization, WallPost, PostType, PostVisibility } from '@/types/org.types'

const POST_TYPE_BADGE: Record<PostType, string> = {
  announcement: 'bg-blue-50 text-blue-600 border border-blue-200',
  event:        'bg-orange-50 text-orange-600 border border-orange-200',
  news:         'bg-green-50 text-green-600 border border-green-200',
  result:       'bg-violet-50 text-violet-600 border border-violet-200',
}

const POST_TYPES: PostType[] = ['announcement', 'event', 'news', 'result']

export default function OrgWallPage() {
  const { user, loading: userLoading } = useUser()
  const [org, setOrg] = useState<Organization | null>(null)
  const [posts, setPosts] = useState<WallPost[]>([])
  const [loading, setLoading] = useState(true)

  // Create post modal
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    title: '',
    body: '',
    post_type: 'announcement' as PostType,
    event_date: '',
    visible_to: 'all' as PostVisibility,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (userLoading) return
    if (user?.role !== 'organization') { setLoading(false); return }
    async function load() {
      const orgData = await getMyOrg()
      if (!orgData) { setLoading(false); return }
      setOrg(orgData)
      const p = await getWallPosts(orgData.id)
      setPosts(p)
      setLoading(false)
    }
    load()
  }, [user, userLoading])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!org || !user) return
    setSaving(true)
    const post = await createWallPost({
      org_id: org.id,
      author_id: user.id,
      title: form.title,
      body: form.body,
      post_type: form.post_type,
      event_date: form.event_date || null,
      visible_to: form.visible_to,
    })
    if (post) {
      setPosts(prev => [post, ...prev])
      setForm({ title: '', body: '', post_type: 'announcement', event_date: '', visible_to: 'all' })
      setShowCreate(false)
    }
    setSaving(false)
  }

  async function handleTogglePin(post: WallPost) {
    const pinnedCount = posts.filter(p => p.is_pinned).length
    if (!post.is_pinned && pinnedCount >= 5) {
      alert('Maximum 5 pinned posts allowed.')
      return
    }
    await togglePin(post.id, !post.is_pinned)
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, is_pinned: !p.is_pinned } : p))
  }

  async function handleDelete(postId: string) {
    if (!confirm('Delete this post?')) return
    await softDeletePost(postId)
    setPosts(prev => prev.filter(p => p.id !== postId))
  }

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

  const pinned = posts.filter(p => p.is_pinned)
  const feed = posts.filter(p => !p.is_pinned)

  return (
    <div className="flex flex-col gap-5 pf-enter">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Organization</p>
          <h2 className="pf-num text-[36px] text-foreground leading-none">Wall</h2>
          <p className="text-2sm text-muted-foreground mt-1">{org?.org_name}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="kt-btn kt-btn-primary gap-2">
          <i className="ki-filled ki-plus text-sm" />
          New post
        </button>
      </div>

      {/* Pinned section */}
      {pinned.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">📌</span>
            <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">Pinned</span>
          </div>
          <div className="flex flex-col gap-3">
            {pinned.map(p => <PostCard key={p.id} post={p} onPin={() => handleTogglePin(p)} onDelete={() => handleDelete(p.id)} />)}
          </div>
        </div>
      )}

      {/* Feed */}
      <div>
        <div className="mb-3">
          <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">All posts</span>
        </div>
        {feed.length === 0 && pinned.length === 0 ? (
          <div className="bg-card border border-border rounded-xl px-5 py-12 text-center text-muted-foreground text-2sm">
            No posts yet. Create the first one!
          </div>
        ) : feed.length === 0 ? null : (
          <div className="flex flex-col gap-3">
            {feed.map(p => <PostCard key={p.id} post={p} onPin={() => handleTogglePin(p)} onDelete={() => handleDelete(p.id)} />)}
          </div>
        )}
      </div>

      {/* Create Post Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}
        >
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="pf-num text-xl text-foreground">New post</h3>
              <button onClick={() => setShowCreate(false)} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
                <i className="ki-filled ki-cross text-sm" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Type</label>
                  <select
                    value={form.post_type}
                    onChange={e => setForm(f => ({ ...f, post_type: e.target.value as PostType }))}
                    className="w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400 bg-background"
                  >
                    {POST_TYPES.map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Visible to</label>
                  <select
                    value={form.visible_to}
                    onChange={e => setForm(f => ({ ...f, visible_to: e.target.value as PostVisibility }))}
                    className="w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400 bg-background"
                  >
                    <option value="all">Everyone (public)</option>
                    <option value="members">Members only</option>
                    <option value="coaches">Coaches only</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                  placeholder="Post title"
                  className="w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                />
              </div>
              <div>
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Body *</label>
                <textarea
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  required
                  rows={4}
                  placeholder="Write your post…"
                  className="w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400 resize-none"
                />
              </div>
              {(form.post_type === 'event') && (
                <div>
                  <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Event date</label>
                  <input
                    type="date"
                    value={form.event_date}
                    onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                    className="w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                  />
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving} className="flex-1 kt-btn kt-btn-primary">
                  {saving ? 'Saving…' : 'Publish post'}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="kt-btn kt-btn-outline">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function PostCard({ post, onPin, onDelete }: { post: WallPost; onPin: () => void; onDelete: () => void }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {post.is_pinned && <span className="text-sm">📌</span>}
            <span className={`inline-flex px-2 py-0.5 rounded-full text-2xs font-semibold capitalize ${POST_TYPE_BADGE[post.post_type]}`}>
              {post.post_type}
            </span>
            <span className="inline-flex px-2 py-0.5 rounded-full text-2xs font-medium bg-slate-100 text-slate-500 capitalize">
              {post.visible_to === 'all' ? 'Public' : post.visible_to}
            </span>
            {post.event_date && (
              <span className="text-2xs text-muted-foreground flex items-center gap-1">
                <i className="ki-filled ki-calendar text-xs" />
                {new Date(post.event_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
              </span>
            )}
          </div>
          <h4 className="text-sm font-semibold text-foreground mb-1">{post.title}</h4>
          <p className="text-2sm text-muted-foreground leading-relaxed">{post.body}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={onPin}
            title={post.is_pinned ? 'Unpin' : 'Pin'}
            className={`kt-btn kt-btn-xs kt-btn-icon ${post.is_pinned ? 'kt-btn-primary' : 'kt-btn-outline'}`}
          >
            <i className="ki-filled ki-pin text-xs" />
          </button>
          <button
            onClick={onDelete}
            title="Delete"
            className="kt-btn kt-btn-xs kt-btn-icon kt-btn-outline hover:!bg-red-50 hover:!border-red-200 hover:!text-red-600"
          >
            <i className="ki-filled ki-trash text-xs" />
          </button>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
        <span className="text-2xs text-muted-foreground">
          {new Date(post.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>
    </div>
  )
}
