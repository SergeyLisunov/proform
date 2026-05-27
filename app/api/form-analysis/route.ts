import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeFormFrames } from '@/lib/ai/form-analyze'

export const runtime = 'nodejs'
export const maxDuration = 60

// POST /api/form-analysis
// Body: { title, sport?, exercise?, videoPath?, videoPublicUrl?, frames: string[], athleteId? }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', authUser.id).single()
  if (!me) return NextResponse.json({ ok: false, error: 'NO_USER_ROW' }, { status: 400 })

  let body: {
    title?: unknown
    sport?: unknown
    exercise?: unknown
    videoPath?: unknown
    videoPublicUrl?: unknown
    frames?: unknown
    athleteId?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 160) : ''
  if (!title) return NextResponse.json({ ok: false, error: 'TITLE_REQUIRED' }, { status: 400 })

  const frames = Array.isArray(body.frames)
    ? (body.frames as unknown[]).filter((f): f is string => typeof f === 'string' && f.length > 0).slice(0, 10)
    : []
  if (frames.length < 1) return NextResponse.json({ ok: false, error: 'FRAMES_REQUIRED' }, { status: 400 })

  const sport    = typeof body.sport    === 'string' ? body.sport.trim().slice(0, 60)    : null
  const exercise = typeof body.exercise === 'string' ? body.exercise.trim().slice(0, 60) : null
  const videoPath      = typeof body.videoPath      === 'string' ? body.videoPath      : null
  const videoPublicUrl = typeof body.videoPublicUrl === 'string' ? body.videoPublicUrl : null
  const athleteId      = typeof body.athleteId      === 'string' ? body.athleteId      : (me.id as string)

  // Create row (status=analyzing). Row lives in public.form_analyses.
  const insertBase = {
    athlete_id: athleteId,
    author_id:  me.id,
    title, sport, exercise,
    video_path: videoPath,
    video_public_url: videoPublicUrl,
    frames_count: frames.length,
    status: 'analyzing' as const,
  }

  const { data: created, error: insErr } = await (supabase as any)
    .from('form_analyses')
    .insert(insertBase)
    .select('*')
    .single()
  if (insErr || !created) {
    return NextResponse.json({ ok: false, error: insErr?.message || 'INSERT_FAILED' }, { status: 500 })
  }

  // Run AI analysis.
  try {
    const feedback = await analyzeFormFrames({ frames, sport: sport ?? undefined, exercise: exercise ?? undefined, title })
    const { data: updated, error: updErr } = await (supabase as any)
      .from('form_analyses')
      .update({
        status: 'done',
        ai_summary: feedback.summary,
        ai_feedback: feedback,
        updated_at: new Date().toISOString(),
      })
      .eq('id', created.id)
      .select('*')
      .single()
    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message, analysis: created }, { status: 500 })
    }
    return NextResponse.json({ ok: true, analysis: updated })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'AI_FAILED'
    await (supabase as any).from('form_analyses').update({
      status: 'error',
      error_message: msg,
      updated_at: new Date().toISOString(),
    }).eq('id', created.id)
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }
}

// GET /api/form-analysis — list analyses for current user.
export async function GET() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await (supabase as any)
    .from('form_analyses')
    .select('id, title, sport, exercise, status, ai_summary, ai_feedback, video_public_url, frames_count, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  return NextResponse.json({ ok: true, items: data ?? [] })
}
