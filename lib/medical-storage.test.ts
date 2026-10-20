import { describe, expect, it } from 'vitest'
import { attachmentHref, buildMedicalPath } from './medical-storage'

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
