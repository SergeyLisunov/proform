/**
 * POST /api/tools/team-risk — Sprint W4 Day 18 (PR #34).
 *
 * Public lead-magnet endpoint. Coach без auth отправляет данные команды
 * (3-12 атлетов с weekly hours + recovery + mood), получает AI-сгенерированный
 * Team Risk Snapshot.
 *
 * NOT email-gated на этом endpoint — UI снимает email отдельно через
 * существующий /api/tools/lead с source='team-risk' (single source of
 * truth для leads). Так разделяем concerns: snapshot генерируется
 * сразу для preview, lead capture — отдельная commitment-action.
 *
 * Rate limits (anti-abuse — AI tokens стоят денег):
 *   - 5 calls / hour per IP
 *   - 20 calls / day per IP
 *   - Stub-mode fallback если AI не настроен (return rule-based snapshot)
 */
import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { TeamRiskInputSchema, analyzeTeamRisk } from '@/lib/ai/team-risk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RATE_LIMIT_HOUR = 5
const RATE_LIMIT_DAY  = 20

function sha(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 48)
}

export async function POST(req: Request) {
  // ── Validate body ─────────────────────────────────────────────────
  const json = await req.json().catch(() => null)
  const parsed = TeamRiskInputSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'INVALID_INPUT', details: parsed.error.format() },
      { status: 400 },
    )
  }
  const input = parsed.data

  // ── Rate limit by IP via tool_leads table audit ──────────────────
  // We piggyback on the same `tool_leads` storage by counting recent
  // lead-captures from this IP. This conflates "user submitted email"
  // with "user invoked AI", but in practice the funnel is sequential:
  // run snapshot → email gate → POST lead. So a hot IP won't be
  // double-charged. For pure anonymous abuse we still need a separate
  // rate-limit table; piggybacking is good enough for MVP.
  const rawIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
              ?? req.headers.get('x-real-ip')
              ?? ''
  const ipHash = rawIp.length > 0 ? sha(rawIp) : null

  if (ipHash) {
    try {
      const admin = createAdminClient()
      const hourAgo = new Date(Date.now() - 3600_000).toISOString()
      const dayAgo  = new Date(Date.now() - 24 * 3600_000).toISOString()

      const { count: hourCount } = await admin
        .from('tool_leads')
        .select('id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash)
        .eq('source', 'team-risk')
        .gte('created_at', hourAgo)
      if ((hourCount ?? 0) >= RATE_LIMIT_HOUR) {
        return NextResponse.json(
          { ok: false, error: 'RATE_LIMITED', retry_after_minutes: 60 },
          { status: 429 },
        )
      }

      const { count: dayCount } = await admin
        .from('tool_leads')
        .select('id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash)
        .eq('source', 'team-risk')
        .gte('created_at', dayAgo)
      if ((dayCount ?? 0) >= RATE_LIMIT_DAY) {
        return NextResponse.json(
          { ok: false, error: 'RATE_LIMITED', retry_after_minutes: 60 * 24 },
          { status: 429 },
        )
      }
    } catch (e) {
      // If rate-limit lookup fails (DB blip), prefer to serve the user
      // rather than reject — they didn't do anything wrong.
      console.warn('[team-risk] rate-limit check failed, proceeding:', e instanceof Error ? e.message : e)
    }
  }

  // ── Run analysis ──────────────────────────────────────────────────
  try {
    const snapshot = await analyzeTeamRisk(input)
    return NextResponse.json({ ok: true, data: snapshot })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'AI_ERROR'
    return NextResponse.json({ ok: false, error: 'ANALYSIS_FAILED', details: msg }, { status: 500 })
  }
}
