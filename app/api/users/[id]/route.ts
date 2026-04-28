import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('users').select('id').eq('auth_id', authUser.id).single()
  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // users table has no first_name/last_name (just `name` + nickname).
  // Coaches/doctors hold the split fields in their role tables.
  const { data: profile } = await supabase
    .from('users')
    .select('id, nickname, name, role, avatar_url, sport, discipline, city, country, bio, coach_specialization, experience_years, is_searchable')
    .eq('id', id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Role-specific profile record
  let roleProfile: Record<string, unknown> | null = null
  if (profile.role === 'athlete') {
    const { data } = await supabase
      .from('athletes')
      .select('primary_sport, fitness_level, goal, height_cm, weight_kg, club, weekly_training_hours, profile_public, workouts_public')
      .eq('id', id).maybeSingle()
    roleProfile = (data as Record<string, unknown>) ?? null
  } else if (profile.role === 'coach') {
    const { data } = await supabase
      .from('coaches').select('*').eq('id', id).maybeSingle()
    roleProfile = (data as Record<string, unknown>) ?? null
  } else if (profile.role === 'doctor') {
    const { data } = await supabase
      .from('doctors').select('*').eq('id', id).maybeSingle()
    roleProfile = (data as Record<string, unknown>) ?? null
  } else if (profile.role === 'organization') {
    const { data } = await supabase
      .from('organizations').select('*').eq('id', id).maybeSingle()
    roleProfile = (data as Record<string, unknown>) ?? null
  }

  // Connection status between me and this user
  let connectionStatus = 'none'
  let connectionId: string | null = null
  if (me.id !== id) {
    const { data: conn } = await supabase
      .from('connections')
      .select('id, status, initiator_id')
      .or(`and(initiator_id.eq.${me.id},recipient_id.eq.${id}),and(initiator_id.eq.${id},recipient_id.eq.${me.id})`)
      .in('status', ['pending', 'active'])
      .maybeSingle()
    if (conn) { connectionStatus = conn.status; connectionId = conn.id }
  }

  return NextResponse.json({
    profile: { ...profile, ...(roleProfile ?? {}) },
    connectionStatus,
    connectionId,
    isOwn: me.id === id,
  })
}
