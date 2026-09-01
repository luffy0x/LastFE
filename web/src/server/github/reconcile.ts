import "server-only";

import type { ReconciliationCursorStore } from "@/server/db/client";

import type {
  GitHubIssueSnapshot,
  SyncResult,
} from "./sync-issue";

export type { GitHubIssueSnapshot } from "./sync-issue";
export type { ReconciliationCursorStore } from "@/server/db/client";

export type ReconcileDependencies = {
  since: string;
  listIssues(
    page: number,
    perPage: number,
  ): Promise<readonly GitHubIssueSnapshot[]>;
  syncIssue(issue: GitHubIssueSnapshot, deliveryId: string): Promise<SyncResult>;
};

export type ReconcileReport = {
  scanned: number;
  synced: number;
  failed: number;
};

type ReconcileFromCursorDependencies = Omit<ReconcileDependencies, "since"> & {
  cursorStore: ReconciliationCursorStore;
  startedAt: string;
};

const CURSOR_NAME = "github-issues";
const FIRST_RECONCILIATION_CURSOR = new Date(0).toISOString();
const PAGE_SIZE = 100;

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Reconciliation failed (INVALID_CURSOR)");
  }
  return parsed;
}

export async function reconcileIssues(
  dependencies: ReconcileDependencies,
): Promise<ReconcileReport> {
  const since = timestamp(dependencies.since);
  let scanned = 0;
  let synced = 0;
  let failed = 0;

  for (let page = 1; ; page += 1) {
    const issues = await dependencies.listIssues(page, PAGE_SIZE);
    if (issues.length === 0) break;

    for (const issue of issues) {
      let updatedAt: number;
      try {
        updatedAt = timestamp(issue.updatedAt);
      } catch {
        scanned += 1;
        failed += 1;
        continue;
      }
      if (updatedAt < since) {
        return { scanned, synced, failed };
      }

      scanned += 1;
      try {
        await dependencies.syncIssue(
          issue,
          `reconcile:${issue.number}:${issue.updatedAt}`,
        );
        synced += 1;
      } catch {
        failed += 1;
      }
    }
  }

  return { scanned, synced, failed };
}

export async function reconcileFromCursor(
  dependencies: ReconcileFromCursorDependencies,
): Promise<ReconcileReport> {
  timestamp(dependencies.startedAt);
  const since =
    (await dependencies.cursorStore.read(CURSOR_NAME)) ??
    FIRST_RECONCILIATION_CURSOR;
  const report = await reconcileIssues({
    since,
    listIssues: dependencies.listIssues,
    syncIssue: dependencies.syncIssue,
  });
  if (report.failed === 0) {
    await dependencies.cursorStore.write(CURSOR_NAME, dependencies.startedAt);
  }
  return report;
}
