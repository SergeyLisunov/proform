import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const PatchSchema = z.object({
  body: z.string().trim().min(1).max(4000),
})

// Verifies the caller authored the comment (or is admin). Returns the user's
// id when authorised, or a NextResponse with the appropriate error.
async function authoriseCommentWrite(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  commentId: string,
): Promise<{ ok: true; meId: string } | { ok: false; res: NextResponse }> {
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) {
    return { ok: false, res: NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 }) }
  }
  const { data: me } = await sb.from('users').select('id, role').eq('auth_id', auth.user.id).maybeSingle()
  if (!me) {
    return { ok: false, res: NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 }) }
  }
  const meRow = me as { id: string; role: string | null }
  const { data: c } = await sb.from('workout_comments').select('author_id').eq('id', commentId).maybeSingle()
  if (!c) {
    return { ok: false, res: NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 }) }
  }
  const authorId = (c as { author_id: string }).author_id
  if (authorId !== meRow.id && meRow.role !== 'admin') {
    return { ok: false, res: NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 }) }
  }
  return { ok: true, meId: meRow.id }
}

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
  const guard = await authoriseCommentWrite(sb, commentId)
  if (!guard.ok) return guard.res

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
  const guard = await authoriseCommentWrite(sb, commentId)
  if (!guard.ok) return guard.res

  const { error } = await sb.from('workout_comments').delete().eq('id', commentId)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
