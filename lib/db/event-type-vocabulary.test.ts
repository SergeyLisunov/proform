import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Регрессия к P1 «применение шаблона в календарь всегда падает».
 *
 * Код писал в calendar_events значение event_type='training', которого нет
 * в CHECK-констрейнте. Ошибка 23514 приходила на каждую попытку — сценарий
 * был мёртв, но выглядел рабочим. Констрейнты живут в БД, поэтому здесь —
 * статический сторож: значения, которые код пишет в event_type, должны
 * принадлежать словарю, зафиксированному в миграциях.
 */

const ROOT = process.cwd()

/** Значения из calendar_events_event_type_check и workouts_event_type_check. */
const CALENDAR_EVENT_TYPES = new Set([
  'workout', 'competition', 'rest', 'note', 'travel', 'medical', 'test',
  'camp', 'other', 'medical_appointment', 'coach_plan',
])
const WORKOUT_EVENT_TYPES = new Set(['workout', 'competition', 'prescribed'])

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(p)
  }
  return out
}

/** Ищем `.from('<table>')` … `event_type: '<value>'` в пределах одного вызова. */
function collectWrites(src: string, table: string): string[] {
  const found: string[] = []
  const re = new RegExp(`from\\(\\s*['"]${table}['"]\\s*\\)[\\s\\S]{0,900}?event_type:\\s*['"]([a-z_]+)['"]`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) found.push(m[1])
  return found
}

describe('event_type: код пишет только значения из словаря БД', () => {
  const files = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'lib')), ...walk(join(ROOT, 'services'))]

  it('calendar_events', () => {
    const offenders: string[] = []
    for (const file of files) {
      for (const value of collectWrites(readFileSync(file, 'utf8'), 'calendar_events')) {
        if (!CALENDAR_EVENT_TYPES.has(value)) {
          offenders.push(`${file.replace(ROOT + '/', '')} → event_type='${value}'`)
        }
      }
    }
    expect(offenders, `значения вне CHECK-констрейнта calendar_events:\n${offenders.join('\n')}`).toEqual([])
  })

  it('workouts', () => {
    const offenders: string[] = []
    for (const file of files) {
      for (const value of collectWrites(readFileSync(file, 'utf8'), 'workouts')) {
        if (!WORKOUT_EVENT_TYPES.has(value)) {
          offenders.push(`${file.replace(ROOT + '/', '')} → event_type='${value}'`)
        }
      }
    }
    expect(offenders, `значения вне CHECK-констрейнта workouts:\n${offenders.join('\n')}`).toEqual([])
  })
})
