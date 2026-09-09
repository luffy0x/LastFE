# Responsive UI Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the current search, submission, territory, and map DOM to a coherent responsive layout from 320px through 1440px, including short mobile screens.

**Architecture:** Keep the existing React structure and tactical visual language. Reconcile stale global selectors with the current BEM class names, establish one shared form-control baseline, and use width plus height media queries for HUD geometry. Add Playwright geometry checks for rendered behavior instead of testing CSS source text.

**Tech Stack:** Next.js 16, React 19, CSS, Playwright, Vitest

**Spec:** `docs/superpowers/specs/2026-09-01-interview-resource-sharing-design.md`

## Global Constraints

- Preserve the existing dark tactical map direction and current color tokens.
- Pointer targets are at least 44 by 44 CSS pixels for primary controls.
- Mobile form text is at least 16px to avoid browser focus zoom.
- Desktop territory panels occupy 42% to 62% of the viewport; below 768px they occupy the full width.
- Do not overwrite unrelated Markdown renderer or content changes already present in the worktree.

---

### Task 1: Add rendered layout regressions

**Files:**
- Create: `web/e2e/ui-layout.spec.ts`

**Interfaces:**
- Consumes: current routes and semantic labels.
- Produces: geometry and computed-style assertions for search, submission, territory, and responsive map layouts.

- [x] Write Playwright assertions for dialog fit, 44px controls, submission structure, short-screen HUD collision, tablet map labels, and panel width.
- [x] Stop the audit development server and run `pnpm exec playwright test e2e/ui-layout.spec.ts` to confirm the assertions fail for the observed defects.

### Task 2: Reconcile current DOM and CSS

**Files:**
- Modify: `web/src/app/globals.css`
- Modify if required for map fitting: `web/src/features/map/components/StrategicMap.tsx`

**Interfaces:**
- Consumes: existing BEM classes in `GlobalSearch`, submission routes, `TerritoryPanel`, and `SubmissionForm`.
- Produces: styled current DOM with obsolete selector dependencies removed.

- [x] Add complete dialog, directory, completion, pagination, and form-control rules.
- [x] Correct the search trigger grid, short-height HUD positions, tablet panel width, and map fitting behavior.
- [x] Run the new Playwright file until it passes.

### Task 3: Verify the full project

**Files:**
- Modify only if a regression is exposed by validation.

**Interfaces:**
- Consumes: repaired UI and regression suite.
- Produces: browser and static-check evidence for handoff.

- [x] Run `pnpm lint`, `pnpm typecheck`, `pnpm test --run`, and the full Playwright suite.
- [x] Render 320, 375, 768, 1024, and 1440px states, plus 375 by 375, and inspect screenshots for clipping, overlap, and accidental horizontal scrolling.
