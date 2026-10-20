/**
 * Миграция 117: медицинские файлы — в закрытом бакете, читает их тот, кому
 * видна запись медицинского дневника со ссылкой на файл.
 *
 * Атаки обязаны получить отказ по правам (42501) или пустой ответ; любая
 * другая ошибка — провал теста. Обычная работа обязана проходить.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMedicalDb, USERS, type Db, type QueryOutcome, type UserKey } from './pg-harness'

const MIGRATIONS = [
  '114_medical_write_requires_patient_link.sql',
  '115_connections_consent_guard.sql',
  '116_recommendations_ack_only_for_non_authors.sql',
  '117_private_medical_storage.sql',
]
const BUCKET = 'medical-private'
const { doctorA, doctorB, athleteA1 } = USERS

const succeeded = (r: QueryOutcome) => !r.error && r.count > 0
const deniedByPolicy = (r: QueryOutcome) => r.code === '42501' || (!r.error && r.count === 0)

/** Файл врача A в его папке, как его кладёт MedicalDiaryClient. */
const FILE_A = `${doctorA.id}/med/analysis.pdf`

const upload = (db: Db, who: UserKey, name: string) =>
  db.as(who, `INSERT INTO storage.objects (bucket_id, name) VALUES ($1, $2) RETURNING id`, [BUCKET, name])

const read = (db: Db, who: UserKey, name: string) =>
  db.as(who, `SELECT id FROM storage.objects WHERE bucket_id = $1 AND name = $2`, [BUCKET, name])

/** Запись дневника врача A о спортсмене A1 со ссылкой на файл. Падает,
 *  если запись не создалась: иначе тесты «доступа нет» проходили бы
 *  вхолостую — без записи файл недоступен и так. */
const diaryWithFile = async (db: Db, shared: { athlete?: boolean; coach?: boolean }) => {
  const r = await db.as('doctorA',
    `INSERT INTO medical_diary (doctor_id, athlete_id, date, note, attachments,
       is_shared_with_athlete, is_shared_with_coach)
     VALUES ($1, $2, '2026-10-20', 'анализы', $3, $4, $5) RETURNING id`,
    [doctorA.id, athleteA1.id, JSON.stringify([{ path: FILE_A, name: 'analysis.pdf', type: 'document', size: 1 }]),
     !!shared.athlete, !!shared.coach])
  if (!succeeded(r)) throw new Error(`запись дневника не создана: ${r.error}`)
  return r
}

const withUploadedFile = async (): Promise<Db> => {
  const db = await createMedicalDb(MIGRATIONS)
  const up = await upload(db, 'doctorA', FILE_A)
  if (!succeeded(up)) throw new Error(`загрузка файла не удалась: ${up.error}`)
  return db
}

// Каждый тест поднимает свой Postgres в WASM. Под нагрузкой (весь набор
// параллельно, CI) первый запуск занимает больше стандартных 5 секунд.
vi.setConfig({ testTimeout: 30_000 })

let db: Db | null = null
afterEach(async () => { await db?.close(); db = null })

describe('медицинские файлы после миграции 117', () => {
  it('бакет закрытый', async () => {
    db = await createMedicalDb(MIGRATIONS)
    const r = await db.sys(`SELECT public FROM storage.buckets WHERE id = $1`, [BUCKET])
    expect(r.rows[0]).toEqual({ public: false })
  })

  it('врач загружает файл в свою папку и читает его', async () => {
    db = await withUploadedFile()
    expect(succeeded(await read(db, 'doctorA', FILE_A))).toBe(true)
  })

  it('загрузить в чужую папку нельзя', async () => {
    db = await createMedicalDb(MIGRATIONS)
    // Без RETURNING: иначе отказ дала бы политика чтения, а не загрузки.
    const r = await db.as('doctorB',
      `INSERT INTO storage.objects (bucket_id, name) VALUES ($1, $2)`, [BUCKET, FILE_A])
    const stored = await db.sys(`SELECT id FROM storage.objects WHERE name = $1`, [FILE_A])
    expect(r.code, r.error).toBe('42501')
    expect(stored.count).toBe(0)
  })

  it('спортсмен читает файл из записи, которой врач с ним поделился', async () => {
    db = await withUploadedFile()
    await diaryWithFile(db, { athlete: true })
    expect(succeeded(await read(db, 'athleteA1', FILE_A))).toBe(true)
  })

  it('спортсмен НЕ читает файл из записи, которой врач не делился', async () => {
    db = await withUploadedFile()
    await diaryWithFile(db, {})
    expect(deniedByPolicy(await read(db, 'athleteA1', FILE_A))).toBe(true)
  })

  it('тренер спортсмена читает файл из записи, показанной тренеру', async () => {
    db = await withUploadedFile()
    await diaryWithFile(db, { coach: true })
    expect(succeeded(await read(db, 'coachA', FILE_A))).toBe(true)
  })

  it('врач скрыл запись — доступ к файлу пропал', async () => {
    db = await withUploadedFile()
    await diaryWithFile(db, { athlete: true })
    await db.as('doctorA', `UPDATE medical_diary SET is_shared_with_athlete = false WHERE note = 'анализы'`)
    expect(deniedByPolicy(await read(db, 'athleteA1', FILE_A))).toBe(true)
  })

  it('посторонний спортсмен и посторонний врач файл НЕ читают', async () => {
    db = await withUploadedFile()
    await diaryWithFile(db, { athlete: true, coach: true })
    expect(deniedByPolicy(await read(db, 'athleteA2', FILE_A))).toBe(true)
    expect(deniedByPolicy(await read(db, 'doctorB', FILE_A))).toBe(true)
  })

  it('сославшись на чужой файл из своей записи, доступ НЕ получить', async () => {
    db = await withUploadedFile()
    const forged = await db.as('doctorB',
      `INSERT INTO medical_diary (doctor_id, date, note, attachments)
       VALUES ($1, '2026-10-20', 'чужой файл', $2) RETURNING id`,
      [doctorB.id, JSON.stringify([{ path: FILE_A, name: 'x', type: 'document', size: 1 }])])
    expect(succeeded(forged), forged.error).toBe(true)
    expect(deniedByPolicy(await read(db, 'doctorB', FILE_A))).toBe(true)
  })

  it('без входа файл НЕ читается', async () => {
    db = await withUploadedFile()
    await diaryWithFile(db, { athlete: true })
    const r = await db.asAnon('SELECT id FROM storage.objects WHERE bucket_id = $1', [BUCKET])
    expect(deniedByPolicy(r), r.error).toBe(true)
  })

  it('удалить файл может только автор', async () => {
    db = await withUploadedFile()
    await diaryWithFile(db, { athlete: true })
    const byAthlete = await db.as('athleteA1',
      `DELETE FROM storage.objects WHERE bucket_id = $1 AND name = $2 RETURNING id`, [BUCKET, FILE_A])
    expect(deniedByPolicy(byAthlete)).toBe(true)
    const byAuthor = await db.as('doctorA',
      `DELETE FROM storage.objects WHERE bucket_id = $1 AND name = $2 RETURNING id`, [BUCKET, FILE_A])
    expect(succeeded(byAuthor), byAuthor.error).toBe(true)
  })

  it('медицинский файл в публичный бакет больше не загрузить', async () => {
    db = await createMedicalDb(MIGRATIONS)
    await db.sys(`INSERT INTO storage.buckets (id, name, public) VALUES ('note-attachments', 'note-attachments', true)`)
    await db.sys(`CREATE POLICY note_upload ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'note-attachments')`)
    const med = await db.as('doctorA',
      `INSERT INTO storage.objects (bucket_id, name) VALUES ('note-attachments', $1)`, [`${doctorA.id}/med/x.pdf`])
    const health = await db.as('doctorA',
      `INSERT INTO storage.objects (bucket_id, name) VALUES ('note-attachments', $1)`,
      [`${doctorA.id}/health-private/apple_health/x.zip`])
    const note = await db.as('doctorA',
      `INSERT INTO storage.objects (bucket_id, name) VALUES ('note-attachments', $1)`, [`${doctorA.id}/notes/x.jpg`])
    expect(med.code).toBe('42501')
    expect(health.code).toBe('42501')
    expect(note.error).toBeUndefined()
  })

  it('новое вложение со ссылкой в публичный бакет запись не принимает', async () => {
    db = await createMedicalDb(MIGRATIONS)
    const legacy = JSON.stringify([{ url: 'https://x/storage/v1/object/public/note-attachments/a/med/1.pdf', name: 'a', type: 'document', size: 1 }])
    const insert = await db.as('doctorA',
      `INSERT INTO medical_diary (doctor_id, date, note, attachments) VALUES ($1, '2026-10-20', 'старая ссылка', $2)`,
      [doctorA.id, legacy])
    expect(insert.code).toBe('42501')
  })

  it('уже лежащее старое вложение не мешает править запись, новое — мешает', async () => {
    db = await createMedicalDb(MIGRATIONS)
    const old = { url: 'https://x/storage/v1/object/public/note-attachments/a/med/1.pdf', name: 'a', type: 'document', size: 1 }
    await db.sys(`INSERT INTO medical_diary (doctor_id, date, note, attachments) VALUES ($1, '2026-10-20', 'до переноса', $2)`,
      [doctorA.id, JSON.stringify([old])])
    const keep = await db.as('doctorA',
      `UPDATE medical_diary SET note = 'правка', attachments = $1 WHERE note = 'до переноса' RETURNING id`,
      [JSON.stringify([old, { path: `${doctorA.id}/med/new.pdf`, name: 'b', type: 'document', size: 2 }])])
    expect(succeeded(keep), keep.error).toBe(true)
    const add = await db.as('doctorA',
      `UPDATE medical_diary SET attachments = attachments || $1::jsonb WHERE note = 'правка' RETURNING id`,
      [JSON.stringify([{ ...old, url: old.url.replace('1.pdf', '2.pdf') }])])
    expect(add.code).toBe('42501')
  })

  it('миграцию можно применить повторно', async () => {
    db = await createMedicalDb([...MIGRATIONS, '117_private_medical_storage.sql'])
    expect(succeeded(await upload(db, 'doctorA', FILE_A))).toBe(true)
  })
})
