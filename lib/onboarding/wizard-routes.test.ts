import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { USER_ROLES } from '@/types/users'
import { WIZARD_PATH, needsOnboarding, wizardPathForRole } from './wizard-routes'

/** Роли, которые можно выбрать при регистрации, — из триггера 105. */
function selfSignupRoles(): string[] {
  const sql = readFileSync(join(__dirname, '../../supabase/migrations/105_p0_signup_role_and_medical_scope.sql'), 'utf8')
  const m = /IN\s*\(\s*('coach'[^)]*)\)/.exec(sql)
  if (!m) throw new Error('не найден список ролей самостоятельной регистрации в 105')
  return [...m[1].matchAll(/'([a-z_]+)'/g)].map(x => x[1])
}

describe('онбординг по ролям', () => {
  it('у каждой роли, доступной при регистрации, есть мастер — иначе вход зацикливается', () => {
    const roles = selfSignupRoles()
    expect(roles).toContain('specialist')
    for (const role of roles) expect(wizardPathForRole(role), role).not.toBeNull()
  })

  it('у админа мастера нет, и онбординг ему не нужен', () => {
    expect(wizardPathForRole('admin')).toBeNull()
    expect(needsOnboarding('admin', {})).toBe(false)
  })

  it('незнакомая роль не отправляется на онбординг — круга нет', () => {
    expect(needsOnboarding('superhero', {})).toBe(false)
    expect(needsOnboarding(null, null)).toBe(false)
  })

  it('специалист без отметки идёт в свой мастер, с отметкой — нет', () => {
    expect(wizardPathForRole('specialist')).toBe('/onboarding/specialist')
    expect(needsOnboarding('specialist', null)).toBe(true)
    expect(needsOnboarding('specialist', { completed: false })).toBe(true)
    expect(needsOnboarding('specialist', { completed: true })).toBe(false)
  })

  it('мастер есть у каждой роли из USER_ROLES, кроме админа', () => {
    for (const role of USER_ROLES) {
      if (role === 'admin') continue
      expect(role in WIZARD_PATH, role).toBe(true)
    }
  })

  it('путь мастера не наследуется от Object.prototype', () => {
    expect(wizardPathForRole('constructor')).toBeNull()
    expect(wizardPathForRole('toString')).toBeNull()
  })
})
