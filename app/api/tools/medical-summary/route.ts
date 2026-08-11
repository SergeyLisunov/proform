/**
 * POST /api/tools/medical-summary — Sprint W4 Day 21 (PR #37).
 *
 * Public lead-magnet endpoint для doctor / sports physician acquisition.
 * Mirror Day 18-20 pattern (team-risk / adaptive-plan / club-audit).
 *
 * ⚠️ Medical context: response includes structured assessment template
 * BUT response.data._disclaimer field reminds caller это AI draft, not
 * a diagnosis. UI surfaces disclaimer prominently.
 */
import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { MedicalCaseInputSchema, analyzeMedicalCase } from '@/lib/ai/medical-summary-demo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Бюджет функции на Vercel: инструмент ходит в Gemma (общий дедлайн вызова
// 45 с внутри lib/ai/gemma.ts). Без явного значения платформа даёт меньший
// умолчательный лимит, и функция умирает раньше собственного дедлайна.
export const maxDuration = 60


const RATE_LIMIT_HOUR = 5
const RATE_LIMIT_DAY  = 20

const DISCLAIMER = 'AI-generated draft for clinical reference only. NOT a diagnosis. Clinical review by a licensed practitioner required before acting on this summary.'

function sha(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 48)
}

export async function POST(req: Request) {
  // ── Validate body ─────────────────────────────────────────────────
  const json = await req.json().catch(() => null)
  const parsed = MedicalCaseInputSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'INVALID_INPUT', details: parsed.error.format() },
      { status: 400 },
    )
  }
  const input = parsed.data

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
        .eq('source', 'medical-summary')
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
        .eq('source', 'medical-summary')
        .gte('created_at', dayAgo)
      if ((dayCount ?? 0) >= RATE_LIMIT_DAY) {
        return NextResponse.json(
          { ok: false, error: 'RATE_LIMITED', retry_after_minutes: 60 * 24 },
          { status: 429 },
        )
      }
    } catch (e) {
      console.warn('[medical-summary] rate-limit check failed, proceeding:', e instanceof Error ? e.message : e)
    }
  }

  // ── Run analysis ──────────────────────────────────────────────────
  try {
    const summary = await analyzeMedicalCase(input)
    return NextResponse.json({
      ok:          true,
      data:        summary,
      _disclaimer: DISCLAIMER,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'AI_ERROR'
    return NextResponse.json({ ok: false, error: 'ANALYSIS_FAILED', details: msg }, { status: 500 })
  }
}
