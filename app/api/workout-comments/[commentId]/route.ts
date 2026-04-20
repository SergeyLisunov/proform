import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const PatchSchema = z.object({
  body: z.string().trim().min(1).max(4000),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ commentId: string }> }) {
  const { commentId } = await params
  if (!commentId) return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 })

  let body: z.infer<typeof PatchSchema>
  try {
    body = PatchSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 })
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const { data, error } = await sb
    .from('workout_comments')
    .update({ body: body.body, updated_at: new Date().toISOString() })
    .eq('id', commentId)
    .select(`
      id, workout_id, author_id, body, created_at, updated_at,
      author:users!workout_comments_author_id_fkey(id, name, first_name, last_name, nickname, avatar_url, role)
    `)
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, comment: data })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ commentId: string }> }) {
  const { commentId } = await params
  if (!commentId) return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 })

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const { error } = await sb.from('workout_comments').delete().eq('id', commentId)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
