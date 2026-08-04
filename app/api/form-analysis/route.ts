import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  analyzeFormFrames, isFormAnalysisAvailable, FORM_ANALYSIS_UNAVAILABLE,
} from '@/lib/ai/form-analyze'

export const runtime = 'nodejs'
export const maxDuration = 60

// POST /api/form-analysis
// Body: { title, sport?, exercise?, videoPath?, videoPublicUrl?, frames: string[], athleteId? }
export async function POST(req: NextRequest) {
  // Отказ ДО создания строки в form_analyses: иначе каждая попытка
  // оставляла бы мусорную запись analyzing → error. Разбор техники
  // требует мультимодального вызова, которого у текущего провайдера
  // нет — подробности в шапке lib/ai/form-analyze.
  if (!isFormAnalysisAvailable()) {
    return NextResponse.json(
      {
        ok: false,
        error: FORM_ANALYSIS_UNAVAILABLE,
        message: 'Видеоразбор техники временно недоступен: AI-провайдер платформы не принимает изображения.',
      },
      { status: 501 },
    )
  }

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

  // Mass assignment: athlete_id брался из тела запроса без единой проверки, а
  // RLS-политика form_analyses_owner_insert смотрит ТОЛЬКО на author_id — то
  // есть любой авторизованный пользователь мог записать разбор техники в чужой
  // аккаунт (жертва видит его у себя: form_analyses_select пускает по
  // athlete_id). Разбор на чужого спортсмена разрешаем только тренеру с
  // подтверждённой связью — тем же предикатом, что и /api/recommendations.
  const requestedAthleteId = typeof body.athleteId === 'string' ? body.athleteId.trim() : ''
  let athleteId = me.id as string
  if (requestedAthleteId && requestedAthleteId !== me.id) {
    const { data: link } = await supabase
      .from('trainer_athletes')
      .select('trainer_id')
      .eq('trainer_id', me.id as string)
      .eq('athlete_id', requestedAthleteId)
      .eq('status', 'accepted')
      .maybeSingle()
    if (!link) {
      return NextResponse.json({ ok: false, error: 'NOT_YOUR_ATHLETE' }, { status: 403 })
    }
    athleteId = requestedAthleteId
  }

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
    return NextResponse.json({ ok: false, error: 'INSERT_FAILED' }, { status: 500 })
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
      return NextResponse.json({ ok: false, error: 'server_error', analysis: created }, { status: 500 })
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
