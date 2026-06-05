/**
 * POST /api/parent/issue-claim-link — tenant refactor #4b-v.
 *
 * Родитель выдаёт ребёнку токен для самостоятельной привязки своего email +
 * пароля к ранее созданному (через #4b-ii) аккаунту. Возвращает URL вида
 * `<APP_URL>/auth/claim-child/<token>`, который родитель передаёт ребёнку
 * вручную (мессенджер, бумажка — что угодно). Токен валиден 14 дней.
 *
 * Body: { child_id: uuid }
 *
 * Security:
 *   - caller авторизован
 *   - caller является active parent для child_id (проверка через parent_links)
 *   - запись делается admin client'ом (RLS на child_claim_tokens — INSERT
 *     не выдан authenticated)
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://proform-delta.vercel.app'

const BodySchema = z.object({
  child_id: z.string().uuid(),
})

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const { data: meRow } = await supabase
    .from('users').select('id').eq('auth_id', authUser.id).maybeSingle()
  if (!meRow) return NextResponse.json({ ok: false, error: 'no_profile' }, { status: 404 })
  const parentId = (meRow as { id: string }).id

  let body: z.infer<typeof BodySchema>
  try { body = BodySchema.parse(await req.json()) }
  catch { return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 }) }

  if (body.child_id === parentId) {
    return NextResponse.json({ ok: false, error: 'same_user' }, { status: 422 })
  }

  const admin = createAdminClient()

  // Verify caller is an active parent of child_id.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: linkRow } = await (admin as any)
    .from('parent_links')
    .select('id')
    .eq('parent_id', parentId)
    .eq('child_id', body.child_id)
    .eq('status', 'active')
    .maybeSingle()
  if (!linkRow) {
    return NextResponse.json({ ok: false, error: 'not_parent_of_child' }, { status: 403 })
  }

  // Issue token (column default fills `token` + `expires_at`).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: created, error: insertErr } = await (admin as any)
    .from('child_claim_tokens')
    .insert({ parent_id: parentId, child_id: body.child_id })
    .select('token, expires_at')
    .single()
  if (insertErr || !created) {
    return NextResponse.json({ ok: false, error: 'issue_failed' }, { status: 500 })
  }

  return NextResponse.json({
    ok:         true,
    token:      created.token,
    url:        `${APP_URL}/auth/claim-child/${created.token}`,
    expires_at: created.expires_at,
  })
}
