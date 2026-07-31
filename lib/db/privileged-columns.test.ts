import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Регрессия к P0 «эскалация привилегий» (миграция 104).
 *
 * Дефект: RLS-политика users_update_own не ограничивает КОЛОНКИ, поэтому
 * любой клиентский код (и любой обладатель токена) мог переписать свой
 * users.role на 'admin'. Живая проверка — qa/ralph/rls-probe.mjs (WR-02),
 * она требует сети и базы. Здесь — статический страж: клиентский код не
 * должен вообще пытаться писать привилегированные поля пользователя.
 */

const ROOT = process.cwd()
const PRIVILEGED = ['role', 'is_verified', 'verified_at', 'verified_by', 'verification_notes', 'auth_id']

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue
    const p = join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(p)
  }
  return out
}

/** Файл исполняется в браузере: есть 'use client' или это hook/компонент без серверных маркеров. */
function isClientFile(src: string): boolean {
  return /^\s*['"]use client['"]/m.test(src)
}

describe('P0-регрессия: клиент не пишет привилегированные поля users', () => {
  const files = [
    ...walk(join(ROOT, 'components')),
    ...walk(join(ROOT, 'lib', 'hooks')),
    ...walk(join(ROOT, 'app')),
  ]

  it('ни один клиентский файл не обновляет users.role', () => {
    const offenders: string[] = []

    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      if (!isClientFile(src)) continue
      // Ищем обновление таблицы users, в теле которого есть привилегированное поле.
      // Границы блока держим узкими (до 400 символов после .from('users')),
      // чтобы не ловить несвязанный код ниже по файлу.
      const re = /from\(\s*['"]users['"]\s*\)[\s\S]{0,400}?\.update\(([\s\S]{0,300}?)\)/g
      let m: RegExpExecArray | null
      while ((m = re.exec(src)) !== null) {
        const payload = m[1]
        for (const field of PRIVILEGED) {
          if (new RegExp(`\\b${field}\\b\\s*:`).test(payload)) {
            offenders.push(`${file.replace(ROOT + '/', '')} → users.${field}`)
          }
        }
      }
    }

    expect(offenders, `Привилегированные поля users нельзя писать из браузера — только админ-канал:\n${offenders.join('\n')}`)
      .toEqual([])
  })

  it('useUser не экспортирует switchRole (удалён как вектор эскалации)', () => {
    const src = readFileSync(join(ROOT, 'lib', 'hooks', 'useUser.ts'), 'utf8')
    expect(src).not.toMatch(/switchRole\s*[,=:]/)
  })

  it('миграция 104 существует и вешает триггер на users', () => {
    const mig = readFileSync(
      join(ROOT, 'supabase', 'migrations', '104_guard_users_privileged_columns.sql'),
      'utf8'
    )
    expect(mig).toMatch(/CREATE TRIGGER trg_guard_users_privileged_columns/)
    expect(mig).toMatch(/BEFORE UPDATE ON public\.users/)
    for (const field of ['role', 'auth_id', 'is_verified']) {
      expect(mig, `триггер должен защищать ${field}`).toMatch(new RegExp(`NEW\\.${field}`))
    }
  })
})
