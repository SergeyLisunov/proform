# Sprint W20 wrap — Next.js 14 → 16 Security Upgrade

> Closed 2026-05-28. PRs #126–#129 (+ wrap). Theme: security-critical major upgrade.
> Production live on Next 16.2.6, npm audit 0 vulnerabilities.

## Tagline

«14.x был EOL — 14 runtime advisories (DoS/XSS/SSRF/cache-poison) только в 15+.
W20 поднял Next 14.2.35 → 15.3.9 → 16.2.6 + React 18 → 19. Код-миграция прошла
гладко (5 файлов async params + 1 ssr:false wrapper), но **deploy выявил 2
платформенных блокера** которые local + CI build не ловили — Vercel имеет свои
контуры (buildCommand + plan limits). Production на Next 16, 0 vulnerabilities.»

## Day-by-day

| Day | PR | Тема |
|---|---|---|
| 1-2 | #126 | Next 14.2.35 → 15.3.9 + React 19 + async params (2 pages + 8 API routes) + ssr:false→ClientOverlays |
| 4 | #127 | Next 15 → 16.2.6 + postcss override (0 vulns) + --webpack scripts + eslint key removed |
| 4 | #128 | 🔴 hotfix — vercel.json buildCommand → --webpack (Turbopack CSS блокер) |
| 4 | #129 | 🔴 hotfix — opengraph-image edge → nodejs (1.15MB > 1MB edge limit) |
| 5 | — | W20 wrap |

## Architecture wins

### 1. Security goal достигнут — 0 vulnerabilities
`npm audit`: 14 Next.js runtime advisories + postcss → **0**. Все DoS/XSS/SSRF/
cache-poison закрыты. Production на 16.2.6.

### 2. Incremental 15→16 path снизил риск
Сначала 15 (стабилизировать, merge, production-validate), потом 16. Каждый major
отдельным PR. Когда 16 deploy сломался, 15 уже был на production как safety net.

### 3. Код-миграция меньше чем боялись
Breaking surface = 5 server components (async params) + 1 cookies (уже awaited)
+ 1 layout ssr:false. React 19 types — 0 tsc errors. Deps все React-19-ready
(open peer ranges). Официальный codemod автоматизировал 8 API routes.

### 4. Deploy incident debugging via Vercel MCP
2 платформенных блокера диагностированы через build logs + `vercel inspect`:
Turbopack CSS resolution + edge function size limit. См.
[[три build-контура должны согласоваться local CI Vercel]].

### 5. Production никогда не лежал
4 неудачных Next 16 deploy attempt — production всё время на Next 15 (Vercel
держит last-good). Zero downtime во время turbulent upgrade.

## Метрики до/после

| Метрика | До W20 | После W20 |
|---|---|---|
| Next.js | 14.2.35 (EOL) | **16.2.6** |
| React | 18.3.1 | **19** |
| npm audit | 1 high (14 advisories) + 1 moderate | **0 vulnerabilities** |
| Production runtime | Next 14 | Next 16, live |
| Build bundler | webpack (default) | webpack (--webpack, Turbopack deferred) |
| OG image | edge runtime | nodejs (static prerender) |
| Migrations | 78 | 78 (0) |
| tsc errors | 0 | 0 |

## Surprises of W20

### 1. Три build-контура разошлись
Local `npm run build` + GitHub Actions (оба `--webpack`) были зелёные. Но Vercel
использует СВОЙ `vercel.json buildCommand` (был голый `next build` → Turbopack).
Major-upgrade нужно валидировать на фактической deploy-платформе.

### 2. Edge function size limit (Hobby 1MB)
После fix #1, deploy всё равно упал: opengraph-image edge bundle 1.15MB > 1MB.
Next 16 + React 19 раздули edge bundle. Fix: edge → nodejs runtime (250MB limit).

### 3. #128 смержился до готовности #129
#128 (vercel.json fix) merged когда я ещё диагностировал edge-блокер. Production
deploy #128 упал на OG limit. #129 добил второй блокер. Lesson: не мержить
deploy-fix пока не подтверждён ПОЛНЫЙ green deploy.

### 4. Next 16 убрал per-route sizes из build output
bundle-budget парсер сломался (text-parse не находит sizes). Graceful degradation
(build gate сохранён, budget skipped с warning). Rewrite → W21.

### 5. Vercel игнорирует package.json --webpack
package.json `build` script не используется Vercel'ом — только vercel.json
buildCommand. Три места должны согласованно указывать bundler.

## Pre-wrap deploy verification

- [x] #126–#129 merged, main @ 87461df
- [x] Production deploy READY on Next 16.2.6 (87461df)
- [x] `npm audit` → 0 vulnerabilities
- [x] Production smoke: landing 200, OG image 200 (png 92KB), HSTS + X-Frame headers, /auth/login 200
- [x] tsc 0 errors, build green
- [x] Zero downtime (production on Next 15 throughout failed attempts)

## W21 candidates

| Кандидат | Скоуп | Приоритет |
|---|---|---|
| **Turbopack migration** | move Metronic `@import url('/assets/...')` к `<link>` tags → build на Turbopack natively, drop `--webpack` (3 контура) | medium |
| **bundle-budget parser rewrite** | parse `.next/app-build-manifest.json` (Next 16 убрал stdout sizes) | medium |
| **middleware → proxy rename** | Next 16 deprecation warning (non-fatal) | low |
| **ESLint gate enable** | flip ignoreDuringBuilds, fix rules-of-hooks + unescaped entities | medium |
| **Lighthouse baseline** | 7-sprint defer | low |
| **I2/I5 audit carryover** | DB VIEW redaction + duplicate notification refactor | medium |

## Связанные

- [[2026-05-28 Sprint W19 закрыт]] ← Next 14.x EOL discovery + research
- [[Next 14.x EOL — runtime vulns требуют 15+ upgrade]] ← W19 decision, executed W20
- [[functional verify не равен structural verify]] ← W18 pattern; W20 extends к deploy-платформе
- [[Sprint W21 план]] ← Turbopack + tooling debt
