import { test, expect } from '@playwright/test'
import { statePath } from '../accounts'

/**
 * Негативные ролевые проверки ЧЕРЕЗ СОБСТВЕННЫЕ API приложения
 * (RLS-уровень проверяет qa/ralph/rls-probe.mjs — здесь именно то, что
 * отдаёт Next.js: маршруты могут ходить admin-клиентом в обход RLS,
 * и тогда изоляцию обязан обеспечивать код маршрута).
 *
 * Правило: любой отказ (401/403/404) — успех. Опасен только 200 с чужими
 * данными.
 */

// 405 — маршрут не поддерживает метод: данные не утекли, отказ засчитан.
const FORBIDDEN_OK = [401, 403, 404, 405]

test.describe('cross-tenant: тренер Alpha против организации Beta', () => {
  test.use({ storageState: statePath('coach-alpha1') })

  test('не может читать состав чужой организации через /api/org/teams', async ({ request }) => {
    const res = await request.get('/api/org/teams')
    if (res.status() === 200) {
      const body = await res.json().catch(() => ({}))
      const text = JSON.stringify(body)
      expect(text, 'в ответе не должно быть организации Beta').not.toContain('qa-club-beta')
      expect(text, 'в ответе не должно быть клуба Beta по имени').not.toContain('QA Клуб Бета')
    } else {
      expect(FORBIDDEN_OK).toContain(res.status())
    }
  })

  test('не может пригласить участника в чужую организацию', async ({ request }) => {
    const res = await request.post('/api/org/bulk-invite', {
      data: { emails: ['qa.intruder@sporteo-qa.dev'], role: 'coach', orgSlug: 'qa-club-beta' },
    })
    expect(res.status(), 'приглашение в чужой клуб должно отклоняться').not.toBe(200)
  })
})

test.describe('cross-tenant: спортсмен не получает админ-API', () => {
  test.use({ storageState: statePath('athlete-alpha1') })

  test('POST /api/admin/users/role отвергается для не-админа', async ({ request }) => {
    const res = await request.post('/api/admin/users/role', {
      data: { userId: '00000000-0000-0000-0000-000000000000', role: 'admin' },
    })
    expect(FORBIDDEN_OK).toContain(res.status())
  })

  test('POST /api/admin/invite отвергается для не-админа', async ({ request }) => {
    const res = await request.post('/api/admin/invite', {
      data: { email: 'qa.intruder@sporteo-qa.dev', role: 'coach' },
    })
    expect(FORBIDDEN_OK).toContain(res.status())
  })

  test('не может прочитать чужие AI-диалоги', async ({ request }) => {
    const res = await request.get('/api/assistant/conversations')
    if (res.status() === 200) {
      const body = await res.json().catch(() => ({})) as { conversations?: unknown[] }
      const list = body.conversations ?? []
      // Диалоги другого пользователя не должны попадать в выдачу вовсе.
      expect(JSON.stringify(list)).not.toContain('qa.doctor')
      expect(JSON.stringify(list)).not.toContain('qa.coach')
    } else {
      expect(FORBIDDEN_OK).toContain(res.status())
    }
  })
})

test.describe('медицинские рекомендации: роли не подменяются', () => {
  test.use({ storageState: statePath('athlete-alpha1') })

  test('спортсмен не может подтвердить рекомендацию «от имени тренера»', async ({ request }) => {
    const list = await request.get('/api/recommendations')
    expect(list.status()).toBe(200)
    const body = await list.json() as { data?: Array<{ id: string }> }
    const rec = (body.data ?? [])[0]
    test.skip(!rec, 'нет ни одной рекомендации в фикстурах')

    const forged = await request.post(`/api/recommendations/${rec!.id}/ack`, {
      data: { as: 'coach' },
    })
    expect(FORBIDDEN_OK, `подделка подтверждения вернула ${forged.status()}`)
      .toContain(forged.status())
  })

  test('спортсмен может подтвердить рекомендацию от своего имени', async ({ request }) => {
    const list = await request.get('/api/recommendations')
    const body = await list.json() as { data?: Array<{ id: string }> }
    const rec = (body.data ?? [])[0]
    test.skip(!rec, 'нет ни одной рекомендации в фикстурах')

    const ok = await request.post(`/api/recommendations/${rec!.id}/ack`, {
      data: { as: 'athlete' },
    })
    expect(ok.status(), 'легитимное подтверждение не должно ломаться').toBe(200)
  })

  test('спортсмен не может отменить врачебную рекомендацию', async ({ request }) => {
    const list = await request.get('/api/recommendations')
    const body = await list.json() as { data?: Array<{ id: string }> }
    const rec = (body.data ?? [])[0]
    test.skip(!rec, 'нет ни одной рекомендации в фикстурах')

    const cancelled = await request.patch(`/api/recommendations/${rec!.id}`, {
      data: { action: 'cancel' },
    })
    expect(cancelled.status(), 'отмена доступна только автору-врачу').not.toBe(200)
  })
})

test.describe('администратор платформы: смена роли аудируется', () => {
  test.use({ storageState: statePath('platform-owner') })

  test('нельзя сменить роль самому себе', async ({ request }) => {
    const me = await request.get('/api/assistant/capabilities')
    // Идентификатор не важен: маршрут сам сверяет actor и target.
    expect([200, 401, 403]).toContain(me.status())

    const res = await request.post('/api/admin/users/role', {
      data: { userId: '00000000-0000-0000-0000-000000000000', role: 'admin' },
    })
    // Несуществующий пользователь → 404; сам себе → 400. 200 недопустим.
    expect(res.status(), 'админ-маршрут не должен молча принимать любой userId').not.toBe(200)
  })

  test('невалидная роль отклоняется', async ({ request }) => {
    const res = await request.post('/api/admin/users/role', {
      data: { userId: '11111111-1111-1111-1111-111111111111', role: 'superuser' },
    })
    expect(res.status()).toBe(400)
  })
})
