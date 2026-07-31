import { describe, expect, it } from 'vitest'
import {
  CLUB_MANAGER_MEMBER_ROLES,
  canAssignOrgAdmin,
  canViewMedicalReport,
  isClubManager,
  isClubManagerMemberRole,
  isOrgOwner,
  isPlatformAdmin,
} from './permissions'

/**
 * Permission-хелперы — единственный источник правды по правам (см. шапку
 * lib/permissions.ts). Тесты фиксируют границу, которую легко размыть при
 * починке P1 «org_admin неработоспособен»: админ клуба УПРАВЛЯЕТ клубом,
 * но не становится владельцем и не делегирует права дальше.
 */
describe('isClubManager / isOrgOwner', () => {
  it('аккаунт-организация управляет и владеет', () => {
    expect(isClubManager('organization', null)).toBe(true)
    expect(isOrgOwner('organization', null)).toBe(true)
  })

  it('org_admin управляет, но НЕ владеет', () => {
    expect(isClubManager('coach', 'org_admin')).toBe(true)
    expect(isOrgOwner('coach', 'org_admin')).toBe(false)
  })

  it('scoped org_owner управляет и владеет', () => {
    expect(isClubManager('coach', 'org_owner')).toBe(true)
    expect(isOrgOwner('coach', 'org_owner')).toBe(true)
  })

  it('роль без scoped-права клуб не открывает', () => {
    for (const role of ['athlete', 'coach', 'doctor', 'admin'] as const) {
      expect(isClubManager(role, null), role).toBe(false)
      expect(isOrgOwner(role, null), role).toBe(false)
    }
  })

  it('неаутентифицированный (undefined) не проходит', () => {
    expect(isClubManager(undefined, null)).toBe(false)
    expect(isOrgOwner(undefined, undefined)).toBe(false)
  })
})

describe('isClubManagerMemberRole', () => {
  it('пропускает только управляющие org-роли', () => {
    expect(isClubManagerMemberRole('org_owner')).toBe(true)
    expect(isClubManagerMemberRole('org_admin')).toBe(true)
  })

  it('отсекает рядовые роли и мусор', () => {
    for (const role of ['coach', 'athlete', 'doctor', 'specialist', '', null, undefined]) {
      expect(isClubManagerMemberRole(role), String(role)).toBe(false)
    }
  })

  it('константа для .in()-фильтров совпадает с guard-ом', () => {
    for (const role of CLUB_MANAGER_MEMBER_ROLES) {
      expect(isClubManagerMemberRole(role), role).toBe(true)
    }
    expect(CLUB_MANAGER_MEMBER_ROLES).toHaveLength(2)
  })
})

describe('canAssignOrgAdmin', () => {
  it('делегировать права может только глобальный аккаунт-организация', () => {
    // Тот же helper стоит на PATCH /api/org/members/role — UI обязан
    // совпадать с сервером, иначе кнопка гарантированно даёт 403.
    expect(canAssignOrgAdmin('organization')).toBe(true)
    for (const role of ['coach', 'athlete', 'doctor', 'admin', undefined] as const) {
      expect(canAssignOrgAdmin(role), String(role)).toBe(false)
    }
  })
})

describe('canViewMedicalReport / isPlatformAdmin', () => {
  it('клинический surface — врач и платформенный admin', () => {
    expect(canViewMedicalReport('doctor')).toBe(true)
    expect(canViewMedicalReport('admin')).toBe(true)
    expect(canViewMedicalReport('organization')).toBe(false)
    expect(canViewMedicalReport('coach')).toBe(false)
  })

  it('org-роли платформенным админом не становятся', () => {
    expect(isPlatformAdmin('admin')).toBe(true)
    expect(isPlatformAdmin('organization')).toBe(false)
    expect(isPlatformAdmin(undefined)).toBe(false)
  })
})
