import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import type { Newsletter, NewsletterStatus, NewsletterStats, OrgMemberRole } from '@/types/org.types'

type NewsletterInsert = Database['public']['Tables']['newsletters']['Insert']
type NewsletterUpdate = Database['public']['Tables']['newsletters']['Update']
type NewsletterDeliveryRow = Database['public']['Tables']['newsletter_deliveries']['Row']

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
  const payload: NewsletterInsert = {
    ...nl,
    scheduled_at: nl.scheduled_at ?? null,
    sent_at: nl.status === 'sent' ? new Date().toISOString() : null,
  }
  const { data } = await (supabase.from('newsletters') as any)
    .insert(payload)
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
  const payload: NewsletterUpdate = {
    status,
    scheduled_at: scheduled_at ?? null,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
  }
  await (supabase.from('newsletters') as any)
    .update(payload)
    .eq('id', id)
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
