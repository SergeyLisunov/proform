import { describe, expect, it } from 'vitest'
import { attachmentHref, buildMedicalPath, reconcileWithMigrated } from './medical-storage'

const USER = '00000000-0000-0000-0000-0000000000a1'

describe('buildMedicalPath', () => {
  it('кладёт файл в папку автора: первый сегмент — users.id', () => {
    const path = buildMedicalPath(USER, 'Анализ крови.PDF')
    expect(path.split('/')[0]).toBe(USER)
    expect(path.split('/')[1]).toBe('med')
  })

  it('имя случайное, расширение исходное в нижнем регистре', () => {
    const a = buildMedicalPath(USER, 'scan.PDF')
    const b = buildMedicalPath(USER, 'scan.PDF')
    expect(a).not.toBe(b)
    expect(a).toMatch(/\/med\/[0-9a-f-]{36}\.pdf$/)
  })

  it('исходное имя файла в путь не попадает', () => {
    expect(buildMedicalPath(USER, 'Иванов_диагноз.docx')).not.toContain('Иванов')
  })

  it('выгрузка Apple Health — в свою подпапку той же папки автора', () => {
    expect(buildMedicalPath(USER, 'export.zip', 'apple_health')).toMatch(
      new RegExp(`^${USER}/apple_health/[0-9a-f-]{36}\\.zip$`))
  })

  it('без расширения и с мусором в расширении', () => {
    expect(buildMedicalPath(USER, 'README')).toMatch(/\/med\/[0-9a-f-]{36}$/)
    expect(buildMedicalPath(USER, 'x.p/d f')).toMatch(/\.pdf$/)
  })
})

describe('attachmentHref', () => {
  it('закрытый файл — подписанная ссылка', () => {
    expect(attachmentHref({ path: 'a/med/1.pdf' }, { 'a/med/1.pdf': 'https://signed' })).toBe('https://signed')
  })

  it('закрытый файл без подписи — нет ссылки, а не публичная', () => {
    expect(attachmentHref({ path: 'a/med/1.pdf', url: 'https://public' }, {})).toBeUndefined()
  })

  it('старый, ещё не перенесённый файл — прежняя ссылка', () => {
    expect(attachmentHref({ url: 'https://public' }, {})).toBe('https://public')
  })
})

describe('reconcileWithMigrated', () => {
  type Att = { name: string; path?: string; url?: string }
  const PUBLIC = 'https://x.supabase.co/storage/v1/object/public/note-attachments/auth/med/'
  it('старая ссылка на уже перенесённый файл заменяется вложением с путём', () => {
    const current: Att[] = [{ name: 'a', path: `${USER}/med/1-a.pdf` }]
    const next: Att[] = [{ name: 'a', url: `${PUBLIC}1-a.pdf` }, { name: 'b', path: `${USER}/med/new.pdf` }]
    expect(reconcileWithMigrated(next, current)).toEqual([
      { name: 'a', path: `${USER}/med/1-a.pdf` },
      { name: 'b', path: `${USER}/med/new.pdf` },
    ])
  })
  it('не перенесённая ссылка остаётся как есть', () => {
    const next: Att[] = [{ name: 'a', url: `${PUBLIC}1-a.pdf` }]
    expect(reconcileWithMigrated(next, [])).toEqual(next)
  })
  it('имя с пробелом в ссылке совпадает с путём', () => {
    const current: Att[] = [{ name: 'a', path: `${USER}/med/1-a b.pdf` }]
    expect(reconcileWithMigrated<Att>([{ name: 'a', url: `${PUBLIC}1-a%20b.pdf` }], current)[0].path).toBe(`${USER}/med/1-a b.pdf`)
  })
})
