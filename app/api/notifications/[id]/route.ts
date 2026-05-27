import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH — mark read or archive
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('users').select('id').eq('auth_id', authUser.id).single()
  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const update: Record<string, unknown> = {}
  if (body.is_read !== undefined) {
    update.is_read = body.is_read
    if (body.is_read) update.read_at = new Date().toISOString()
  }
  if (body.is_archived !== undefined) update.is_archived = body.is_archived

  const { data, error } = await supabase
    .from('notifications')
    .update(update)
    .eq('id', id)
    .eq('user_id', me.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'server_error' }, { status: 500 })
  return NextResponse.json({ notification: data })
}
