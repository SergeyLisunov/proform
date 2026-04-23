import { createClient } from '@/lib/supabase/client'

export type InviteConnectionType =
  | 'coach_athlete'
  | 'org_coach'
  | 'org_athlete'
  | 'doctor_athlete'
  | 'coach_doctor'
  | 'org_doctor'
  | 'admin_doctor'

export type InviteStatus = 'pending' | 'claimed' | 'expired' | 'revoked'

export interface EmailInvite {
  id: string
  token: string
  inviter_id: string
  email: string
  connection_type: InviteConnectionType
  message: string | null
  status: InviteStatus
  claimed_by_user_id: string | null
  claimed_at: string | null
  expires_at: string
  created_at: string
}

export const CONNECTION_TYPE_LABELS: Record<InviteConnectionType, string> = {
  coach_athlete:  'тренер ↔ атлет',
  org_coach:      'организация ↔ тренер',
  org_athlete:    'организация ↔ атлет',
  doctor_athlete: 'врач ↔ атлет',
  coach_doctor:   'тренер ↔ врач',
  org_doctor:     'организация ↔ врач',
  admin_doctor:   'админ ↔ врач',
}

/**
 * Отправляет email-приглашение через защищённый API-роут (service role).
 * Возвращает токен и ссылку. Если email уже зарегистрирован — роут
 * всё равно создаст pending-invite; клик по ссылке переведёт в логин.
 */
export async function sendEmailInvite(input: {
  email: string
  connection_type: InviteConnectionType
  message?: string | null
}): Promise<{ ok: true; token: string; url: string } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: input.email.trim(),
        connection_type: input.connection_type,
        message: input.message ?? null,
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: json.error ?? `HTTP ${res.status}` }
    return { ok: true, token: json.token, url: json.url }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Список моих исходящих приглашений (видит только инвайтер). */
export async function listMyInvites(): Promise<EmailInvite[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('email_invites')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.warn('[listMyInvites]', error.message); return [] }
  return (data ?? []) as EmailInvite[]
}

/** Отозвать приглашение (только если ещё pending). */
export async function revokeInvite(id: string): Promise<boolean> {
  const sb = createClient()
  const { error } = await (sb as any)
    .from('email_invites')
    .update({ status: 'revoked' })
    .eq('id', id)
    .eq('status', 'pending')
  if (error) { console.warn('[revokeInvite]', error.message); return false }
  return true
}
