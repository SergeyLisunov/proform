'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import { useToast } from '@/lib/hooks/useToast'
import { getMyOrg } from '@/services/org.service'
import { getWallPosts, createWallPost, togglePin, softDeletePost } from '@/services/wall.service'
import type { Organization, WallPost, PostType, PostVisibility } from '@/types/org.types'
import { Card, Alert } from '@/components/ui/metronic'

const POST_TYPE_META: Record<PostType, { label: string; badge: string; icon: string; accent: string; panel: string }> = {
  announcement: {
    label: 'Объявление',
    badge: 'bg-blue-50 text-blue-600 border border-blue-200',
    icon: 'ki-notification-status',
    accent: '#2563EB',
    panel: '#EFF6FF',
  },
  event: {
    label: 'Событие',
    badge: 'bg-orange-50 text-orange-600 border border-orange-200',
    icon: 'ki-calendar-tick',
    accent: '#F35703',
    panel: '#FFF7ED',
  },
  news: {
    label: 'Новость',
    badge: 'bg-green-50 text-green-600 border border-green-200',
    icon: 'ki-abstract-26',
    accent: '#16A34A',
    panel: '#F0FDF4',
  },
  result: {
    label: 'Результат',
    badge: 'bg-violet-50 text-violet-600 border border-violet-200',
    icon: 'ki-chart-line-up-2',
    accent: '#9333EA',
    panel: '#FAF5FF',
  },
}

const POST_TYPES: PostType[] = ['announcement', 'event', 'news', 'result']

const VISIBILITY_META: Record<PostVisibility, { label: string; badge: string; hint: string }> = {
  all: {
    label: 'Публично',
    badge: 'bg-slate-100 text-slate-600 border border-slate-200',
    hint: 'Доступно всем посетителям',
  },
  members: {
    label: 'Участники',
    badge: 'bg-amber-50 text-amber-700 border border-amber-200',
    hint: 'Видно только участникам клуба',
  },
  coaches: {
    label: 'Тренеры',
    badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    hint: 'Видно только тренерам',
  },
}

function formatDate(date: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Intl.DateTimeFormat('ru-RU', options).format(new Date(date))
}

export default function OrgWallPage() {
  const { user, loading: userLoading } = useUser()
  const { warning } = useToast()
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
      warning('Максимум 5 закреплённых публикаций.')
      return
    }
    await togglePin(post.id, !post.is_pinned)
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, is_pinned: !p.is_pinned } : p))
  }

  async function handleDelete(postId: string) {
    if (!confirm('Удалить эту публикацию?')) return
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
        <p className="text-sm font-semibold text-foreground">Требуется доступ организации</p>
      </div>
    )
  }

  const pinned = posts.filter(p => p.is_pinned)
  const feed = posts.filter(p => !p.is_pinned)
  const eventPosts = posts.filter(p => p.post_type === 'event').length
  const publicPosts = posts.filter(p => p.visible_to === 'all').length
  const latestPost = posts[0]
  const summary = [
    { label: 'Всего публикаций', value: posts.length, hint: 'Все записи на стене', icon: 'ki-abstract-26', color: '#2563EB', bg: '#EFF6FF' },
    { label: 'Закреплено', value: pinned.length, hint: 'Верх ленты и важные анонсы', icon: 'ki-pin', color: '#F35703', bg: '#FFF7ED' },
    { label: 'События', value: eventPosts, hint: 'Посты с датой события', icon: 'ki-calendar-tick', color: '#9333EA', bg: '#FAF5FF' },
    { label: 'Публичные', value: publicPosts, hint: 'Открыты всем посетителям', icon: 'ki-eye', color: '#16A34A', bg: '#F0FDF4' },
  ]

  return (
    <div className="flex flex-col gap-6 pf-enter">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(249,115,22,0.15),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(37,99,235,0.08),_transparent_28%)]" />
        <div className="relative p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-orange-700">
                  Организация
                </span>
                <span className="inline-flex items-center rounded-full border border-border bg-background/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Контент
                </span>
                <span className="inline-flex items-center rounded-full border border-border bg-background/80 px-3 py-1 text-[10px] font-semibold text-muted-foreground">
                  {org?.org_name}
                </span>
              </div>
              <h2 className="pf-num text-[clamp(2.15rem,4vw,3.75rem)] leading-[0.95] tracking-tight text-foreground">
                Стена
              </h2>
              <p className="mt-4 max-w-xl text-sm md:text-base text-muted-foreground">
                Центр публикаций, анонсов и результатов для участников клуба. Здесь удобно держать важный контент, события и закрепленные сообщения в одном ритме.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => setShowCreate(true)}
                  className="inline-flex items-center gap-2 rounded-[14px] border border-orange-200 bg-[linear-gradient(135deg,#F35703,#D44A02)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(249,115,22,0.26)] transition-transform hover:-translate-y-0.5"
                >
                  <i className="ki-filled ki-plus text-sm" />
                  Новая публикация
                </button>
                <Link
                  href="/org/newsletters"
                  className="inline-flex items-center gap-2 rounded-[14px] border border-border bg-background/80 px-4 py-2.5 text-sm font-semibold text-foreground no-underline shadow-sm transition-all hover:border-orange-200 hover:text-orange-700"
                >
                  <i className="ki-filled ki-sms text-sm" />
                  Перейти к рассылкам
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
              <div className="rounded-2xl border border-border bg-background/80 p-4 shadow-sm">
                <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Состояние ленты</div>
                <div className="mt-2 text-lg font-semibold text-foreground">{pinned.length} закрепл. · {posts.length} публикац.</div>
                <div className="mt-1 text-2xs text-muted-foreground">
                  {latestPost ? `Последняя запись ${formatDate(latestPost.created_at, { day: 'numeric', month: 'long' })}` : 'Лента пока пустая'}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-background/80 p-4 shadow-sm">
                <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Публичность</div>
                <div className="mt-2 text-lg font-semibold text-foreground">{publicPosts} открытых постов</div>
                <div className="mt-1 text-2xs text-muted-foreground">
                  {eventPosts > 0 ? `${eventPosts} публикац. с событиями` : 'Событий пока нет'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((item) => (
          <Card key={item.label} className="p-5 rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{item.label}</div>
                <div className="pf-num mt-2 text-3xl leading-none text-foreground">{item.value}</div>
                <div className="mt-2 text-2xs text-muted-foreground">{item.hint}</div>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`ki-filled ${item.icon} text-base`} style={{ color: item.color }} />
              </div>
            </div>
          </Card>
        ))}
      </section>

      {pinned.length > 0 && (
        <section className="rounded-3xl border border-orange-100 bg-[linear-gradient(180deg,#FFF8F1_0%,#FFFFFF_100%)] p-4 md:p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                  <i className="ki-filled ki-pin text-sm" />
                </span>
                <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-orange-700">Закрепленные публикации</span>
              </div>
              <p className="mt-2 text-2sm text-muted-foreground">Самые важные записи, которые всегда должны оставаться наверху стены.</p>
            </div>
            <div className="inline-flex items-center rounded-full border border-orange-100 bg-white px-3 py-1 text-xs font-semibold text-orange-700">
              {pinned.length} из 5 закреплений
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {pinned.map(p => (
              <PostCard
                key={p.id}
                post={p}
                pinnedStyle
                onPin={() => handleTogglePin(p)}
                onDelete={() => handleDelete(p.id)}
              />
            ))}
          </div>
        </section>
      )}

      <Card className="rounded-3xl p-4 md:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Все публикации</div>
            <p className="mt-1 text-2sm text-muted-foreground">Лента новостей, результатов и анонсов для вашей организации.</p>
          </div>
          <div className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">
            В ленте: {feed.length}
          </div>
        </div>
        {feed.length === 0 && pinned.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-border bg-accent/30 px-6 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
              <i className="ki-filled ki-abstract-45 text-2xl" />
            </div>
            <div className="mt-4 text-base font-semibold text-foreground">Публикаций пока нет</div>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Создайте первую публикацию, чтобы объявить новости, результаты или ближайшие события клуба.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-[14px] border border-orange-200 bg-white px-4 py-2.5 text-sm font-semibold text-orange-700 shadow-sm transition-all hover:bg-orange-50"
            >
              <i className="ki-filled ki-plus text-sm" />
              Создать первую публикацию
            </button>
          </div>
        ) : feed.length === 0 ? null : (
          <div className="flex flex-col gap-3">
            {feed.map(p => <PostCard key={p.id} post={p} onPin={() => handleTogglePin(p)} onDelete={() => handleDelete(p.id)} />)}
          </div>
        )}
      </Card>

      {showCreate && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}
        >
          <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_30px_90px_rgba(15,23,42,0.2)]">
            <div className="border-b border-border bg-[linear-gradient(135deg,rgba(249,115,22,0.08),transparent)] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-orange-700">Контент организации</div>
                  <h3 className="pf-num mt-2 text-[28px] leading-none text-foreground">Новая публикация</h3>
                  <p className="mt-2 text-2sm text-muted-foreground">Подготовьте анонс, новость, событие или результат для участников клуба.</p>
                </div>
                <button onClick={() => setShowCreate(false)} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
                  <i className="ki-filled ki-cross text-sm" />
                </button>
              </div>
            </div>
            <div className="px-6 py-6">
              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Тип</label>
                    <select
                      value={form.post_type}
                      onChange={e => setForm(f => ({ ...f, post_type: e.target.value as PostType }))}
                      className="w-full rounded-2xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                    >
                      {POST_TYPES.map(t => (
                        <option key={t} value={t}>{POST_TYPE_META[t].label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Видимость</label>
                    <select
                      value={form.visible_to}
                      onChange={e => setForm(f => ({ ...f, visible_to: e.target.value as PostVisibility }))}
                      className="w-full rounded-2xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                    >
                      <option value="all">Все (публично)</option>
                      <option value="members">Только участники</option>
                      <option value="coaches">Только тренеры</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Заголовок *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    required
                    placeholder="Например: Сбор команды перед стартом сезона"
                    className="w-full rounded-2xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Текст *</label>
                  <textarea
                    value={form.body}
                    onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                    required
                    rows={5}
                    placeholder="Расскажите участникам, что произошло, что важно сделать или к какому событию подготовиться…"
                    className="w-full resize-none rounded-2xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                  />
                </div>

                {(form.post_type === 'event') && (
                  <div>
                    <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Дата события</label>
                    <input
                      type="date"
                      value={form.event_date}
                      onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                      className="w-full rounded-2xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                    />
                  </div>
                )}

                <Alert variant="primary">
                  Публикация появится на стене сразу после сохранения. Закрепить ее при необходимости можно уже из списка публикаций.
                </Alert>

                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={saving} className="flex-1 rounded-[14px] border border-orange-200 bg-[linear-gradient(135deg,#F35703,#D44A02)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(249,115,22,0.26)] disabled:opacity-60">
                    {saving ? 'Сохранение…' : 'Опубликовать'}
                  </button>
                  <button type="button" onClick={() => setShowCreate(false)} className="kt-btn kt-btn-outline">
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PostCard({ post, onPin, onDelete, pinnedStyle = false }: { post: WallPost; onPin: () => void; onDelete: () => void; pinnedStyle?: boolean }) {
  const typeMeta = POST_TYPE_META[post.post_type]
  const visibilityMeta = VISIBILITY_META[post.visible_to]

  return (
    <Card className={`p-5 rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-sm ${
      pinnedStyle
        ? '!border-orange-100 !bg-white shadow-[0_12px_28px_rgba(249,115,22,0.08)]'
        : ''
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            {post.is_pinned && (
              <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-2xs font-semibold text-orange-700">
                <i className="ki-filled ki-pin text-[10px]" />
                Закреплено
              </span>
            )}
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-semibold ${typeMeta.badge}`}>
              <i className={`ki-filled ${typeMeta.icon} text-[10px]`} />
              {typeMeta.label}
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-2xs font-medium ${visibilityMeta.badge}`}>
              {visibilityMeta.label}
            </span>
            {post.event_date && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-2xs text-muted-foreground">
                <i className="ki-filled ki-calendar text-[10px]" />
                {formatDate(post.event_date, { day: 'numeric', month: 'long' })}
              </span>
            )}
          </div>
          <h4 className="mb-2 text-base font-semibold text-foreground">{post.title}</h4>
          <p className="text-2sm leading-relaxed text-muted-foreground">{post.body}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={onPin}
            title={post.is_pinned ? 'Открепить' : 'Закрепить'}
            className={`kt-btn kt-btn-xs kt-btn-icon ${post.is_pinned ? 'kt-btn-primary' : 'kt-btn-outline'}`}
          >
            <i className="ki-filled ki-pin text-xs" />
          </button>
          <button
            onClick={onDelete}
            title="Удалить"
            className="kt-btn kt-btn-xs kt-btn-icon kt-btn-outline hover:!bg-red-50 hover:!border-red-200 hover:!text-red-600"
          >
            <i className="ki-filled ki-trash text-xs" />
          </button>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex flex-wrap items-center gap-3 text-2xs text-muted-foreground">
          <span>{formatDate(post.created_at)}</span>
          <span>{visibilityMeta.hint}</span>
        </div>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: typeMeta.panel }}>
          <i className={`ki-filled ${typeMeta.icon} text-xs`} style={{ color: typeMeta.accent }} />
        </span>
      </div>
    </Card>
  )
}
