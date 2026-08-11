/**
 * POST /api/tools/adaptive-plan — Sprint W4 Day 19 (PR #35).
 *
 * Public lead-magnet endpoint. Athlete без auth отправляет sport + goal
 * + 4-week training history (3-30 workouts), получает AI-сгенерированный
 * 7-day plan preview.
 *
 * Mirror /api/tools/team-risk pattern (Day 18):
 *   - Public, no auth
 *   - Zod validation via AdaptivePlanInputSchema
 *   - Rate limit 5/hour + 20/day per IP via tool_leads piggyback
 *   - Stub fallback если AI не настроен (rule-based plan)
 *   - NOT email-gated — UI снимает email отдельно через /api/tools/lead
 */
import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  AdaptivePlanInputSchema,
  generateAdaptivePlan,
} from '@/lib/ai/adaptive-plan-preview'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Бюджет функции на Vercel: инструмент ходит в Gemma (общий дедлайн вызова
// 45 с внутри lib/ai/gemma.ts). Без явного значения платформа даёт меньший
// умолчательный лимит, и функция умирает раньше собственного дедлайна.
export const maxDuration = 60


const RATE_LIMIT_HOUR = 5
const RATE_LIMIT_DAY  = 20

function sha(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 48)
}

export async function POST(req: Request) {
  // ── Validate body ─────────────────────────────────────────────────
  const json = await req.json().catch(() => null)
  const parsed = AdaptivePlanInputSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'INVALID_INPUT', details: parsed.error.format() },
      { status: 400 },
    )
  }
  const input = parsed.data

  // ── Rate limit by IP via tool_leads audit ────────────────────────
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
        .eq('source', 'adaptive-plan')
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
        .eq('source', 'adaptive-plan')
        .gte('created_at', dayAgo)
      if ((dayCount ?? 0) >= RATE_LIMIT_DAY) {
        return NextResponse.json(
          { ok: false, error: 'RATE_LIMITED', retry_after_minutes: 60 * 24 },
          { status: 429 },
        )
      }
    } catch (e) {
      console.warn('[adaptive-plan] rate-limit check failed, proceeding:', e instanceof Error ? e.message : e)
    }
  }

  // ── Run analysis ──────────────────────────────────────────────────
  try {
    const plan = await generateAdaptivePlan(input)
    return NextResponse.json({ ok: true, data: plan })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'AI_ERROR'
    return NextResponse.json({ ok: false, error: 'ANALYSIS_FAILED', details: msg }, { status: 500 })
  }
}
