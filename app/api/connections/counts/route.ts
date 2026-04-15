import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('users').select('id').eq('auth_id', authUser.id).single()
  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data } = await supabase
    .from('connections')
    .select('status, initiator_id, recipient_id')
    .or(`initiator_id.eq.${me.id},recipient_id.eq.${me.id}`)
    .in('status', ['pending', 'active'])

  const rows = data ?? []
  return NextResponse.json({
    active:   rows.filter(r => r.status === 'active').length,
    incoming: rows.filter(r => r.status === 'pending' && r.recipient_id === me.id).length,
    outgoing: rows.filter(r => r.status === 'pending' && r.initiator_id === me.id).length,
  })
}
