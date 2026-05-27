import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getMe(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null
  const { data: me } = await supabase.from('users').select('id').eq('auth_id', authUser.id).single()
  return me ?? null
}

// GET /api/notes/:id
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const me = await getMe(supabase)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', me.id)
    .eq('is_deleted', false)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ note: data })
}

// PATCH /api/notes/:id
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const me = await getMe(supabase)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const payload: Record<string, unknown> = {}

  if (body.title !== undefined) {
    if (body.title && body.title.length > 255)
      return NextResponse.json({ error: 'title too long' }, { status: 400 })
    payload.title = body.title ?? null
  }
  if (body.content !== undefined) {
    if (!body.content || body.content.trim().length === 0)
      return NextResponse.json({ error: 'content cannot be empty' }, { status: 400 })
    if (body.content.length > 50000)
      return NextResponse.json({ error: 'content too long' }, { status: 400 })
    payload.content = body.content.trim()
  }
  if (body.note_date !== undefined) payload.note_date = body.note_date
  if (body.attachments !== undefined) payload.attachments = body.attachments

  if (Object.keys(payload).length === 0)
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const { data, error } = await supabase
    .from('notes')
    .update(payload)
    .eq('id', params.id)
    .eq('user_id', me.id)
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 })
  return NextResponse.json({ note: data })
}

// DELETE /api/notes/:id  (soft delete)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const me = await getMe(supabase)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('notes')
    .update({ is_deleted: true })
    .eq('id', params.id)
    .eq('user_id', me.id)

  if (error) return NextResponse.json({ error: 'server_error' }, { status: 500 })
  return NextResponse.json({ success: true })
}
