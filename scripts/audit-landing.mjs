#!/usr/bin/env node
/**
 * scripts/audit-landing.mjs — W18 Day 90.
 *
 * Multi-viewport visual screenshot capture для landing pages.
 * Standalone Playwright script (не идёт через `playwright test` runner) —
 * captures full-page screenshots across 5 viewports × 6 routes.
 *
 * Use:
 *   npm run audit:screenshots                     # против production
 *   LANDING_URL=http://localhost:3000 npm run audit:screenshots  # local dev
 *
 * Output:
 *   .screenshots/{viewport}_{route}.png
 *
 * Iterate workflow:
 *   1. npm run audit:screenshots
 *   2. Open .screenshots/ — review visual problems per viewport
 *   3. Fix problems в components/landing/*
 *   4. Re-run script — compare before/after
 *
 * .screenshots/ ignored by git (large binaries, regenerable).
 *
 * Requires:
 *   - Playwright installed (@playwright/test in devDeps)
 *   - Chromium binary downloaded (`npx playwright install chromium`)
 */

import { chromium, devices } from 'playwright'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const OUT_DIR   = join(REPO_ROOT, '.screenshots')

const LANDING_URL =
  process.env.LANDING_URL?.replace(/\/$/, '') ?? 'https://proform-delta.vercel.app'

// Viewports — covers real device mix RU/CIS audience
const VIEWPORTS = [
  {
    name:     'mobile-iphone-se',
    viewport: { width: 375, height: 667 },
    isMobile: true,
    label:    'iPhone SE (smallest common mobile)',
  },
  {
    name:     'mobile-pixel-6',
    viewport: { width: 412, height: 915 },
    isMobile: true,
    label:    'Pixel 6 (mid mobile)',
  },
  {
    name:     'tablet-ipad-mini',
    viewport: { width: 768, height: 1024 },
    isMobile: false,
    label:    'iPad Mini portrait (tablet breakpoint)',
  },
  {
    name:     'desktop-1280',
    viewport: { width: 1280, height: 800 },
    isMobile: false,
    label:    'Desktop standard (most common)',
  },
  {
    name:     'desktop-1440',
    viewport: { width: 1440, height: 900 },
    isMobile: false,
    label:    'Desktop wide (premium displays)',
  },
]

const ROUTES = [
  { path: '/',                slug: 'landing' },
  { path: '/about',           slug: 'about' },
  { path: '/pricing',         slug: 'pricing' },
  { path: '/contacts',        slug: 'contacts' },
  { path: '/legal/terms',     slug: 'legal-terms' },
  { path: '/legal/privacy',   slug: 'legal-privacy' },
]

async function ensureCleanOutDir() {
  await rm(OUT_DIR, { recursive: true, force: true })
  await mkdir(OUT_DIR, { recursive: true })
}

async function captureViewport({ browser, vp }) {
  const context = await browser.newContext({
    viewport:          vp.viewport,
    isMobile:          vp.isMobile,
    hasTouch:          vp.isMobile,
    deviceScaleFactor: vp.isMobile ? 2 : 1,
    locale:            'ru-RU',
  })
  const page = await context.newPage()

  for (const route of ROUTES) {
    const filename = `${vp.name}__${route.slug}.png`
    const out = join(OUT_DIR, filename)
    try {
      await page.goto(`${LANDING_URL}${route.path}`, {
        waitUntil: 'networkidle',
        timeout:   30_000,
      })
      // Allow lazy chunks (fonts, late images) к settle
      await page.waitForTimeout(800)
      await page.screenshot({
        path:       out,
        fullPage:   true,
        animations: 'disabled',
      })
      const size = (await import('node:fs')).statSync(out).size
      console.log(`  ✓ ${filename.padEnd(48)} ${(size / 1024).toFixed(1)} kB`)
    } catch (err) {
      console.error(`  ✗ ${filename} — ${err.message}`)
    }
  }

  await context.close()
}

async function main() {
  console.log(`Target: ${LANDING_URL}`)
  console.log(`Viewports: ${VIEWPORTS.length} · Routes: ${ROUTES.length} · Total: ${VIEWPORTS.length * ROUTES.length} screenshots\n`)

  await ensureCleanOutDir()
  console.log('Launching Chromium...')
  const browser = await chromium.launch({ headless: true })

  for (const vp of VIEWPORTS) {
    console.log(`\n[${vp.name}] ${vp.label} (${vp.viewport.width}×${vp.viewport.height})`)
    await captureViewport({ browser, vp })
  }

  await browser.close()

  console.log(`\n✅ Screenshots saved к ${OUT_DIR}`)
  console.log('Review: ls -la .screenshots/  OR  open .screenshots/')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
