import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  computeMetrics, generateInsight, periodRange, prevRange,
  type PeriodKind, type WorkoutRow, type NoteRow,
} from '@/lib/ai/weekly-insights'
import { AI_MODEL_SMART } from '@/lib/ai/gemma'

export const runtime = 'nodejs'
export const maxDuration = 60

function parseKind(v: unknown): PeriodKind {
  return v === 'month' ? 'month' : 'week'
}

// GET /api/insights?kind=week|month → returns cached or null
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const kind = parseKind(req.nextUrl.searchParams.get('kind'))
  const { start, end } = periodRange(kind)

  const { data: me } = await supabase.from('users').select('id').eq('auth_id', authUser.id).single()
  if (!me) return NextResponse.json({ ok: false, error: 'NO_USER' }, { status: 400 })

  const { data: row } = await (supabase as any)
    .from('ai_insights')
    .select('*')
    .eq('user_id', me.id)
    .eq('period_kind', kind)
    .eq('period_start', start)
    .maybeSingle()

  // list recent cached insights too
  const { data: recent } = await (supabase as any)
    .from('ai_insights')
    .select('id, period_kind, period_start, period_end, created_at, payload')
    .eq('user_id', me.id)
    .order('period_start', { ascending: false })
    .limit(12)

  return NextResponse.json({ ok: true, current: row ?? null, range: { start, end, kind }, recent: recent ?? [] })
}

// POST /api/insights  { kind: 'week'|'month' } → (re)generate for current period
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  let body: { kind?: unknown } = {}
  try { body = await req.json() } catch { /* allow empty */ }
  const kind = parseKind(body.kind)

  const { data: me } = await supabase.from('users').select('id').eq('auth_id', authUser.id).single()
  if (!me) return NextResponse.json({ ok: false, error: 'NO_USER' }, { status: 400 })

  const cur  = periodRange(kind)
  const prev = prevRange(kind, cur.start)

  // Pull workouts & notes for both periods.
  const [wkCurRes, wkPrevRes, notesRes] = await Promise.all([
    supabase.from('workouts')
      .select('event_date, activity_type, activity_duration_min, activity_strain, avg_heart_rate, max_heart_rate, recovery_score, hrv, mood, name, description, risk_flag')
      .eq('athlete_id', me.id)
      .gte('event_date', cur.start)
      .lte('event_date', cur.end)
      .order('event_date', { ascending: true }),
    supabase.from('workouts')
      .select('event_date, activity_type, activity_duration_min, activity_strain, avg_heart_rate, max_heart_rate, recovery_score, hrv, mood, name, description, risk_flag')
      .eq('athlete_id', me.id)
      .gte('event_date', prev.start)
      .lte('event_date', prev.end),
    supabase.from('notes')
      .select('note_date, title, content')
      .eq('user_id', me.id)
      .gte('note_date', cur.start)
      .lte('note_date', cur.end)
      .order('note_date', { ascending: true })
      .limit(30),
  ])

  const workouts = (wkCurRes.data ?? []) as WorkoutRow[]
  const workoutsPrev = (wkPrevRes.data ?? []) as WorkoutRow[]
  const notes = (notesRes.data ?? []) as NoteRow[]

  const metrics = computeMetrics(workouts)
  const prevMetrics = workoutsPrev.length ? computeMetrics(workoutsPrev) : null

  if (!workouts.length && !notes.length) {
    return NextResponse.json({
      ok: false,
      error: 'NO_DATA',
      message: 'За этот период нет тренировок и заметок.',
      metrics, range: { ...cur, kind },
    }, { status: 400 })
  }

  let payload
  try {
    payload = await generateInsight({
      periodKind: kind,
      periodStart: cur.start,
      periodEnd: cur.end,
      metrics,
      prevMetrics,
      workouts,
      notes,
    })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : 'AI_FAILED',
    }, { status: 502 })
  }

  const { data: upserted, error: upErr } = await (supabase as any)
    .from('ai_insights')
    .upsert({
      user_id: me.id,
      period_kind: kind,
      period_start: cur.start,
      period_end: cur.end,
      metrics,
      payload,
      model: AI_MODEL_SMART,
    }, { onConflict: 'user_id,period_kind,period_start' })
    .select('*')
    .single()

  if (upErr) return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  return NextResponse.json({ ok: true, current: upserted, range: { ...cur, kind } })
}
