/**
 * POST /api/auth/claim-child — tenant refactor #4b-v.
 *
 * Публичный (token-only auth) endpoint. Принимает claim-токен + новый email +
 * пароль; обновляет auth.users (email_confirm=true сразу — ребёнок ручается)
 * + public.users.email, помечает токен claimed. После этого аккаунт ребёнка
 * работает как обычный — login через свой email/пароль.
 *
 * Body: { token: string, email: string, password: string }
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  token:    z.string().min(32),
  email:    z.string().email(),
  password: z.string().min(8).refine(
    (p) => /[A-Z]/.test(p) && /[0-9]/.test(p),
    { message: 'password_complexity' },
  ),
})

export async function POST(req: Request) {
  let body: z.infer<typeof BodySchema>
  try { body = BodySchema.parse(await req.json()) }
  catch { return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 }) }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any

  // ── 1. Validate token ─────────────────────────────────────────────────────
  const { data: tokenRow } = await adminAny
    .from('child_claim_tokens')
    .select('id, child_id, parent_id, expires_at, claimed_at')
    .eq('token', body.token)
    .maybeSingle()
  if (!tokenRow) return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 404 })
  if (tokenRow.claimed_at) return NextResponse.json({ ok: false, error: 'already_claimed' }, { status: 410 })
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: 'expired' }, { status: 410 })
  }

  // ── 2. Resolve child's auth_id ────────────────────────────────────────────
  const { data: childRow } = await adminAny
    .from('users')
    .select('id, auth_id')
    .eq('id', tokenRow.child_id)
    .maybeSingle()
  if (!childRow?.auth_id) {
    return NextResponse.json({ ok: false, error: 'child_missing' }, { status: 410 })
  }

  // ── 3. Update auth.users (email + password) via admin API ────────────────
  const emailLower = body.email.trim().toLowerCase()
  const { error: updErr } = await adminAny.auth.admin.updateUserById(childRow.auth_id, {
    email:         emailLower,
    password:      body.password,
    email_confirm: true,
  })
  if (updErr) {
    const msg = updErr.message ?? 'update_failed'
    const isDup = /already.*registered|already.*exists|duplicate|email.*exists/i.test(msg)
    return NextResponse.json(
      { ok: false, error: isDup ? 'email_taken' : 'update_failed' },
      { status: isDup ? 409 : 500 },
    )
  }

  // ── 4. Update public.users.email + mark token claimed ────────────────────
  await adminAny.from('users').update({ email: emailLower }).eq('id', tokenRow.child_id)
  await adminAny
    .from('child_claim_tokens')
    .update({ claimed_at: new Date().toISOString(), claimed_email: emailLower })
    .eq('id', tokenRow.id)

  return NextResponse.json({ ok: true, email: emailLower })
}
