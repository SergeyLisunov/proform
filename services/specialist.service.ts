/**
 * Профиль специалиста (таблица specialists, миграция 118) и его клиенты —
 * спортсмены с активной связью specialist_athlete (миграция 119).
 *
 * Права решает база: строку профиля создаёт и правит только сам
 * специалист, публичный профиль читают все.
 */
import { createClient } from '@/lib/supabase/client'
import {
  SPECIALIST_CONNECTION_TYPE, isSpecialistType,
  type SpecialistFormat, type SpecialistType,
} from '@/lib/specialist'
import { SPECIALIST_FIELD_LABEL } from '@/lib/specialist-form'

export interface SpecialistCertification {
  name: string
  issuer?: string
  year?: number
}

export interface SpecialistProfile {
  id: string
  specialist_types: SpecialistType[]
  main_focus: string | null
  bio: string | null
  experience_years: number | null
  education: string | null
  certifications: SpecialistCertification[]
  license_number: string | null
  formats: SpecialistFormat[]
  city: string | null
  country: string | null
  languages: string[]
  consultation_fee: number | null
  currency: string
  telegram_url: string | null
  website_url: string | null
  accepts_new_clients: boolean
  profile_public: boolean
  created_at: string
  updated_at: string
}

/** Что можно сохранить: всё, кроме id и служебных дат. */
export type SpecialistProfileInput = Partial<Omit<SpecialistProfile, 'id' | 'created_at' | 'updated_at'>>

export type SaveResult = { ok: true } | { ok: false; error: string }

// Таблицы specialists ещё нет в сгенерированных типах (types/database.ts)
// — запросы к ней идут без схемы, ответ приводится к SpecialistProfile.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const specialistsTable = () => (createClient() as any).from('specialists')

/**
 * Профиль специалиста или null, если его ещё нет. Сбой запроса — ошибка,
 * а не null: иначе форма настроек открылась бы пустой, и «Сохранить»
 * затёрло бы настоящий профиль пустыми полями.
 */
export async function getSpecialistProfile(userId: string): Promise<SpecialistProfile | null> {
  const { data, error } = await specialistsTable().select('*').eq('id', userId).maybeSingle()
  if (error) throw new Error(`Не удалось загрузить профиль специалиста: ${error.message}`)
  return (data as SpecialistProfile | null) ?? null
}

/** Создать или обновить свой профиль. userId — users.id текущего специалиста. */
export async function saveSpecialistProfile(userId: string, input: SpecialistProfileInput): Promise<SaveResult> {
  const row = {
    ...input,
    id: userId,
    ...(input.specialist_types ? { specialist_types: input.specialist_types.filter(isSpecialistType) } : {}),
  }
  const { error } = await specialistsTable().upsert(row, { onConflict: 'id' })
  if (error) {
    console.warn('[specialist.saveProfile]', error.message)
    return { ok: false, error: 'Не удалось сохранить профиль. Попробуйте ещё раз.' }
  }
  return { ok: true }
}

/**
 * Каких полей не хватает в профиле — подписями из формы. Нет профиля —
 * пустой список: это отдельное состояние, его показывает сам экран.
 */
export function specialistProfileGaps(p: SpecialistProfile | null): string[] {
  if (!p) return []
  const L = SPECIALIST_FIELD_LABEL
  const gaps: string[] = []
  if (p.specialist_types.length === 0) gaps.push(L.types)
  if (!p.bio?.trim()) gaps.push(L.bio)
  if (p.experience_years === null) gaps.push(L.experience)
  if (p.formats.length === 0) gaps.push(L.formats)
  if (!p.city?.trim() && p.formats.some(f => f !== 'online')) gaps.push(L.city)
  return gaps
}

export interface SpecialistClient {
  connectionId: string
  id: string
  name: string
  avatar_url: string | null
  sport: string | null
  since: string
}

interface LinkedUser {
  id: string
  name: string | null
  nickname: string | null
  avatar_url: string | null
  sport: string | null
  role: string | null
}

interface ClientConnectionRow {
  id: string
  initiated_at: string
  responded_at: string | null
  initiator: LinkedUser | null
  recipient: LinkedUser | null
}

/** Клиенты — спортсмены с активной связью specialist_athlete. */
export async function listSpecialistClients(userId: string): Promise<SpecialistClient[]> {
  const { data, error } = await createClient()
    .from('connections')
    .select(`
      id, initiated_at, responded_at,
      initiator:users!connections_initiator_id_fkey(id, name, nickname, avatar_url, sport, role),
      recipient:users!connections_recipient_id_fkey(id, name, nickname, avatar_url, sport, role)
    `)
    .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`)
    .eq('connection_type', SPECIALIST_CONNECTION_TYPE)
    .eq('status', 'active')
    .order('responded_at', { ascending: false })
  if (error) throw new Error(`Не удалось загрузить клиентов: ${error.message}`)

  return ((data ?? []) as unknown as ClientConnectionRow[]).flatMap(c => {
    const other = c.initiator?.id === userId ? c.recipient : c.initiator
    if (!other || other.role !== 'athlete') return []
    return [{
      connectionId: c.id,
      id: other.id,
      name: other.name?.trim() || other.nickname?.trim() || 'Клиент',
      avatar_url: other.avatar_url,
      sport: other.sport,
      since: c.responded_at ?? c.initiated_at,
    }]
  })
}

export interface PendingSpecialistRequests {
  /** Специалист отправил — ждут ответа спортсменов. */
  outgoing: number
  /** Спортсмены отправили — ждут ответа специалиста. */
  incoming: number
}

/** Запросы на связь specialist_athlete в ожидании — в обе стороны. */
export async function countPendingSpecialistRequests(userId: string): Promise<PendingSpecialistRequests> {
  const count = async (column: 'initiator_id' | 'recipient_id') => {
    const { count: n, error } = await createClient()
      .from('connections')
      .select('id', { count: 'exact', head: true })
      .eq(column, userId)
      .eq('connection_type', SPECIALIST_CONNECTION_TYPE)
      .eq('status', 'pending')
    if (error) throw new Error(`Не удалось загрузить запросы: ${error.message}`)
    return n ?? 0
  }
  const [outgoing, incoming] = await Promise.all([count('initiator_id'), count('recipient_id')])
  return { outgoing, incoming }
}
