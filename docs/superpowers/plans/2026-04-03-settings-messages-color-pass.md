# Settings Messages Color Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the compact `settings` header closer to the `messages` color language without reintroducing the large gradient hero.

**Architecture:** Keep the current compact header structure intact and only update its visual treatment. Reuse the warm gradient and orange accent logic already proven on the `messages` page while preserving compact typography and the single-save flow.

**Tech Stack:** Next.js App Router, React, Tailwind utility classes, existing ProForm design tokens

---

### Task 1: Refresh the compact settings header styling

**Files:**
- Modify: `/Users/sergeylisunov/Documents/Playground/proform/app/settings/page.tsx`
- Test: `/Users/sergeylisunov/Documents/Playground/proform/app/settings/page.tsx`

- [ ] Step 1: Update the top header card classes to use a warm `messages`-style gradient surface while keeping the compact rounded card geometry.
- [ ] Step 2: Restyle the back button and chips so they inherit the orange accent language from `messages` without expanding the layout.
- [ ] Step 3: Give the helper completion copy a soft tinted inline surface instead of plain text.
- [ ] Step 4: Run `./node_modules/.bin/eslint app/settings/page.tsx` from `/Users/sergeylisunov/Documents/Playground/proform` and verify it passes.
- [ ] Step 5: Run `npm run build` from `/Users/sergeylisunov/Documents/Playground/proform` and verify the build passes.
- [ ] Step 6: Commit the change with a message describing the settings header color refresh.
