import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseWorkoutText } from '@/lib/ai/parse-workout'

export const runtime = 'nodejs'
export const maxDuration = 30

// POST /api/workouts/parse  { text: string }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  let body: { text?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 })
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) return NextResponse.json({ ok: false, error: 'EMPTY_TEXT' }, { status: 400 })
  if (text.length > 2000) return NextResponse.json({ ok: false, error: 'TEXT_TOO_LONG' }, { status: 400 })

  const todayISO = new Date().toISOString().slice(0, 10)

  try {
    const draft = await parseWorkoutText({ text, todayISO })
    return NextResponse.json({ ok: true, draft })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : 'AI_FAILED',
    }, { status: 502 })
  }
}
