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

/**
 * Create a series of group sessions on a set of weekdays between start_date
 * and end_date (inclusive). Participant list is copied to every occurrence.
 * days_of_week: 0=Sunday, 1=Monday, ..., 6=Saturday.
 */
export async function createRecurringGroupSessions(input: {
  organization_id: string
  start_date: string            // YYYY-MM-DD
  end_date: string              // YYYY-MM-DD
  days_of_week: number[]        // 0..6
  title: string
  session_type?: SessionType
  start_time?: string | null
  end_time?: string | null
  location?: string | null
  description?: string | null
  participant_ids?: string[]
  max_occurrences?: number      // safety cap, default 52
}): Promise<{ created: GroupSession[]; skipped: number }> {
  const cap = input.max_occurrences ?? 52
  const start = new Date(input.start_date + 'T00:00:00')
  const end   = new Date(input.end_date   + 'T00:00:00')
  const days  = new Set(input.days_of_week)
  const occurrences: string[] = []
  for (let d = new Date(start); d <= end && occurrences.length < cap; d.setDate(d.getDate() + 1)) {
    if (days.has(d.getDay())) {
      const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0')
      occurrences.push(`${y}-${m}-${dd}`)
    }
  }
  const created: GroupSession[] = []
  let skipped = 0
  for (const date of occurrences) {
    const row = await createGroupSession({
      organization_id: input.organization_id,
      session_date:    date,
      title:           input.title,
      session_type:    input.session_type,
      start_time:      input.start_time,
      end_time:        input.end_time,
      location:        input.location,
      description:     input.description,
      participant_ids: input.participant_ids,
    })
    if (row) created.push(row); else skipped++
  }
  return { created, skipped }
}

async function listParticipantUserIds(sessionId: string): Promise<string[]> {
  const sb = createClient()
  const { data } = await sb
    .from('org_session_participants')
    .select('user_id')
    .eq('session_id', sessionId)
  return ((data ?? []) as Array<{ user_id: string }>).map(r => r.user_id)
}

export async function updateGroupSession(id: string, patch: Partial<Omit<GroupSession, 'id' | 'organization_id' | 'created_at' | 'updated_at'>>): Promise<GroupSession | null> {
  const sb = createClient()
  const { data: prevRaw } = await (sb as any)
    .from('org_group_sessions').select('*').eq('id', id).maybeSingle()
  const prev = prevRaw as GroupSession | null

  const { data, error } = await (sb as any)
    .from('org_group_sessions').update(patch).eq('id', id).select().single()
  if (error) { console.error('updateGroupSession:', error.message); return null }
  const next = data as GroupSession

  if (prev) {
    const cancelledNow = prev.status !== 'cancelled' && next.status === 'cancelled'
    const dateChanged  = prev.session_date !== next.session_date
    const timeChanged  = (prev.start_time ?? '') !== (next.start_time ?? '')
                       || (prev.end_time   ?? '') !== (next.end_time   ?? '')

    if (cancelledNow || dateChanged || timeChanged) {
      const participants = await listParticipantUserIds(id)
      if (participants.length > 0) {
        const typeLabel = SESSION_TYPE_LABELS[next.session_type]
        const base = `${next.title} · ${next.session_date}${next.start_time ? ' в ' + next.start_time.slice(0,5) : ''}`
        await notifyMany(participants.map(uid => (
          cancelledNow
            ? {
                user_id: uid,
                type: 'event_cancelled' as const,
                title: `${typeLabel} отменено`,
                body: base,
                entity_type: 'group_session',
                entity_id: next.id,
                action_url: '/calendar',
              }
            : {
                user_id: uid,
                type: 'invited_to_event' as const,
                title: `${typeLabel} перенесено`,
                body: base,
                entity_type: 'group_session',
                entity_id: next.id,
                action_url: '/calendar',
              }
        )))
      }
    }
  }

  return next
}

export async function deleteGroupSession(id: string): Promise<void> {
  const sb = createClient()
  const { data: prevRaw } = await (sb as any)
    .from('org_group_sessions').select('*').eq('id', id).maybeSingle()
  const prev = prevRaw as GroupSession | null
  const participants = prev ? await listParticipantUserIds(id) : []

  await sb.from('org_group_sessions').delete().eq('id', id)

  if (prev && participants.length > 0) {
    const typeLabel = SESSION_TYPE_LABELS[prev.session_type]
    const base = `${prev.title} · ${prev.session_date}${prev.start_time ? ' в ' + prev.start_time.slice(0,5) : ''}`
    await notifyMany(participants.map(uid => ({
      user_id: uid,
      type: 'event_cancelled' as const,
      title: `${typeLabel} отменено`,
      body: base,
      entity_type: 'group_session',
      entity_id: prev.id,
      action_url: '/calendar',
    })))
  }
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
