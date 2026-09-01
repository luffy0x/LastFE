import { describe, expect, it, vi } from "vitest";

import { parseSubmission } from "@/features/submissions/schemas";
import { createSqliteContentStores } from "@/server/content/sqlite-repository";
import { openDatabase } from "@/server/db/client";
import { migrate } from "@/server/db/migrate";

import { encodeIssue } from "./issue-codec";
import {
  SyncIssueError,
  syncIssue,
  type GitHubIssueSnapshot,
  type SyncIssueDependencies,
} from "./sync-issue";

const submission = (position = "后端开发") =>
  parseSubmission("interview", {
    regionSlug: "interview",
    companyDepartment: "字节跳动/基础架构",
    position,
    tags: ["一面"],
    markdown: "面试记录",
  });

function issue(
  overrides: Partial<GitHubIssueSnapshot> & {
    review?:
      | { source: "webhook"; action: string; changedLabel: string | null }
      | {
          source: "reconciliation";
          latestRelevantEvent: {
            id: string;
            action: "labeled" | "unlabeled";
            label: "approved" | "unpublish";
            createdAt: string;
          } | null;
        };
  } = {},
): GitHubIssueSnapshot {
  const encoded = encodeIssue(submission());
  return {
    number: 101,
    title: encoded.title,
    body: encoded.body,
    labels: [...encoded.labels, "approved"],
    state: "open",
    createdAt: "2026-09-01T08:00:00.000Z",
    updatedAt: "2026-09-01T08:05:00.000Z",
    review: {
      source: "webhook",
      action: "labeled",
      changedLabel: "approved",
    },
    ...overrides,
  } as GitHubIssueSnapshot;
}

function fakeDependencies(
  apply: SyncIssueDependencies["moderation"]["apply"] = vi
    .fn()
    .mockResolvedValue("applied"),
): SyncIssueDependencies {
  return {
    moderation: { apply },
    ensureReviewState: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
  };
}

describe("syncIssue", () => {
  it("publishes an approved submission once and repeats post-commit repair for a duplicate", async () => {
    const dependencies = fakeDependencies(
      vi
        .fn()
        .mockResolvedValueOnce("applied")
        .mockResolvedValueOnce("duplicate"),
    );
    const approved = issue();

    await expect(syncIssue(approved, "delivery-1", dependencies)).resolves.toBe(
      "published",
    );
    await expect(syncIssue(approved, "delivery-1", dependencies)).resolves.toBe(
      "duplicate",
    );

    expect(dependencies.moderation.apply).toHaveBeenCalledTimes(2);
    expect(dependencies.moderation.apply).toHaveBeenLastCalledWith({
      deliveryId: "delivery-1",
      action: "publish",
      ordering: {
        updatedAt: "2026-09-01T08:05:00.000Z",
        snapshotIdentity: expect.stringMatching(/^[a-f0-9]{64}$/),
        authoritative: false,
        reviewSequence: null,
      },
      record: {
        id: "gh-101",
        githubIssueNumber: 101,
        regionSlug: "interview",
        title: "字节跳动/基础架构 · 后端开发",
        summary: null,
        nickname: null,
        tags: ["一面"],
        publishedAt: "2026-09-01T08:05:00.000Z",
        createdAt: "2026-09-01T08:00:00.000Z",
        updatedAt: "2026-09-01T08:05:00.000Z",
        metadata: {
          companyDepartment: "字节跳动/基础架构",
          position: "后端开发",
        },
        markdown: "面试记录",
        externalUrl: null,
        status: "published",
      },
    });
    expect(dependencies.invalidate).toHaveBeenCalledTimes(2);
    expect(dependencies.invalidate).toHaveBeenLastCalledWith([
      "/",
      "/regions/interview",
      "/content/gh-101",
      "/api/search",
    ]);
    expect(dependencies.ensureReviewState).toHaveBeenCalledTimes(2);
    expect(dependencies.ensureReviewState).toHaveBeenLastCalledWith(
      101,
      "published",
    );
  });

  it("does not run cache or GitHub repair for a stale database decision", async () => {
    const dependencies = fakeDependencies(
      vi.fn().mockResolvedValue("stale"),
    );

    await expect(
      syncIssue(issue(), "stale-approved-delivery", dependencies),
    ).resolves.toBe("stale");
    expect(dependencies.invalidate).not.toHaveBeenCalled();
    expect(dependencies.ensureReviewState).not.toHaveBeenCalled();
  });

  it("does not repair a duplicate delivery after a newer decision supersedes it", async () => {
    const database = openDatabase(":memory:");
    migrate(database);
    const { moderation } = createSqliteContentStores(database);
    const dependencies: SyncIssueDependencies = {
      moderation,
      ensureReviewState: vi.fn().mockResolvedValue(undefined),
      invalidate: vi.fn().mockResolvedValue(undefined),
    };
    const approved = issue({ updatedAt: "2026-09-01T08:05:00.000Z" });

    await syncIssue(approved, "superseded-approval", dependencies);
    await syncIssue(
      issue({
        labels: [
          "submission",
          "region:interview",
          "approved",
          "unpublish",
        ],
        updatedAt: "2026-09-01T09:00:00.000Z",
        review: {
          source: "webhook",
          action: "labeled",
          changedLabel: "unpublish",
        },
      }),
      "newer-withdrawal",
      dependencies,
    );
    vi.mocked(dependencies.invalidate).mockClear();
    vi.mocked(dependencies.ensureReviewState).mockClear();

    await expect(
      syncIssue(approved, "superseded-approval", dependencies),
    ).resolves.toBe("stale");
    expect(dependencies.invalidate).not.toHaveBeenCalled();
    expect(dependencies.ensureReviewState).not.toHaveBeenCalled();
    database.close();
  });

  it.each([
    {
      regionSlug: "resources",
      input: {
        regionSlug: "resources",
        title: "Node.js 文档",
        url: "https://nodejs.org/docs/latest/api/",
        summary: "运行时 API 索引",
        tags: ["文档"],
      },
      fields: {
        summary: "运行时 API 索引",
        metadata: {},
        markdown: null,
        externalUrl: "https://nodejs.org/docs/latest/api/",
      },
    },
    {
      regionSlug: "fundamentals",
      input: {
        regionSlug: "fundamentals",
        title: "Redis 持久化",
        category: "数据库与缓存",
        tags: ["Redis"],
        markdown: "RDB 与 AOF",
      },
      fields: {
        summary: null,
        metadata: { category: "数据库与缓存" },
        markdown: "RDB 与 AOF",
        externalUrl: null,
      },
    },
    {
      regionSlug: "projects",
      input: {
        regionSlug: "projects",
        title: "实时协作编辑器",
        techStack: ["React", "Yjs"],
        repositoryUrl: "https://github.com/yjs/yjs",
        demoUrl: "https://example.com/demo",
        tags: ["协作"],
        markdown: "项目复盘",
      },
      fields: {
        summary: null,
        metadata: { techStack: "React / Yjs" },
        markdown: "项目复盘",
        externalUrl: "https://example.com/demo",
      },
    },
    {
      regionSlug: "algorithms",
      input: {
        regionSlug: "algorithms",
        title: "动态规划训练路线",
        source: "LeetCode",
        difficulty: "medium",
        problemUrl: "https://leetcode.cn/tag/dynamic-programming/",
        tags: ["动态规划"],
        markdown: "状态转移",
      },
      fields: {
        summary: null,
        metadata: { source: "LeetCode", difficulty: "medium" },
        markdown: "状态转移",
        externalUrl: "https://leetcode.cn/tag/dynamic-programming/",
      },
    },
  ] as const)("maps a $regionSlug submission into public content", async ({ regionSlug, input, fields }) => {
    const parsed = parseSubmission(regionSlug, input);
    const encoded = encodeIssue(parsed);
    const dependencies = fakeDependencies();

    await syncIssue(
      issue({
        title: encoded.title,
        body: encoded.body,
        labels: [...encoded.labels, "approved"],
      }),
      `delivery-${regionSlug}`,
      dependencies,
    );

    expect(dependencies.moderation.apply).toHaveBeenCalledWith(expect.objectContaining({
      deliveryId: `delivery-${regionSlug}`,
      action: "publish",
      ordering: expect.objectContaining({
        updatedAt: "2026-09-01T08:05:00.000Z",
        authoritative: false,
      }),
      record: expect.objectContaining({
        regionSlug,
        title: parsed.title,
        tags: parsed.tags,
        ...fields,
      }),
    }));
  });

  it.each([
    {
      name: "withdrawal before approval",
      labels: ["submission", "region:interview", "approved", "unpublish"],
      state: "open" as const,
      decision: "withdrawn" as const,
      command: {
        deliveryId: "delivery-state",
        action: "withdraw",
        issueNumber: 101,
      },
    },
    {
      name: "closed unapproved issue",
      labels: ["submission", "region:interview", "pending"],
      state: "closed" as const,
      decision: "rejected" as const,
      command: {
        deliveryId: "delivery-state",
        action: "reject",
        issueNumber: 101,
      },
    },
    {
      name: "open pending issue",
      labels: ["submission", "region:interview", "pending"],
      state: "open" as const,
      decision: "ignored" as const,
      command: {
        deliveryId: "delivery-state",
        action: "ignore",
        issueNumber: 101,
      },
    },
  ])("chooses $name", async ({ labels, state, decision, command }) => {
    const dependencies = fakeDependencies();

    await expect(
      syncIssue(issue({ labels, state }), "delivery-state", dependencies),
    ).resolves.toBe(decision);

    expect(dependencies.moderation.apply).toHaveBeenCalledWith({
      ...command,
      ordering: {
        updatedAt: "2026-09-01T08:05:00.000Z",
        snapshotIdentity: expect.stringMatching(/^[a-f0-9]{64}$/),
        authoritative: false,
        reviewSequence: null,
      },
    });
    expect(dependencies.ensureReviewState).toHaveBeenCalledWith(101, decision);
  });

  it.each([
    ["missing submission label", ["region:interview", "approved"], undefined],
    ["mismatched region label", ["submission", "region:projects", "approved"], undefined],
    ["malformed issue marker", undefined, "not an encoded submission"],
  ])("rejects %s before the transaction", async (_name, labels, body) => {
    const dependencies = fakeDependencies();

    await expect(
      syncIssue(
        issue({ ...(labels ? { labels } : {}), ...(body ? { body } : {}) }),
        "invalid-delivery",
        dependencies,
      ),
    ).rejects.toMatchObject({ code: "INVALID_ISSUE" });
    expect(dependencies.moderation.apply).not.toHaveBeenCalled();
    expect(dependencies.invalidate).not.toHaveBeenCalled();
    expect(dependencies.ensureReviewState).not.toHaveBeenCalled();
  });

  it("preserves the first publication time across withdrawal, stale delivery, and republish", async () => {
    const database = openDatabase(":memory:");
    migrate(database);
    const { repository, moderation } = createSqliteContentStores(database);
    const dependencies: SyncIssueDependencies = {
      moderation,
      ensureReviewState: vi.fn().mockResolvedValue(undefined),
      invalidate: vi.fn().mockResolvedValue(undefined),
    };

    await syncIssue(
      issue({ updatedAt: "2026-09-01T08:05:00.000Z" }),
      "publish-t1",
      dependencies,
    );
    await syncIssue(
      issue({
        labels: ["submission", "region:interview", "unpublish"],
        updatedAt: "2026-09-01T10:00:00.000Z",
      }),
      "withdraw-t3",
      dependencies,
    );
    await syncIssue(
      issue({ updatedAt: "2026-09-01T09:00:00.000Z" }),
      "stale-publish-t2",
      dependencies,
    );
    await expect(repository.get("gh-101")).resolves.toBeNull();

    const republishedSubmission = encodeIssue(submission("平台开发"));
    await syncIssue(
      issue({
        title: republishedSubmission.title,
        body: republishedSubmission.body,
        labels: [...republishedSubmission.labels, "approved"],
        updatedAt: "2026-09-01T11:00:00.000Z",
      }),
      "republish-t4",
      dependencies,
    );

    await expect(repository.get("gh-101")).resolves.toMatchObject({
      title: "字节跳动/基础架构 · 平台开发",
      publishedAt: "2026-09-01T08:05:00.000Z",
      updatedAt: "2026-09-01T11:00:00.000Z",
    });
    database.close();
  });

  it("keeps content withdrawn until approved is explicitly removed and re-added", async () => {
    const database = openDatabase(":memory:");
    migrate(database);
    const { repository, moderation } = createSqliteContentStores(database);
    const dependencies: SyncIssueDependencies = {
      moderation,
      ensureReviewState: vi.fn().mockResolvedValue(undefined),
      invalidate: vi.fn().mockResolvedValue(undefined),
    };

    await syncIssue(issue(), "explicit-approve", dependencies);
    await syncIssue(
      issue({
        labels: ["submission", "region:interview", "approved", "unpublish"],
        updatedAt: "2026-09-01T09:00:00.000Z",
        review: {
          source: "webhook",
          action: "labeled",
          changedLabel: "unpublish",
        },
      }),
      "explicit-withdraw",
      dependencies,
    );

    await expect(
      syncIssue(
        issue({
          labels: ["submission", "region:interview", "approved"],
          state: "closed",
          updatedAt: "2026-09-01T10:00:00.000Z",
          review: {
            source: "webhook",
            action: "unlabeled",
            changedLabel: "unpublish",
          },
        }),
        "remove-unpublish-only",
        dependencies,
      ),
    ).resolves.toBe("withdrawn");
    await expect(repository.get("gh-101")).resolves.toBeNull();

    await expect(
      syncIssue(
        issue({
          labels: ["submission", "region:interview"],
          state: "closed",
          updatedAt: "2026-09-01T11:00:00.000Z",
          review: {
            source: "webhook",
            action: "unlabeled",
            changedLabel: "approved",
          },
        }),
        "remove-approved",
        dependencies,
      ),
    ).resolves.toBe("rejected");
    await expect(repository.get("gh-101")).resolves.toBeNull();

    await expect(
      syncIssue(
        issue({
          labels: ["submission", "region:interview", "approved"],
          state: "closed",
          updatedAt: "2026-09-01T12:00:00.000Z",
          review: {
            source: "webhook",
            action: "labeled",
            changedLabel: "approved",
          },
        }),
        "readd-approved",
        dependencies,
      ),
    ).resolves.toBe("published");
    await expect(repository.get("gh-101")).resolves.toMatchObject({
      status: "published",
      updatedAt: "2026-09-01T12:00:00.000Z",
    });
    database.close();
  });

  it("uses reconciliation review history instead of an approved snapshot alone", async () => {
    const database = openDatabase(":memory:");
    migrate(database);
    const { repository, moderation } = createSqliteContentStores(database);
    const dependencies: SyncIssueDependencies = {
      moderation,
      ensureReviewState: vi.fn().mockResolvedValue(undefined),
      invalidate: vi.fn().mockResolvedValue(undefined),
    };

    await syncIssue(issue(), "history-approve", dependencies);
    await syncIssue(
      issue({
        labels: ["submission", "region:interview", "approved", "unpublish"],
        updatedAt: "2026-09-01T09:00:00.000Z",
        review: {
          source: "webhook",
          action: "labeled",
          changedLabel: "unpublish",
        },
      }),
      "history-withdraw",
      dependencies,
    );

    const removedUnpublish = issue({
      labels: ["submission", "region:interview", "approved"],
      state: "closed",
      updatedAt: "2026-09-01T10:00:00.000Z",
      review: {
        source: "reconciliation",
        latestRelevantEvent: {
          id: "9001",
          action: "unlabeled",
          label: "unpublish",
          createdAt: "2026-09-01T10:00:00.000Z",
        },
      },
    });
    await expect(
      syncIssue(removedUnpublish, "history-unpublish-removed", dependencies),
    ).resolves.toBe("withdrawn");
    await expect(repository.get("gh-101")).resolves.toBeNull();

    await expect(
      syncIssue(
        issue({
          ...removedUnpublish,
          updatedAt: "2026-09-01T11:00:00.000Z",
          review: {
            source: "reconciliation",
            latestRelevantEvent: {
              id: "9002",
              action: "labeled",
              label: "approved",
              createdAt: "2026-09-01T11:00:00.000Z",
            },
          },
        }),
        "history-approved-again",
        dependencies,
      ),
    ).resolves.toBe("published");
    await expect(repository.get("gh-101")).resolves.toMatchObject({
      status: "published",
    });
    database.close();
  });

  it("uses authoritative same-second history to recover a missed withdrawal", async () => {
    const database = openDatabase(":memory:");
    migrate(database);
    const { repository, moderation } = createSqliteContentStores(database);
    const dependencies: SyncIssueDependencies = {
      moderation,
      ensureReviewState: vi.fn().mockResolvedValue(undefined),
      invalidate: vi.fn().mockResolvedValue(undefined),
    };
    const updatedAt = "2026-09-01T10:00:00.000Z";

    await syncIssue(
      issue({ updatedAt }),
      "out-of-order-approval",
      dependencies,
    );
    await expect(repository.get("gh-101")).resolves.toMatchObject({
      status: "published",
    });

    await expect(
      syncIssue(
        issue({
          labels: ["submission", "region:interview", "approved"],
          state: "closed",
          updatedAt,
          review: {
            source: "reconciliation",
            latestRelevantEvent: {
              id: "9003",
              action: "unlabeled",
              label: "unpublish",
              createdAt: updatedAt,
            },
          },
        }),
        "reconcile-missed-withdrawal",
        dependencies,
      ),
    ).resolves.toBe("withdrawn");
    await expect(repository.get("gh-101")).resolves.toBeNull();
    database.close();
  });

  it("propagates the same-second authoritative sequence from reconciliation", async () => {
    const dependencies = fakeDependencies();
    const updatedAt = "2026-09-01T10:00:00.000Z";

    await syncIssue(
      issue({
        updatedAt,
        review: {
          source: "reconciliation",
          latestRelevantEvent: {
            id: "9001",
            action: "labeled",
            label: "approved",
            createdAt: updatedAt,
          },
        },
      }),
      "sequence-approval-9001",
      dependencies,
    );
    await syncIssue(
      issue({
        labels: ["submission", "region:interview", "approved"],
        state: "closed",
        updatedAt,
        review: {
          source: "reconciliation",
          latestRelevantEvent: {
            id: "9002",
            action: "unlabeled",
            label: "unpublish",
            createdAt: updatedAt,
          },
        },
      }),
      "sequence-withdrawal-9002",
      dependencies,
    );

    expect(dependencies.moderation.apply).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        ordering: expect.objectContaining({
          reviewSequence: { createdAt: updatedAt, eventId: "9001" },
        }),
      }),
    );
    expect(dependencies.moderation.apply).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        ordering: expect.objectContaining({
          reviewSequence: { createdAt: updatedAt, eventId: "9002" },
        }),
      }),
    );
  });

  it("keeps the newer same-second authoritative sequence after reverse delivery", async () => {
    const database = openDatabase(":memory:");
    migrate(database);
    const { repository, moderation } = createSqliteContentStores(database);
    const dependencies: SyncIssueDependencies = {
      moderation,
      ensureReviewState: vi.fn().mockResolvedValue(undefined),
      invalidate: vi.fn().mockResolvedValue(undefined),
    };
    const updatedAt = "2026-09-01T10:00:00.000Z";
    const newerWithdrawal = issue({
      labels: ["submission", "region:interview", "approved"],
      state: "closed",
      updatedAt,
      review: {
        source: "reconciliation",
        latestRelevantEvent: {
          id: "9002",
          action: "unlabeled",
          label: "unpublish",
          createdAt: updatedAt,
        },
      },
    });
    const olderApproval = issue({
      updatedAt,
      review: {
        source: "reconciliation",
        latestRelevantEvent: {
          id: "9001",
          action: "labeled",
          label: "approved",
          createdAt: updatedAt,
        },
      },
    });

    await expect(
      syncIssue(newerWithdrawal, "reverse-withdrawal-9002", dependencies),
    ).resolves.toBe("withdrawn");
    await expect(
      syncIssue(olderApproval, "reverse-approval-9001", dependencies),
    ).resolves.toBe("stale");
    await expect(repository.list({ page: 1, pageSize: 20 })).resolves.toMatchObject({
      total: 0,
      items: [],
    });
    database.close();
  });

  it.each([
    ["DATABASE", "moderation"],
    ["CACHE", "invalidate"],
    ["GITHUB", "ensureReviewState"],
  ] as const)("categorizes %s failures without retaining the cause", async (code, source) => {
    const secretCause = new Error("token and private issue body");
    const dependencies = fakeDependencies();
    if (source === "moderation") {
      vi.mocked(dependencies.moderation.apply).mockRejectedValue(secretCause);
    } else {
      vi.mocked(dependencies[source]).mockRejectedValue(secretCause);
    }

    let caught: unknown;
    try {
      await syncIssue(issue(), `delivery-${code}`, dependencies);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(SyncIssueError);
    expect(caught).toMatchObject({ code });
    expect(String(caught)).not.toContain(secretCause.message);
  });
});
