# Moderation Ordering Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the remaining same-second moderation ordering ambiguity and ensure one GitHub history failure cannot abort reconciliation of later Issues.

**Architecture:** Keep webhook snapshots conservative and let authoritative reconciliation resolve same-second ambiguity with a persisted GitHub review-event sequence `(createdAt, eventId)`. Separate paged Issue listing from per-Issue history enrichment so each enrichment and synchronization runs inside the existing per-Issue failure boundary.

**Tech Stack:** Next.js 16.3.3, React 19.2.8, TypeScript 5, better-sqlite3 13, Octokit 22, Vitest 4, Playwright 1.62.

**Spec:** `docs/superpowers/specs/2026-09-01-interview-resource-sharing-design.md`

## Global Constraints

- Public reads expose only `published` records; pending, rejected, ignored, and withdrawn records remain hidden.
- Withdrawal must take effect after `unpublish`; removing `unpublish` alone must remain withdrawn until `approved` is removed and re-added.
- Duplicate and out-of-order webhook deliveries must be deterministic, including multiple GitHub events sharing one-second timestamps.
- Missed webhooks must be recoverable by the ten-minute reconciliation command without one malformed or unavailable Issue preventing later Issues from being processed.
- Delivery identifiers and logs may contain Issue number and allowlisted categories, but never title, body, token, URL, cookie, raw response, or raw IP.
- SQLite schema upgrades must preserve v1/v2 databases, be transactional, and be safe to rerun.
- All tests use `:memory:` or uniquely owned temporary SQLite databases. Do not access a real GitHub repository or user database.
- Do not add dependencies, push, deploy, or change the approved cold tactical UI.

---

### Task 1: Persist a deterministic authoritative review-event sequence

**Files:**
- Create: `web/src/server/db/migrations/0003-moderation-sequence.ts`
- Modify: `web/src/server/db/migrate.ts`
- Modify: `web/src/server/db/migrate.test.ts`
- Modify: `web/src/server/content/sqlite-repository.ts`
- Modify: `web/src/server/content/sqlite-repository.test.ts`
- Modify: `web/src/server/github/sync-issue.ts`
- Modify: `web/src/server/github/sync-issue.test.ts`

**Interfaces:**
- Consumes: `GitHubIssueSnapshot.review.latestRelevantEvent = { id, action, label, createdAt } | null` for reconciliation snapshots.
- Produces: `ModerationOrdering.reviewSequence: { createdAt: string; eventId: string } | null` in addition to `updatedAt`, `snapshotIdentity`, and `authoritative`.
- Produces: persisted nullable `review_event_created_at` and `review_event_id` columns in `moderation_issue_states`.
- Preserves: `ContentModerationStore.apply(command): Promise<"applied" | "duplicate" | "stale">`.

- [ ] **Step 1: Write failing repository tests for reversed same-second authoritative delivery**

Add a test that applies authoritative `withdraw` with sequence `{ createdAt: SAME_SECOND, eventId: "9002" }`, then an authoritative `publish` with the same `updatedAt` but sequence event ID `"9001"`. Assert the second call returns `"stale"` and the public repository remains empty. Add the inverse arrival test and assert the newer event ID wins regardless of arrival order.

```ts
const sameSecond = "2026-09-01T10:00:00.000Z";
const olderApproval = {
  updatedAt: sameSecond,
  snapshotIdentity: "approval-9001",
  authoritative: true,
  reviewSequence: { createdAt: sameSecond, eventId: "9001" },
};
const newerWithdrawal = {
  updatedAt: sameSecond,
  snapshotIdentity: "withdrawal-9002",
  authoritative: true,
  reviewSequence: { createdAt: sameSecond, eventId: "9002" },
};
```

- [ ] **Step 2: Run the focused repository test and verify RED**

Run: `cd web; pnpm test --run src/server/content/sqlite-repository.test.ts -t "same-second authoritative sequence"`

Expected: FAIL because different authoritative hashes currently overwrite by arrival order and `ModerationOrdering` has no persisted event sequence.

- [ ] **Step 3: Write failing synchronization tests for sequence propagation**

Create two reconciliation snapshots at the same `updatedAt`, with latest relevant events `9001` approved and `9002` unpublish/withdrawal. Assert the generated moderation commands carry the exact sequence and that `9002` remains authoritative when the snapshots are delivered in reverse order.

```ts
expect(moderation.apply).toHaveBeenCalledWith(
  expect.objectContaining({
    ordering: expect.objectContaining({
      reviewSequence: {
        createdAt: "2026-09-01T10:00:00.000Z",
        eventId: "9002",
      },
    }),
  }),
);
```

- [ ] **Step 4: Run the focused synchronization test and verify RED**

Run: `cd web; pnpm test --run src/server/github/sync-issue.test.ts -t "same-second authoritative sequence"`

Expected: FAIL because the review-event sequence is not part of `ModerationOrdering`.

- [ ] **Step 5: Add migration v3 and deterministic comparison**

Add nullable sequence columns without rewriting content rows:

```sql
ALTER TABLE moderation_issue_states ADD COLUMN review_event_created_at TEXT;
ALTER TABLE moderation_issue_states ADD COLUMN review_event_id TEXT;
```

Register v3 through the existing transactional migration runner. Extend `ModerationOrdering` with `reviewSequence`. For equal `updatedAt` values, use these rules in order:

1. non-authoritative incoming snapshots never replace a current same-second state;
2. authoritative snapshots replace a non-authoritative same-second state;
3. when both are authoritative and both carry sequences, compare `createdAt`, then compare decimal event IDs numerically (`BigInt`) with lexical fallback for non-decimal IDs;
4. a snapshot with a sequence outranks one without a sequence;
5. equal or older sequences are stale; never use the snapshot hash as a recency surrogate.

Derive `reviewSequence` only from reconciliation's `latestRelevantEvent`; webhook snapshots use `null`. Persist the winning sequence with the decision.

- [ ] **Step 6: Add migration upgrade, rollback, retry, and rerun tests**

Create a v2-shaped temporary database, migrate it to v3, and assert old moderation state remains while sequence columns are `NULL`. Inject a failure after the first v3 statement and assert the schema rolls back; retry and rerun must succeed exactly once.

- [ ] **Step 7: Run Task 1 focused tests and verify GREEN**

Run: `cd web; pnpm test --run src/server/db/migrate.test.ts src/server/content/sqlite-repository.test.ts src/server/github/sync-issue.test.ts`

Expected: all tests pass, including both arrival orders and the existing stale/duplicate/out-of-order cases.

- [ ] **Step 8: Commit Task 1**

```bash
git add web/src/server/db/migrations/0003-moderation-sequence.ts web/src/server/db/migrate.ts web/src/server/db/migrate.test.ts web/src/server/content/sqlite-repository.ts web/src/server/content/sqlite-repository.test.ts web/src/server/github/sync-issue.ts web/src/server/github/sync-issue.test.ts
git commit -m "fix(moderation): order same-second review events"
```

---

### Task 2: Isolate GitHub history enrichment per Issue

**Files:**
- Modify: `web/src/server/github/submission-queue.ts`
- Modify: `web/src/server/github/submission-queue.test.ts`
- Modify: `web/src/server/github/reconcile.ts`
- Modify: `web/src/server/github/reconcile.test.ts`
- Modify: `web/scripts/reconcile-github.ts`
- Modify: `web/src/server/github/reconciliation-webhook-transport.ts`
- Modify: `web/src/server/github/reconciliation-webhook-transport.test.ts`

**Interfaces:**
- Produces: `ReconcileIssueSnapshot = Omit<GitHubIssueSnapshot, "review">` from paged search.
- Produces: `GitHubSubmissionQueue.enrichReview(issue: ReconcileIssueSnapshot): Promise<GitHubIssueSnapshot>`.
- Consumes: `ReconcileDependencies.enrichIssue(issue): Promise<GitHubIssueSnapshot>` inside the per-Issue `try/catch`.
- Preserves: page size 100, updated-descending traversal, cursor rules, signed internal webhook transport, and safe `ReconcileFailure` output.

- [ ] **Step 1: Write a failing reconciliation isolation test**

Return two basic Issue snapshots from `listIssues`. Make `enrichIssue` reject for Issue 41 with an error whose allowlisted code is `GITHUB`, then resolve Issue 42 and let `syncIssue` succeed. Assert the report is exactly:

```ts
{
  scanned: 2,
  synced: 1,
  failed: 1,
  failures: [{ issueNumber: 41, category: "GITHUB" }],
}
```

Also assert Issue 42 reaches `syncIssue` and the cursor is not advanced when enrichment fails.

- [ ] **Step 2: Run the focused reconciliation test and verify RED**

Run: `cd web; pnpm test --run src/server/github/reconcile.test.ts -t "history enrichment failure"`

Expected: FAIL because history fetching currently happens inside `listIssues`, outside the per-Issue isolation boundary.

- [ ] **Step 3: Write failing queue tests for split listing/enrichment**

Assert `listSubmissionIssues(page)` performs only the server-side Issues search and does not call `issues.listEvents`. Then call `enrichReview(issue)` and assert it paginates events at 100 per page, selects the newest relevant event by `created_at` plus numeric event ID independent of API order, and returns a reconciliation snapshot. Assert an Octokit history failure becomes a safe `GITHUB`-coded error without embedding response/title/body/token/URL.

- [ ] **Step 4: Run the focused queue test and verify RED**

Run: `cd web; pnpm test --run src/server/github/submission-queue.test.ts`

Expected: FAIL because listing and event-history enrichment are currently coupled.

- [ ] **Step 5: Split listing from enrichment and move enrichment inside isolation**

Make `listSubmissionIssues` normalize only the Issue search result. Move paged `listEvents` and latest-event selection into `enrichReview`. In `reconcileIssues`, validate the basic snapshot timestamp, increment `scanned`, then call `enrichIssue` and `syncIssue` within the same per-Issue `try/catch`; compute the canonical delivery ID only after enrichment.

Wire the CLI so:

```ts
await reconcileFromCursor({
  listIssues: (page) => queue.listSubmissionIssues(page),
  enrichIssue: (issue) => queue.enrichReview(issue),
  syncIssue: webhook.syncIssue,
  // existing cursor, startedAt, and safe onFailure remain unchanged
});
```

If the signed webhook transport accepts only a full `GitHubIssueSnapshot`, keep that boundary unchanged and pass only enriched snapshots to it.

- [ ] **Step 6: Run Task 2 focused tests and verify GREEN**

Run: `cd web; pnpm test --run src/server/github/submission-queue.test.ts src/server/github/reconcile.test.ts src/server/github/reconciliation-webhook-transport.test.ts src/test/reconcile-github-cli.test.ts`

Expected: all tests pass; one history failure is reported safely and later Issues still synchronize.

- [ ] **Step 7: Run full verification**

Run in `web`:

```bash
pnpm lint
pnpm typecheck
pnpm test --run
pnpm exec playwright test
pnpm build
```

Run from repository root: `git diff --check`

Expected: zero exits; Playwright reports all 21 scenarios passing and confirms owned run-directory cleanup; production build keeps public data routes dynamic.

- [ ] **Step 8: Commit Task 2**

```bash
git add web/src/server/github/submission-queue.ts web/src/server/github/submission-queue.test.ts web/src/server/github/reconcile.ts web/src/server/github/reconcile.test.ts web/scripts/reconcile-github.ts web/src/server/github/reconciliation-webhook-transport.ts web/src/server/github/reconciliation-webhook-transport.test.ts
git commit -m "fix(moderation): isolate reconciliation history failures"
```

---

## Plan Self-Review

- Spec coverage: same-second ordering, explicit reapproval, missed-webhook recovery, per-Issue continuation, safe reporting, migration compatibility, and all required gates are mapped to Tasks 1–2.
- Placeholder scan: no TBD/TODO or unspecified implementation step remains.
- Type consistency: Task 1 produces `ModerationOrdering.reviewSequence`; Task 2 produces the enriched `GitHubIssueSnapshot` that supplies it before delivery identity calculation.
- Scope: UI, submission schemas, abuse limits, and deployment are intentionally unchanged.
