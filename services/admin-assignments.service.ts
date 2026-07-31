/**
 * Назначение спортсмена тренеру из админ-панели — ревизия «выдуманные данные» (P1).
 *
 * Причина появления сервиса: диалог «Назначить атлета» на /admin был декорацией.
 * Селекты содержали захардкоженные строки без value/onChange, кнопка «Назначить»
 * просто закрывала модалку, а функция handleAssign (никем не вызываемая) писала
 * в athletes.coach_id — колонку, на которую не смотрит ни одна RLS-политика и ни
 * один экран. Реальная связь тренер↔спортсмен живёт в
 * trainer_athletes(trainer_id, athlete_id, status='accepted') — на неё завязаны
 * ~12 политик доступа (workouts, calendar_events, injuries, medical_diary…).
 *
 * Почему пишем в trainer_athletes напрямую, хотя миграция 085 сделала таблицу
 * проекцией connections: у админки нет и не должно быть флоу «отправить заявку
 * от чужого имени», а RLS явно разрешает админу писать в проекцию
 * (ta_insert: WITH CHECK get_my_role() = 'admin'). Триггер на connections
 * работает независимо и при появлении реальной заявки просто переутвердит ту же
 * строку. Обратная сторона: если пара потом пройдёт полный цикл connections
 * (заявка → отклонение), триггер удалит связь — это осознанный компромисс,
 * админское назначение является ручным исключением, а не источником истины.
 */
import { createClient } from '@/lib/supabase/client'
import { writeAuditEntry } from '@/services/admin-audit.service'

/** Канонический статус связи в коде и во всех RLS-политиках. */
const LINK_STATUS_ACCEPTED = 'accepted'

export interface CoachAthleteLink {
  trainer_id: string
  athlete_id: string
  status:     string | null
  created_at: string | null
}

export interface AssignResult {
  ok:            boolean
  error:         string | null
  /** Связь уже была — ничего не меняли, но и ошибкой это не считаем. */
  alreadyLinked: boolean
  /** Связь создана, но запись в audit_logs не прошла — админ должен знать. */
  auditWarning:  string | null
}

/**
 * Все связи тренер↔спортсмен. Админ читает таблицу целиком (ta_select),
 * остальные — только свои строки, поэтому вызывать из не-админского контекста
 * бессмысленно, но безопасно.
 */
export async function listCoachAthleteLinks(limit = 500): Promise<CoachAthleteLink[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('trainer_athletes')
    .select('trainer_id, athlete_id, status, created_at')
    .limit(limit)
  if (error) {
    console.warn('[admin-assignments.listCoachAthleteLinks]', error.message)
    return []
  }
  return (data ?? []) as CoachAthleteLink[]
}

/**
 * Назначает спортсмена тренеру и фиксирует это в журнале (action='assign_athlete').
 *
 * Роли участников проверяются повторно, хотя UI и подставляет отфильтрованные
 * списки: строка в trainer_athletes открывает доступ к тренировкам, травмам и
 * медицинскому дневнику — ошибиться стороной здесь дороже, чем сделать лишний
 * запрос.
 */
export async function assignAthleteToCoach(input: {
  athleteId: string
  coachId:   string
}): Promise<AssignResult> {
  const fail = (error: string): AssignResult => ({ ok: false, error, alreadyLinked: false, auditWarning: null })

  const athleteId = input.athleteId.trim()
  const coachId   = input.coachId.trim()
  if (!athleteId || !coachId) return fail('Выберите спортсмена и тренера')
  if (athleteId === coachId)  return fail('Нельзя назначить пользователя тренером самому себе')

  const sb = createClient()

  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return fail('Не авторизован')
  const { data: meRow } = await sb.from('users').select('id, role').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string; role: string } | null
  if (!me) return fail('Профиль не найден')
  if (me.role !== 'admin') return fail('Доступно только администраторам')

  const { data: partiesRaw, error: partiesErr } = await sb
    .from('users')
    .select('id, role')
    .in('id', [athleteId, coachId])
  if (partiesErr) return fail(partiesErr.message)
  const parties = (partiesRaw ?? []) as Array<{ id: string; role: string }>
  const athlete = parties.find(p => p.id === athleteId)
  const coach   = parties.find(p => p.id === coachId)
  if (!athlete || !coach)        return fail('Пользователь не найден')
  if (athlete.role !== 'athlete') return fail('Выбранный спортсмен не имеет роли athlete')
  if (coach.role !== 'coach')     return fail('Выбранный тренер не имеет роли coach')

  // UPDATE-политики у trainer_athletes нет (только INSERT/DELETE для админа),
  // поэтому upsert невозможен: существующую строку с другим статусом
  // пересоздаём удалением + вставкой.
  const { data: existingRaw } = await sb
    .from('trainer_athletes')
    .select('trainer_id, athlete_id, status')
    .eq('trainer_id', coachId)
    .eq('athlete_id', athleteId)
    .maybeSingle()
  const existing = existingRaw as { status: string | null } | null

  if (existing?.status === LINK_STATUS_ACCEPTED) {
    return { ok: true, error: null, alreadyLinked: true, auditWarning: null }
  }
  if (existing) {
    const { error: delErr } = await sb
      .from('trainer_athletes')
      .delete()
      .eq('trainer_id', coachId)
      .eq('athlete_id', athleteId)
    if (delErr) return fail(delErr.message)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insErr } = await (sb as any).from('trainer_athletes').insert({
    trainer_id:  coachId,
    athlete_id:  athleteId,
    status:      LINK_STATUS_ACCEPTED,
    assigned_by: me.id,
  })
  if (insErr) {
    console.warn('[admin-assignments.assignAthleteToCoach]', insErr.message)
    return fail(insErr.message)
  }

  const audit = await writeAuditEntry({
    actorId:     me.id,
    action:      'assign_athlete',
    targetTable: 'trainer_athletes',
    targetId:    athleteId,
    payload:     { trainer_id: coachId, athlete_id: athleteId, status: LINK_STATUS_ACCEPTED },
  })

  return {
    ok: true,
    error: null,
    alreadyLinked: false,
    auditWarning: audit.ok ? null : (audit.error ?? 'Запись в журнал не прошла'),
  }
}
