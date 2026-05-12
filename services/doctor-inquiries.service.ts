/**
 * Doctor Inquiries service — Sprint W5 Day 26 (PR #43).
 *
 * Coach → Doctor message workflow для medical clearance questions.
 * Differentiator vs TrainingPeaks/TeamSnap — нет в их платформах.
 *
 * RLS handles auth:
 *   - Coach own inquiries CRUD (coach_id = me)
 *   - Doctor read+update inquiries assigned (doctor_id = me) OR open queue
 *     (doctor_id IS NULL AND role='doctor')
 *   - Athlete read own inquiries (athlete_id = me) — summary, не clinical
 */
import { createClient } from '@/lib/supabase/client'

export type QuestionType = 'general' | 'load_clearance' | 'injury_review' | 'return_to_play' | 'red_flag'
export type Urgency      = 'routine' | 'urgent' | 'red_flag'
export type InquiryStatus = 'pending' | 'answered' | 'expired' | 'cancelled'

export const QUESTION_TYPE_META: Record<QuestionType, { label: string; emoji: string; color: string; bg: string; border: string; placeholder: string }> = {
  general:         { label: 'Общий вопрос',                    emoji: '💬', color: '#475569', bg: '#F8FAFC', border: '#E2E8F0', placeholder: 'Опишите ситуацию атлета и в чём ваш вопрос' },
  load_clearance:  { label: 'Допуск к нагрузке',               emoji: '✅', color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0', placeholder: 'Атлет хочет вернуться к тренировкам — можно ли допустить?' },
  injury_review:   { label: 'Оценка травмы',                   emoji: '🩹', color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA', placeholder: 'Опишите механизм травмы и симптомы' },
  return_to_play:  { label: 'Return to play',                  emoji: '🏃', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', placeholder: 'Сроки реабилитации, есть ли остаточные симптомы' },
  red_flag:        { label: 'Срочно: красные флаги',           emoji: '🚨', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA', placeholder: 'Опишите тревожные симптомы и обстоятельства' },
}

export const URGENCY_META: Record<Urgency, { label: string; color: string; bg: string; border: string; sla_hours: number }> = {
  routine: { label: 'Routine (7 дн)',    color: '#475569', bg: '#F8FAFC', border: '#E2E8F0', sla_hours: 24 * 7 },
  urgent:  { label: 'Urgent (72 ч)',     color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA', sla_hours: 72 },
  red_flag:{ label: 'Red Flag (24 ч)',   color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA', sla_hours: 24 },
}

export const STATUS_META: Record<InquiryStatus, { label: string; color: string; bg: string; border: string; emoji: string }> = {
  pending:   { label: 'Ожидает',     color: '#0E7490', bg: '#ECFEFF', border: '#A5F3FC', emoji: '⏳' },
  answered:  { label: 'Отвечено',    color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0', emoji: '✅' },
  expired:   { label: 'Истекло',     color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0', emoji: '⌛' },
  cancelled: { label: 'Отменено',    color: '#94A3B8', bg: '#F8FAFC', border: '#E2E8F0', emoji: '✕' },
}

export interface DoctorInquiry {
  id:             string
  coach_id:       string
  athlete_id:     string
  doctor_id:      string | null
  question:       string
  question_type:  QuestionType
  urgency:        Urgency
  response:       string | null
  status:         InquiryStatus
  responded_at:   string | null
  expires_at:     string
  created_at:     string
  updated_at:     string
}

export interface InquiryWithUsers extends DoctorInquiry {
  coach_name:    string | null
  athlete_name:  string | null
  doctor_name:   string | null
}

// ── Coach side: list + create ─────────────────────────────────────────

export async function listMyCoachInquiries(): Promise<InquiryWithUsers[]> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return []
  const { data: meRow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string } | null
  if (!me) return []

  const { data: inqs } = await sb
    .from('doctor_inquiries')
    .select('*')
    .eq('coach_id', me.id)
    .order('created_at', { ascending: false })

  return enrichWithUserNames(sb, (inqs ?? []) as DoctorInquiry[])
}

export interface CreateInquiryInput {
  athlete_id:     string
  question:       string
  question_type:  QuestionType
  urgency:        Urgency
  doctor_id?:     string | null   // если null — open queue для any doctor
}

export async function createInquiry(input: CreateInquiryInput): Promise<DoctorInquiry | null> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return null
  const { data: meRow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string } | null
  if (!me) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).from('doctor_inquiries').insert({
    coach_id:       me.id,
    athlete_id:     input.athlete_id,
    doctor_id:      input.doctor_id ?? null,
    question:       input.question.trim(),
    question_type:  input.question_type,
    urgency:        input.urgency,
    status:         'pending',
  }).select().single()
  if (error) {
    console.warn('[doctor-inquiries.createInquiry]', error.message)
    return null
  }
  return data as DoctorInquiry
}

export async function cancelInquiry(inquiryId: string): Promise<boolean> {
  const sb = createClient()
  const { error } = await sb.from('doctor_inquiries').update({ status: 'cancelled' }).eq('id', inquiryId)
  if (error) {
    console.warn('[doctor-inquiries.cancelInquiry]', error.message)
    return false
  }
  return true
}

// ── Doctor side: queue + respond ──────────────────────────────────────

export async function listMyDoctorInquiries(filter?: 'pending' | 'answered' | 'all'): Promise<InquiryWithUsers[]> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return []
  const { data: meRow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string } | null
  if (!me) return []

  let q = sb.from('doctor_inquiries').select('*')
  // RLS handles read filtering (own doctor_id OR open queue)
  if (filter === 'pending')  q = q.eq('status', 'pending')
  if (filter === 'answered') q = q.eq('status', 'answered')

  const { data } = await q.order('created_at', { ascending: false }).limit(100)
  return enrichWithUserNames(sb, (data ?? []) as DoctorInquiry[])
}

export async function respondToInquiry(inquiryId: string, response: string): Promise<boolean> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return false
  const { data: meRow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string } | null
  if (!me) return false

  // Claim if doctor_id null (open queue) + respond
  const { error } = await sb
    .from('doctor_inquiries')
    .update({
      doctor_id: me.id,
      response:  response.trim(),
      status:    'answered',
    })
    .eq('id', inquiryId)
  if (error) {
    console.warn('[doctor-inquiries.respondToInquiry]', error.message)
    return false
  }
  return true
}

// ── User name enrichment (batch) ──────────────────────────────────────

interface SbLike {
  from: (table: string) => {
    select: (cols: string) => {
      in: (col: string, vals: string[]) => Promise<{ data: unknown }>
    }
  }
}

async function enrichWithUserNames(sb: unknown, inquiries: DoctorInquiry[]): Promise<InquiryWithUsers[]> {
  if (inquiries.length === 0) return []
  const userIds = Array.from(new Set(inquiries.flatMap(i =>
    [i.coach_id, i.athlete_id, i.doctor_id].filter((id): id is string => !!id),
  )))
  if (userIds.length === 0) {
    return inquiries.map(i => ({ ...i, coach_name: null, athlete_name: null, doctor_name: null }))
  }

  const { data: users } = await (sb as SbLike).from('users').select('id, name').in('id', userIds)
  const nameMap = new Map<string, string | null>()
  for (const u of ((users ?? []) as Array<{ id: string; name: string | null }>)) {
    nameMap.set(u.id, u.name)
  }
  return inquiries.map(i => ({
    ...i,
    coach_name:   nameMap.get(i.coach_id)  ?? null,
    athlete_name: nameMap.get(i.athlete_id)?? null,
    doctor_name:  i.doctor_id ? (nameMap.get(i.doctor_id) ?? null) : null,
  }))
}

// ── Pickers ───────────────────────────────────────────────────────────

export interface AthleteOption { id: string; name: string | null }

export async function listMyAssignedAthletes(): Promise<AthleteOption[]> {
  const sb = createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return []
  const { data: meRow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string } | null
  if (!me) return []

  const { data: links } = await sb
    .from('trainer_athletes')
    .select('athlete_id')
    .eq('trainer_id', me.id)
    .eq('status', 'accepted')
  const ids = ((links ?? []) as Array<{ athlete_id: string }>).map(l => l.athlete_id)
  if (ids.length === 0) return []

  const { data } = await sb.from('users').select('id, name').in('id', ids).order('name', { ascending: true })
  return ((data ?? []) as AthleteOption[])
}
