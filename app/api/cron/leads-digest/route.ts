/**
 * GET /api/cron/leads-digest — Sprint W4 Day 22 (PR #38).
 *
 * Weekly cron (Vercel schedule "0 8 * * 1" — Monday 8am UTC) — обрабатывает
 * pending tool_leads, отправляет drip emails по 4 W4 sources, marks
 * email_dispatched_at.
 *
 * Auth: CRON_SECRET via Bearer header (Vercel автоматически добавляет
 * для крон-вызовов; manual triggers тоже работают если есть secret).
 *
 * Strategy:
 *   1. Pull до 50 pending leads (limit для Resend free tier 100/day)
 *   2. Per lead: render drip template + send via Resend
 *   3. Success → markDispatched (sets email_dispatched_at)
 *   4. Failure → markFailed (increments email_attempts)
 *   5. Lead с email_attempts >= 3 — больше не попадает в выборку
 *
 * Returns summary: { processed, dispatched, failed, skipped }.
 */
import { NextResponse } from 'next/server'
import {
  listPendingForDispatch,
  markDispatched,
  markFailed,
  type LeadSource,
} from '@/services/admin-leads.service'
import { renderLeadDrip } from '@/lib/email/lead-drip-templates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FROM = process.env.RESEND_FROM ?? 'ProForm <notifications@proform-delta.vercel.app>'
const BATCH_LIMIT = 50

interface DispatchResult {
  ok:           true
  processed:    number
  dispatched:   number
  failed:       number
  skipped:      number
  by_source:    Partial<Record<LeadSource, { dispatched: number; failed: number }>>
  duration_ms:  number
}

export async function GET(req: Request) {
  // ── Auth: CRON_SECRET ─────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
    }
  }

  const start = Date.now()

  // ── Resend lazy import ────────────────────────────────────────────
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) {
    return NextResponse.json({
      ok: false,
      error: 'RESEND_NOT_CONFIGURED',
      details: 'RESEND_API_KEY not set; cannot dispatch emails',
    }, { status: 503 })
  }

  let resend: { emails: { send: (args: { from: string; to: string; subject: string; html: string }) => Promise<unknown> } }
  try {
    const { Resend } = await import('resend')
    resend = new Resend(RESEND_API_KEY) as unknown as typeof resend
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: 'RESEND_LOAD_FAILED',
      details: e instanceof Error ? e.message : String(e),
    }, { status: 500 })
  }

  // ── Pull pending leads ────────────────────────────────────────────
  const pending = await listPendingForDispatch({ limit: BATCH_LIMIT })
  if (pending.length === 0) {
    return NextResponse.json({
      ok: true, processed: 0, dispatched: 0, failed: 0, skipped: 0,
      by_source: {}, duration_ms: Date.now() - start,
    } satisfies DispatchResult)
  }

  // ── Process each ──────────────────────────────────────────────────
  let dispatched = 0
  let failed     = 0
  let skipped    = 0
  const by_source: DispatchResult['by_source'] = {}

  function tally(source: LeadSource, kind: 'dispatched' | 'failed') {
    const s = by_source[source] ?? { dispatched: 0, failed: 0 }
    s[kind]++
    by_source[source] = s
  }

  for (const lead of pending) {
    const drip = renderLeadDrip({ source: lead.source as 'team-risk' | 'adaptive-plan' | 'club-audit' | 'medical-summary', payload: lead.payload })
    if (!drip) {
      skipped++
      continue
    }

    try {
      await resend.emails.send({
        from:    FROM,
        to:      lead.email,
        subject: drip.subject,
        html:    drip.html,
      })
      const ok = await markDispatched(lead.id)
      if (ok) {
        dispatched++
        tally(lead.source, 'dispatched')
      } else {
        // DB update failed — count as failed для retry
        await markFailed(lead.id, 'mark_dispatched_failed', lead.attempts)
        failed++
        tally(lead.source, 'failed')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await markFailed(lead.id, msg, lead.attempts)
      failed++
      tally(lead.source, 'failed')
      console.warn('[leads-digest] dispatch failed:', lead.email, msg)
    }
  }

  const result: DispatchResult = {
    ok: true,
    processed:   pending.length,
    dispatched,
    failed,
    skipped,
    by_source,
    duration_ms: Date.now() - start,
  }
  return NextResponse.json(result)
}
