import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH — accept | decline | cancel
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', authUser.id).single()
  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { action } = await req.json()
  if (!['accept', 'decline', 'cancel'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const { data: conn } = await supabase.from('connections').select('*').eq('id', id).single()
  if (!conn) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (conn.status !== 'pending') return NextResponse.json({ error: 'Not pending' }, { status: 409 })

  // Permissions
  if (action === 'cancel' && conn.initiator_id !== me.id) {
    return NextResponse.json({ error: 'Only initiator can cancel' }, { status: 403 })
  }
  if ((action === 'accept' || action === 'decline') && conn.recipient_id !== me.id) {
    return NextResponse.json({ error: 'Only recipient can accept/decline' }, { status: 403 })
  }

  const newStatus = action === 'accept' ? 'active' : action === 'decline' ? 'declined' : 'cancelled'
  const { data: updated, error } = await supabase
    .from('connections')
    .update({ status: newStatus, responded_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'server_error' }, { status: 500 })

  // Notifications handled by DB trigger (trg_connection_status_notify)

  // If accepted coach_athlete → create direct chat if not exists
  if (action === 'accept' && conn.connection_type === 'coach_athlete') {
    // Determine athlete/coach ids by looking up their roles
    const { data: initiatorUser } = await supabase.from('users').select('role').eq('id', conn.initiator_id).single()
    const athleteId = initiatorUser?.role === 'athlete' ? conn.initiator_id : conn.recipient_id
    const coachId   = initiatorUser?.role === 'coach'   ? conn.initiator_id : conn.recipient_id

    const { data: existingChat } = await supabase
      .from('chats')
      .select('id')
      .eq('athlete_id', athleteId)
      .eq('coach_id', coachId)
      .maybeSingle()

    if (!existingChat) {
      const { data: chat } = await supabase
        .from('chats')
        .insert({ athlete_id: athleteId, coach_id: coachId, type: 'direct', created_by: me.id })
        .select()
        .single()
      if (chat) {
        await supabase.from('chat_members').insert([
          { chat_id: chat.id, user_id: athleteId, role: 'member' },
          { chat_id: chat.id, user_id: coachId,   role: 'member' },
        ])
      }
    }
  }

  return NextResponse.json({ connection: updated })
}

// DELETE — terminate active connection
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('users').select('id').eq('auth_id', authUser.id).single()
  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data: conn } = await supabase.from('connections').select('*').eq('id', id).single()
  if (!conn) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (conn.initiator_id !== me.id && conn.recipient_id !== me.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await supabase
    .from('connections')
    .update({ status: 'terminated', terminated_at: new Date().toISOString(), terminated_by: me.id })
    .eq('id', id)

  // Notification handled by DB trigger (trg_connection_status_notify)

  return NextResponse.json({ success: true })
}
