import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONNECTION_TYPE_ROLES, rolesMatchConnectionType } from './types'

const MIGRATIONS = join(__dirname, '../../supabase/migrations')

/** Последнее определение connection_type_roles() в миграциях. */
function sqlConnectionTypes(): Record<string, [string, string]> {
  const files = readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()
  let body: string | null = null
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8')
    const m = /FUNCTION public\.connection_type_roles\(\)[\s\S]*?AS \$\$([\s\S]*?)\$\$/.exec(sql)
    if (m) body = m[1]
  }
  if (!body) throw new Error('connection_type_roles() не найдена в миграциях')
  const out: Record<string, [string, string]> = {}
  for (const m of body.matchAll(/\('([a-z_]+)',\s*'([a-z_]+)',\s*'([a-z_]+)'\)/g)) out[m[1]] = [m[2], m[3]]
  return out
}

describe('типы связей', () => {
  it('приложение и база знают одни и те же типы и роли сторон', () => {
    expect(sqlConnectionTypes()).toEqual(CONNECTION_TYPE_ROLES)
  })

  it('специалист связывается только со спортсменом', () => {
    expect(rolesMatchConnectionType('specialist_athlete', 'specialist', 'athlete')).toBe(true)
    expect(rolesMatchConnectionType('specialist_athlete', 'athlete', 'specialist')).toBe(true)
    expect(rolesMatchConnectionType('specialist_athlete', 'coach', 'athlete')).toBe(false)
    expect(rolesMatchConnectionType('doctor_athlete', 'specialist', 'athlete')).toBe(false)
  })

  it('незнакомый тип и унаследованные ключи не проходят', () => {
    expect(rolesMatchConnectionType('friend', 'athlete', 'athlete')).toBe(false)
    expect(rolesMatchConnectionType('constructor', 'athlete', 'athlete')).toBe(false)
  })
})

describe('пара ролей → тип связи', () => {
  it('специалист и спортсмен — specialist_athlete в любом порядке', async () => {
    const { connectionTypeForRoles } = await import('./types')
    expect(connectionTypeForRoles('specialist', 'athlete')).toBe('specialist_athlete')
    expect(connectionTypeForRoles('athlete', 'specialist')).toBe('specialist_athlete')
    expect(connectionTypeForRoles('athlete', 'doctor')).toBe('doctor_athlete')
    expect(connectionTypeForRoles('organization', 'specialist')).toBeNull()
    expect(connectionTypeForRoles('athlete', 'athlete')).toBeNull()
  })

  it('у каждой пары ролей не больше одного типа связи', () => {
    const seen = new Set<string>()
    for (const [r1, r2] of Object.values(CONNECTION_TYPE_ROLES)) {
      const pair = [r1, r2].sort().join('|')
      expect(seen.has(pair), pair).toBe(false)
      seen.add(pair)
    }
  })
})

describe('кем подключается приглашённый', () => {
  it('зависит от того, кто пригласил', async () => {
    const { invitedAsLabel } = await import('./types')
    expect(invitedAsLabel('specialist_athlete', 'specialist')).toBe('спортсмена')
    expect(invitedAsLabel('specialist_athlete', 'athlete')).toBe('специалиста')
    expect(invitedAsLabel('doctor_athlete', 'doctor')).toBe('спортсмена')
    expect(invitedAsLabel('doctor_athlete', 'coach')).toBeNull()
    expect(invitedAsLabel('parent_link', 'athlete')).toBeNull()
  })
})
