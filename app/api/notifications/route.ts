import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET — list notifications
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('users').select('id').eq('auth_id', authUser.id).single()
  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const limit  = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '30'), 100)
  const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0')
  const type   = req.nextUrl.searchParams.get('type')

  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', me.id)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (type && type !== 'all') query = query.eq('type', type)

  const { data, count } = await query

  const { count: unread } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', me.id)
    .eq('is_read', false)
    .eq('is_archived', false)

  return NextResponse.json({ notifications: data ?? [], total: count ?? 0, unread_count: unread ?? 0 })
}

// POST — broadcast (org/admin only)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', authUser.id).single()
  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (me.role !== 'organization' && me.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { target, title, body, action_url } = await req.json()
  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  // Get recipients: members of this organization
  let recipientsQuery = supabase
    .from('connections')
    .select('initiator_id, recipient_id, connection_type')
    .or(`initiator_id.eq.${me.id},recipient_id.eq.${me.id}`)
    .eq('status', 'active')

  if (target === 'athletes') recipientsQuery = recipientsQuery.eq('connection_type', 'org_athlete')
  else if (target === 'coaches') recipientsQuery = recipientsQuery.eq('connection_type', 'org_coach')
  else recipientsQuery = recipientsQuery.in('connection_type', ['org_athlete', 'org_coach'])

  const { data: conns } = await recipientsQuery
  const recipientIds = (conns ?? []).map(c => c.initiator_id === me.id ? c.recipient_id : c.initiator_id)

  if (recipientIds.length === 0) return NextResponse.json({ sent: 0 })

  const rows = recipientIds.map(uid => ({
    user_id:    uid,
    type:       'broadcast',
    title,
    body:       body ?? null,
    action_url: action_url ?? null,
    entity_type: 'organization',
    entity_id:   me.id,
  }))

  const { error } = await supabase.from('notifications').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ sent: rows.length })
}
