import { createClient } from '@/lib/supabase/client'
import { notifyMany } from './notifications.service'

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

// Athlete/coach-side: события команды, где я участник.
export async function listMyGroupSessionsAsMember(
  userId: string, from: string, to: string
): Promise<Array<GroupSession & { my_attendance: AttendanceStatus }>> {
  const sb = createClient()
  const { data: partsRaw } = await sb
    .from('org_session_participants')
    .select('session_id, attendance_status')
    .eq('user_id', userId)
  const parts = (partsRaw ?? []) as Array<{ session_id: string; attendance_status: AttendanceStatus }>
  if (parts.length === 0) return []
  const attMap: Record<string, AttendanceStatus> = {}
  for (const p of parts) attMap[p.session_id] = p.attendance_status
  const ids = parts.map(p => p.session_id)
  const { data: sRaw } = await sb
    .from('org_group_sessions')
    .select('*')
    .in('id', ids)
    .gte('session_date', from)
    .lte('session_date', to)
    .order('session_date', { ascending: true })
  const sessions = (sRaw ?? []) as GroupSession[]
  return sessions.map(s => ({ ...s, my_attendance: attMap[s.id] ?? 'pending' }))
}

// Athlete-side: моя текущая организация (первая активная связь).
export async function getMyOrganization(userId: string): Promise<{ id: string; name: string } | null> {
  const sb = createClient()
  const { data: mRaw } = await sb
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
  const members = (mRaw ?? []) as Array<{ org_id: string }>
  if (members.length === 0) return null
  const { data: orgRaw } = await sb
    .from('users')
    .select('id, name')
    .eq('id', members[0].org_id)
    .single()
  const org = orgRaw as { id: string; name: string | null } | null
  if (!org) return null
  return { id: org.id, name: org.name ?? '—' }
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
    const typeLabel = SESSION_TYPE_LABELS[session.session_type]
    await notifyMany(input.participant_ids.map(uid => ({
      user_id: uid,
      type: 'invited_to_event' as const,
      title: `Приглашение на ${typeLabel.toLowerCase()}`,
      body: `${session.title} · ${session.session_date}${session.start_time ? ' в ' + session.start_time.slice(0,5) : ''}`,
      entity_type: 'group_session',
      entity_id: session.id,
      action_url: '/calendar',
    })))
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

  if (toAdd.length > 0) {
    await (sb as any).from('org_session_participants').insert(toAdd)
    // Pull session title for notification body.
    const { data: sRaw } = await sb.from('org_group_sessions')
      .select('title, session_date, session_type, start_time').eq('id', sessionId).single()
    const s = sRaw as { title: string; session_date: string; session_type: SessionType; start_time: string | null } | null
    if (s) {
      const typeLabel = SESSION_TYPE_LABELS[s.session_type]
      await notifyMany(toAdd.map(r => ({
        user_id: r.user_id,
        type: 'invited_to_event' as const,
        title: `Приглашение на ${typeLabel.toLowerCase()}`,
        body: `${s.title} · ${s.session_date}${s.start_time ? ' в ' + s.start_time.slice(0,5) : ''}`,
        entity_type: 'group_session',
        entity_id: sessionId,
        action_url: '/calendar',
      })))
    }
  }
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
