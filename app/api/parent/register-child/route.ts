/**
 * POST /api/parent/register-child — tenant refactor #4b-ii.
 *
 * Создаёт аккаунт ребёнка от имени родителя и связывает их через parent_links.
 *
 * Flow:
 *   1. Авторизованный родитель вызывает endpoint после signUp своего аккаунта.
 *   2. Сервер через admin client делает auth.admin.createUser для ребёнка
 *      (email подтверждён сразу — родитель ручается; password — рандомный uuid,
 *      ребёнок установит свой через recovery позже).
 *   3. Триггер on_auth_user_created → handle_new_auth_user создаёт
 *      public.users(role='athlete') для ребёнка.
 *   4. Сервер ждёт появления public.users (короткий polling — триггер
 *      синхронный, но мы перестраховываемся) и пишет parent_links
 *      (parent_id=me, child_id=new_athlete, status='active', created_by=me).
 *
 * Body:
 *   childName:   string (1-80)
 *   childEmail?: string — если не задан, генерируется синтетический
 *                child-<uuid>@sporteo.local (не отправляется почта, ребёнок
 *                позже задаст свой email через flow "claim my account" —
 *                follow-up 4b-v).
 *   childDob?:   ISO date (YYYY-MM-DD) — сохраняется в user_metadata.dob
 *                для будущего age-gate (152-ФЗ для <14).
 *
 * Возвращает: { ok: true, child_id, child_name, used_synthetic_email }.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  childName:  z.string().trim().min(1).max(80),
  childEmail: z.string().email().optional(),
  childDob:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const SYNTHETIC_DOMAIN = 'sporteo.local'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function POST(req: Request) {
  // ── Auth: parent must be signed in ───────────────────────────────────────
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const { data: meRow } = await supabase
    .from('users').select('id').eq('auth_id', authUser.id).maybeSingle()
  if (!meRow) return NextResponse.json({ ok: false, error: 'no_profile' }, { status: 404 })
  const parentId = (meRow as { id: string }).id

  // ── Validate body ────────────────────────────────────────────────────────
  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
  }

  const usedSynthetic = !body.childEmail
  const childEmail = (body.childEmail ?? `child-${randomUUID()}@${SYNTHETIC_DOMAIN}`).toLowerCase()

  const admin = createAdminClient()

  // ── 1. Create child auth user via admin (email_confirm=true) ─────────────
  // Random password — child claims their account later via recovery flow.
  const tempPassword = randomUUID() + '-' + randomUUID()  // 72 chars, well above min
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAuth = (admin as any).auth.admin
  const { data: createRes, error: createErr } = await adminAuth.createUser({
    email:         childEmail,
    password:      tempPassword,
    email_confirm: true,
    user_metadata: {
      name:                 body.childName,
      role:                 'athlete',
      dob:                  body.childDob ?? null,
      registered_by_parent: parentId,
    },
  })
  if (createErr || !createRes?.user?.id) {
    // Common cause: email already registered.
    const msg = createErr?.message ?? 'create_failed'
    const isDup = /already.*registered|already.*exists|duplicate/i.test(msg)
    return NextResponse.json(
      { ok: false, error: isDup ? 'email_taken' : 'create_failed' },
      { status: isDup ? 409 : 500 },
    )
  }
  const childAuthId = createRes.user.id as string

  // ── 2. Wait for handle_new_auth_user trigger to create public.users ──────
  let childId: string | null = null
  for (let i = 0; i < 8; i++) {
    const { data: childRow } = await admin
      .from('users')
      .select('id')
      .eq('auth_id', childAuthId)
      .maybeSingle()
    if (childRow) { childId = (childRow as { id: string }).id; break }
    await sleep(150)
  }
  if (!childId) {
    // Trigger didn't produce a users row — leave the auth user orphaned (no
    // public profile) rather than retry forever. Surface a distinct error
    // so we can investigate if it ever happens in practice.
    return NextResponse.json({ ok: false, error: 'profile_not_created' }, { status: 500 })
  }

  // P1 privacy (docs/policy/child-privacy-defaults.md, принцип 1-2): детский
  // аккаунт приватен по умолчанию. users.is_searchable имеет DB-default TRUE
  // (взрослые находимы в поиске чата) — для ребёнка принудительно выключаем,
  // чтобы незнакомцы не находили его в /messages. Родитель сможет включить
  // позже в настройках, когда ребёнок вырастет / заберёт аккаунт.
  // Данные-фикс для уже созданных детей — миграция 093.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('users').update({ is_searchable: false }).eq('id', childId)

  // ── 3. Link parent ↔ child ───────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: linkErr } = await (admin as any)
    .from('parent_links')
    .upsert(
      { parent_id: parentId, child_id: childId, status: 'active', created_by: parentId },
      { onConflict: 'parent_id,child_id' },
    )
  if (linkErr) {
    return NextResponse.json({ ok: false, error: 'link_failed' }, { status: 500 })
  }

  return NextResponse.json({
    ok:                    true,
    child_id:              childId,
    child_name:            body.childName,
    used_synthetic_email:  usedSynthetic,
  })
}
