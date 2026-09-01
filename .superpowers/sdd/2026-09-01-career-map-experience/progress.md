# SDD ledger — plan: docs/superpowers/plans/2026-09-01-career-map-experience.md

Workspace: `C:\Users\luffy\Documents\ChatGPT\plus`
Branch: `codex/knowledge-frontier`
Task 7 continuation base: `ac03a955e4d2320dbb06a28ef3e2655aded67639`
Spec: `docs/superpowers/specs/2026-09-01-interview-resource-sharing-design.md`

Ruling: continue in the existing normal checkout on the goal-designated `codex/knowledge-frontier` branch rather than creating a linked worktree — the persistent goal requires the current branch and the tracked worktree was clean — if wrong, isolation depends on task-scoped commits and clean-status checks instead of a separate filesystem checkout.

Historical evidence: Tasks 1–6 are present in `80302aa`; the original Task 7 implementation and four screenshot baselines are present in `b2e2cdb`; later commits preserve and extend the same interfaces. The current audit therefore resumes Task 7 rather than redispatching completed Tasks 1–6.

## Pre-flight consistency scan

| Scope | Producer / consumer | Finding |
| --- | --- | --- |
| Task 3 → Task 7 | semantic SVG regions and labels → responsive screenshot gate | Gap: the labels remain semantic and keyboard-operable, but the 768px rendered baseline visibly clips three Chinese territory labels. |
| Task 4 → Task 7 | full-height SVG camera surface → four target viewport screenshots | Root cause: `viewBox="0 0 1000 600"` plus `xMidYMid slice` scales the 768×900 canvas by 1.5, leaving logical x≈244–756 while edge anchors are x=228, 232, and 759. |
| Task 5 → Task 7 | cancellable explorer motion and reset → E2E navigation | Consistent: current Playwright covers pointer, keyboard, reduced motion, destination replacement, pinch/reset, retry, Back, and explicit return. |
| Task 6 → Task 7 | map-backed routes → direct-link and return-to-map coverage | Consistent: route and focus restoration are covered without changing content contracts. |
| Task 7 self-check | screenshot baselines + horizontal-overflow assertion → manual no-clipping acceptance | Gap: `scrollWidth <= innerWidth` detects page overflow but not clipping inside an SVG using `slice`; the baseline comparison therefore canonized the defect instead of rejecting it. |

Root-cause evidence: at 768×900, live DOM bounds are `面经区 [-61.875,14.615]`, `项目区 [-55.875,20.615]`, and `算法区 [734.625,811.115]` against a 768px viewport. The 1024px and 1440px baselines contain all labels; the 375px layout intentionally relies on the equivalent territory list while keeping the central target readable.

Ruling: Task 7 is not complete until the 768px map shows all five Chinese territory labels fully inside the viewport and an E2E geometry assertion fails on the pre-fix code — this implements the plan's explicit manual-inspection criterion without requiring all five SVG labels on the 375px navigation fallback layout — if wrong, the tablet composition will reserve more breathing room than the original crop, but navigation density and the mobile fallback remain unchanged.

Tasks 1–6: complete (historical commits `80302aa..b2e2cdb`)
Task 7: complete (responsive label-containment regression, viewport fix, and four-viewport visual review recorded in `task-7-report.md`)

## Task 7 completion evidence

- RED at 768×900: the DOM-bound regression failed on `面经区 left=-61.875`, `项目区 left=-55.875`, and `算法区 right=811.114990234375`.
- GREEN at 768×900: the focused Playwright scenario passed after switching square/portrait non-mobile map viewports from `slice` to `meet`.
- Snapshot gate: `pnpm exec playwright test e2e/map-navigation.spec.ts --update-snapshots` passed 14/14; all four target baselines were inspected and only the corrected 768 image changed.
- Supporting gates: asset budget passed at 7812/32768 geometry bytes; 46/46 map tests, lint, and typecheck passed.
- Deferred exactly as instructed: complete Playwright and production build remain for controller review.
