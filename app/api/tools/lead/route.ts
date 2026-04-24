import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/tools/lead
 *
 * Public endpoint — без auth. Капча email + payload (результат расчёта
 * ACWR / теста перетренированности / скачанный шаблон). Хранится в
 * `tool_leads` через service-role client (RLS insert открыт, но
 * SELECT закрыт — читать может только admin).
 *
 * Rate-limit — мягкий: блокируем только явный спам. Ключ по ip_hash
 * + source, лимит 20 вставок / час на IP.
 */

const VALID_SOURCES = new Set(['acwr', 'overtraining', 'templates', 'other'])

function sha(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 48)
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as {
    email?: string
    source?: string
    payload?: Record<string, unknown>
    consent?: boolean
  }
  const email  = (body.email ?? '').trim().toLowerCase()
  const source = (body.source ?? '').trim()
  const payload = body.payload ?? null

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 })
  }
  if (!VALID_SOURCES.has(source)) {
    return NextResponse.json({ ok: false, error: 'invalid_source' }, { status: 400 })
  }
  if (body.consent !== true) {
    return NextResponse.json({ ok: false, error: 'consent_required' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
             ?? req.headers.get('x-real-ip')
             ?? ''
  const ipHash    = ip ? sha(ip) : null
  const userAgent = req.headers.get('user-agent')?.slice(0, 400) ?? null

  const admin = createAdminClient()

  // Soft rate limit: не даём больше 20 вставок за час с одного IP.
  if (ipHash) {
    const { count } = await admin
      .from('tool_leads')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', new Date(Date.now() - 3600_000).toISOString())
    if ((count ?? 0) >= 20) {
      return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
    }
  }

  const { error } = await admin.from('tool_leads').insert({
    email,
    source,
    payload: payload as any,
    ip_hash: ipHash,
    user_agent: userAgent,
  })
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true }, { status: 201 })
}
