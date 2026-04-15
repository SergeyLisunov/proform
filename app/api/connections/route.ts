import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET — list my connections
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', authUser.id).single()
  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const status = req.nextUrl.searchParams.get('status') // pending|active|all

  let query = supabase
    .from('connections')
    .select(`
      *,
      initiator:users!connections_initiator_id_fkey(id, nickname, first_name, last_name, role, avatar_url, sport, city),
      recipient:users!connections_recipient_id_fkey(id, nickname, first_name, last_name, role, avatar_url, sport, city)
    `)
    .or(`initiator_id.eq.${me.id},recipient_id.eq.${me.id}`)
    .order('initiated_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status as 'pending' | 'active' | 'declined' | 'cancelled' | 'terminated')
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ connections: data ?? [] })
}

// POST — create invitation
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', authUser.id).single()
  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const { recipient_id, connection_type, message } = body

  if (!recipient_id || !connection_type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Validate connection_type matches roles
  const { data: recipient } = await supabase.from('users').select('id, role').eq('id', recipient_id).single()
  if (!recipient) return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })

  const validCombos: Record<string, [string, string]> = {
    'coach_athlete': ['coach', 'athlete'],
    'org_coach':     ['organization', 'coach'],
    'org_athlete':   ['organization', 'athlete'],
  }
  const [roleA, roleB] = validCombos[connection_type] ?? []
  const rolesMatch = (me.role === roleA && recipient.role === roleB) || (me.role === roleB && recipient.role === roleA)
  if (!rolesMatch) {
    return NextResponse.json({ error: 'Role mismatch for connection_type' }, { status: 422 })
  }

  // Check for existing connection
  const { data: existing } = await supabase
    .from('connections')
    .select('id, status, responded_at')
    .or(
      `and(initiator_id.eq.${me.id},recipient_id.eq.${recipient_id}),` +
      `and(initiator_id.eq.${recipient_id},recipient_id.eq.${me.id})`
    )
    .eq('connection_type', connection_type)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'active') {
      return NextResponse.json({ error: 'already_connected' }, { status: 409 })
    }
    if (existing.status === 'pending') {
      return NextResponse.json({ error: 'already_pending' }, { status: 409 })
    }
    if (existing.status === 'declined' && existing.responded_at) {
      const hoursSince = (Date.now() - new Date(existing.responded_at).getTime()) / 3600000
      if (hoursSince < 24) {
        return NextResponse.json({ error: 'too_soon', retry_after_hours: Math.ceil(24 - hoursSince) }, { status: 429 })
      }
    }
    // Re-use: update existing row back to pending
    const { data: updated, error: upErr } = await supabase
      .from('connections')
      .update({ status: 'pending', initiator_id: me.id, recipient_id, message: message ?? null, initiated_at: new Date().toISOString(), responded_at: null })
      .eq('id', existing.id)
      .select()
      .single()
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    // Re-invite: trigger doesn't fire for pending→pending UPDATE, so notify manually
    await supabase.from('notifications').insert({
      user_id: recipient_id, type: 'invitation_received',
      title: 'Новое приглашение', body: message ?? null,
      entity_type: 'connection', entity_id: updated.id, action_url: '/connections',
    })

    return NextResponse.json({ connection: updated }, { status: 200 })
  }

  // Create new — DB trigger sends invitation_received notification automatically
  const { data: conn, error: connErr } = await supabase
    .from('connections')
    .insert({ initiator_id: me.id, recipient_id, connection_type, message: message ?? null })
    .select()
    .single()

  if (connErr) return NextResponse.json({ error: connErr.message }, { status: 500 })

  return NextResponse.json({ connection: conn }, { status: 201 })
}
