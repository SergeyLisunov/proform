/**
 * Миграции 118 и 119: профиль специалиста и связь «специалист — спортсмен».
 * Прав на данные спортсмена связь пока не даёт — это следующие миграции.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMedicalDb, USERS, type Db, type QueryOutcome } from './pg-harness'

const MIGRATIONS = [
  '114_medical_write_requires_patient_link.sql',
  '115_connections_consent_guard.sql',
  '116_recommendations_ack_only_for_non_authors.sql',
  '118_specialist_profile.sql',
  '119_specialist_connections.sql',
]
const { specialistS, athleteA1, coachA } = USERS

const succeeded = (r: QueryOutcome) => !r.error && r.count > 0
const deniedByPolicy = (r: QueryOutcome) => r.code === '42501' || (!r.error && r.count === 0)

vi.setConfig({ testTimeout: 30_000 })

let db: Db | null = null
afterEach(async () => { await db?.close(); db = null })

const ownProfile = (d: Db, types = '{physio,massage}', isPublic = true) =>
  d.as('specialistS',
    `INSERT INTO specialists (id, specialist_types, formats, profile_public)
     VALUES ($1, $2, '{offline,online}', $3) RETURNING id`, [specialistS.id, types, isPublic])

describe('профиль специалиста (118)', () => {
  it('специалист заводит свой профиль с несколькими специализациями', async () => {
    db = await createMedicalDb(MIGRATIONS)
    const r = await ownProfile(db)
    expect(r.error).toBeUndefined()
    expect(succeeded(r)).toBe(true)
  })

  it('незнакомая специализация не проходит', async () => {
    db = await createMedicalDb(MIGRATIONS)
    const r = await ownProfile(db, '{physio,surgeon}')
    expect(r.code).toBe('23514')
  })

  it('спортсмен НЕ может завести себе профиль специалиста', async () => {
    db = await createMedicalDb(MIGRATIONS)
    const r = await db.as('athleteA1',
      `INSERT INTO specialists (id, specialist_types) VALUES ($1, '{physio}') RETURNING id`, [athleteA1.id])
    expect(deniedByPolicy(r), r.error).toBe(true)
  })

  it('чужой профиль завести нельзя', async () => {
    db = await createMedicalDb(MIGRATIONS)
    const r = await db.as('specialistS',
      `INSERT INTO specialists (id, specialist_types) VALUES ($1, '{physio}') RETURNING id`, [coachA.id])
    expect(deniedByPolicy(r), r.error).toBe(true)
  })

  it('публичный профиль видят все, скрытый — только владелец', async () => {
    db = await createMedicalDb(MIGRATIONS)
    await ownProfile(db, '{nutrition}', false)
    const own = await db.as('specialistS', 'SELECT id FROM specialists WHERE id = $1', [specialistS.id])
    const other = await db.as('athleteA1', 'SELECT id FROM specialists WHERE id = $1', [specialistS.id])
    expect(succeeded(own)).toBe(true)
    expect(other.count).toBe(0)
    await db.as('specialistS', 'UPDATE specialists SET profile_public = true WHERE id = $1', [specialistS.id])
    const anon = await db.asAnon('SELECT id FROM specialists WHERE id = $1', [specialistS.id])
    expect(succeeded(anon)).toBe(true)
  })

  it('чужой профиль не правится', async () => {
    db = await createMedicalDb(MIGRATIONS)
    await ownProfile(db)
    const r = await db.as('athleteA1',
      `UPDATE specialists SET bio = 'взлом' WHERE id = $1 RETURNING id`, [specialistS.id])
    expect(deniedByPolicy(r)).toBe(true)
  })
})

describe('связь специалист — спортсмен (119)', () => {
  const request = (d: Db) => d.as('specialistS',
    `INSERT INTO connections (initiator_id, recipient_id, connection_type)
     VALUES ($1, $2, 'specialist_athlete') RETURNING id`, [specialistS.id, athleteA1.id])

  it('специалист отправляет запрос, спортсмен принимает — связь активна', async () => {
    db = await createMedicalDb(MIGRATIONS)
    const req = await request(db)
    expect(req.error).toBeUndefined()
    const accept = await db.as('athleteA1',
      `UPDATE connections SET status = 'active', responded_at = now() WHERE id = $1 RETURNING id`, [req.rows[0].id])
    expect(succeeded(accept), accept.error).toBe(true)
    const linked = await db.as('specialistS',
      `SELECT public.has_active_link($1, ARRAY['specialist_athlete']) AS ok`, [athleteA1.id])
    expect(linked.rows[0]).toEqual({ ok: true })
  })

  it('специалист НЕ принимает свой же запрос', async () => {
    db = await createMedicalDb(MIGRATIONS)
    const req = await request(db)
    const r = await db.as('specialistS',
      `UPDATE connections SET status = 'active' WHERE id = $1 RETURNING id`, [req.rows[0].id])
    expect(deniedByPolicy(r)).toBe(true)
  })

  it('тренер НЕ называется специалистом, специалист — врачом', async () => {
    db = await createMedicalDb(MIGRATIONS)
    const coach = await db.as('coachA',
      `INSERT INTO connections (initiator_id, recipient_id, connection_type)
       VALUES ($1, $2, 'specialist_athlete') RETURNING id`, [coachA.id, athleteA1.id])
    const asDoctor = await db.as('specialistS',
      `INSERT INTO connections (initiator_id, recipient_id, connection_type)
       VALUES ($1, $2, 'doctor_athlete') RETURNING id`, [specialistS.id, athleteA1.id])
    expect(deniedByPolicy(coach)).toBe(true)
    expect(deniedByPolicy(asDoctor)).toBe(true)
  })

  it('связь специалиста не даёт прав врача: осмотр он не создаёт', async () => {
    db = await createMedicalDb(MIGRATIONS)
    const req = await request(db)
    await db.as('athleteA1', `UPDATE connections SET status = 'active' WHERE id = $1`, [req.rows[0].id])
    const r = await db.as('specialistS',
      `INSERT INTO medical_checkups (doctor_id, athlete_id, checkup_date)
       VALUES ($1, $2, '2026-10-20') RETURNING id`, [specialistS.id, athleteA1.id])
    expect(deniedByPolicy(r)).toBe(true)
  })

  it('без 119 запрос специалиста отклоняется триггером 115 — тест не холостой', async () => {
    db = await createMedicalDb(MIGRATIONS.filter(m => !m.startsWith('119')))
    const r = await request(db)
    expect(r.code).toBe('42501')
  })
})

describe('ограничения типов связи (119)', () => {
  it('приглашение по почте принимает specialist_athlete и по-прежнему parent_link', async () => {
    db = await createMedicalDb(MIGRATIONS)
    const spec = await db.sys(`INSERT INTO email_invites (connection_type) VALUES ('specialist_athlete') RETURNING id`)
    const parent = await db.sys(`INSERT INTO email_invites (connection_type) VALUES ('parent_link') RETURNING id`)
    expect(spec.error).toBeUndefined()
    expect(parent.error).toBeUndefined()
  })

  it('без 119 приглашение специалиста отклоняется — тест не холостой', async () => {
    db = await createMedicalDb(MIGRATIONS.filter(m => !m.startsWith('119')))
    const r = await db.sys(`INSERT INTO email_invites (connection_type) VALUES ('specialist_athlete')`)
    expect(r.code).toBe('23514')
  })

  it('связь незнакомого типа не записать даже серверу', async () => {
    db = await createMedicalDb(MIGRATIONS)
    const r = await db.asService(
      `INSERT INTO connections (initiator_id, recipient_id, connection_type, status)
       VALUES ($1, $2, 'friend', 'active')`, [specialistS.id, athleteA1.id])
    expect(r.code).toBe('23514')
  })

  it('старый CHECK на connections пересоздаётся с полным списком', async () => {
    db = await createMedicalDb(MIGRATIONS.filter(m => !m.startsWith('119')))
    await db.sys(`ALTER TABLE connections ADD CONSTRAINT legacy_type_check
      CHECK (connection_type IN ('coach_athlete', 'doctor_athlete'))`)
    const insert = () => db!.asService(
      `INSERT INTO connections (initiator_id, recipient_id, connection_type) VALUES ($1, $2, 'specialist_athlete')`,
      [specialistS.id, athleteA1.id])
    expect((await insert()).code).toBe('23514')
    await db.applyMigration('119_specialist_connections.sql')
    const after = await insert()
    expect(after.error).toBeUndefined()
  })
})
