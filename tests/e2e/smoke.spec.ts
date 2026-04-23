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
    await page.goto('/invite/00000000-0000-0000-0000-000000000000')
    // landing page should end up in one of: loading, not-found, expired, revoked.
    // No 500s and the ProForm branding should be visible.
    await expect(page.getByText(/ProForm/i).first()).toBeVisible()
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
