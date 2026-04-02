# Diary Quick-Add Workout Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the athlete diary quick-add flow so adding a workout feels faster, clearer, and more productized without changing the existing save logic.

**Architecture:** Keep the work in `app/diary/page.tsx`, preserving the current athlete/coach split, `createWorkout` call, and `calendar_events` sync. Focus this pass on the athlete diary hero and `AddWorkoutDrawer`, using stronger page hierarchy, clearer sectioning, and better live feedback inside the form.

**Tech Stack:** Next.js App Router, React client components, Tailwind CSS, Supabase browser client, existing workout service helpers

---

### Task 1: Reframe the athlete diary entry point

**Files:**
- Modify: `app/diary/page.tsx`

- [ ] **Step 1: Replace the flat athlete diary header with a stronger quick-capture hero**

Add a top workspace hero for the athlete diary with:

```tsx
<section className="relative overflow-hidden rounded-[30px] border border-orange-100 bg-[radial-gradient(circle_at_top_right,_rgba(249,115,22,0.14),_transparent_36%),linear-gradient(135deg,#FFF8F1_0%,#FFFFFF_56%,#FFF4EC_100%)] p-6 shadow-sm">
  ...
</section>
```

The hero should emphasize:
- quick workout capture
- current workout count or recent activity context
- a stronger primary CTA for `Новая тренировка`

- [ ] **Step 2: Keep existing analytics and filters below the hero**

Do not rewrite the analytics block or list/grid behavior in this pass. Only improve the entry flow and page hierarchy around them.

- [ ] **Step 3: Verify the page still compiles after hero changes**

Run: `./node_modules/.bin/eslint app/diary/page.tsx`

Expected: exit code `0`

### Task 2: Redesign the add-workout drawer into a quick-capture flow

**Files:**
- Modify: `app/diary/page.tsx`

- [ ] **Step 1: Recompose `AddWorkoutDrawer` into three clear sections**

Keep the existing `DrawerForm` and submit handler, but reorganize the UI into:
- `Основное` — activity type, workout name, date, time, duration
- `Интенсивность` — strain slider, HR, calories, compact live summary
- `Контекст` — mood and notes

- [ ] **Step 2: Strengthen the selected activity state and live feedback**

Make the selected activity type visually stronger and expose live preview values such as:

```tsx
[
  form.activity_type,
  form.activity_duration_min ? `${form.activity_duration_min} мин` : 'Длительность не задана',
  form.activity_strain > 0 ? `${form.activity_strain.toFixed(1)} strain` : 'Нагрузка не задана',
]
```

- [ ] **Step 3: Improve validation and CTA presentation without changing save logic**

Keep `validate()` and `handleSubmit()` behavior intact, but make:
- required-field errors easier to scan
- sticky footer actions feel more intentional
- save state visually stronger

- [ ] **Step 4: Preserve existing create/save behavior**

Do not change:
- `createWorkout(...)`
- the follow-up `calendar_events` insert
- `onCreated(workout)` success flow

- [ ] **Step 5: Verify the page still compiles after drawer changes**

Run: `./node_modules/.bin/eslint app/diary/page.tsx`

Expected: exit code `0`

### Task 3: Final verification and progress logging

**Files:**
- Modify: `docs/progress-log.md`

- [ ] **Step 1: Document the diary quick-add pass**

Add a progress-log entry describing:
- athlete diary hero improvement
- quick-add workout drawer redesign
- preserved workout save and calendar sync behavior

- [ ] **Step 2: Run final verification**

Because this repository does not currently include a dedicated UI test harness for this flow, use the existing project verification commands:

Run: `./node_modules/.bin/eslint app/diary/page.tsx`

Expected: exit code `0`

Run: `npm run build`

Expected: exit code `0`

- [ ] **Step 3: Commit**

```bash
git add app/diary/page.tsx docs/progress-log.md docs/superpowers/plans/2026-04-02-diary-quick-add-pass.md
git commit -m "Refine diary quick add workflow"
```
