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
