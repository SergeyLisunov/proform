import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SPECIALIST_FORMATS, SPECIALIST_TYPES, specialistTypesLabel } from './specialist'

const sql = readFileSync(join(__dirname, '../supabase/migrations/118_specialist_profile.sql'), 'utf8')
const checkList = (column: string): string[] => {
  // Привязка к определению столбца: в комментарии к миграции имена
  // столбцов тоже встречаются.
  const m = new RegExp(`\\b${column}\\s+text\\[\\][\\s\\S]*?ARRAY\\[([^\\]]+)\\]`).exec(sql)
  if (!m) throw new Error(`CHECK для ${column} не найден в 118`)
  return [...m[1].matchAll(/'([a-z_]+)'/g)].map(x => x[1])
}

describe('словарь специалиста', () => {
  it('специализации совпадают с CHECK в таблице specialists', () => {
    expect(checkList('specialist_types')).toEqual([...SPECIALIST_TYPES])
  })

  it('форматы совпадают с CHECK в таблице specialists', () => {
    expect(checkList('formats')).toEqual([...SPECIALIST_FORMATS])
  })

  it('подпись: несколько специализаций, незнакомые пропускаются', () => {
    expect(specialistTypesLabel(['physio', 'massage'])).toBe('Физиотерапевт, массажист')
    expect(specialistTypesLabel(['surgeon'])).toBe('Специалист')
    expect(specialistTypesLabel(null)).toBe('Специалист')
  })
})
