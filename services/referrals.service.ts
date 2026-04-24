import { createClient } from '@/lib/supabase/client'

export interface ReferralCredit {
  id: string
  inviter_id: string
  invited_user_id: string | null
  source_invite_id: string | null
  months_granted: number
  applied_at: string
}

export interface ReferralStats {
  credits: ReferralCredit[]
  total_months: number
  /** pending = отправлено приглашение, ещё не принято */
  pending_count: number
  /** claimed = приглашение принято, кредит начислен */
  claimed_count: number
}

/** Суммарная статистика рефералов текущего пользователя. */
export async function getMyReferralStats(): Promise<ReferralStats> {
  const sb = createClient()
  const [creditsRes, invitesRes] = await Promise.all([
    sb.from('referral_credits').select('*').order('applied_at', { ascending: false }),
    sb.from('email_invites').select('id, status'),
  ])
  const credits = (creditsRes.data ?? []) as ReferralCredit[]
  const invites = ((invitesRes.data ?? []) as Array<{ id: string; status: string }>)
  return {
    credits,
    total_months:  credits.reduce((s, c) => s + c.months_granted, 0),
    pending_count: invites.filter(i => i.status === 'pending').length,
    claimed_count: invites.filter(i => i.status === 'claimed').length,
  }
}

/** Ссылка на публичный лендинг инвайта, которую удобно копировать. */
export function buildInviteLink(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://proform-delta.vercel.app'
  return `${base}/invite/${token}`
}
