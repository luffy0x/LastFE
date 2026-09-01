import { describe, expect, it, vi } from "vitest";

import {
  createReconciliationCursorStore,
  openDatabase,
} from "@/server/db/client";
import { migrate } from "@/server/db/migrate";

import {
  reconcileFromCursor,
  reconcileIssues,
  type GitHubIssueSnapshot,
  type ReconcileDependencies,
} from "./reconcile";

const changedIssue = (number: number, updatedAt = `2026-09-01T08:0${number}:00.000Z`): GitHubIssueSnapshot => ({
  number,
  title: `[interview] submission-${number}`,
  body: "encoded-test-body",
  labels: ["submission", "approved"],
  state: "open",
  createdAt: "2026-09-01T08:00:00.000Z",
  updatedAt,
  review: {
    source: "reconciliation",
    latestRelevantEvent: {
      id: `event-${number}`,
      action: "labeled",
      label: "approved",
      createdAt: updatedAt,
    },
  },
});

const basicIssue = (number: number, updatedAt = `2026-09-01T08:0${number}:00.000Z`) => ({
  number,
  title: `[interview] submission-${number}`,
  body: "encoded-test-body",
  labels: ["submission", "approved"],
  state: "open" as const,
  createdAt: "2026-09-01T08:00:00.000Z",
  updatedAt,
});

const enrichExistingIssue = async (
  issue: Omit<GitHubIssueSnapshot, "review">,
): Promise<GitHubIssueSnapshot> => issue as GitHubIssueSnapshot;

const TEST_RECONCILE_DEPS: ReconcileDependencies = {
  since: "2026-09-01T07:00:00.000Z",
  listIssues: vi
    .fn()
    .mockResolvedValueOnce([changedIssue(1), changedIssue(2), changedIssue(3)])
    .mockResolvedValueOnce([]),
  enrichIssue: enrichExistingIssue,
  syncIssue: vi
    .fn()
    .mockResolvedValueOnce("published")
    .mockResolvedValueOnce("withdrawn")
    .mockRejectedValueOnce(new Error("temporary upstream failure")),
};

describe("reconcileIssues", () => {
  it("syncs every changed submission issue and reports failures", async () => {
    const report = await reconcileIssues(TEST_RECONCILE_DEPS);

    expect(report).toEqual({
      scanned: 3,
      synced: 2,
      failed: 1,
      failures: [{ issueNumber: 3, category: "UNKNOWN" }],
    });
    expect(TEST_RECONCILE_DEPS.syncIssue).toHaveBeenCalledTimes(3);
    expect(TEST_RECONCILE_DEPS.syncIssue).toHaveBeenNthCalledWith(
      1,
      changedIssue(1),
      expect.stringMatching(
        /^reconcile:1:2026-09-01T08:01:00\.000Z:[a-f0-9]{64}$/,
      ),
    );
  });

  it("uses pages of exactly 100 and stops before an issue older than the cursor", async () => {
    const listIssues = vi.fn().mockResolvedValue([
      changedIssue(4, "2026-09-01T08:04:00.000Z"),
      changedIssue(3, "2026-09-01T06:59:59.999Z"),
      changedIssue(2, "2026-09-01T06:58:00.000Z"),
    ]);
    const syncIssue = vi.fn(async () => "published" as const);

    await expect(
      reconcileIssues({
        since: "2026-09-01T07:00:00.000Z",
        listIssues,
        enrichIssue: enrichExistingIssue,
        syncIssue,
      }),
    ).resolves.toEqual({ scanned: 1, synced: 1, failed: 0, failures: [] });
    expect(listIssues).toHaveBeenCalledExactlyOnceWith(1, 100);
    expect(syncIssue).toHaveBeenCalledExactlyOnceWith(
      changedIssue(4, "2026-09-01T08:04:00.000Z"),
      expect.stringMatching(
        /^reconcile:4:2026-09-01T08:04:00\.000Z:[a-f0-9]{64}$/,
      ),
    );
  });

  it("continues with later issues when one snapshot has an invalid update timestamp", async () => {
    const validIssue = changedIssue(5, "2026-09-01T08:05:00.000Z");
    const syncIssue = vi.fn().mockResolvedValue("published");

    await expect(
      reconcileIssues({
        since: "2026-09-01T07:00:00.000Z",
        listIssues: vi
          .fn()
          .mockResolvedValueOnce([
            changedIssue(4, "not-a-timestamp"),
            validIssue,
          ])
          .mockResolvedValueOnce([]),
        enrichIssue: enrichExistingIssue,
        syncIssue,
      }),
    ).resolves.toEqual({
      scanned: 2,
      synced: 1,
      failed: 1,
      failures: [{ issueNumber: 4, category: "INVALID_TIMESTAMP" }],
    });
    expect(syncIssue).toHaveBeenCalledExactlyOnceWith(
      validIssue,
      expect.stringMatching(
        /^reconcile:5:2026-09-01T08:05:00\.000Z:[a-f0-9]{64}$/,
      ),
    );
  });

  it("uses distinct opaque delivery identities for different same-second snapshots", async () => {
    const updatedAt = "2026-09-01T08:05:00.000Z";
    const removedUnpublish: GitHubIssueSnapshot = {
      ...changedIssue(8, updatedAt),
      title: "private title must not enter the delivery id",
      body: "private body and https://private.example/issue/8",
      review: {
        source: "reconciliation",
        latestRelevantEvent: {
          id: "event-unpublish-removed",
          action: "unlabeled",
          label: "unpublish",
          createdAt: updatedAt,
        },
      },
    };
    const reapproved: GitHubIssueSnapshot = {
      ...removedUnpublish,
      review: {
        source: "reconciliation",
        latestRelevantEvent: {
          id: "event-approved-again",
          action: "labeled",
          label: "approved",
          createdAt: updatedAt,
        },
      },
    };
    const syncIssue = vi.fn().mockResolvedValue("published");

    await reconcileIssues({
      since: "2026-09-01T07:00:00.000Z",
      listIssues: vi
        .fn()
        .mockResolvedValueOnce([removedUnpublish, reapproved])
        .mockResolvedValueOnce([]),
      enrichIssue: enrichExistingIssue,
      syncIssue,
    });

    const deliveryIds = syncIssue.mock.calls.map(([, deliveryId]) => deliveryId);
    expect(new Set(deliveryIds).size).toBe(2);
    for (const deliveryId of deliveryIds) {
      expect(deliveryId).toMatch(
        /^reconcile:8:2026-09-01T08:05:00\.000Z:[a-f0-9]{64}$/,
      );
      expect(deliveryId).not.toContain("private");
      expect(deliveryId).not.toContain("https://");
    }
  });

  it("emits only the issue number and safe category at the operator boundary", async () => {
    const onFailure = vi.fn();
    const privateIssue = {
      ...changedIssue(12, "2026-09-01T08:12:00.000Z"),
      title: "private title",
      body: "private body with token and https://private.example/12",
    };
    const dependencies = {
      since: "2026-09-01T07:00:00.000Z",
      listIssues: vi
        .fn()
        .mockResolvedValueOnce([privateIssue])
        .mockResolvedValueOnce([]),
      enrichIssue: enrichExistingIssue,
      syncIssue: vi.fn().mockRejectedValue(
        Object.assign(new Error(privateIssue.body), { code: "DATABASE" }),
      ),
      onFailure,
    };

    await reconcileIssues(dependencies);

    expect(onFailure).toHaveBeenCalledExactlyOnceWith({
      issueNumber: 12,
      category: "DATABASE",
    });
    expect(JSON.stringify(onFailure.mock.calls)).not.toContain("private");
    expect(JSON.stringify(onFailure.mock.calls)).not.toContain("token");
    expect(JSON.stringify(onFailure.mock.calls)).not.toContain("https://");
  });
});

describe("reconcileFromCursor", () => {
  it("keeps processing later issues when history enrichment failure", async () => {
    const database = openDatabase(":memory:");
    migrate(database);
    const cursorStore = createReconciliationCursorStore(database);
    await cursorStore.write("github-issues", "2026-09-01T08:00:00.000Z");
    const issue41 = basicIssue(41, "2026-09-01T08:09:00.000Z");
    const issue42 = basicIssue(42, "2026-09-01T08:08:00.000Z");
    const enrichIssue = vi.fn(async (issue: typeof issue41) => {
      if (issue.number === 41) {
        throw Object.assign(new Error("private GitHub response"), {
          code: "GITHUB",
        });
      }
      return changedIssue(issue.number, issue.updatedAt);
    });
    const syncIssue = vi.fn().mockResolvedValue("published");

    const report = await reconcileFromCursor({
      cursorStore,
      startedAt: "2026-09-01T08:10:00.000Z",
      listIssues: vi
        .fn()
        .mockResolvedValueOnce([issue41, issue42])
        .mockResolvedValueOnce([]),
      enrichIssue,
      syncIssue,
    });

    expect(report).toEqual({
      scanned: 2,
      synced: 1,
      failed: 1,
      failures: [{ issueNumber: 41, category: "GITHUB" }],
    });
    expect(syncIssue).toHaveBeenCalledExactlyOnceWith(
      changedIssue(42, "2026-09-01T08:08:00.000Z"),
      expect.stringMatching(
        /^reconcile:42:2026-09-01T08:08:00\.000Z:[a-f0-9]{64}$/,
      ),
    );
    await expect(cursorStore.read("github-issues")).resolves.toBe(
      "2026-09-01T08:00:00.000Z",
    );
    database.close();
  });

  it("starts at the Unix epoch and advances its cursor only after a failure-free scan", async () => {
    const database = openDatabase(":memory:");
    migrate(database);
    const cursorStore = createReconciliationCursorStore(database);
    const listIssues = vi
      .fn()
      .mockResolvedValueOnce([
        changedIssue(1, "1970-01-01T00:00:00.000Z"),
      ])
      .mockResolvedValueOnce([]);

    const report = await reconcileFromCursor({
      cursorStore,
      startedAt: "2026-09-01T08:10:00.000Z",
      listIssues,
      enrichIssue: enrichExistingIssue,
      syncIssue: vi.fn().mockResolvedValue("published"),
    });

    expect(report).toEqual({
      scanned: 1,
      synced: 1,
      failed: 0,
      failures: [],
    });
    expect(listIssues).toHaveBeenNthCalledWith(1, 1, 100);
    expect(listIssues).toHaveBeenNthCalledWith(2, 2, 100);
    await expect(cursorStore.read("github-issues")).resolves.toBe(
      "2026-09-01T08:10:00.000Z",
    );
    database.close();
  });

  it("keeps the previous cursor when an individual issue synchronization fails", async () => {
    const database = openDatabase(":memory:");
    migrate(database);
    const cursorStore = createReconciliationCursorStore(database);
    await cursorStore.write("github-issues", "2026-09-01T08:00:00.000Z");

    const report = await reconcileFromCursor({
      cursorStore,
      startedAt: "2026-09-01T08:10:00.000Z",
      listIssues: vi
        .fn()
        .mockResolvedValueOnce([changedIssue(9, "2026-09-01T08:09:00.000Z")])
        .mockResolvedValueOnce([]),
      enrichIssue: enrichExistingIssue,
      syncIssue: vi.fn().mockRejectedValue(new Error("private issue body")),
    });

    expect(report).toEqual({
      scanned: 1,
      synced: 0,
      failed: 1,
      failures: [{ issueNumber: 9, category: "UNKNOWN" }],
    });
    expect(JSON.stringify(report)).not.toContain("private issue body");
    await expect(cursorStore.read("github-issues")).resolves.toBe(
      "2026-09-01T08:00:00.000Z",
    );
    database.close();
  });
});
