import "server-only";

import type { ReconciliationCursorStore } from "@/server/db/client";

import type {
  GitHubIssueSnapshot,
  SyncResult,
} from "./sync-issue";
import {
  moderationDecisionFor,
  moderationSnapshotIdentity,
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
  onFailure?(failure: ReconcileFailure): void;
};

export type ReconcileReport = {
  scanned: number;
  synced: number;
  failed: number;
  failures: readonly ReconcileFailure[];
};

export type ReconcileFailureCategory =
  | "INVALID_TIMESTAMP"
  | "INVALID_ISSUE"
  | "DATABASE"
  | "CACHE"
  | "GITHUB"
  | "WEBHOOK"
  | "UNKNOWN";

export type ReconcileFailure = {
  issueNumber: number;
  category: ReconcileFailureCategory;
};

type ReconcileFromCursorDependencies = Omit<ReconcileDependencies, "since"> & {
  cursorStore: ReconciliationCursorStore;
  startedAt: string;
};

const CURSOR_NAME = "github-issues";
const FIRST_RECONCILIATION_CURSOR = new Date(0).toISOString();
const PAGE_SIZE = 100;
const SAFE_FAILURE_CATEGORIES = new Set<ReconcileFailureCategory>([
  "INVALID_ISSUE",
  "DATABASE",
  "CACHE",
  "GITHUB",
  "WEBHOOK",
]);

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Reconciliation failed (INVALID_CURSOR)");
  }
  return parsed;
}

function reconciliationDeliveryId(issue: GitHubIssueSnapshot): string {
  const identity = moderationSnapshotIdentity(
    issue,
    moderationDecisionFor(issue),
  );
  return `reconcile:${issue.number}:${issue.updatedAt}:${identity}`;
}

function failureCategory(error: unknown): ReconcileFailureCategory {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    SAFE_FAILURE_CATEGORIES.has(error.code as ReconcileFailureCategory)
  ) {
    return error.code as ReconcileFailureCategory;
  }
  return "UNKNOWN";
}

export async function reconcileIssues(
  dependencies: ReconcileDependencies,
): Promise<ReconcileReport> {
  const since = timestamp(dependencies.since);
  let scanned = 0;
  let synced = 0;
  let failed = 0;
  const failures: ReconcileFailure[] = [];

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
        const failure = {
          issueNumber: issue.number,
          category: "INVALID_TIMESTAMP" as const,
        };
        failures.push(failure);
        dependencies.onFailure?.(failure);
        continue;
      }
      if (updatedAt < since) {
        return { scanned, synced, failed, failures };
      }

      scanned += 1;
      try {
        await dependencies.syncIssue(
          issue,
          reconciliationDeliveryId(issue),
        );
        synced += 1;
      } catch (error) {
        failed += 1;
        const failure = {
          issueNumber: issue.number,
          category: failureCategory(error),
        };
        failures.push(failure);
        dependencies.onFailure?.(failure);
      }
    }
  }

  return { scanned, synced, failed, failures };
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
    onFailure: dependencies.onFailure,
  });
  if (report.failed === 0) {
    await dependencies.cursorStore.write(CURSOR_NAME, dependencies.startedAt);
  }
  return report;
}
