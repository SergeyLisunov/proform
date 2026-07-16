import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashLinkCode, getBotToken } from '@/lib/telegram/bot'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CODE_TTL_MIN = 10
const MAX_CODES_PER_HOUR = 5

/**
 * POST /api/telegram/link — одноразовый deep-link для привязки (P2).
 *
 * Код: 32 случайных байта → base64url (алфавит A-Za-z0-9_- — ровно то,
 * что допускает payload /start, лимит 64 символа). Храним ТОЛЬКО
 * SHA-256-хэш, TTL 10 минут, single-use, ≤5 кодов/час на пользователя.
 * DELETE — отвязка со стороны приложения (зеркало /unlink в боте).
 */
export async function POST() {
  if (!getBotToken() || !process.env.TELEGRAM_BOT_USERNAME) {
    return NextResponse.json({ ok: false, error: 'TELEGRAM_NOT_CONFIGURED' }, { status: 503 })
  }
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase
    .from('users').select('id').eq('auth_id', authUser.id).single()
  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any

  // Rate-limit генерации
  const hourAgo = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await adminAny.from('telegram_link_codes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', me.id)
    .gt('created_at', hourAgo)
  if ((count ?? 0) >= MAX_CODES_PER_HOUR) {
    return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 })
  }

  const code = randomBytes(32).toString('base64url')
  const { error } = await adminAny.from('telegram_link_codes').insert({
    user_id:    me.id,
    code_hash:  hashLinkCode(code),
    expires_at: new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString(),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok:   true,
    url:  `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${code}`,
    ttl_minutes: CODE_TTL_MIN,
  })
}

/** DELETE — отвязать Telegram из приложения. */
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase
    .from('users').select('id').eq('auth_id', authUser.id).single()
  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('telegram_accounts')
    .update({ unlinked_at: new Date().toISOString() })
    .eq('user_id', me.id)
    .is('unlinked_at', null)
  return NextResponse.json({ ok: true })
}
