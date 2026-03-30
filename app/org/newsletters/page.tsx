'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import { getMyOrg } from '@/services/org.service'
import { getNewsletters, createNewsletter, updateNewsletterStatus } from '@/services/newsletter.service'
import type { Organization, Newsletter, NewsletterStatus, OrgMemberRole } from '@/types/org.types'

const STATUS_BADGE: Record<NewsletterStatus, string> = {
  draft:     'bg-slate-100 text-slate-600',
  sent:      'bg-green-50 text-green-600 border border-green-200',
  scheduled: 'bg-orange-50 text-orange-600 border border-orange-200',
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

  async function handleSend(id: string) {
    await updateNewsletterStatus(id, 'sent')
    setNewsletters(prev => prev.map(n => n.id === id ? { ...n, status: 'sent' as NewsletterStatus, sent_at: new Date().toISOString() } : n))
  }

  const drafts = newsletters.filter(n => n.status === 'draft')
  const scheduled = newsletters.filter(n => n.status === 'scheduled')
  const sent = newsletters.filter(n => n.status === 'sent')

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

  return (
    <div className="flex flex-col gap-5 pf-enter">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Organization</p>
          <h2 className="pf-num text-[36px] text-foreground leading-none">Newsletters</h2>
          <p className="text-2sm text-muted-foreground mt-1">{org?.org_name}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="kt-btn kt-btn-primary gap-2">
          <i className="ki-filled ki-plus text-sm" />
          New newsletter
        </button>
      </div>

      {/* Sections */}
      {[
        { title: 'Drafts', items: drafts, emptyMsg: 'No drafts' },
        { title: 'Scheduled', items: scheduled, emptyMsg: 'No scheduled newsletters' },
        { title: 'Sent', items: sent, emptyMsg: 'No sent newsletters yet' },
      ].map(section => (
        <div key={section.title}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">{section.title}</span>
            {section.items.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-accent text-2xs font-bold text-muted-foreground">{section.items.length}</span>
            )}
          </div>
          {section.items.length === 0 ? (
            <div className="bg-card border border-border rounded-xl px-5 py-6 text-center text-muted-foreground text-2sm">
              {section.emptyMsg}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {section.items.map(nl => (
                <div key={nl.id} className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-2xs font-semibold capitalize ${STATUS_BADGE[nl.status]}`}>
                          {nl.status}
                        </span>
                        <span className="text-2xs text-muted-foreground">
                          To: {nl.target_roles.join(', ')}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-foreground truncate">{nl.subject}</h4>
                      <p className="text-2sm text-muted-foreground mt-0.5 line-clamp-2">{nl.body}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {nl.status === 'draft' && (
                        <button
                          onClick={() => handleSend(nl.id)}
                          className="kt-btn kt-btn-sm kt-btn-primary gap-1.5"
                        >
                          <i className="ki-filled ki-send text-xs" />
                          Send now
                        </button>
                      )}
                      {nl.status === 'sent' && (
                        <Link
                          href={`/org/newsletters/${nl.id}/stats`}
                          className="kt-btn kt-btn-sm kt-btn-outline gap-1.5"
                        >
                          <i className="ki-filled ki-chart-line-up text-xs" />
                          Stats
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border">
                    <span className="text-2xs text-muted-foreground">
                      {nl.sent_at
                        ? `Sent ${new Date(nl.sent_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`
                        : nl.scheduled_at
                        ? `Scheduled for ${new Date(nl.scheduled_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`
                        : `Created ${new Date(nl.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Create Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}
        >
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="pf-num text-xl text-foreground">New newsletter</h3>
              <button onClick={() => setShowCreate(false)} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
                <i className="ki-filled ki-cross text-sm" />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Subject *</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  required
                  placeholder="Newsletter subject"
                  className="w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                />
              </div>
              <div>
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Body *</label>
                <textarea
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  required
                  rows={6}
                  placeholder="Write your newsletter…"
                  className="w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400 resize-none"
                />
              </div>
              <div>
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Send to</label>
                <div className="flex gap-3">
                  {[
                    { key: 'target_athlete', label: 'Athletes' },
                    { key: 'target_coach',   label: 'Coaches' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form[key as keyof typeof form] as boolean}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                        className="rounded border-border"
                      />
                      <span className="text-sm text-foreground">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Schedule date (optional)
                </label>
                <input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                  className="w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                />
              </div>
              <div className="flex gap-2 pt-1 flex-wrap">
                <button
                  onClick={() => handleSave('draft')}
                  disabled={saving || !form.subject || !form.body}
                  className="kt-btn kt-btn-outline flex-1"
                >
                  {saving && saveAction === 'draft' ? 'Saving…' : 'Save draft'}
                </button>
                {form.scheduled_at && (
                  <button
                    onClick={() => handleSave('schedule')}
                    disabled={saving || !form.subject || !form.body}
                    className="kt-btn kt-btn-outline flex-1"
                  >
                    {saving && saveAction === 'schedule' ? 'Scheduling…' : 'Schedule'}
                  </button>
                )}
                <button
                  onClick={() => handleSave('send')}
                  disabled={saving || !form.subject || !form.body}
                  className="kt-btn kt-btn-primary flex-1"
                >
                  {saving && saveAction === 'send' ? 'Sending…' : 'Send now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
