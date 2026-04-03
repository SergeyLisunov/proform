# Messages Centered Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Center the messages workspace within the available shell so the screen reads as a deliberate product surface instead of stretching left across the full content width.

**Architecture:** Keep the fix local to `app/messages/page.tsx`. Add one centered max-width wrapper that contains the existing hero, stats, search, and chat list so the current design and messaging logic stay intact while the page geometry becomes balanced on wide screens.

**Tech Stack:** Next.js App Router, React client component, TypeScript, Tailwind utility classes

---

### Task 1: Add the centered content rail

**Files:**
- Modify: `app/messages/page.tsx`

- [ ] Wrap the page content in a single `mx-auto` container with an explicit `max-width`.
- [ ] Keep the current internal section order and design unchanged.
- [ ] Ensure the centered wrapper still allows the chat grid and empty/loading states to fill the intended workspace width.

### Task 2: Verify and document

**Files:**
- Modify: `docs/progress-log.md`

- [ ] Add a progress-log entry for the messages centering pass.
- [ ] Run `./node_modules/.bin/eslint app/messages/page.tsx`.
- [ ] Run `npm run build`.
- [ ] Commit the pass with a focused message after verification succeeds.
