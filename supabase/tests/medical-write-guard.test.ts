/**
 * Миграции 114–116: медзаписи — только о своём пациенте, связь «врач —
 * пациент» — только с согласия пациента, чужую рекомендацию можно только
 * отметить прочитанной.
 *
 * Каждая атака прогоняется дважды. До миграций она обязана пройти — иначе
 * тест холостой и ничего не доказывает. После — обязана получить отказ по
 * правам (42501) или не изменить ни одной строки; любая другая ошибка —
 * провал теста, а не «защита сработала». Обычная работа врача, спортсмена и
 * тренера после миграций обязана работать.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { createMedicalDb, USERS, type Db, type QueryOutcome, type UserKey } from './pg-harness'

const FIX = [
  '114_medical_write_requires_patient_link.sql',
  '115_connections_consent_guard.sql',
  '116_recommendations_ack_only_for_non_authors.sql',
]
const { doctorA, doctorB, athleteA1, athleteA2, athleteA3, athleteB, coachA } = USERS

const succeeded = (r: QueryOutcome) => !r.error && r.count > 0
const deniedByPolicy = (r: QueryOutcome) => r.code === '42501' || (!r.error && r.count === 0)

interface Scenario {
  code: string
  title: string
  run: (db: Db) => Promise<QueryOutcome>
}

// ── Подготовка данных ──────────────────────────────────────────────────────

const checkup = (db: Db, who: UserKey, doctor: string, athlete: string, findings: string) =>
  db.as(who,
    `INSERT INTO medical_checkups (doctor_id, athlete_id, checkup_date, findings)
     VALUES ($1, $2, '2026-10-20', $3) RETURNING id`, [doctor, athlete, findings])

const recommendation = (db: Db, who: UserKey, doctor: string, athlete: string, title: string,
  visibility = 'coach_and_athlete') =>
  db.as(who,
    `INSERT INTO recommendations (doctor_id, athlete_id, title, category, visibility_level)
     VALUES ($1, $2, $3, 'general', $4) RETURNING id`, [doctor, athlete, title, visibility])

const endLink = (db: Db, doctor: string, athlete: string) =>
  db.sys(`UPDATE connections SET status = 'terminated' WHERE initiator_id = $1 AND recipient_id = $2`,
    [doctor, athlete])

/** Клуб, в составе которого спортсмен A1. */
const clubOfA1 = async (db: Db) => {
  const org = (await db.sys('INSERT INTO organizations DEFAULT VALUES RETURNING id')).rows[0].id as string
  await db.sys(`INSERT INTO org_members (org_id, user_id, member_role, status) VALUES ($1, $2, 'athlete', 'active')`,
    [org, athleteA1.id])
  return org
}

/** Подделанная до 115 связь «врач» тренера A со спортсменом A2. */
const forgedCoachDoctorLink = (db: Db) => db.sys(
  `INSERT INTO connections (initiator_id, recipient_id, connection_type, status)
   VALUES ($1, $2, 'doctor_athlete', 'active')`, [coachA.id, athleteA2.id])

/** Считать атаку удавшейся, если значение столбца после запроса изменилось. */
const changed = async (db: Db, upd: QueryOutcome, id: string, column: string): Promise<QueryOutcome> => {
  if (upd.error) return upd
  const after = await db.sys(`SELECT ${column} AS v FROM recommendations WHERE id = $1`, [id])
  return { rows: after.rows, count: (after.rows[0] as { v: unknown }).v !== null ? 1 : 0 }
}

/** Связь, которую когда-то прислал спортсмен A2 врачу B, в заданном статусе. */
const oldRequestFromA2 = async (db: Db, status: string) => (await db.sys(
  `INSERT INTO connections (initiator_id, recipient_id, connection_type, status)
   VALUES ($1, $2, 'doctor_athlete', $3) RETURNING id`, [athleteA2.id, doctorB.id, status])).rows[0].id

/** Два шага подряд; если первый получил отказ — это и есть результат. */
const steps = async (...run: Array<() => Promise<QueryOutcome>>): Promise<QueryOutcome> => {
  let last: QueryOutcome = { rows: [], count: 0 }
  for (const step of run) {
    last = await step()
    if (last.error) return last
  }
  return last
}

// ── Атаки: до миграций проходят, после — нет ───────────────────────────────

const ATTACKS: Scenario[] = [
  {
    code: 'MED-09', title: 'врач создаёт осмотр не своему пациенту',
    run: db => checkup(db, 'doctorB', doctorB.id, athleteA1.id, 'поддельное заключение'),
  },
  {
    code: 'MED-10', title: 'спортсмен создаёт «осмотр» другому спортсмену от своего имени',
    run: db => checkup(db, 'athleteA2', athleteA2.id, athleteA1.id, 'не врач'),
  },
  {
    code: 'MED-11', title: 'врач пишет в дневник о чужом пациенте с показом его тренеру',
    run: db => db.as('doctorB',
      `INSERT INTO medical_diary (doctor_id, athlete_id, date, note, is_shared_with_coach)
       VALUES ($1, $2, '2026-10-20', 'запрет нагрузок', true) RETURNING id`, [doctorB.id, athleteA1.id]),
  },
  {
    code: 'MED-11b', title: 'тренер видит поддельное ограничение из MED-11',
    run: async db => {
      await db.as('doctorB',
        `INSERT INTO medical_diary (doctor_id, athlete_id, date, note, is_shared_with_coach)
         VALUES ($1, $2, '2026-10-20', 'запрет нагрузок', true)`, [doctorB.id, athleteA1.id])
      return db.as('coachA', 'SELECT id FROM medical_diary WHERE athlete_id = $1', [athleteA1.id])
    },
  },
  {
    code: 'MED-13', title: 'врач переносит личную заметку на чужого спортсмена',
    run: async db => {
      await db.as('doctorB',
        `INSERT INTO medical_diary (doctor_id, date, note) VALUES ($1, '2026-10-20', 'перенос')`, [doctorB.id])
      return db.as('doctorB',
        `UPDATE medical_diary SET athlete_id = $1, is_shared_with_athlete = true
         WHERE note = 'перенос' RETURNING id`, [athleteA1.id])
    },
  },
  {
    code: 'MED-15', title: 'врач переносит осмотр своего пациента на чужого',
    run: db => steps(
      () => checkup(db, 'doctorA', doctorA.id, athleteA1.id, 'перенос'),
      () => db.as('doctorA',
        `UPDATE medical_checkups SET athlete_id = $1 WHERE findings = 'перенос' RETURNING id`, [athleteB.id]),
    ),
  },
  {
    code: 'MED-19', title: 'врач переносит рекомендацию своего пациента на чужого',
    run: db => steps(
      () => recommendation(db, 'doctorA', doctorA.id, athleteA1.id, 'перенос'),
      () => db.as('doctorA',
        `UPDATE recommendations SET athlete_id = $1 WHERE title = 'перенос' RETURNING id`, [athleteB.id]),
    ),
  },
  {
    code: 'MED-21', title: 'бывший врач переписывает старую запись и показывает её тренеру',
    run: db => steps(
      () => db.as('doctorA',
        `INSERT INTO medical_diary (doctor_id, athlete_id, date, note)
         VALUES ($1, $2, '2025-01-01', 'личная заметка') RETURNING id`, [doctorA.id, athleteA1.id]),
      () => endLink(db, doctorA.id, athleteA1.id),
      () => db.as('doctorA',
        `UPDATE medical_diary SET note = 'подозрение на порок сердца, тренировки запрещены',
           severity = 'critical', is_shared_with_coach = true
         WHERE note = 'личная заметка' RETURNING id`),
    ),
  },
  {
    code: 'MED-22', title: 'бывший врач заново назначает отменённый осмотр',
    run: db => steps(
      () => db.as('doctorA',
        `INSERT INTO medical_checkups (doctor_id, athlete_id, checkup_date, status)
         VALUES ($1, $2, '2026-10-20', 'cancelled') RETURNING id`, [doctorA.id, athleteA1.id]),
      () => endLink(db, doctorA.id, athleteA1.id),
      () => db.as('doctorA',
        `UPDATE medical_checkups SET status = 'scheduled' WHERE athlete_id = $1 RETURNING id`, [athleteA1.id]),
    ),
  },
  {
    code: 'MED-23', title: 'пациент создаёт «осмотр» о своём враче',
    run: db => checkup(db, 'athleteA1', athleteA1.id, doctorA.id, 'наоборот'),
  },
  {
    code: 'MED-24', title: 'пациент выписывает «рекомендацию» своему врачу',
    run: db => recommendation(db, 'athleteA1', athleteA1.id, doctorA.id, 'наоборот'),
  },
  // Активные связи, подделанные до 115, триггер не трогает — их ловят
  // проверки ролей в политиках. Каждый случай закрывает ровно одна из них.
  {
    code: 'MED-28', title: 'тренер с подделанной до 115 связью «врач» пишет осмотр',
    run: async db => {
      await db.sys(
        `INSERT INTO connections (initiator_id, recipient_id, connection_type, status)
         VALUES ($1, $2, 'doctor_athlete', 'active')`, [coachA.id, athleteA2.id])
      return checkup(db, 'coachA', coachA.id, athleteA2.id, 'тренер-«врач»')
    },
  },
  {
    code: 'MED-29', title: 'врач пишет осмотр о другом враче через ошибочную связь',
    run: async db => {
      await db.sys(
        `INSERT INTO connections (initiator_id, recipient_id, connection_type, status)
         VALUES ($1, $2, 'doctor_athlete', 'active')`, [doctorA.id, doctorB.id])
      return checkup(db, 'doctorA', doctorA.id, doctorB.id, 'врач о враче')
    },
  },
  {
    code: 'MED-30', title: 'бывший врач только включает показ старой записи тренеру',
    run: db => steps(
      () => db.as('doctorA',
        `INSERT INTO medical_diary (doctor_id, athlete_id, date, note)
         VALUES ($1, $2, '2025-01-01', 'личная') RETURNING id`, [doctorA.id, athleteA1.id]),
      () => endLink(db, doctorA.id, athleteA1.id),
      () => db.as('doctorA', `UPDATE medical_diary SET is_shared_with_coach = true WHERE note = 'личная' RETURNING id`),
    ),
  },
  {
    code: 'MED-31', title: 'бывший врач превращает отменённый осмотр в проведённый',
    run: db => steps(
      () => db.as('doctorA',
        `INSERT INTO medical_checkups (doctor_id, athlete_id, checkup_date, status, findings)
         VALUES ($1, $2, '2026-10-20', 'cancelled', 'старые данные') RETURNING id`, [doctorA.id, athleteA1.id]),
      () => endLink(db, doctorA.id, athleteA1.id),
      () => db.as('doctorA',
        `UPDATE medical_checkups SET status = 'completed' WHERE findings = 'старые данные' RETURNING id`),
    ),
  },
  {
    code: 'MED-32', title: 'тренер с подделанной до 115 связью «врач» пишет в дневник',
    run: async db => {
      await forgedCoachDoctorLink(db)
      return db.as('coachA',
        `INSERT INTO medical_diary (doctor_id, athlete_id, date, note, is_shared_with_athlete)
         VALUES ($1, $2, '2026-10-20', 'тренер-«врач»', true) RETURNING id`, [coachA.id, athleteA2.id])
    },
  },
  {
    code: 'MED-33', title: 'тренер с подделанной до 115 связью «врач» выписывает рекомендацию',
    run: async db => {
      await forgedCoachDoctorLink(db)
      return recommendation(db, 'coachA', coachA.id, athleteA2.id, 'тренер-«врач»')
    },
  },
  {
    code: 'REC-01', title: 'тренер подменяет вложение и отменяет рекомендацию врача',
    run: async db => {
      const rec = await recommendation(db, 'doctorA', doctorA.id, athleteA1.id, 'нагрузки')
      if (!succeeded(rec)) return { ...rec, error: `предусловие не выполнено: ${rec.error ?? 'нет строки'}` }
      const upd = await db.as('coachA',
        `UPDATE recommendations SET attachments = '{"file":"поддельный-допуск.pdf"}', status = 'cancelled'
         WHERE id = $1 RETURNING id`, [rec.rows[0].id])
      if (upd.error) return upd
      const after = await db.sys('SELECT attachments, status FROM recommendations WHERE id = $1', [rec.rows[0].id])
      const row = after.rows[0] as { attachments: unknown; status: string }
      return { rows: after.rows, count: row.attachments !== null || row.status === 'cancelled' ? 1 : 0 }
    },
  },
  {
    code: 'REC-03', title: 'тренер ставит отметку «ознакомлен» за спортсмена',
    run: async db => {
      const rec = await recommendation(db, 'doctorA', doctorA.id, athleteA1.id, 'за спортсмена')
      if (!succeeded(rec)) return rec
      const id = rec.rows[0].id as string
      return changed(db, await db.as('coachA',
        `UPDATE recommendations SET acknowledged_by_athlete_at = now() WHERE id = $1 RETURNING id`, [id]),
        id, 'acknowledged_by_athlete_at')
    },
  },
  {
    code: 'REC-04', title: 'спортсмен ставит отметку «ознакомлен» за тренера',
    run: async db => {
      const rec = await recommendation(db, 'doctorA', doctorA.id, athleteA1.id, 'за тренера')
      if (!succeeded(rec)) return rec
      const id = rec.rows[0].id as string
      return changed(db, await db.as('athleteA1',
        `UPDATE recommendations SET acknowledged_by_coach_at = now() WHERE id = $1 RETURNING id`, [id]),
        id, 'acknowledged_by_coach_at')
    },
  },
  {
    code: 'REC-05', title: 'автор приписывает свою рекомендацию другому врачу',
    run: async db => {
      const rec = await recommendation(db, 'doctorA', doctorA.id, athleteA1.id, 'чужое авторство')
      if (!succeeded(rec)) return rec
      // referred_to_user_id = я — чтобы строка осталась видна автору после смены doctor_id.
      return db.as('doctorA',
        `UPDATE recommendations SET doctor_id = $1, referred_to_user_id = $2 WHERE id = $3 RETURNING id`,
        [doctorB.id, doctorA.id, rec.rows[0].id])
    },
  },
  {
    code: 'REC-06', title: 'врач адресует рекомендацию своего пациента чужому тренеру',
    run: db => db.as('doctorB',
      `INSERT INTO recommendations (doctor_id, athlete_id, title, category, coach_id, visibility_level)
       VALUES ($1, $2, 'чужому тренеру', 'general', $3, 'coach_only') RETURNING id`,
      [doctorB.id, athleteB.id, coachA.id]),
  },
  {
    code: 'REC-07', title: 'врач публикует рекомендацию в клубе, где пациента нет',
    run: async db => {
      const org = await clubOfA1(db)
      return db.as('doctorB',
        `INSERT INTO recommendations (doctor_id, athlete_id, title, category, organization_id, visibility_level)
         VALUES ($1, $2, 'в чужой клуб', 'general', $3, 'org_full') RETURNING id`,
        [doctorB.id, athleteB.id, org])
    },
  },
  {
    code: 'REC-08', title: 'врач «направляет» рекомендацию постороннему спортсмену',
    run: db => db.as('doctorB',
      `INSERT INTO recommendations (doctor_id, athlete_id, title, category, referred_to_user_id)
       VALUES ($1, $2, 'направление', 'referral', $3) RETURNING id`,
      [doctorB.id, athleteB.id, athleteA1.id]),
  },
  {
    code: 'REC-10', title: 'врач переадресует уже выписанную рекомендацию чужому тренеру',
    run: async db => {
      const rec = await recommendation(db, 'doctorB', doctorB.id, athleteB.id, 'переадресация')
      if (!succeeded(rec)) return rec
      return db.as('doctorB',
        `UPDATE recommendations SET coach_id = $1 WHERE id = $2 RETURNING id`, [coachA.id, rec.rows[0].id])
    },
  },
  {
    code: 'CONN-18', title: 'JWT без профиля создаёт активную связь, если политика пропускает',
    run: async db => {
      // Модель неизвестной политики из панели, которая пускает любого вошедшего.
      await db.sys(`CREATE POLICY conn_any_insert ON connections FOR INSERT TO authenticated WITH CHECK (true)`)
      return db.asUnknownUser(
        `INSERT INTO connections (initiator_id, recipient_id, connection_type, status)
         VALUES ($1, $2, 'doctor_athlete', 'active')`, [doctorB.id, athleteA2.id])
    },
  },
  {
    code: 'CONN-01', title: 'врач сразу создаёт активную связь со спортсменом',
    run: db => db.as('doctorB',
      `INSERT INTO connections (initiator_id, recipient_id, connection_type, status)
       VALUES ($1, $2, 'doctor_athlete', 'active') RETURNING id`, [doctorB.id, athleteA1.id]),
  },
  {
    code: 'CONN-02', title: 'врач создаёт запрос от имени спортсмена, чтобы самому его принять',
    run: db => db.as('doctorB',
      `INSERT INTO connections (initiator_id, recipient_id, connection_type)
       VALUES ($1, $2, 'doctor_athlete') RETURNING id`, [athleteA1.id, doctorB.id]),
  },
  {
    code: 'CONN-04', title: 'врач принимает свой же запрос',
    run: async db => {
      const req = await db.as('doctorB',
        `INSERT INTO connections (initiator_id, recipient_id, connection_type)
         VALUES ($1, $2, 'doctor_athlete') RETURNING id`, [doctorB.id, athleteA2.id])
      if (!succeeded(req)) return { ...req, error: `предусловие не выполнено: ${req.error ?? 'нет строки'}` }
      return db.as('doctorB', `UPDATE connections SET status = 'active' WHERE id = $1 RETURNING id`, [req.rows[0].id])
    },
  },
  {
    code: 'CONN-06', title: 'тренер назначает себя «врачом» спортсмена',
    run: db => db.as('coachA',
      `INSERT INTO connections (initiator_id, recipient_id, connection_type)
       VALUES ($1, $2, 'doctor_athlete') RETURNING id`, [coachA.id, athleteA2.id]),
  },
  {
    code: 'CONN-07', title: 'врач переписывает отклонённый запрос так, будто его прислал спортсмен',
    run: async db => {
      await db.sys(
        `INSERT INTO connections (initiator_id, recipient_id, connection_type, status)
         VALUES ($1, $2, 'doctor_athlete', 'declined')`, [doctorB.id, athleteA1.id])
      return db.as('doctorB',
        `UPDATE connections SET initiator_id = $1, recipient_id = $2, status = 'pending'
         WHERE initiator_id = $2 AND recipient_id = $1 RETURNING id`, [athleteA1.id, doctorB.id])
    },
  },
  ...(['terminated', 'cancelled', 'declined'] as const).map((status, i): Scenario => ({
    code: `CONN-1${i + 1}`, title: `получатель сам возвращает старый запрос (${status}) в pending и принимает`,
    run: async db => {
      const id = await oldRequestFromA2(db, status)
      return steps(
        () => db.as('doctorB', `UPDATE connections SET status = 'pending' WHERE id = $1 RETURNING id`, [id]),
        () => db.as('doctorB', `UPDATE connections SET status = 'active' WHERE id = $1 RETURNING id`, [id]),
      )
    },
  })),
  {
    code: 'CONN-14', title: 'получатель принимает запрос, который сам отклонил',
    run: async db => {
      const id = await oldRequestFromA2(db, 'declined')
      return db.as('doctorB', `UPDATE connections SET status = 'active' WHERE id = $1 RETURNING id`, [id])
    },
  },
  {
    code: 'CONN-15', title: 'тренер переписывает активную связь на другого спортсмена',
    run: db => db.as('coachA',
      `UPDATE connections SET recipient_id = $1, status = 'pending'
       WHERE initiator_id = $2 AND recipient_id = $3 RETURNING id`, [athleteB.id, coachA.id, athleteA1.id]),
  },
]

// ── Обычная работа: после миграций обязана проходить ──────────────────────

const LEGIT: Scenario[] = [
  {
    code: 'MED-12', title: 'врач пишет личную заметку без спортсмена',
    run: db => db.as('doctorB',
      `INSERT INTO medical_diary (doctor_id, date, note) VALUES ($1, '2026-10-20', 'заметка') RETURNING id`,
      [doctorB.id]),
  },
  {
    code: 'MED-14', title: 'врач создаёт осмотр своему пациенту',
    run: db => checkup(db, 'doctorA', doctorA.id, athleteA1.id, 'свой'),
  },
  {
    code: 'MED-16', title: 'врач правит свой осмотр — форма шлёт тот же athlete_id',
    run: db => steps(
      () => checkup(db, 'doctorA', doctorA.id, athleteA1.id, 'правка'),
      () => db.as('doctorA',
        `UPDATE medical_checkups SET athlete_id = $1, status = 'completed', location = 'кабинет 3'
         WHERE findings = 'правка' RETURNING id`, [athleteA1.id]),
    ),
  },
  {
    code: 'MED-17', title: 'врач закрывает старый осмотр после разрыва связи — форма шлёт всё как было',
    run: db => steps(
      () => checkup(db, 'doctorA', doctorA.id, athleteA1.id, 'разрыв'),
      () => endLink(db, doctorA.id, athleteA1.id),
      () => db.as('doctorA',
        `UPDATE medical_checkups SET athlete_id = $1, findings = 'разрыв', status = 'completed'
         WHERE findings = 'разрыв' RETURNING id`, [athleteA1.id]),
    ),
  },
  {
    code: 'MED-18', title: 'врач пишет в дневник о своём пациенте с показом тренеру',
    run: db => db.as('doctorA',
      `INSERT INTO medical_diary (doctor_id, athlete_id, date, note, is_shared_with_coach)
       VALUES ($1, $2, '2026-10-20', 'ограничение', true) RETURNING id`, [doctorA.id, athleteA1.id]),
  },
  {
    code: 'MED-20', title: 'спортсмен подтверждает рекомендацию',
    run: db => steps(
      () => recommendation(db, 'doctorA', doctorA.id, athleteA1.id, 'подтверждение'),
      () => db.as('athleteA1',
        `UPDATE recommendations SET acknowledged_by_athlete_at = now()
         WHERE title = 'подтверждение' RETURNING id`),
    ),
  },
  {
    code: 'MED-25', title: 'врач привязывает личную заметку к своему пациенту',
    run: db => steps(
      () => db.as('doctorA',
        `INSERT INTO medical_diary (doctor_id, date, note) VALUES ($1, '2026-10-20', 'привязка') RETURNING id`,
        [doctorA.id]),
      () => db.as('doctorA',
        `UPDATE medical_diary SET athlete_id = $1 WHERE note = 'привязка' RETURNING id`, [athleteA1.id]),
    ),
  },
  {
    code: 'MED-26', title: 'врач исправляет пациента в осмотре — на другого своего',
    run: db => steps(
      () => checkup(db, 'doctorA', doctorA.id, athleteA1.id, 'не тот пациент'),
      () => db.as('doctorA',
        `UPDATE medical_checkups SET athlete_id = $1 WHERE findings = 'не тот пациент' RETURNING id`,
        [athleteA3.id]),
    ),
  },
  {
    code: 'MED-27', title: 'бывший врач скрывает старую запись от тренера',
    run: db => steps(
      () => db.as('doctorA',
        `INSERT INTO medical_diary (doctor_id, athlete_id, date, note, is_shared_with_coach)
         VALUES ($1, $2, '2026-10-20', 'скрыть', true) RETURNING id`, [doctorA.id, athleteA1.id]),
      () => endLink(db, doctorA.id, athleteA1.id),
      () => db.as('doctorA',
        `UPDATE medical_diary SET is_shared_with_coach = false WHERE note = 'скрыть' RETURNING id`),
    ),
  },
  {
    code: 'REC-02', title: 'тренер отмечает «Понятно», статус становится acknowledged',
    run: async db => {
      const rec = await recommendation(db, 'doctorA', doctorA.id, athleteA1.id, 'для тренера', 'coach_only')
      if (!succeeded(rec)) return rec
      const ack = await db.as('coachA',
        `UPDATE recommendations SET acknowledged_by_coach_at = now() WHERE id = $1 RETURNING id`, [rec.rows[0].id])
      if (!succeeded(ack)) return ack
      const after = await db.sys('SELECT status FROM recommendations WHERE id = $1', [rec.rows[0].id])
      const status = (after.rows[0] as { status: string }).status
      return status === 'acknowledged' ? after : { ...after, error: `статус ${status}` }
    },
  },
  {
    code: 'MED-34', title: 'бывший врач удаляет из календаря приём, связанный с записью дневника',
    run: async db => {
      const ev = (await db.sys('INSERT INTO calendar_events DEFAULT VALUES RETURNING id')).rows[0].id
      return steps(
        () => db.as('doctorA',
          `INSERT INTO medical_diary (doctor_id, athlete_id, date, note, entry_type, calendar_event_id)
           VALUES ($1, $2, '2026-10-20', 'приём', 'schedule', $3) RETURNING id`, [doctorA.id, athleteA1.id, ev]),
        () => endLink(db, doctorA.id, athleteA1.id),
        () => db.as('doctorA', 'DELETE FROM calendar_events WHERE id = $1 RETURNING id', [ev]),
      )
    },
  },
  {
    code: 'REC-09', title: 'врач адресует рекомендацию тренеру пациента, его клубу и направляет к врачу',
    run: async db => {
      const org = await clubOfA1(db)
      return db.as('doctorA',
        `INSERT INTO recommendations (doctor_id, athlete_id, title, category, coach_id, organization_id,
           referred_to_user_id, visibility_level)
         VALUES ($1, $2, 'команде', 'referral', $3, $4, $5, 'org_full') RETURNING id`,
        [doctorA.id, athleteA1.id, coachA.id, org, doctorB.id])
    },
  },
  {
    code: 'CONN-03', title: 'врач отправляет обычный запрос на связь',
    run: db => db.as('doctorB',
      `INSERT INTO connections (initiator_id, recipient_id, connection_type)
       VALUES ($1, $2, 'doctor_athlete') RETURNING id`, [doctorB.id, athleteA2.id]),
  },
  {
    code: 'CONN-05', title: 'получатель принимает запрос',
    run: async db => {
      const req = await db.as('doctorB',
        `INSERT INTO connections (initiator_id, recipient_id, connection_type)
         VALUES ($1, $2, 'doctor_athlete') RETURNING id`, [doctorB.id, athleteA2.id])
      if (!succeeded(req)) return { ...req, error: `предусловие не выполнено: ${req.error ?? 'нет строки'}` }
      return db.as('athleteA2',
        `UPDATE connections SET status = 'active', responded_at = now() WHERE id = $1 RETURNING id`,
        [req.rows[0].id])
    },
  },
  ...(['declined', 'terminated'] as const).map((status, i): Scenario => ({
    code: `CONN-0${8 + i}`, title: `повторный запрос после ${status} от бывшего получателя — как POST /api/connections`,
    run: async db => {
      await db.sys(
        `INSERT INTO connections (initiator_id, recipient_id, connection_type, status)
         VALUES ($1, $2, 'coach_athlete', $3)`, [athleteB.id, coachA.id, status])
      return db.as('coachA',
        `UPDATE connections SET status = 'pending', initiator_id = $1, recipient_id = $2, responded_at = NULL
         WHERE initiator_id = $2 AND recipient_id = $1 RETURNING id`, [coachA.id, athleteB.id])
    },
  })),
  {
    code: 'CONN-10', title: 'отклонить, отменить, разорвать',
    run: async db => {
      const request = async () => (await db.sys(
        `INSERT INTO connections (initiator_id, recipient_id, connection_type)
         VALUES ($1, $2, 'coach_athlete') RETURNING id`, [coachA.id, athleteB.id])).rows[0].id
      const results = [
        await db.as('athleteB', `UPDATE connections SET status = 'declined' WHERE id = $1 RETURNING id`, [await request()]),
        await db.as('coachA', `UPDATE connections SET status = 'cancelled' WHERE id = $1 RETURNING id`, [await request()]),
        await db.as('doctorA',
          `UPDATE connections SET status = 'terminated', terminated_by = $1, terminated_at = now()
           WHERE initiator_id = $1 AND recipient_id = $2 RETURNING id`, [doctorA.id, athleteA1.id]),
      ]
      return results.find(r => !succeeded(r)) ?? { rows: [], count: results.length }
    },
  },
  {
    code: 'CONN-16', title: 'инициатор повторяет свой отклонённый запрос',
    run: async db => {
      const id = (await db.sys(
        `INSERT INTO connections (initiator_id, recipient_id, connection_type, status)
         VALUES ($1, $2, 'doctor_athlete', 'declined') RETURNING id`, [doctorB.id, athleteA2.id])).rows[0].id
      return db.as('doctorB',
        `UPDATE connections SET status = 'pending', responded_at = NULL WHERE id = $1 RETURNING id`, [id])
    },
  },
  {
    code: 'CONN-17', title: 'сервер (service role) создаёт активную связь — приглашения, клуб',
    run: db => db.asService(
      `INSERT INTO connections (initiator_id, recipient_id, connection_type, status)
       VALUES ($1, $2, 'doctor_athlete', 'active') RETURNING id`, [doctorB.id, athleteA2.id]),
  },
]

let db: Db | null = null
afterEach(async () => { await db?.close(); db = null })

const byCode = (list: Scenario[]) => list.map(s => [s.code, s] as const)

describe('без миграций 114–116 атаки проходят — тест не холостой', () => {
  it.each(byCode(ATTACKS))('%s', async (_code, s) => {
    db = await createMedicalDb()
    const r = await s.run(db)
    expect(r.error, s.title).toBeUndefined()
    expect(r.count, s.title).toBeGreaterThan(0)
  })
})

// 119 заменяет функцию триггера согласия из 115 — всё должно держаться и с ней.
describe.each([
  ['после миграций 114–116', FIX],
  ['после миграций 114–116 и 119', [...FIX, '119_specialist_connections.sql']],
])('%s', (_title, migrations) => {
  it.each(byCode(ATTACKS))('%s закрыта', async (_code, s) => {
    db = await createMedicalDb(migrations)
    const r = await s.run(db)
    expect(deniedByPolicy(r), `${s.title}: ${r.error ?? `строк ${r.count}`}`).toBe(true)
  })

  it.each(byCode(LEGIT))('%s работает', async (_code, s) => {
    db = await createMedicalDb(migrations)
    const r = await s.run(db)
    expect(r.error, s.title).toBeUndefined()
    expect(r.count, s.title).toBeGreaterThan(0)
  })

  it('миграции можно применить повторно', async () => {
    db = await createMedicalDb([...migrations, ...migrations])
    const r = await checkup(db, 'doctorA', doctorA.id, athleteA1.id, 'повтор')
    expect(r.error).toBeUndefined()
  })
})
