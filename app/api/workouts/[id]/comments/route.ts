import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const BodySchema = z.object({
  body: z.string().trim().min(1).max(4000),
})

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: workoutId } = await params
  if (!workoutId) return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 })

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const { data, error } = await sb
    .from('workout_comments')
    .select(`
      id, workout_id, author_id, body, created_at, updated_at,
      author:users!workout_comments_author_id_fkey(id, name, first_name, last_name, nickname, avatar_url, role)
    `)
    .eq('workout_id', workoutId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, comments: data ?? [] })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: workoutId } = await params
  if (!workoutId) return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 })

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 })
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const { data: me } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  if (!me) return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })
  const meRow = me as { id: string }

  const { data, error } = await sb
    .from('workout_comments')
    .insert({ workout_id: workoutId, author_id: meRow.id, body: body.body })
    .select(`
      id, workout_id, author_id, body, created_at, updated_at,
      author:users!workout_comments_author_id_fkey(id, name, first_name, last_name, nickname, avatar_url, role)
    `)
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  // Notify the workout owner (if different from author)
  try {
    const { data: workout } = await sb
      .from('workouts')
      .select('athlete_id, activity_type, date')
      .eq('id', workoutId)
      .maybeSingle()
    const ownerId = (workout as { athlete_id?: string } | null)?.athlete_id
    if (ownerId && ownerId !== meRow.id) {
      const { data: author } = await sb
        .from('users').select('name, first_name, last_name').eq('id', meRow.id).maybeSingle()
      const a = author as { name?: string; first_name?: string; last_name?: string } | null
      const authorName =
        a?.name ||
        [a?.first_name, a?.last_name].filter(Boolean).join(' ') ||
        'Пользователь'
      const preview = body.body.length > 140 ? body.body.slice(0, 140) + '…' : body.body
      await sb.from('notifications').insert({
        user_id: ownerId,
        type: 'workout_comment',
        title: `${authorName} оставил комментарий к тренировке`,
        body: preview,
        entity_type: 'workout',
        entity_id: workoutId,
        action_url: `/diary?workout=${workoutId}`,
      })
    }
  } catch (e) {
    console.error('workout-comment notification failed:', e)
  }

  return NextResponse.json({ ok: true, comment: data })
}
