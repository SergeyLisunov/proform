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
  return NextResponse.json({ ok: true, comment: data })
}
