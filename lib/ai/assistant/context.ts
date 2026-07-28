/**
 * AIContextBuilder — сбор МИНИМАЛЬНОГО разрешённого контекста по allowlist.
 *
 * Два слоя защиты:
 *   1. Все чтения данных идут SSR-клиентом ПОД RLS пользователя — даже
 *      баг в этом файле структурно не даст чужие строки (tenant isolation
 *      обеспечивает БД).
 *   2. Контекстная сущность из клиента дополнительно проверяется
 *      object-level: тренер → trainer_athletes(accepted); врач →
 *      connections(doctor_athlete, active); организация → владелец
 *      (organizations.id == user_id) или org_admin в org_members.
 *
 * Allowlist полей — только то, что роль видит в обычном интерфейсе.
 * Чувствительное исключено по умолчанию: никаких паролей/токенов/платежей;
 * тренеру — без диагнозов (только светофор + расшаренные записи);
 * организации — медицина ТОЛЬКО агрегатами.
 */
import type { AssistantContextType, RoleProfile } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any

const CONTEXT_CHAR_BUDGET = 7000

export interface BuiltContext {
  /** Текстовый блок для системного промпта (уже в бюджете). */
  block: string
  /** Проверенная сущность (для snapshot в conversation). */
  contextType: AssistantContextType | null
  contextEntityId: string | null
  organizationId: string | null
}

export class ContextAccessError extends Error {
  constructor(message: string) { super(message); this.name = 'ContextAccessError' }
}

function j(value: unknown, cap: number): string {
  return JSON.stringify(value ?? null).slice(0, cap)
}

// ── Object-level проверки ─────────────────────────────────────────────────

export async function verifyTrainerAthlete(sb: Sb, coachId: string, athleteId: string): Promise<boolean> {
  const { data } = await sb.from('trainer_athletes')
    .select('athlete_id')
    .eq('trainer_id', coachId)
    .eq('athlete_id', athleteId)
    .eq('status', 'accepted')
    .maybeSingle()
  return !!data
}

export async function verifyDoctorPatient(sb: Sb, doctorId: string, athleteId: string): Promise<boolean> {
  const { data } = await sb.from('connections')
    .select('id')
    .eq('connection_type', 'doctor_athlete')
    .eq('status', 'active')
    .or(`and(initiator_id.eq.${doctorId},recipient_id.eq.${athleteId}),and(initiator_id.eq.${athleteId},recipient_id.eq.${doctorId})`)
    .maybeSingle()
  return !!data
}

/** Организация пользователя: владелец (tenant: org.id == user.id) или org_admin. */
export async function resolveMyOrganization(sb: Sb, userId: string): Promise<string | null> {
  const { data: own } = await sb.from('organizations')
    .select('id').eq('id', userId).maybeSingle()
  if (own) return (own as { id: string }).id
  const { data: adminOf } = await sb.from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('member_role', ['org_owner', 'org_admin'])
    .limit(1)
    .maybeSingle()
  return (adminOf as { org_id: string } | null)?.org_id ?? null
}

// ── Ролевые сборщики ──────────────────────────────────────────────────────

async function athleteSelfBlock(sb: Sb, athleteId: string, budget: number): Promise<string> {
  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const [workouts, goals, prescribed, records] = await Promise.all([
    sb.from('workouts')
      .select('event_date, activity_type, activity_duration_min, recovery_score, mood, name')
      .eq('athlete_id', athleteId)
      .gte('event_date', since)
      .order('event_date', { ascending: false })
      .limit(30),
    // Колонки сверены с прод-схемой: у athlete_goals нет title —
    // цель описывается metric_label + target_value/unit (смоук поймал).
    sb.from('athlete_goals')
      .select('metric_label, target_value, target_unit, current_value, target_date, status')
      .eq('athlete_id', athleteId)
      .limit(5),
    sb.from('workouts')
      .select('event_date, name, activity_duration_min, completion_status, prescribed_note')
      .eq('athlete_id', athleteId)
      .eq('event_type', 'prescribed')
      .gte('event_date', new Date().toISOString().slice(0, 10))
      .order('event_date', { ascending: true })
      .limit(10),
    sb.from('athlete_records')
      .select('kind, value, achieved_on')
      .eq('athlete_id', athleteId),
  ])
  return [
    `Тренировки за 30 дней: ${j(workouts.data, Math.floor(budget * 0.5))}`,
    `Предстоящий план от тренера: ${j(prescribed.data, Math.floor(budget * 0.2))}`,
    `Цели: ${j(goals.data, Math.floor(budget * 0.15))}`,
    `Личные рекорды: ${j(records.data, Math.floor(budget * 0.15))}`,
  ].join('\n')
}

async function coachBlock(sb: Sb, coachId: string, athleteId: string | null, budget: number): Promise<string> {
  // Список своих атлетов — всегда (для «на кого обратить внимание»).
  const { data: links } = await sb.from('trainer_athletes')
    .select('athlete_id')
    .eq('trainer_id', coachId)
    .eq('status', 'accepted')
    .limit(50)
  const athleteIds = ((links ?? []) as Array<{ athlete_id: string }>).map(l => l.athlete_id)
  const { data: names } = athleteIds.length
    ? await sb.from('users').select('id, name, sport').in('id', athleteIds)
    : { data: [] }

  const parts = [`Мои спортсмены (${athleteIds.length}): ${j(names, Math.floor(budget * 0.2))}`]

  if (athleteId) {
    // Доступ уже проверен verifyTrainerAthlete в gateway.
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const [workouts, clearance, shared] = await Promise.all([
      sb.from('workouts')
        .select('event_date, activity_type, activity_duration_min, completion_status, name, mood')
        .eq('athlete_id', athleteId)
        .gte('event_date', since)
        .order('event_date', { ascending: false })
        .limit(25),
      // Светофор — coach-visible по дизайну допусков.
      sb.from('current_clearances')
        .select('status, valid_until, review_needed')
        .eq('athlete_id', athleteId)
        .maybeSingle(),
      // Только записи, которыми ПОДЕЛИЛИСЬ с тренером (без диагнозов).
      // Колонка даты называется `date` (не entry_date) — сверено со схемой.
      sb.from('medical_diary')
        .select('date, severity, title')
        .eq('athlete_id', athleteId)
        .eq('is_shared_with_coach', true)
        .order('date', { ascending: false })
        .limit(5),
    ])
    parts.push(
      `Выбранный спортсмен — тренировки 30 дней: ${j(workouts.data, Math.floor(budget * 0.45))}`,
      `Допуск (светофор): ${j(clearance.data, 300)}`,
      `Расшаренные с тренером записи самочувствия (без диагнозов): ${j(shared.data, Math.floor(budget * 0.15))}`,
    )
  }
  return parts.join('\n')
}

async function doctorBlock(sb: Sb, doctorId: string, athleteId: string | null, budget: number): Promise<string> {
  const { data: conns } = await sb.from('connections')
    .select('initiator_id, recipient_id')
    .eq('connection_type', 'doctor_athlete')
    .eq('status', 'active')
    .or(`initiator_id.eq.${doctorId},recipient_id.eq.${doctorId}`)
    .limit(50)
  const patientIds = ((conns ?? []) as Array<{ initiator_id: string; recipient_id: string }>)
    .map(c => (c.initiator_id === doctorId ? c.recipient_id : c.initiator_id))
  const { data: names } = patientIds.length
    ? await sb.from('users').select('id, name, sport').in('id', patientIds)
    : { data: [] }

  const parts = [`Назначенные спортсмены (${patientIds.length}): ${j(names, Math.floor(budget * 0.2))}`]

  if (athleteId) {
    // Доступ уже проверен verifyDoctorPatient в gateway; RLS мед-таблиц
    // дополнительно гарантирует границы врача.
    const [clearances, injuries, diary] = await Promise.all([
      sb.from('clearances')
        .select('status, note, valid_until, created_at')
        .eq('athlete_id', athleteId)
        .order('created_at', { ascending: false })
        .limit(10),
      // Схема injuries: onset_date/description (не injury_date/title);
      // medical_diary: date/note/pain_level (не entry_date/symptoms).
      sb.from('injuries')
        .select('onset_date, body_part, side, severity, status, description, expected_recovery_days')
        .eq('athlete_id', athleteId)
        .order('onset_date', { ascending: false })
        .limit(10),
      sb.from('medical_diary')
        .select('date, entry_type, severity, title, note, pain_level, body_part')
        .eq('athlete_id', athleteId)
        .order('date', { ascending: false })
        .limit(10),
    ])
    parts.push(
      `Журнал допусков пациента: ${j(clearances.data, Math.floor(budget * 0.3))}`,
      `Травмы: ${j(injuries.data, Math.floor(budget * 0.25))}`,
      `Медицинский дневник: ${j(diary.data, Math.floor(budget * 0.25))}`,
    )
  }
  return parts.join('\n')
}

async function organizationBlock(sb: Sb, admin: Sb, orgId: string, budget: number): Promise<string> {
  // ТОЛЬКО агрегаты: составы/количества/статусы. Без содержимого медицины.
  const [members, groups, upcoming] = await Promise.all([
    sb.from('org_members')
      .select('user_id, member_role')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .limit(500),
    sb.from('org_groups')
      .select('name, is_active')
      .eq('organization_id', orgId)
      .limit(50),
    sb.from('org_group_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('session_date', new Date().toISOString().slice(0, 10)),
  ])
  const memberRows = (members.data ?? []) as Array<{ user_id: string; member_role: string }>
  const roleCounts: Record<string, number> = {}
  for (const m of memberRows) {
    roleCounts[m.member_role] = (roleCounts[m.member_role] ?? 0) + 1
  }

  // Агрегат по допускам. RLS-политики clearances НЕ дают организации
  // row-доступа (и не должны — «медицина агрегатами»), поэтому счётчик
  // считаем admin-клиентом с ЯВНЫМ скоупом по ростеру ИМЕННО этой
  // организации (ревью-находка: запрос без org-фильтра под RLS владельца
  // возвращал 0 либо примешивал его ЛИЧНЫЕ связи из других клубов).
  // Наружу уходит ТОЛЬКО число — ни athlete_id, ни статусов.
  let reviewNeededCount = 0
  const rosterAthleteIds = memberRows
    .filter(m => m.member_role === 'athlete')
    .map(m => m.user_id)
  if (rosterAthleteIds.length > 0) {
    const { count } = await admin.from('current_clearances')
      .select('athlete_id', { count: 'exact', head: true })
      .in('athlete_id', rosterAthleteIds)
      .eq('review_needed', true)
    reviewNeededCount = count ?? 0
  }

  return [
    `Состав организации по ролям: ${j(roleCounts, 400)}`,
    `Группы: ${j(groups.data, Math.floor(budget * 0.25))}`,
    `Допуски, требующие внимания (агрегат по ростеру клуба): ${reviewNeededCount} шт.`,
    `Предстоящих занятий: ${j(upcoming.count ?? 0, 50)}`,
  ].join('\n')
}

// ── Главная точка входа ───────────────────────────────────────────────────

export async function buildContext(
  sb: Sb,
  admin: Sb,
  profile: RoleProfile,
  userId: string,
  requested: { contextType?: AssistantContextType | null; contextEntityId?: string | null },
): Promise<BuiltContext> {
  const budget = CONTEXT_CHAR_BUDGET
  const ct = requested.contextType ?? null
  const entity = requested.contextEntityId ?? null

  // Запрошенный тип обязан входить в allowlist роли.
  if (ct && !profile.allowedContextTypes.includes(ct)) {
    throw new ContextAccessError('Контекст недоступен для вашей роли.')
  }

  switch (profile.role) {
    case 'athlete': {
      // Спортсмен: только собственные данные, entity игнорируется всегда.
      return {
        block: await athleteSelfBlock(sb, userId, budget),
        contextType: null, contextEntityId: null, organizationId: null,
      }
    }
    case 'coach': {
      if (entity && !(await verifyTrainerAthlete(sb, userId, entity))) {
        throw new ContextAccessError('Этот спортсмен не прикреплён к вам.')
      }
      return {
        block: await coachBlock(sb, userId, entity, budget),
        contextType: entity ? 'athlete' : null, contextEntityId: entity,
        organizationId: null,
      }
    }
    case 'doctor': {
      if (entity && !(await verifyDoctorPatient(sb, userId, entity))) {
        throw new ContextAccessError('Этот спортсмен вам не назначен.')
      }
      return {
        block: await doctorBlock(sb, userId, entity, budget),
        contextType: entity ? 'patient' : null, contextEntityId: entity,
        organizationId: null,
      }
    }
    case 'organization': {
      const orgId = await resolveMyOrganization(sb, userId)
      if (!orgId) throw new ContextAccessError('Организация не найдена для вашего аккаунта.')
      // entity из клиента игнорируем: организация всегда СВОЯ.
      return {
        block: await organizationBlock(sb, admin, orgId, budget),
        contextType: 'organization', contextEntityId: orgId, organizationId: orgId,
      }
    }
  }
}
