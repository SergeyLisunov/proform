import { describe, expect, it } from 'vitest'
import { resolveOrgContext, type OrgMembershipRow } from './resolve-org-context'

/**
 * Регрессия к P1 «роль org_admin выдаётся, но неработоспособна».
 *
 * Дефект был двойным:
 *   1) гейт страниц /org/* сравнивал ГЛОБАЛЬНУЮ роль (`user.role !== 'organization'`),
 *      которой у администратора клуба нет;
 *   2) org_id брался из `user.id` — верно только для аккаунта-организации
 *      (organizations.id = users.id), у org_admin это чужой id.
 *
 * Тесты фиксируют обе половины: canManage и orgId.
 */

const OWNER_ACCOUNT = 'u-org-account'
const ADMIN_USER    = 'u-club-admin'
const CLUB_A        = 'org-a'
const CLUB_B        = 'org-b'

const CLUB_C        = 'org-c'

function member(
  org_id: string,
  member_role: string,
  status: string = 'active',
  joined_at?: string | null,
): OrgMembershipRow {
  return { org_id, member_role, status, joined_at }
}

describe('resolveOrgContext', () => {
  it('аккаунт-организации управляет клубом со СВОИМ users.id', () => {
    const ctx = resolveOrgContext(OWNER_ACCOUNT, 'organization', [
      member(OWNER_ACCOUNT, 'org_owner'),
    ])

    expect(ctx.orgId).toBe(OWNER_ACCOUNT)
    expect(ctx.canManage).toBe(true)
    expect(ctx.isOwner).toBe(true)
  })

  it('аккаунт-организации управляет даже без строки в org_members', () => {
    // Онбординг мог не создать членство — доступ к своему клубу это не отменяет.
    const ctx = resolveOrgContext(OWNER_ACCOUNT, 'organization', [])

    expect(ctx.orgId).toBe(OWNER_ACCOUNT)
    expect(ctx.canManage).toBe(true)
  })

  it('org_admin получает ЧУЖОЙ org_id из членства, а не свой users.id', () => {
    const ctx = resolveOrgContext(ADMIN_USER, 'coach', [
      member(CLUB_A, 'org_admin'),
    ])

    expect(ctx.orgId).toBe(CLUB_A)
    expect(ctx.orgId).not.toBe(ADMIN_USER)
    expect(ctx.scopedOrgRole).toBe('org_admin')
    expect(ctx.canManage).toBe(true)
    // Делегирование прав остаётся привилегией владельца.
    expect(ctx.isOwner).toBe(false)
  })

  it('scoped org_owner — тоже владелец, даже с не-organization глобальной ролью', () => {
    const ctx = resolveOrgContext(ADMIN_USER, 'coach', [
      member(CLUB_A, 'org_owner'),
    ])

    expect(ctx.orgId).toBe(CLUB_A)
    expect(ctx.isOwner).toBe(true)
    expect(ctx.canManage).toBe(true)
  })

  it('org_owner приоритетнее org_admin — пара (роль, org_id) не разъезжается', () => {
    // Пользователь владеет клубом B и админит клуб A. Порядок строк из БД
    // произвольный, поэтому выбор обязан быть детерминированным.
    const ctx = resolveOrgContext(ADMIN_USER, 'coach', [
      member(CLUB_A, 'org_admin'),
      member(CLUB_B, 'org_owner'),
    ])

    expect(ctx.scopedOrgRole).toBe('org_owner')
    expect(ctx.orgId).toBe(CLUB_B)
    expect(ctx.isOwner).toBe(true)
  })

  it('два org_admin-членства: выигрывает раннее joined_at, а не порядок строк', () => {
    // Регрессия «администратор двух клубов открывает произвольный».
    // Тот же набор строк в обратном порядке обязан дать тот же клуб.
    const rows = [
      member(CLUB_B, 'org_admin', 'active', '2025-03-01T00:00:00Z'),
      member(CLUB_A, 'org_admin', 'active', '2024-01-15T00:00:00Z'),
      member(CLUB_C, 'org_admin', 'active', '2025-09-20T00:00:00Z'),
    ]

    expect(resolveOrgContext(ADMIN_USER, 'coach', rows).orgId).toBe(CLUB_A)
    expect(resolveOrgContext(ADMIN_USER, 'coach', [...rows].reverse()).orgId).toBe(CLUB_A)
  })

  it('без joined_at выбор всё равно стабилен — тай-брейк по org_id', () => {
    // Вызывающие, которые не выбирают колонку joined_at, не должны получать
    // «то один клуб, то другой»: правило обязано доработать без неё.
    const rows = [
      member(CLUB_C, 'org_admin'),
      member(CLUB_A, 'org_admin'),
      member(CLUB_B, 'org_admin'),
    ]

    expect(resolveOrgContext(ADMIN_USER, 'coach', rows).orgId).toBe(CLUB_A)
    expect(resolveOrgContext(ADMIN_USER, 'coach', [...rows].reverse()).orgId).toBe(CLUB_A)
  })

  it('членство с датой приоритетнее членства без даты', () => {
    // Пустой joined_at не должен выигрывать у реальной даты только потому,
    // что пустая строка меньше любой ISO-даты.
    const withDate    = member(CLUB_B, 'org_admin', 'active', '2025-03-01T00:00:00Z')
    const withoutDate = member(CLUB_A, 'org_admin')

    expect(resolveOrgContext(ADMIN_USER, 'coach', [withoutDate, withDate]).orgId).toBe(CLUB_B)
    expect(resolveOrgContext(ADMIN_USER, 'coach', [withDate, withoutDate]).orgId).toBe(CLUB_B)
  })

  it('org_owner бьёт org_admin даже с более поздним joined_at', () => {
    // Роль — старший ключ сортировки: владение сильнее делегированных прав.
    const rows = [
      member(CLUB_A, 'org_admin', 'active', '2020-01-01T00:00:00Z'),
      member(CLUB_B, 'org_owner', 'active', '2026-01-01T00:00:00Z'),
    ]

    const ctx = resolveOrgContext(ADMIN_USER, 'coach', rows)
    expect(ctx.orgId).toBe(CLUB_B)
    expect(ctx.scopedOrgRole).toBe('org_owner')
  })

  it('резолвер не мутирует переданный массив членств', () => {
    // Сортировка «на месте» переставила бы строки в кэше вызывающего.
    const rows = [
      member(CLUB_C, 'org_admin', 'active', '2025-09-20T00:00:00Z'),
      member(CLUB_A, 'org_admin', 'active', '2024-01-15T00:00:00Z'),
    ]
    const snapshot = rows.map(r => r.org_id)

    resolveOrgContext(ADMIN_USER, 'coach', rows)

    expect(rows.map(r => r.org_id)).toEqual(snapshot)
  })

  it('неактивное членство прав не даёт', () => {
    for (const status of ['pending', 'suspended', 'removed']) {
      const ctx = resolveOrgContext(ADMIN_USER, 'coach', [
        member(CLUB_A, 'org_admin', status),
      ])

      expect(ctx.canManage, status).toBe(false)
      expect(ctx.orgId, status).toBeNull()
      expect(ctx.scopedOrgRole, status).toBeNull()
    }
  })

  it('рядовые роли в клубе управления не дают', () => {
    for (const role of ['coach', 'athlete', 'doctor', 'specialist']) {
      const ctx = resolveOrgContext(ADMIN_USER, 'coach', [member(CLUB_A, role)])

      expect(ctx.canManage, role).toBe(false)
      expect(ctx.orgId, role).toBeNull()
    }
  })

  it('атлет без членств не управляет ничем', () => {
    const ctx = resolveOrgContext('u-athlete', 'athlete', [])

    expect(ctx.canManage).toBe(false)
    expect(ctx.isOwner).toBe(false)
    expect(ctx.orgId).toBeNull()
  })

  it('платформенный admin не получает клуб «в нагрузку»', () => {
    // Глобальный admin — не менеджер клуба; страницы дают ему доступ отдельной
    // проверкой isPlatformAdmin, но orgId у него неоткуда взяться.
    const ctx = resolveOrgContext('u-admin', 'admin', [])

    expect(ctx.canManage).toBe(false)
    expect(ctx.orgId).toBeNull()
  })

  it('невалидная глобальная роль (undefined) не открывает доступ', () => {
    const ctx = resolveOrgContext(ADMIN_USER, undefined, [])

    expect(ctx.canManage).toBe(false)
    expect(ctx.orgId).toBeNull()
  })
})
