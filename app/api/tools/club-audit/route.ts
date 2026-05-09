/**
 * POST /api/tools/club-audit — Sprint W4 Day 20 (PR #36).
 *
 * Public lead-magnet endpoint для org-admin / club managers. Mirror
 * /api/tools/team-risk и /api/tools/adaptive-plan pattern (Day 18, 19).
 */
import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { ClubAuditInputSchema, analyzeClubAudit } from '@/lib/ai/club-audit'

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
  const parsed = ClubAuditInputSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'INVALID_INPUT', details: parsed.error.format() },
      { status: 400 },
    )
  }
  const input = parsed.data

  // Cross-field sanity: active <= total
  if (input.active_athletes > input.total_athletes) {
    return NextResponse.json(
      { ok: false, error: 'INVALID_INPUT', details: 'active_athletes > total_athletes' },
      { status: 400 },
    )
  }
  if (input.departed_90d !== undefined && input.departed_90d > input.total_athletes) {
    return NextResponse.json(
      { ok: false, error: 'INVALID_INPUT', details: 'departed_90d > total_athletes' },
      { status: 400 },
    )
  }

  // ── Rate limit by IP via tool_leads piggyback ────────────────────
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
        .eq('source', 'club-audit')
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
        .eq('source', 'club-audit')
        .gte('created_at', dayAgo)
      if ((dayCount ?? 0) >= RATE_LIMIT_DAY) {
        return NextResponse.json(
          { ok: false, error: 'RATE_LIMITED', retry_after_minutes: 60 * 24 },
          { status: 429 },
        )
      }
    } catch (e) {
      console.warn('[club-audit] rate-limit check failed, proceeding:', e instanceof Error ? e.message : e)
    }
  }

  // ── Run analysis ──────────────────────────────────────────────────
  try {
    const report = await analyzeClubAudit(input)
    return NextResponse.json({ ok: true, data: report })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'AI_ERROR'
    return NextResponse.json({ ok: false, error: 'ANALYSIS_FAILED', details: msg }, { status: 500 })
  }
}
