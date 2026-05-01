import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import type { Newsletter, NewsletterStatus, NewsletterStats, OrgMemberRole } from '@/types/org.types'

type NewsletterRow         = Database['public']['Tables']['newsletters']['Row']
type NewsletterInsert      = Database['public']['Tables']['newsletters']['Insert']
type NewsletterUpdate      = Database['public']['Tables']['newsletters']['Update']
type NewsletterDeliveryRow = Database['public']['Tables']['newsletter_deliveries']['Row']

// ─── DB ↔ domain mapping ──────────────────────────────────────────────────
// The newsletters table stores `body_html` (NOT NULL) and optional
// `body_text`; the public Newsletter type only exposes a single `body`
// field. The previous service silently relied on stale types and
// inserted/read a non-existent `body` column.

function rowToNewsletter(row: NewsletterRow): Newsletter {
  return {
    id:           row.id,
    org_id:       row.org_id,
    author_id:    row.author_id,
    subject:      row.subject,
    body:         row.body_html ?? row.body_text ?? '',
    target_roles: (row.target_roles as OrgMemberRole[]) ?? [],
    status:       row.status as NewsletterStatus,
    scheduled_at: row.scheduled_at,
    sent_at:      row.sent_at,
    created_at:   row.created_at,
  }
}

// ─── reads ────────────────────────────────────────────────────────────────

export async function getNewsletters(orgId: string): Promise<Newsletter[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('newsletters')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  return ((data ?? []) as NewsletterRow[]).map(rowToNewsletter)
}

export async function getNewsletter(id: string): Promise<Newsletter | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('newsletters')
    .select('*')
    .eq('id', id)
    .single()

  return data ? rowToNewsletter(data as NewsletterRow) : null
}

// ─── writes ───────────────────────────────────────────────────────────────

export async function createNewsletter(nl: {
  org_id: string
  author_id: string
  subject: string
  body: string
  target_roles: OrgMemberRole[]
  status: NewsletterStatus
  scheduled_at?: string | null
}): Promise<Newsletter | null> {
  const supabase = createClient()
  const payload: NewsletterInsert = {
    org_id:       nl.org_id,
    author_id:    nl.author_id,
    subject:      nl.subject,
    body_html:    nl.body,
    target_roles: nl.target_roles,
    status:       nl.status,
    scheduled_at: nl.scheduled_at ?? null,
    sent_at:      nl.status === 'sent' ? new Date().toISOString() : null,
  }
  const { data } = await supabase
    .from('newsletters')
    .insert(payload)
    .select()
    .single()

  return data ? rowToNewsletter(data as NewsletterRow) : null
}

export async function updateNewsletterStatus(
  id: string,
  status: NewsletterStatus,
  scheduled_at?: string | null
): Promise<void> {
  const supabase = createClient()
  const payload: NewsletterUpdate = {
    status,
    scheduled_at: scheduled_at ?? null,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
  }
  await supabase
    .from('newsletters')
    .update(payload)
    .eq('id', id)
}

/**
 * Send-now: triggers actual email blast via the server route.
 * Returns server payload `{ sent, failed, total_recipients, message }` on
 * success, or null on transport/server error (caller shows generic
 * "не удалось отправить" toast).
 *
 * Why a separate route + admin client: org admin needs to see emails of
 * all `org_members` with `target_roles`, and RLS would correctly hide
 * those from the user-side client. The server uses createAdminClient()
 * AFTER verifying caller authorization.
 */
export interface NewsletterSendResult {
  sent: number
  failed: number
  total_recipients: number
  message: string
}

export async function sendNewsletter(id: string): Promise<NewsletterSendResult | null> {
  const res = await fetch(`/api/org/newsletters/${id}/send`, { method: 'POST' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.ok) {
    console.warn('[sendNewsletter]', res.status, json?.error)
    return null
  }
  return json.data as NewsletterSendResult
}

export async function getNewsletterStats(newsletterId: string): Promise<NewsletterStats> {
  const supabase = createClient()
  const { data } = await supabase
    .from('newsletter_deliveries')
    .select('status, opened_at')
    .eq('newsletter_id', newsletterId)

  const rows = (data ?? []) as Pick<NewsletterDeliveryRow, 'status' | 'opened_at'>[]
  return {
    sent: rows.length,
    delivered: rows.filter(r => r.status === 'delivered').length,
    opened: rows.filter(r => r.opened_at !== null).length,
    failed: rows.filter(r => r.status === 'failed').length,
  }
}
