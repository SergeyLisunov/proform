'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import { getMyOrg } from '@/services/org.service'
import { getNewsletters, createNewsletter, updateNewsletterStatus, sendNewsletter } from '@/services/newsletter.service'
import type { Organization, Newsletter, NewsletterStatus, OrgMemberRole } from '@/types/org.types'
import { Card, Badge, Alert } from '@/components/ui/metronic'

const STATUS_META: Record<NewsletterStatus, { label: string; badge: string; icon: string; accent: string; bg: string }> = {
  draft: {
    label: 'Черновик',
    badge: 'bg-slate-100 text-slate-600 border border-slate-200',
    icon: 'ki-note-2',
    accent: '#64748B',
    bg: '#F8FAFC',
  },
  sent: {
    label: 'Отправлена',
    badge: 'bg-green-50 text-green-600 border border-green-200',
    icon: 'ki-send',
    accent: '#16A34A',
    bg: '#F0FDF4',
  },
  scheduled: {
    label: 'Запланирована',
    badge: 'bg-orange-50 text-orange-600 border border-orange-200',
    icon: 'ki-calendar-8',
    accent: '#F35703',
    bg: '#FEF0E7',
  },
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Intl.DateTimeFormat('ru-RU', options).format(new Date(value))
}

function formatAudience(roles: OrgMemberRole[]) {
  return roles.map(role => role === 'athlete' ? 'атлеты' : 'тренеры').join(', ')
}

export default function OrgNewslettersPage() {
  const { user, loading: userLoading } = useUser()
  const [org, setOrg] = useState<Organization | null>(null)
  const [newsletters, setNewsletters] = useState<Newsletter[]>([])
  const [loading, setLoading] = useState(true)

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    subject: '',
    body: '',
    target_athlete: true,
    target_coach: true,
    scheduled_at: '',
  })
  const [saving, setSaving] = useState(false)
  const [saveAction, setSaveAction] = useState<'draft' | 'send' | 'schedule'>('draft')

  useEffect(() => {
    if (userLoading) return
    if (user?.role !== 'organization') { setLoading(false); return }
    async function load() {
      const orgData = await getMyOrg()
      if (!orgData) { setLoading(false); return }
      setOrg(orgData)
      const nls = await getNewsletters(orgData.id)
      setNewsletters(nls)
      setLoading(false)
    }
    load()
  }, [user, userLoading])

  async function handleSave(action: 'draft' | 'send' | 'schedule') {
    if (!org || !user) return
    setSaving(true)
    setSaveAction(action)

    const target_roles: OrgMemberRole[] = [
      ...(form.target_athlete ? ['athlete' as OrgMemberRole] : []),
      ...(form.target_coach   ? ['coach'   as OrgMemberRole] : []),
    ]

    const nl = await createNewsletter({
      org_id: org.id,
      author_id: user.id,
      subject: form.subject,
      body: form.body,
      target_roles,
      status: action === 'send' ? 'sent' : action === 'schedule' ? 'scheduled' : 'draft',
      scheduled_at: action === 'schedule' ? form.scheduled_at || null : null,
    })

    if (nl) {
      setNewsletters(prev => [nl, ...prev])
      setForm({ subject: '', body: '', target_athlete: true, target_coach: true, scheduled_at: '' })
      setShowCreate(false)
    }
    setSaving(false)
  }

  // Real send via Resend — replaces the previous status-flip stub.
  // Confirms with the user, calls the server route, then either
  // marks the newsletter as sent locally + shows result, or surfaces
  // the failure. The server route is idempotent (409 on already-sent).
  const [sending, setSending] = useState<string | null>(null)
  const [sendResult, setSendResult] = useState<{ id: string; ok: boolean; message: string } | null>(null)

  async function handleSend(id: string) {
    if (sending) return
    if (!confirm('Отправить рассылку всем активным членам с выбранными ролями?')) return
    setSending(id)
    setSendResult(null)
    try {
      const result = await sendNewsletter(id)
      if (!result) {
        setSendResult({ id, ok: false, message: 'Не удалось отправить. Проверьте настройки email или повторите позже.' })
        return
      }
      setNewsletters(prev => prev.map(n => n.id === id
        ? { ...n, status: 'sent' as NewsletterStatus, sent_at: new Date().toISOString() }
        : n,
      ))
      setSendResult({ id, ok: true, message: result.message })
    } finally {
      setSending(null)
    }
  }

  const drafts = newsletters.filter(n => n.status === 'draft')
  const scheduled = newsletters.filter(n => n.status === 'scheduled')
  const sent = newsletters.filter(n => n.status === 'sent')
  const latestNewsletter = newsletters[0]
  const summary = [
    { label: 'Всего рассылок', value: newsletters.length, hint: 'Общий архив коммуникаций', icon: 'ki-sms', color: '#2563EB', bg: '#EFF6FF' },
    { label: 'Черновики', value: drafts.length, hint: 'Готовятся к публикации', icon: 'ki-note-2', color: '#64748B', bg: '#F8FAFC' },
    { label: 'Запланированные', value: scheduled.length, hint: 'Уже стоят в очереди', icon: 'ki-calendar-8', color: '#F35703', bg: '#FEF0E7' },
    { label: 'Отправленные', value: sent.length, hint: 'Ушли в коммуникацию', icon: 'ki-send', color: '#16A34A', bg: '#F0FDF4' },
  ]

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

  return (
    <div className="flex flex-col gap-6 pf-enter">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(147,51,234,0.12),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(243,87,3,0.1),_transparent_28%)]" />
        <div className="relative p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-orange-700">
                  Организация
                </span>
                <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-700">
                  Коммуникации
                </span>
                <span className="inline-flex items-center rounded-full border border-border bg-background/80 px-3 py-1 text-[10px] font-semibold text-muted-foreground">
                  {org?.org_name}
                </span>
              </div>
              <h2 className="pf-num text-[clamp(2.15rem,4vw,3.75rem)] leading-[0.95] tracking-tight text-navy-500">
                Рассылки
              </h2>
              <p className="mt-4 max-w-xl text-sm md:text-base text-muted-foreground">
                Центр рассылок для объявлений, плановых уведомлений и коммуникаций с атлетами и тренерами.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => setShowCreate(true)}
                  className="inline-flex items-center gap-2 rounded-[14px] border border-violet-200 bg-[linear-gradient(135deg,#9333EA,#7C3AED)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(124,58,237,0.26)] transition-transform hover:-translate-y-0.5"
                >
                  <i className="ki-filled ki-plus text-sm" />
                  Новая рассылка
                </button>
                <Link
                  href="/org/wall"
                  className="inline-flex items-center gap-2 rounded-[14px] border border-border bg-background/80 px-4 py-2.5 text-sm font-semibold text-foreground no-underline shadow-sm transition-all hover:border-violet-200 hover:text-violet-700"
                >
                  <i className="ki-filled ki-abstract-45 text-sm" />
                  Перейти к стене
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
              <div className="rounded-2xl border border-border bg-background/80 p-4 shadow-sm">
                <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Состояние очереди</div>
                <div className="mt-2 text-lg font-semibold text-foreground">{scheduled.length} заплан. · {drafts.length} чернов.</div>
                <div className="mt-1 text-2xs text-muted-foreground">
                  {scheduled.length > 0 ? 'Есть активные отправки в очереди' : 'Очередь сейчас свободна'}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-background/80 p-4 shadow-sm">
                <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Последняя активность</div>
                <div className="mt-2 text-lg font-semibold text-foreground">
                  {latestNewsletter ? formatDate(latestNewsletter.created_at, { day: 'numeric', month: 'long' }) : 'Нет данных'}
                </div>
                <div className="mt-1 text-2xs text-muted-foreground">
                  {latestNewsletter ? `${STATUS_META[latestNewsletter.status].label} · ${formatAudience(latestNewsletter.target_roles)}` : 'Рассылок пока нет'}
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

      {[
        {
          title: 'Черновики',
          description: 'Подготовленные сообщения, которые еще можно дописать, скорректировать аудиторию или отправить вручную.',
          items: drafts,
          emptyMsg: 'Черновиков нет',
        },
        {
          title: 'Запланированные',
          description: 'Рассылки, которые уже поставлены в очередь и ожидают времени отправки.',
          items: scheduled,
          emptyMsg: 'Запланированных рассылок нет',
        },
        {
          title: 'Отправленные',
          description: 'История завершенных рассылок и переходы к статистике по доставке и открытиям.',
          items: sent,
          emptyMsg: 'Отправленных рассылок пока нет',
        },
      ].map(section => (
        <Card key={section.title} className="rounded-3xl p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{section.title}</div>
              <p className="mt-1 text-2sm text-muted-foreground">{section.description}</p>
            </div>
            {section.items.length > 0 && (
              <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">
                {section.items.length}
              </span>
            )}
          </div>
          {section.items.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-border bg-accent/30 px-5 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                <i className="ki-filled ki-sms text-xl" />
              </div>
              <div className="mt-4 text-base font-semibold text-foreground">{section.emptyMsg}</div>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {section.title === 'Черновики'
                  ? 'Создайте первый шаблон сообщения, чтобы быстро готовить рассылки под события и новости клуба.'
                  : section.title === 'Запланированные'
                    ? 'Когда у рассылки будет дата отправки, она появится здесь как часть очереди коммуникаций.'
                    : 'После отправки здесь появятся завершенные рассылки со ссылкой на статистику.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {section.items.map(nl => (
                <Card key={nl.id} className="p-5 rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="mb-2 flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-semibold ${STATUS_META[nl.status].badge}`}>
                          <i className={`ki-filled ${STATUS_META[nl.status].icon} text-[10px]`} />
                          {STATUS_META[nl.status].label}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-2xs font-medium text-muted-foreground">
                          Кому: {formatAudience(nl.target_roles)}
                        </span>
                      </div>
                      <h4 className="truncate text-base font-semibold text-foreground">{nl.subject}</h4>
                      <p className="mt-1 line-clamp-2 text-2sm text-muted-foreground">{nl.body}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {nl.status === 'draft' && (
                        <button
                          onClick={() => handleSend(nl.id)}
                          disabled={sending === nl.id}
                          className="kt-btn kt-btn-sm kt-btn-primary gap-1.5 disabled:opacity-50"
                        >
                          <i className={`ki-filled ${sending === nl.id ? 'ki-arrows-circle' : 'ki-send'} text-xs ${sending === nl.id ? 'animate-spin' : ''}`} />
                          {sending === nl.id ? 'Отправка…' : 'Отправить'}
                        </button>
                      )}
                      {nl.status === 'sent' && (
                        <Link
                          href={`/org/newsletters/${nl.id}/stats`}
                          className="kt-btn kt-btn-sm kt-btn-outline gap-1.5"
                        >
                          <i className="ki-filled ki-chart-line-up text-xs" />
                          Статистика
                        </Link>
                      )}
                    </div>
                  </div>
                  {sendResult?.id === nl.id && (
                    <Alert
                      variant={sendResult.ok ? 'success' : 'destructive'}
                      icon={sendResult.ok ? 'ki-check-circle' : 'ki-shield-cross'}
                      className="mt-3"
                    >
                      {sendResult.message}
                    </Alert>
                  )}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                    <span className="text-2xs text-muted-foreground">
                      {nl.sent_at
                        ? `Отправлено ${formatDate(nl.sent_at)}`
                        : nl.scheduled_at
                        ? `Запланировано на ${formatDate(nl.scheduled_at)}`
                        : `Создано ${formatDate(nl.created_at)}`}
                    </span>
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl"
                      style={{ background: STATUS_META[nl.status].bg }}
                    >
                      <i className={`ki-filled ${STATUS_META[nl.status].icon} text-xs`} style={{ color: STATUS_META[nl.status].accent }} />
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      ))}

      {showCreate && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[28px] border border-border bg-card shadow-[0_30px_90px_rgba(15,23,42,0.2)]">
            <div className="border-b border-border bg-[linear-gradient(135deg,rgba(147,51,234,0.08),transparent)] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-violet-700">Коммуникации организации</div>
                  <h3 className="pf-num mt-2 text-[28px] leading-none text-navy-500">Новая рассылка</h3>
                  <p className="mt-2 text-2sm text-muted-foreground">Подготовьте сообщение для атлетов, тренеров или всей организации в одном редакторе.</p>
                </div>
                <button onClick={() => setShowCreate(false)} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
                  <i className="ki-filled ki-cross text-sm" />
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-4 px-6 py-6">
              <div>
                <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Тема *</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  required
                  placeholder="Например: График сборов на следующую неделю"
                  className="w-full rounded-2xl border border-input px-3 py-2.5 text-sm outline-none focus:border-violet-400"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Текст *</label>
                <textarea
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  required
                  rows={6}
                  placeholder="Опишите важную информацию, действия для участников и дедлайны…"
                  className="w-full resize-none rounded-2xl border border-input px-3 py-2.5 text-sm outline-none focus:border-violet-400"
                />
              </div>
              <div>
                <label className="mb-2 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Кому</label>
                <div className="flex flex-wrap gap-3">
                  {[
                    { key: 'target_athlete', label: 'Атлеты' },
                    { key: 'target_coach',   label: 'Тренеры' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={form[key as keyof typeof form] as boolean}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                        className="rounded border-border"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Дата отправки
                </label>
                <input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                  className="w-full rounded-2xl border border-input px-3 py-2.5 text-sm outline-none focus:border-violet-400"
                />
                <p className="mt-1 text-2xs text-muted-foreground">Если дата не задана, рассылку можно сохранить черновиком или отправить сразу.</p>
              </div>
              <Alert variant="info">
                Отправленная рассылка появится в разделе завершенных коммуникаций, а для нее станет доступна статистика доставляемости и открытий.
              </Alert>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => handleSave('draft')}
                  disabled={saving || !form.subject || !form.body}
                  className="kt-btn kt-btn-outline flex-1"
                >
                  {saving && saveAction === 'draft' ? 'Сохранение…' : 'Сохранить черновик'}
                </button>
                {form.scheduled_at && (
                  <button
                    onClick={() => handleSave('schedule')}
                    disabled={saving || !form.subject || !form.body}
                    className="kt-btn kt-btn-outline flex-1"
                  >
                    {saving && saveAction === 'schedule' ? 'Планирование…' : 'Запланировать'}
                  </button>
                )}
                <button
                  onClick={() => handleSave('send')}
                  disabled={saving || !form.subject || !form.body}
                  className="flex-1 rounded-[14px] border border-violet-200 bg-[linear-gradient(135deg,#9333EA,#7C3AED)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(124,58,237,0.24)] disabled:opacity-60"
                >
                  {saving && saveAction === 'send' ? 'Отправка…' : 'Отправить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
