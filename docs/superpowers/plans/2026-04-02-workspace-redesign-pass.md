# Workspace Redesign Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `analytics`, `org`, and `settings` screens into a more consistent Metronic-style workspace while preserving existing data flows and route logic.

**Architecture:** Keep each screen in its existing route file, but reshape the page-level composition around a hero, summary strip, and stronger card hierarchy. Preserve existing Supabase reads/writes and chart data sources, only tightening page structure, status messaging, and action layout.

**Tech Stack:** Next.js App Router, React client components, Tailwind CSS, Supabase SSR/browser client, ApexCharts

---

### Task 1: Redesign the analytics workspace shell

**Files:**
- Modify: `app/analytics/page.tsx`

- [ ] **Step 1: Rework the coach and athlete page headers into workspace heroes**

Use page-level wrappers that introduce:

```tsx
<div className="flex flex-col gap-6 pf-enter">
  <section className="rounded-[28px] border border-orange-100 bg-[linear-gradient(135deg,#FFF7ED_0%,#FFFFFF_55%,#FFF5F0_100%)] p-6 shadow-sm">
    ...
  </section>
</div>
```

- [ ] **Step 2: Add summary strips and insight cards above the charts**

Use compact KPI cards and insight chips to frame the charts before the chart grid:

```tsx
<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
  {summaryCards.map((card) => (
    <div key={card.label} className="rounded-2xl border border-border bg-card p-4">...</div>
  ))}
</div>
```

- [ ] **Step 3: Recompose the chart grid into clearer story blocks**

Group charts into trend, comparison, and outcomes sections with supporting copy and side panels, while preserving the existing Apex/ZoneBar data.

- [ ] **Step 4: Verify the page compiles cleanly**

Run: `./node_modules/.bin/eslint app/analytics/page.tsx`

Expected: exit code `0`

- [ ] **Step 5: Commit**

```bash
git add app/analytics/page.tsx
git commit -m "Refine analytics workspace hierarchy"
```

### Task 2: Redesign the organization workspace shell

**Files:**
- Modify: `app/org/page.tsx`

- [ ] **Step 1: Replace the flat header with an organization command-center hero**

Add a top hero with organization identity, verified state, public-page CTA, and operations-oriented summary copy.

- [ ] **Step 2: Add a stronger KPI strip and action rail**

Keep the current counts and routes, but present them as a denser overview row plus faster action cards.

- [ ] **Step 3: Recompose posts and newsletters into more intentional workspace cards**

Preserve current data loading and empty states while improving hierarchy, badges, metadata, and per-row affordances.

- [ ] **Step 4: Verify the page compiles cleanly**

Run: `./node_modules/.bin/eslint app/org/page.tsx`

Expected: exit code `0`

- [ ] **Step 5: Commit**

```bash
git add app/org/page.tsx
git commit -m "Refine organization workspace shell"
```

### Task 3: Redesign the settings workspace shell

**Files:**
- Modify: `app/settings/page.tsx`

- [ ] **Step 1: Keep the current form logic but reshape the page around a hero and side navigation**

Add a page shell with:

```tsx
<div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
  <aside>...</aside>
  <section>...</section>
</div>
```

- [ ] **Step 2: Replace the most prominent inline-style wrappers with Tailwind-based layout cards**

Focus on page-level wrappers, navigation, save state, section cards, and password/security presentation. Do not rewrite the actual Supabase save flow.

- [ ] **Step 3: Improve completion, save, and privacy feedback**

Expose completion, current section context, and save state more clearly while keeping the current form state model intact.

- [ ] **Step 4: Verify the page compiles cleanly**

Run: `./node_modules/.bin/eslint app/settings/page.tsx`

Expected: exit code `0`

- [ ] **Step 5: Commit**

```bash
git add app/settings/page.tsx
git commit -m "Refine settings workspace shell"
```

### Task 4: Final verification and progress logging

**Files:**
- Modify: `docs/progress-log.md`

- [ ] **Step 1: Document the redesign pass**

Add a dated progress-log entry describing the analytics, org, and settings workspace improvements.

- [ ] **Step 2: Run final verification**

Run: `./node_modules/.bin/eslint app/analytics/page.tsx app/org/page.tsx app/settings/page.tsx`

Expected: exit code `0`

Run: `npm run build`

Expected: exit code `0`

- [ ] **Step 3: Commit**

```bash
git add docs/progress-log.md app/analytics/page.tsx app/org/page.tsx app/settings/page.tsx
git commit -m "Refine analytics org and settings workspaces"
```
