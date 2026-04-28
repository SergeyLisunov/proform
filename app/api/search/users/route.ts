import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', authUser.id).single()
  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const q      = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const role   = req.nextUrl.searchParams.get('role') // athlete|coach|organization
  const limit  = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '20'), 50)
  const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0')

  if (q.length < 1) return NextResponse.json({ users: [], total: 0 })

  // Strip @ prefix for nickname search
  const search = q.startsWith('@') ? q.slice(1).toLowerCase() : q.toLowerCase()

  let query = supabase
    .from('users')
    .select('id, nickname, name, role, avatar_url, sport, city, is_searchable', { count: 'exact' })
    .eq('is_searchable', true)
    .neq('role', 'admin')
    .neq('id', me.id)

  if (role && role !== 'all') query = query.eq('role', role as import('@/types/users').UserRole)

  if (q.startsWith('@')) {
    query = query.ilike('nickname', `${search}%`)
  } else {
    // users has no first_name/last_name — search across nickname + name only.
    query = query.or(
      `nickname.ilike.%${search}%,name.ilike.%${search}%`
    )
  }

  const { data: users, count } = await query
    .order('nickname', { ascending: true })
    .range(offset, offset + limit - 1)

  const userIds = (users ?? []).map(u => u.id)
  type ConnInfo = { status: string; id: string }
  const connectionMap: Record<string, ConnInfo> = {}

  if (userIds.length > 0) {
    const { data: conns } = await supabase
      .from('connections')
      .select('id, initiator_id, recipient_id, status')
      .or(
        `and(initiator_id.eq.${me.id},recipient_id.in.(${userIds.join(',')})),` +
        `and(recipient_id.eq.${me.id},initiator_id.in.(${userIds.join(',')}))`
      )
      .in('status', ['pending', 'active'])

    for (const c of conns ?? []) {
      const otherId = c.initiator_id === me.id ? c.recipient_id : c.initiator_id
      // active takes priority over pending
      if (!connectionMap[otherId] || c.status === 'active') {
        let status: string = c.status
        if (c.status === 'pending') {
          status = c.initiator_id === me.id ? 'pending_outgoing' : 'pending_incoming'
        }
        connectionMap[otherId] = { status, id: c.id }
      }
    }
  }

  const result = (users ?? []).map(u => ({
    ...u,
    connection_status: connectionMap[u.id]?.status ?? 'none',
    connection_id:     connectionMap[u.id]?.id     ?? null,
  }))

  return NextResponse.json({ users: result, total: count ?? 0 })
}
