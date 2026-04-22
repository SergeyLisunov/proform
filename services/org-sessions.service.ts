import { createClient } from '@/lib/supabase/client'

export type SessionType = 'team_practice' | 'competition' | 'travel' | 'meeting' | 'camp' | 'other'
export type GroupStatus = 'planned' | 'completed' | 'cancelled'
export type AttendanceStatus = 'pending' | 'confirmed' | 'declined' | 'attended' | 'absent'

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  team_practice: 'Тренировка',
  competition:   'Соревнование',
  travel:        'Поездка',
  meeting:       'Собрание',
  camp:          'Сборы',
  other:         'Другое',
}

export interface GroupSession {
  id: string
  organization_id: string
  session_date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  title: string
  description: string | null
  session_type: SessionType
  status: GroupStatus
  created_at: string
  updated_at: string
}

export interface SessionParticipant {
  session_id: string
  user_id: string
  attendance_status: AttendanceStatus
}

export interface OrgMember {
  id: string
  name: string
  role: 'athlete' | 'coach'
}

export async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  const sb = createClient()
  const { data: mRaw } = await sb
    .from('org_members')
    .select('user_id, role, status')
    .eq('org_id', orgId)
    .eq('status', 'active')
  const members = (mRaw ?? []) as Array<{ user_id: string; role: 'athlete' | 'coach' }>
  if (members.length === 0) return []
  const ids = members.map(m => m.user_id)
  const { data: usersRaw } = await sb.from('users').select('id, name').in('id', ids)
  const users = (usersRaw ?? []) as Array<{ id: string; name: string | null }>
  const nameById = new Map(users.map(u => [u.id, u.name ?? '—']))
  return members
    .map(m => ({ id: m.user_id, name: nameById.get(m.user_id) ?? '—', role: m.role }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function listGroupSessions(orgId: string, from: string, to: string): Promise<GroupSession[]> {
  const sb = createClient()
  const { data } = await sb
    .from('org_group_sessions')
    .select('*')
    .eq('organization_id', orgId)
    .gte('session_date', from)
    .lte('session_date', to)
    .order('session_date', { ascending: true })
  return (data ?? []) as GroupSession[]
}

export async function listParticipants(sessionIds: string[]): Promise<SessionParticipant[]> {
  if (sessionIds.length === 0) return []
  const sb = createClient()
  const { data } = await sb
    .from('org_session_participants')
    .select('session_id, user_id, attendance_status')
    .in('session_id', sessionIds)
  return (data ?? []) as SessionParticipant[]
}

export async function createGroupSession(input: {
  organization_id: string
  session_date: string
  title: string
  session_type?: SessionType
  start_time?: string | null
  end_time?: string | null
  location?: string | null
  description?: string | null
  status?: GroupStatus
  participant_ids?: string[]
}): Promise<GroupSession | null> {
  const sb = createClient()
  const { data, error } = await (sb as any)
    .from('org_group_sessions')
    .insert({
      organization_id: input.organization_id,
      session_date:    input.session_date,
      title:           input.title,
      session_type:    input.session_type ?? 'team_practice',
      start_time:      input.start_time ?? null,
      end_time:        input.end_time   ?? null,
      location:        input.location   ?? null,
      description:     input.description ?? null,
      status:          input.status ?? 'planned',
    })
    .select()
    .single()
  if (error) { console.error('createGroupSession:', error.message); return null }
  const session = data as GroupSession
  if (input.participant_ids && input.participant_ids.length > 0) {
    const rows = input.participant_ids.map(uid => ({
      session_id: session.id, user_id: uid, attendance_status: 'pending' as const,
    }))
    await (sb as any).from('org_session_participants').insert(rows)
  }
  return session
}

export async function updateGroupSession(id: string, patch: Partial<Omit<GroupSession, 'id' | 'organization_id' | 'created_at' | 'updated_at'>>): Promise<GroupSession | null> {
  const sb = createClient()
  const { data, error } = await (sb as any)
    .from('org_group_sessions').update(patch).eq('id', id).select().single()
  if (error) { console.error('updateGroupSession:', error.message); return null }
  return data as GroupSession
}

export async function deleteGroupSession(id: string): Promise<void> {
  const sb = createClient()
  await sb.from('org_group_sessions').delete().eq('id', id)
}

export async function setParticipants(sessionId: string, userIds: string[]): Promise<void> {
  const sb = createClient()
  const existing = await listParticipants([sessionId])
  const existingIds = new Set(existing.map(p => p.user_id))
  const newSet = new Set(userIds)

  const toAdd = userIds.filter(u => !existingIds.has(u)).map(u => ({
    session_id: sessionId, user_id: u, attendance_status: 'pending' as const,
  }))
  const toRemove = existing.filter(p => !newSet.has(p.user_id)).map(p => p.user_id)

  if (toAdd.length > 0) await (sb as any).from('org_session_participants').insert(toAdd)
  if (toRemove.length > 0) {
    await sb.from('org_session_participants').delete()
      .eq('session_id', sessionId).in('user_id', toRemove)
  }
}

export async function setAttendance(sessionId: string, userId: string, status: AttendanceStatus): Promise<void> {
  const sb = createClient()
  await (sb as any)
    .from('org_session_participants')
    .update({ attendance_status: status })
    .eq('session_id', sessionId).eq('user_id', userId)
}
