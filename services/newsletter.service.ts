import { createClient } from '@/lib/supabase/client'
import type { Newsletter, NewsletterStatus, NewsletterStats, OrgMemberRole } from '@/types/org.types'

export async function getNewsletters(orgId: string): Promise<Newsletter[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('newsletters')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  return (data ?? []) as Newsletter[]
}

export async function getNewsletter(id: string): Promise<Newsletter | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('newsletters')
    .select('*')
    .eq('id', id)
    .single()

  return data ?? null
}

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
  const { data } = await supabase
    .from('newsletters')
    .insert({
      ...nl,
      sent_at: nl.status === 'sent' ? new Date().toISOString() : null,
    })
    .select()
    .single()

  return data ?? null
}

export async function updateNewsletterStatus(
  id: string,
  status: NewsletterStatus,
  scheduled_at?: string | null
): Promise<void> {
  const supabase = createClient()
  await supabase
    .from('newsletters')
    .update({
      status,
      scheduled_at: scheduled_at ?? null,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    })
    .eq('id', id)
}

export async function getNewsletterStats(newsletterId: string): Promise<NewsletterStats> {
  const supabase = createClient()
  const { data } = await supabase
    .from('newsletter_deliveries')
    .select('status, opened_at')
    .eq('newsletter_id', newsletterId)

  const rows = data ?? []
  return {
    sent: rows.length,
    delivered: rows.filter(r => r.status === 'delivered').length,
    opened: rows.filter(r => r.opened_at !== null).length,
    failed: rows.filter(r => r.status === 'failed').length,
  }
}
