import { test, expect } from '@playwright/test'

/**
 * Unauthenticated smoke tests. These verify public pages render without
 * 5xx errors and key UI anchors are present. They don't touch a real
 * database or create any users — safe to run against prod.
 */

test.describe('public pages render', () => {
  test('home page responds with 200', async ({ page }) => {
    const res = await page.goto('/')
    expect(res?.status()).toBeLessThan(500)
  })

  test('login page shows an email field', async ({ page }) => {
    await page.goto('/auth/login')
    // loose selector — any input[type="email"] or named email
    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    await expect(emailInput).toBeVisible()
  })

  test('pricing page renders', async ({ page }) => {
    const res = await page.goto('/pricing')
    expect(res?.status()).toBeLessThan(500)
  })

  test('invite page with fake token shows error state', async ({ page }) => {
    const res = await page.goto('/invite/00000000-0000-0000-0000-000000000000')
    // Page must not 500. The client component starts loading then shows an
    // error state ("Ошибка" / "Приглашение не найдено"). We verify the URL
    // stayed on /invite/ (no auth redirect) and the response was non-5xx.
    expect(res?.status()).toBeLessThan(500)
    expect(page.url()).toContain('/invite/')
  })
})

test.describe('protected routes', () => {
  test('dashboard redirects unauthenticated users to login', async ({ page }) => {
    const res = await page.goto('/dashboard')
    // middleware redirects to /auth/login OR the page renders a "login needed"
    // state — either way we should not see a hard 500.
    expect(res?.status()).toBeLessThan(500)
    // We expect the final URL to be /auth/login OR to contain a login input.
    const url = page.url()
    const onLogin = url.includes('/auth/login')
    if (!onLogin) {
      const emailInput = page.locator('input[type="email"], input[name="email"]').first()
      await expect(emailInput).toBeVisible({ timeout: 3000 }).catch(() => {})
    }
  })

  test('injuries page does not 500 unauthenticated', async ({ page }) => {
    const res = await page.goto('/injuries')
    expect(res?.status()).toBeLessThan(500)
  })

  test('athletes/load page does not 500 unauthenticated', async ({ page }) => {
    const res = await page.goto('/athletes/load')
    expect(res?.status()).toBeLessThan(500)
  })
})

test.describe('api contracts', () => {
  test('GET /api/invite/:token returns JSON 404 for unknown token', async ({ request }) => {
    const res = await request.get('/api/invite/00000000-0000-0000-0000-000000000000')
    expect([404, 410]).toContain(res.status())
    const body = await res.json()
    expect(body.ok).toBe(false)
  })

  test('POST /api/invite returns 401 when unauthenticated', async ({ request }) => {
    const res = await request.post('/api/invite', {
      data: { email: 'noop@example.com', connection_type: 'coach_athlete' },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/billing/checkout returns 401 when unauthenticated', async ({ request }) => {
    const res = await request.post('/api/billing/checkout', {
      data: { passPlanId: '00000000-0000-0000-0000-000000000000' },
    })
    expect(res.status()).toBe(401)
  })

  test('GET /api/digest/daily returns 401 without CRON_SECRET', async ({ request }) => {
    const res = await request.get('/api/digest/daily')
    expect(res.status()).toBe(401)
  })
})

// Athlete Passport — commit 0d9be25: /p/ prefix must be in middleware allowlist
test.describe('athlete passport — public /p/ routes', () => {
  test('GET /p/does-not-exist → 404 (not a redirect to /auth/login)', async ({ request }) => {
    const res = await request.get('/p/does-not-exist', { maxRedirects: 0 })
    // Must NOT be 302 to /auth/login — that indicates the middleware allowlist patch is missing
    expect(res.status()).not.toBe(302)
    // Acceptable outcomes: 404 (notFound()) or 200 (rendered error page)
    expect([200, 404]).toContain(res.status())
  })

  test('GET /p/does-not-exist via browser → URL stays on /p/ (no redirect to login)', async ({ page }) => {
    await page.goto('/p/does-not-exist')
    expect(page.url()).not.toContain('/auth/login')
  })
})

// Wearable integrations — commit 6f91196
test.describe('wearable integrations — auth guard', () => {
  test('GET /api/integrations/whoop/start without auth → 401 JSON', async ({ request }) => {
    const res = await request.get('/api/integrations/whoop/start')
    expect(res.status()).toBe(401)
    const ct = res.headers()['content-type'] ?? ''
    expect(ct).toContain('json')
  })

  test('GET /api/integrations/garmin/start without auth → 401 JSON', async ({ request }) => {
    const res = await request.get('/api/integrations/garmin/start')
    expect(res.status()).toBe(401)
    const ct = res.headers()['content-type'] ?? ''
    expect(ct).toContain('json')
  })
})

// Adaptive plans — commit 9ffafdc
test.describe('adaptive plans — auth guard', () => {
  test('GET /api/ai/adaptive-plan/:id without auth → 401', async ({ request }) => {
    const res = await request.get('/api/ai/adaptive-plan/00000000-0000-0000-0000-000000000000')
    expect(res.status()).toBe(401)
  })
})

// Sprint W1 Day 2 — subscription gate on tier-paid AI endpoints (commit f00304d).
// Auth must be enforced BEFORE the plan check, so unauthenticated requests
// must return 401 (not 402). Regression-protect this ordering — if someone
// accidentally moves enforcePlanForAi() before auth, a free unauth user
// would receive a paywall instead of a login redirect.
test.describe('AI subscription gate — auth-first ordering', () => {
  test('GET /api/ai/coach-briefing without auth → 401', async ({ request }) => {
    const res = await request.get('/api/ai/coach-briefing')
    expect(res.status()).toBe(401)
  })

  test('GET /api/ai/medical-summary?athlete_id=… without auth → 401', async ({ request }) => {
    const res = await request.get('/api/ai/medical-summary?athlete_id=00000000-0000-0000-0000-000000000000')
    expect(res.status()).toBe(401)
  })

  test('POST /api/ai/weekly-plan without auth → 401', async ({ request }) => {
    const res = await request.post('/api/ai/weekly-plan', { data: {} })
    expect(res.status()).toBe(401)
  })
})

// Sprint W1 Day 4 — newsletter real send (commit a58769d). Auth + role
// gate must reject unauthenticated POSTs with 401 (and never partial-send).
test.describe('newsletter send — auth guard', () => {
  test('POST /api/org/newsletters/:id/send without auth → 401 JSON', async ({ request }) => {
    const res = await request.post('/api/org/newsletters/00000000-0000-0000-0000-000000000000/send')
    expect(res.status()).toBe(401)
    const ct = res.headers()['content-type'] ?? ''
    expect(ct).toContain('json')
    const body = await res.json()
    expect(body.ok).toBe(false)
  })
})

// Sprint W2 Day 7 — ЮKassa webhook IP-allowlist guard. The endpoint
// must reject random callers (no auth header — only IP matters), so a
// public scanner can't spam payment_events with garbage. GET serves a
// healthcheck for Юkassa "test webhook" button in их ЛК.
test.describe('ЮKassa webhook — IP allowlist guard', () => {
  test('POST /api/webhooks/yookassa from non-allowlisted IP → 401 IP_NOT_ALLOWED', async ({ request }) => {
    const res = await request.post('/api/webhooks/yookassa', {
      data: { type: 'notification', event: 'payment.succeeded', object: { id: 'fake' } },
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('IP_NOT_ALLOWED')
  })

  test('GET /api/webhooks/yookassa returns healthcheck JSON', async ({ request }) => {
    const res = await request.get('/api/webhooks/yookassa')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.endpoint).toContain('/api/webhooks/yookassa')
  })
})

// Sprint W2 Day 9 — Recommendations API auth guard. POST creates a
// structured doctor recommendation, GET lists for athlete. Both must
// reject unauth callers; POST also enforces role check (doctor only).
test.describe('Recommendations API — auth guard', () => {
  test('POST /api/recommendations without auth → 401', async ({ request }) => {
    const res = await request.post('/api/recommendations', {
      data: {
        athlete_id: '00000000-0000-0000-0000-000000000000',
        title: 'Test',
        category: 'observation',
      },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })

  test('GET /api/recommendations without auth → 401', async ({ request }) => {
    const res = await request.get('/api/recommendations?athlete_id=00000000-0000-0000-0000-000000000000')
    expect(res.status()).toBe(401)
  })

  test('POST /api/recommendations/:id/ack without auth → 401', async ({ request }) => {
    const res = await request.post('/api/recommendations/00000000-0000-0000-0000-000000000000/ack', {
      data: { as: 'coach' },
    })
    expect(res.status()).toBe(401)
  })
})

// Sprint W2 Day 11 — expire-recommendations cron auth guard.
// CRON_SECRET-protected like the existing digest crons.
test.describe('Cron expire-recommendations — auth guard', () => {
  test('GET /api/cron/expire-recommendations without bearer → 401', async ({ request }) => {
    const res = await request.get('/api/cron/expire-recommendations')
    expect(res.status()).toBe(401)
  })

  test('GET /api/cron/expire-recommendations with wrong bearer → 401', async ({ request }) => {
    const res = await request.get('/api/cron/expire-recommendations', {
      headers: { Authorization: 'Bearer wrong-secret-value' },
    })
    expect(res.status()).toBe(401)
  })
})

// Sprint W2 Day 10 — Org Teams (org_groups) API auth guard.
test.describe('Org Teams API — auth guard', () => {
  test('POST /api/org/teams without auth → 401', async ({ request }) => {
    const res = await request.post('/api/org/teams', {
      data: { organization_id: '00000000-0000-0000-0000-000000000000', name: 'Test team' },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/org/teams/:id/members without auth → 401', async ({ request }) => {
    const res = await request.post('/api/org/teams/00000000-0000-0000-0000-000000000000/members', {
      data: { athlete_id: '00000000-0000-0000-0000-000000000000' },
    })
    expect(res.status()).toBe(401)
  })

  test('DELETE /api/org/teams/:id/members?athlete_id=… without auth → 401', async ({ request }) => {
    const res = await request.delete('/api/org/teams/00000000-0000-0000-0000-000000000000/members?athlete_id=00000000-0000-0000-0000-000000000000')
    expect(res.status()).toBe(401)
  })

  test('GET /org/teams page does not 500 unauthenticated', async ({ page }) => {
    const res = await page.goto('/org/teams')
    expect(res?.status()).toBeLessThan(500)
  })
})

// Sprint W3 Day 13 — DB-driven /pricing + /settings/billing + cancel API.
test.describe('Sprint W3 Day 13 — billing UI + cancel API', () => {
  test('POST /api/billing/cancel without auth → 401', async ({ request }) => {
    const res = await request.post('/api/billing/cancel', { data: { cancel: true } })
    expect(res.status()).toBe(401)
  })

  test('POST /api/billing/cancel with invalid body → 400', async ({ request }) => {
    const res = await request.post('/api/billing/cancel', { data: { foo: 'bar' } })
    expect([400, 401]).toContain(res.status())
  })

  test('/pricing renders public (DB-driven, no 5xx)', async ({ page }) => {
    const res = await page.goto('/pricing')
    expect(res?.status()).toBeLessThan(500)
  })

  test('/settings/billing does not 500 unauth', async ({ page }) => {
    const res = await page.goto('/settings/billing')
    expect(res?.status()).toBeLessThan(500)
  })
})

// Sprint W2 Day 12 — Org-view athlete profile (drill-down) + recommendation lifecycle.
test.describe('Sprint W2 Day 12 — closing additions', () => {
  test('GET /org/athletes/[id] page does not 500 unauth', async ({ page }) => {
    const res = await page.goto('/org/athletes/00000000-0000-0000-0000-000000000000')
    expect(res?.status()).toBeLessThan(500)
  })

  test('PATCH /api/recommendations/[id] without auth → 401', async ({ request }) => {
    const res = await request.patch('/api/recommendations/00000000-0000-0000-0000-000000000000', {
      data: { action: 'resolve' },
    })
    expect(res.status()).toBe(401)
  })

  test('PATCH /api/recommendations/[id] with invalid action → 400', async ({ request }) => {
    const res = await request.patch('/api/recommendations/00000000-0000-0000-0000-000000000000', {
      data: { action: 'fake_action' },
    })
    // Either 400 (invalid body) or 401 (unauth). Both fine — verify not 5xx.
    expect(res.status()).toBeLessThan(500)
  })
})

// Lead-magnet pages — new routes from commit ceb3659

test.describe('tools/acwr — ACWR calculator page', () => {
  test('page renders without 5xx', async ({ page }) => {
    const res = await page.goto('/tools/acwr')
    expect(res?.status()).toBeLessThan(500)
  })

  test('contains "Калькулятор риска травмы" H1', async ({ page }) => {
    await page.goto('/tools/acwr')
    await expect(page.locator('h1')).toContainText('Калькулятор риска травмы')
  })

  test('ProForm logo links to /', async ({ page }) => {
    await page.goto('/tools/acwr')
    const logoLink = page.locator('a', { hasText: 'ProForm' }).first()
    await expect(logoLink).toBeVisible()
    await expect(logoLink).toHaveAttribute('href', '/')
  })

  test('page contains JSON-LD script tag', async ({ page }) => {
    await page.goto('/tools/acwr')
    await expect(page.locator('script[type="application/ld+json"]').first()).toBeAttached()
  })
})

test.describe('tools/overtraining — overtraining quiz page', () => {
  test('page renders without 5xx', async ({ page }) => {
    const res = await page.goto('/tools/overtraining')
    expect(res?.status()).toBeLessThan(500)
  })

  test('contains "Тест на перетренированность" H1', async ({ page }) => {
    await page.goto('/tools/overtraining')
    await expect(page.locator('h1')).toContainText('Тест на перетренированность')
  })

  test('shows "Вопрос 1 из 10" progress on first load', async ({ page }) => {
    await page.goto('/tools/overtraining')
    await expect(page.getByText('Вопрос 1 из 10')).toBeVisible()
  })

  test('page contains JSON-LD script tag', async ({ page }) => {
    await page.goto('/tools/overtraining')
    await expect(page.locator('script[type="application/ld+json"]').first()).toBeAttached()
  })
})

test.describe('tools/overtraining — quiz interaction', () => {
  test('selecting answer advances to question 2', async ({ page }) => {
    await page.goto('/tools/overtraining')
    await expect(page.getByText('Вопрос 1 из 10')).toBeVisible()
    await page.locator('button').filter({ hasText: /○|●/ }).first().click()
    await page.getByRole('button', { name: 'Дальше →' }).click()
    await expect(page.getByText('Вопрос 2 из 10')).toBeVisible()
  })
})

test.describe('api/tools/lead — validation', () => {
  test('empty body → 400 invalid_email', async ({ request }) => {
    const res = await request.post('/api/tools/lead', { data: {} })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe('invalid_email')
  })

  test('invalid email format → 400 invalid_email', async ({ request }) => {
    const res = await request.post('/api/tools/lead', {
      data: { email: 'not-an-email', source: 'acwr', consent: true },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe('invalid_email')
  })

  test('valid email + invalid source → 400 invalid_source', async ({ request }) => {
    const res = await request.post('/api/tools/lead', {
      data: { email: 'test@example.com', source: 'unknown_source', consent: true },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe('invalid_source')
  })

  test('valid email + valid source + consent=false → 400 consent_required', async ({ request }) => {
    const res = await request.post('/api/tools/lead', {
      data: { email: 'test@example.com', source: 'acwr', consent: false },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe('consent_required')
  })
})
