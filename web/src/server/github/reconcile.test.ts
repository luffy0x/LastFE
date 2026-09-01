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
});

const TEST_RECONCILE_DEPS: ReconcileDependencies = {
  since: "2026-09-01T07:00:00.000Z",
  listIssues: vi
    .fn()
    .mockResolvedValueOnce([changedIssue(1), changedIssue(2), changedIssue(3)])
    .mockResolvedValueOnce([]),
  syncIssue: vi
    .fn()
    .mockResolvedValueOnce("published")
    .mockResolvedValueOnce("withdrawn")
    .mockRejectedValueOnce(new Error("temporary upstream failure")),
};

describe("reconcileIssues", () => {
  it("syncs every changed submission issue and reports failures", async () => {
    const report = await reconcileIssues(TEST_RECONCILE_DEPS);

    expect(report).toEqual({ scanned: 3, synced: 2, failed: 1 });
    expect(TEST_RECONCILE_DEPS.syncIssue).toHaveBeenCalledTimes(3);
    expect(TEST_RECONCILE_DEPS.syncIssue).toHaveBeenNthCalledWith(
      1,
      changedIssue(1),
      "reconcile:1:2026-09-01T08:01:00.000Z",
    );
  });

  it("uses pages of exactly 100 and stops before an issue older than the cursor", async () => {
    const listIssues = vi.fn().mockResolvedValue([
      changedIssue(4, "2026-09-01T08:04:00.000Z"),
      changedIssue(3, "2026-09-01T06:59:59.999Z"),
      changedIssue(2, "2026-09-01T06:58:00.000Z"),
    ]);
    const syncIssue = vi.fn().mockResolvedValue("published");

    await expect(
      reconcileIssues({
        since: "2026-09-01T07:00:00.000Z",
        listIssues,
        syncIssue,
      }),
    ).resolves.toEqual({ scanned: 1, synced: 1, failed: 0 });
    expect(listIssues).toHaveBeenCalledExactlyOnceWith(1, 100);
    expect(syncIssue).toHaveBeenCalledExactlyOnceWith(
      changedIssue(4, "2026-09-01T08:04:00.000Z"),
      "reconcile:4:2026-09-01T08:04:00.000Z",
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
        syncIssue,
      }),
    ).resolves.toEqual({ scanned: 2, synced: 1, failed: 1 });
    expect(syncIssue).toHaveBeenCalledExactlyOnceWith(
      validIssue,
      "reconcile:5:2026-09-01T08:05:00.000Z",
    );
  });
});

describe("reconcileFromCursor", () => {
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
      syncIssue: vi.fn().mockResolvedValue("published"),
    });

    expect(report).toEqual({ scanned: 1, synced: 1, failed: 0 });
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
      syncIssue: vi.fn().mockRejectedValue(new Error("private issue body")),
    });

    expect(report).toEqual({ scanned: 1, synced: 0, failed: 1 });
    await expect(cursorStore.read("github-issues")).resolves.toBe(
      "2026-09-01T08:00:00.000Z",
    );
    database.close();
  });
});
