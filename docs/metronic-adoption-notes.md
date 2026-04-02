# Metronic Adoption Notes

## Source kit

- Archive reviewed: `/Users/sergeylisunov/Downloads/metronic-tailwind-html-starter-kit.zip`
- Extracted for inspection to: `/tmp/metronic-tailwind-kit/metronic-tailwind-html-starter-kit`
- Kit version: `Metronic 9.4.6`
- Tech profile: Tailwind 4 HTML toolkit with bundled `KTUI`, ApexCharts, FullCalendar, and KeenIcons

## Integration principle

ProForm already runs on `Next.js 14 + Tailwind 3 + Supabase`. Because the Metronic archive is an HTML starter kit, we should not import its full runtime stack into the app. The safer path is:

1. Reuse layout composition, spacing rules, card structure, nav patterns, and CTA hierarchy.
2. Recreate useful pieces as native React/Next components in the current design system.
3. Keep vendor JS out unless a capability is missing from the existing stack.

## Chosen references

### Auth and onboarding

- Primary references:
  - `/tmp/metronic-tailwind-kit/metronic-tailwind-html-starter-kit/dist/html/layout-1/index.html`
  - `/tmp/metronic-tailwind-kit/metronic-tailwind-html-starter-kit/dist/html/layout-10/index.html`
- Why:
  - strongest branded/auth grouping
  - compact form shells that fit the current ProForm login/register flow
  - clear separation between marketing narrative and action area

### Main application shell

- Primary references:
  - `/tmp/metronic-tailwind-kit/metronic-tailwind-html-starter-kit/dist/html/layout-9/index.html`
  - `/tmp/metronic-tailwind-kit/metronic-tailwind-html-starter-kit/dist/html/layout-1/index.html`
- Why:
  - better information density for athlete and coach dashboards
  - stronger activity feed and metrics-card composition
  - useful side navigation and section rhythm for data-heavy screens

### Calendar and event views

- Primary references:
  - `/tmp/metronic-tailwind-kit/metronic-tailwind-html-starter-kit/dist/html/layout-14/index.html`
  - `/tmp/metronic-tailwind-kit/metronic-tailwind-html-starter-kit/dist/html/layout-7/index.html`
- Why:
  - clearer “events / schedule / calendar” navigation language
  - stronger toolbar and utility-action patterns
  - relevant event-oriented iconography and page framing

## Immediate next UI passes

1. Refactor `Sidebar` to a more Metronic-like navigation shell with clearer grouping and role context.
2. Recompose `/dashboard` to increase hierarchy between KPIs, recovery state, recent activity, and coach alerts.
3. Rework `/calendar` top controls and event cards using the selected event/calendar references.
