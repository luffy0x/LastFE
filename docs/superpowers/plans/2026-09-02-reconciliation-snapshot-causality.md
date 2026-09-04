# Reconciliation Snapshot Causality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent a stale withdrawal snapshot from consuming a later approval event sequence and permanently suppressing the matching reapproval snapshot.

**Architecture:** Keep the paged history fetch, but select the authoritative sequence as the event that causally establishes the listed snapshot's moderation state. A snapshot that still carries `unpublish` anchors to the newest `labeled unpublish` event; snapshots without `unpublish` keep the full latest-event reducer so removing `unpublish` alone stays hidden until a later `labeled approved` event.

**Tech Stack:** Next.js 16.3.3, React 19.2.8, TypeScript 5, better-sqlite3 13, Octokit 22, Vitest 4, Playwright 1.62.

**Spec:** `docs/superpowers/specs/2026-09-01-interview-resource-sharing-design.md`

## Global Constraints

- Public reads expose only `published` records; pending, rejected, ignored, and withdrawn records remain hidden.
- Withdrawal must take effect after `unpublish`; removing `unpublish` alone must remain withdrawn until `approved` is removed and re-added.
- Duplicate and out-of-order webhook deliveries must be deterministic, including multiple GitHub events sharing one-second timestamps.
- Missed webhooks must be recoverable by the ten-minute reconciliation command without one malformed or unavailable Issue preventing later Issues from being processed.
- Delivery identifiers and logs may contain Issue number and allowlisted categories, but never title, body, token, URL, cookie, raw response, or raw IP.
- All tests use `:memory:` or uniquely owned temporary SQLite databases. Do not access a real GitHub repository or user database.
- Do not add dependencies, push, deploy, or change the approved cold tactical UI.

---

### Task 1: Bind review-event sequence to the snapshot decision

**Files:**
- Modify: `web/src/server/github/submission-queue.ts`
- Modify: `web/src/server/github/submission-queue.test.ts`

**Interfaces:**
- Consumes: `ReconcileIssueSnapshot` plus normalized `ReviewRelevantEvent[]` from paged Issue history.
- Produces: `GitHubIssueSnapshot.review.latestRelevantEvent` whose sequence is causally compatible with the listed snapshot.
- Preserves: `GitHubSubmissionQueue.enrichReview(issue): Promise<GitHubIssueSnapshot>`, page size 100, safe `GITHUB` failures, numeric/code-point event ordering, signed transport, and downstream `ModerationOrdering.reviewSequence`.

- [ ] **Step 1: Write a failing stale-withdrawal/reapproval integration test**

In `submission-queue.test.ts`, use the real queue, `syncIssue`, and an in-memory SQLite repository. Return a stale search snapshot with `approved` and `unpublish`, then history containing these same-second events in API-independent order:

```ts
const withdrawal = {
  id: 9002,
  event: "labeled",
  label: { name: "unpublish" },
  created_at: sameSecond,
};
const laterReapproval = {
  id: 9003,
  event: "labeled",
  label: { name: "approved" },
  created_at: sameSecond,
};
```

Assert the stale withdrawal snapshot binds event `9002` and remains hidden after synchronization. Then enrich a current snapshot with `approved` but no `unpublish` against the same history, assert it binds event `9003`, synchronize it, and assert the result is `published` and publicly readable. This test must pass regardless of the API event order.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd web
pnpm test --run src/server/github/submission-queue.test.ts -t "keeps explicit same-second reapproval live after a stale withdrawal snapshot"
```

Expected: FAIL because the stale withdrawal currently consumes event `9003`, causing the genuine reapproval with the same sequence to be stale.

- [ ] **Step 3: Select a state-compatible causal event**

Retain all normalized history events long enough to choose the sequence after pagination:

```ts
function latestReviewEvent(
  events: readonly ReviewRelevantEvent[],
  predicate: (event: ReviewRelevantEvent) => boolean = () => true,
): ReviewRelevantEvent | null {
  return events
    .filter(predicate)
    .reduce<ReviewRelevantEvent | null>(
      (latest, event) => isLaterReviewEvent(event, latest) ? event : latest,
      null,
    );
}
```

For a snapshot containing `unpublish`, select the newest event where `action === "labeled" && label === "unpublish"`. For every other enriched snapshot, keep selecting the newest relevant event across `approved` and `unpublish` label/unlabel transitions. If a withdrawal snapshot has no matching `labeled unpublish` event, return `latestRelevantEvent: null`; do not invent a sequence or expose raw history in an error.

- [ ] **Step 4: Run focused queue and ordering tests and verify GREEN**

Run:

```bash
cd web
pnpm test --run src/server/github/submission-queue.test.ts src/server/github/sync-issue.test.ts src/server/content/sqlite-repository.test.ts
```

Expected: all pass, including the stale-withdrawal/current-reapproval pair, reverse arrival, explicit reapproval, mixed-case IDs, and public visibility assertions.

- [ ] **Step 5: Run full verification**

Run in `web`:

```bash
pnpm lint
pnpm typecheck
pnpm test --run
pnpm exec playwright test
pnpm build
```

Run from repository root:

```bash
git diff --check
```

Expected: zero exits; Playwright reports all 21 scenarios and owned run-directory cleanup; production build keeps `/`, `/api/search`, `/regions/[slug]`, and `/content/[id]` dynamic.

- [ ] **Step 6: Commit Task 1**

```bash
git add web/src/server/github/submission-queue.ts web/src/server/github/submission-queue.test.ts
git commit -m "fix(moderation): bind review events to snapshot state"
```

---

## Plan Self-Review

- Spec coverage: withdrawal, explicit reapproval, same-second determinism, safe history handling, and public visibility are exercised through production boundaries.
- Placeholder scan: no TBD/TODO or unspecified implementation step remains.
- Type consistency: the public queue and snapshot interfaces remain unchanged; only the selected `latestRelevantEvent` becomes state-compatible.
- Scope: no schema, CLI, transport, UI, dependency, deployment, or real external-service change.
