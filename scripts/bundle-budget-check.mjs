#!/usr/bin/env node
/**
 * scripts/bundle-budget-check.mjs — W17 Day 86 (Layer 7 CI defence).
 *
 * Bundle-size budget enforcement. Runs `next build`, parses route table,
 * compares each route's First Load JS against budget table. Exits 1
 * if any route exceeds budget.
 *
 * Run: `npm run check:bundle` (does its own build)
 *      `SKIP_BUILD=1 node scripts/bundle-budget-check.mjs` (reuse recent build output)
 *
 * Adding routes:
 *   1. Run `npm run build` локально
 *   2. Note new route's First Load JS column
 *   3. Add к BUDGET map with 20-30% headroom
 *   4. Update docs/bundle-budget.md table
 *
 * Updating budget:
 *   Document why budget changed в commit message + bundle-budget.md.
 *   "Accidentally bumped budget" — caught в code review.
 *
 * Layer 7 в [[layered CI defence — each layer catches independently]]:
 *   - Layer 0: Husky pre-commit (lint + tsc — local)
 *   - Layer 1-3: CI tsc + lint + duplicate-exports
 *   - Layer 4: branch protection (no merge без passing checks)
 *   - Layer 5: Vercel build SWC parity
 *   - Layer 6: sprint-wrap-check.sh (production commit alignment)
 *   - Layer 7: this script — prevents accidental bundle bloat
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const BUILD_LOG = join(REPO_ROOT, '.next/build-output.log')

/**
 * Per-route First Load JS budget (in kB).
 *
 * Categories:
 *   - Public marketing surfaces — strict budget (visitor-facing, perf-critical)
 *   - Public lead-magnet tools — moderate (functional, but acquisition entry)
 *   - Public auth — moderate (forms)
 *   - Auth-required surfaces (admin/dashboard/etc) — generous (logged-in users)
 *
 * `_default` applies к routes NOT explicitly listed. Conservative default
 * prevents new heavy routes от slipping through unnoticed.
 */
const BUDGET_KB = {
  // ── Public marketing surfaces (perf-critical) ───────────────────────
  '/':                      200,
  '/about':                 130,
  '/contacts':              130,
  '/legal/terms':           120,
  '/legal/privacy':         130,
  '/pricing':               180,

  // ── Public auth ─────────────────────────────────────────────────────
  '/auth/login':            200,
  '/auth/register':         200,

  // ── Public lead-magnet tools ────────────────────────────────────────
  '/tools/team-risk':       140,
  '/tools/adaptive-plan':   140,
  '/tools/club-audit':      140,
  '/tools/medical-summary': 140,
  '/tools/acwr':            140,
  '/tools/overtraining':    140,

  // ── SEO infrastructure (auto-generated) ─────────────────────────────
  // W20 Day 1: Next 15 reports shared framework baseline (~103 kB) as First
  // Load JS for metadata routes (Next 14 reported 0). These routes ship
  // text/XML/image — no interactive JS to users; 103 kB is baseline
  // attribution only. Budget bumped 20 → 115 (baseline + headroom).
  '/sitemap.xml':           115,
  '/robots.txt':            115,
  '/opengraph-image':       115,

  // ── Default for auth-required + dynamic routes (more generous) ──────
  _default:                 250,
}

/**
 * Hard ceiling — no route should ever exceed this regardless of budget map.
 * Catches case где developer добавил route к budget map с generous number
 * (e.g. 500 kB) что should never ship для landing-class.
 */
const HARD_CEILING_KB = 400

function pad(s, len) {
  return s.length >= len ? s : s + ' '.repeat(len - s.length)
}

function runBuild() {
  console.log('Running `next build`...\n')
  try {
    const output = execSync('npx next build', {
      cwd:      REPO_ROOT,
      encoding: 'utf8',
      stdio:    ['ignore', 'pipe', 'pipe'],
    })
    // Persist для next SKIP_BUILD=1 run
    mkdirSync(dirname(BUILD_LOG), { recursive: true })
    writeFileSync(BUILD_LOG, output)
    return output
  } catch (err) {
    console.error('next build failed:\n')
    console.error(err.stdout?.toString() ?? '')
    console.error(err.stderr?.toString() ?? '')
    process.exit(1)
  }
}

function getBuildOutput() {
  if (process.env.SKIP_BUILD === '1') {
    if (!existsSync(BUILD_LOG)) {
      console.error(`SKIP_BUILD=1 set but ${BUILD_LOG} not found. Run \`npm run build\` first.`)
      process.exit(1)
    }
    return readFileSync(BUILD_LOG, 'utf8')
  }
  return runBuild()
}

function parseKb(token) {
  // Accepts "154 kB", "4.87 kB", "0 B", "865 B"
  const m = token.match(/^(\d+(?:\.\d+)?)\s*(B|kB)$/)
  if (!m) return null
  const val = parseFloat(m[1])
  return m[2] === 'B' ? val / 1024 : val
}

function parseRoutes(output) {
  const lines = output.split('\n')
  const routes = []

  for (const line of lines) {
    // Pattern: leading whitespace, ├ or └, single icon (ƒ/○/●), route, then numbers
    // Example: "├ ○ /streaks                                              4.87 kB         154 kB"
    const m = line.match(/^[\s│]*[├└]\s+[ƒ○●]\s+(\S+)\s+(\d+(?:\.\d+)?\s*[kK]?B)\s+(\d+(?:\.\d+)?\s*[kK]?B)\s*$/)
    if (!m) continue

    const [, route, _size, firstLoadStr] = m
    const firstLoadKb = parseKb(firstLoadStr.replace(/\s+/g, ' '))
    if (firstLoadKb == null) continue

    routes.push({ route, firstLoadKb })
  }

  return routes
}

function check(routes) {
  let violations = 0
  let warnings = 0

  console.log('Route'.padEnd(42), 'First Load', 'Budget', 'Status')
  console.log('─'.repeat(76))

  for (const { route, firstLoadKb } of routes) {
    const budget    = BUDGET_KB[route] ?? BUDGET_KB._default
    const overBudget   = firstLoadKb > budget
    const overCeiling  = firstLoadKb > HARD_CEILING_KB
    const nearBudget   = !overBudget && firstLoadKb > budget * 0.9

    let status = '✅ OK'
    if (overCeiling) {
      status = `💥 HARD CEILING (>${HARD_CEILING_KB} kB)`
      violations++
    } else if (overBudget) {
      status = `🚨 OVER BUDGET (+${(firstLoadKb - budget).toFixed(1)} kB)`
      violations++
    } else if (nearBudget) {
      status = `⚠️  near limit (${((firstLoadKb / budget) * 100).toFixed(0)}%)`
      warnings++
    }

    console.log(
      pad(route, 42),
      pad(`${firstLoadKb.toFixed(1)} kB`, 11),
      pad(`${budget} kB`, 8),
      status,
    )
  }

  console.log('─'.repeat(76))
  console.log(`Routes checked: ${routes.length} · Warnings: ${warnings} · Violations: ${violations}`)

  if (violations > 0) {
    console.error(`\n💥 ${violations} route(s) exceed budget.`)
    console.error('Fix: optimize route OR update BUDGET_KB в scripts/bundle-budget-check.mjs')
    console.error('     + document why в docs/bundle-budget.md commit message.')
    process.exit(1)
  }

  console.log('\n✅ All routes within budget.')
}

const output = getBuildOutput()
const routes = parseRoutes(output)

if (routes.length === 0) {
  console.error('No routes parsed from build output. Output snippet:')
  console.error(output.split('\n').slice(-20).join('\n'))
  process.exit(1)
}

check(routes)
