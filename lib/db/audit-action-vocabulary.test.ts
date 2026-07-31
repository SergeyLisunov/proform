import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Регрессия: три маршрута писали в audit_logs.action значения, которых нет
 * в enum public.audit_action.
 *
 * Postgres отвечает 22P02, а дальше поведение расходилось:
 *   • /api/admin/users/role и /api/org/members/role не проверяли результат
 *     insert — возвращали 200, журнал оставался пустым (аудит терялся молча);
 *   • /api/clearance/override результат проверяет и отдаёт 500 — там маршрут
 *     падал на каждом вызове, функция была мертва целиком.
 *
 * Тип колонки живёт в БД, поэтому здесь статический сторож: литералы
 * action, которые код пишет в audit_logs, должны принадлежать словарю enum.
 */

const ROOT = process.cwd()

/**
 * Значения enum public.audit_action.
 * Расширяется миграцией (ALTER TYPE ... ADD VALUE) — при добавлении нового
 * ярлыка обнови этот список вместе с миграцией.
 */
const AUDIT_ACTIONS = new Set([
  'create', 'update', 'delete', 'login', 'logout',
  'role_change', 'privacy_change', 'assign_athlete',
  'clearance_override', // добавлено миграцией 109
])

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(p)
  }
  return out
}

describe('audit_logs.action: код пишет только значения из enum', () => {
  const files = [
    ...walk(join(ROOT, 'app')),
    ...walk(join(ROOT, 'lib')),
    ...walk(join(ROOT, 'services')),
  ]

  it('ни один литерал action не выходит за словарь', () => {
    const offenders: string[] = []

    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      // Ищем `.from('audit_logs')` … `action: '<литерал>'` в пределах вызова.
      const re = /from\(\s*['"]audit_logs['"]\s*\)[\s\S]{0,600}?action:\s*['"]([^'"]+)['"]/g
      let m: RegExpExecArray | null
      while ((m = re.exec(src)) !== null) {
        if (!AUDIT_ACTIONS.has(m[1])) {
          offenders.push(`${file.replace(ROOT + '/', '')} → action='${m[1]}'`)
        }
      }
    }

    expect(
      offenders,
      `значения вне enum public.audit_action (insert упадёт с 22P02):\n${offenders.join('\n')}`
    ).toEqual([])
  })

  it('миграция 109 объявляет clearance_override', () => {
    const mig = readFileSync(
      join(ROOT, 'supabase', 'migrations', '109_audit_action_clearance_override.sql'),
      'utf8'
    )
    expect(mig).toMatch(/ALTER TYPE public\.audit_action ADD VALUE IF NOT EXISTS 'clearance_override'/)
  })

  it('маршруты смены роли проверяют результат записи в журнал', () => {
    for (const route of [
      join(ROOT, 'app', 'api', 'admin', 'users', 'role', 'route.ts'),
      join(ROOT, 'app', 'api', 'org', 'members', 'role', 'route.ts'),
    ]) {
      const src = readFileSync(route, 'utf8')
      expect(src, `${route}: результат insert в audit_logs должен проверяться`)
        .toMatch(/error:\s*auditErr[\s\S]{0,600}?if \(auditErr\)/)
    }
  })
})
