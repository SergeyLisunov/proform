#!/usr/bin/env node
/**
 * scripts/bundle-budget-check.mjs — W17 Day 86 (Layer 7 CI defence).
 * Rewritten W21 Day 1 for Next 16.
 *
 * Bundle-size budget enforcement. Runs `next build`, then measures bundle
 * sizes from `.next/build-manifest.json` + on-disk chunk files. Exits 1 if
 * over budget.
 *
 * Why the rewrite: Next 16 removed per-route First Load JS columns from the
 * `next build` stdout table (only route names + ○/ƒ markers remain), and does
 * NOT emit `app-build-manifest.json` (App Router per-route chunk map) at the
 * root — so accurate per-route reconstruction isn't feasible. Instead we track
 * the two highest-signal regression vectors from stable artifacts:
 *
 *   1. SHARED First Load JS baseline — `rootMainFiles` + `polyfillFiles` from
 *      build-manifest.json. Every route loads these; if they balloon, ALL
 *      routes get heavier. Highest-signal metric.
 *   2. TOTAL client chunks — sum of `.next/static/chunks/*.js`. Catches a heavy
 *      new dependency landing anywhere.
 *
 * Sizes are RAW (uncompressed) on-disk bytes — consistent for regression
 * tracking (Next's old table showed gzipped, hence smaller numbers).
 *
 * Run: `npm run check:bundle` (does its own build)
 *      `SKIP_BUILD=1 node scripts/bundle-budget-check.mjs` (reuse last .next)
 *
 * Updating budgets: document why в commit message + docs/bundle-budget.md.
 *
 * Layer 7 в [[layered CI defence — each layer catches independently]]:
 *   - Layer 0: Husky pre-commit (lint + tsc — local)
 *   - Layer 1-3: CI tsc + lint + duplicate-exports
 *   - Layer 4: branch protection
 *   - Layer 5: Vercel build SWC parity
 *   - Layer 6: sprint-wrap-check.sh
 *   - Layer 7: this script — prevents accidental bundle bloat
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const NEXT_DIR = join(REPO_ROOT, '.next')
const BUILD_MANIFEST = join(NEXT_DIR, 'build-manifest.json')
const CHUNKS_DIR = join(NEXT_DIR, 'static', 'chunks')

/**
 * Budgets in kB (RAW on-disk). Calibrated W21 Day 1 on Next 16.2.6:
 *   - shared baseline measured 527 kB → budget 650 (~23% headroom)
 *   - total chunks measured 3762 kB → budget 4600 (~22% headroom)
 * Bump deliberately + document when a justified dependency lands.
 */
const SHARED_BASELINE_KB = 650
const TOTAL_CHUNKS_KB = 4600

function runBuild() {
  console.log('Running `next build --webpack`...\n')
  try {
    // W20 Day 4 — Next 16 defaults к Turbopack; --webpack keeps proven pipeline
    // (Metronic CSS @import url('/assets/...') не резолвится Turbopack'ом).
    execSync('npx next build --webpack', {
      cwd:      REPO_ROOT,
      encoding: 'utf8',
      stdio:    'inherit',
    })
  } catch {
    console.error('\nnext build failed.')
    process.exit(1)
  }
}

function ensureBuild() {
  if (process.env.SKIP_BUILD === '1') {
    if (!existsSync(BUILD_MANIFEST)) {
      console.error(`SKIP_BUILD=1 set but ${BUILD_MANIFEST} not found. Run \`npm run build\` first.`)
      process.exit(1)
    }
    return
  }
  runBuild()
}

function sizeKb(relPathFromNext) {
  try {
    return statSync(join(NEXT_DIR, relPathFromNext)).size / 1024
  } catch {
    return 0
  }
}

/** Sum sizes of the shared First Load JS files (loaded on every route). */
function measureSharedBaseline() {
  const m = JSON.parse(readFileSync(BUILD_MANIFEST, 'utf8'))
  const files = [...(m.rootMainFiles ?? []), ...(m.polyfillFiles ?? [])]
  const totalKb = files.reduce((sum, f) => sum + sizeKb(f), 0)
  return { count: files.length, totalKb }
}

/** Sum sizes of all client JS chunks (recursively). */
function measureTotalChunks() {
  let totalKb = 0
  let count = 0
  const walk = (dir) => {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name)
      if (entry.isDirectory()) walk(p)
      else if (entry.name.endsWith('.js')) {
        totalKb += statSync(p).size / 1024
        count++
      }
    }
  }
  walk(CHUNKS_DIR)
  return { count, totalKb }
}

function row(label, valueKb, budgetKb) {
  const over = valueKb > budgetKb
  const near = !over && valueKb > budgetKb * 0.9
  const status = over
    ? `🚨 OVER BUDGET (+${(valueKb - budgetKb).toFixed(1)} kB)`
    : near
      ? `⚠️  near limit (${((valueKb / budgetKb) * 100).toFixed(0)}%)`
      : '✅ OK'
  console.log(
    label.padEnd(28),
    `${valueKb.toFixed(1)} kB`.padEnd(12),
    `${budgetKb} kB`.padEnd(10),
    status,
  )
  return over
}

ensureBuild()

if (!existsSync(BUILD_MANIFEST)) {
  console.error(`Build manifest not found at ${BUILD_MANIFEST}. Build may have failed.`)
  process.exit(1)
}

const shared = measureSharedBaseline()
const total = measureTotalChunks()

console.log('Metric'.padEnd(28), 'Size'.padEnd(12), 'Budget'.padEnd(10), 'Status')
console.log('─'.repeat(76))
const sharedOver = row(`Shared First Load (${shared.count}f)`, shared.totalKb, SHARED_BASELINE_KB)
const totalOver = row(`Total chunks (${total.count}f)`, total.totalKb, TOTAL_CHUNKS_KB)
console.log('─'.repeat(76))

const violations = (sharedOver ? 1 : 0) + (totalOver ? 1 : 0)
if (violations > 0) {
  console.error(`\n💥 ${violations} budget(s) exceeded.`)
  console.error('Fix: trim bundle OR bump budget в scripts/bundle-budget-check.mjs')
  console.error('     + document why в docs/bundle-budget.md commit message.')
  process.exit(1)
}

console.log('\n✅ Bundle within budget.')
