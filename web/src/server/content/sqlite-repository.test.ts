import { describe, expect, it } from "vitest";
import { openDatabase } from "../db/client";
import { migrate } from "../db/migrate";
import {
  createSqliteContentStores,
  type ModerationOrdering,
} from "./sqlite-repository";
import type { ContentRecord } from "../../features/content/types";

const BASE_TIME = "2026-09-01T12:00:00.000Z";

type PublishedRecord = ContentRecord & { githubIssueNumber: number };

function record(overrides: Partial<PublishedRecord> = {}): PublishedRecord {
  return {
    id: "gh-101",
    githubIssueNumber: 101,
    regionSlug: "interview",
    title: "字节跳动/基础架构 · 后端开发",
    summary: null,
    nickname: null,
    tags: ["一面", "Go"],
    publishedAt: "2026-09-01T08:00:00.000Z",
    createdAt: "2026-09-01T07:55:00.000Z",
    updatedAt: "2026-09-01T08:00:00.000Z",
    metadata: {
      companyDepartment: "字节跳动/基础架构",
      position: "后端开发",
    },
    markdown: "面试记录",
    externalUrl: null,
    status: "published",
    ...overrides,
  };
}

function setup() {
  const db = openDatabase(":memory:");
  migrate(db);
  return { db, ...createSqliteContentStores(db) };
}

function moderationOrdering(
  updatedAt: string,
  snapshotIdentity: string,
  authoritative = false,
) {
  return { updatedAt, snapshotIdentity, authoritative, reviewSequence: null };
}

async function publish(
  moderation: ReturnType<typeof setup>["moderation"],
  content: PublishedRecord,
  deliveryId = `delivery-${content.id}`,
  ordering: ModerationOrdering = {
    updatedAt: content.updatedAt,
    snapshotIdentity: `snapshot-${deliveryId}`,
    authoritative: false,
    reviewSequence: null,
  },
) {
  const command = {
    deliveryId,
    action: "publish" as const,
    record: content,
    ordering,
  };
  return moderation.apply(command);
}

describe("SQLite content repository", () => {
  it("publishes and lists one record by territory", async () => {
    const { repository, moderation } = setup();
    const published = record();

    await expect(publish(moderation, published, "seed-101")).resolves.toBe("applied");

    await expect(
      repository.list({ regionSlug: "interview", page: 1, pageSize: 20 }),
    ).resolves.toMatchObject({
      page: 1,
      pageSize: 20,
      total: 1,
      items: [{ id: "gh-101", title: "字节跳动/基础架构 · 后端开发" }],
    });
  });

  it("updates an existing issue and replaces its tag set while preserving the first tag label", async () => {
    const { repository, moderation } = setup();
    await publish(moderation, record({ tags: [" Go ", "一面"] }), "initial");
    await publish(
      moderation,
      record({
        title: "更新后的面试记录",
        tags: ["go", "系统设计"],
        updatedAt: "2026-09-01T08:01:00.000Z",
      }),
      "update",
    );

    await expect(repository.get("gh-101")).resolves.toMatchObject({
      title: "更新后的面试记录",
      tags: ["Go", "系统设计"],
    });
    await expect(
      repository.list({ tags: ["一面"], page: 1, pageSize: 20 }),
    ).resolves.toMatchObject({ total: 0 });
  });

  it("withdraws content from every public read", async () => {
    const { repository, moderation } = setup();
    await publish(moderation, record(), "published");
    await expect(
      moderation.apply({
        deliveryId: "withdrawn",
        action: "withdraw",
        issueNumber: 101,
        ordering: moderationOrdering(
          "2026-09-02T08:00:00.000Z",
          "withdrawn",
        ),
      }),
    ).resolves.toBe("applied");

    await expect(repository.get("gh-101")).resolves.toBeNull();
    await expect(repository.list({ page: 1, pageSize: 20 })).resolves.toMatchObject({
      total: 0,
      items: [],
    });
  });

  it("counts only published records and the inclusive seven-day window", async () => {
    const { repository, moderation } = setup();
    await publish(
      moderation,
      record({ id: "recent", githubIssueNumber: 201, publishedAt: "2026-08-25T12:00:00.000Z" }),
    );
    await publish(
      moderation,
      record({ id: "old", githubIssueNumber: 202, publishedAt: "2026-08-25T11:59:59.999Z" }),
    );
    await publish(
      moderation,
      record({ id: "withdrawn", githubIssueNumber: 203 }),
    );
    await moderation.apply({
      deliveryId: "withdrawn-203",
      action: "withdraw",
      issueNumber: 203,
      ordering: moderationOrdering(BASE_TIME, "withdrawn-203"),
    });

    await expect(repository.stats(new Date(BASE_TIME))).resolves.toEqual({
      totalPublished: 2,
      recentPublished: 1,
    });
  });

  it("paginates published content in published-at then id order with a fixed size of twenty", async () => {
    const { repository, moderation } = setup();
    for (let issue = 1; issue <= 21; issue += 1) {
      await publish(
        moderation,
        record({
          id: `page-${String(issue).padStart(2, "0")}`,
          githubIssueNumber: 300 + issue,
          publishedAt: "2026-09-01T08:00:00.000Z",
        }),
      );
    }

    const firstPage = await repository.list({ page: 1, pageSize: 20 });
    expect(firstPage.total).toBe(21);
    expect(firstPage.pageSize).toBe(20);
    expect(firstPage.items).toHaveLength(20);
    await expect(repository.list({ page: 2, pageSize: 20 })).resolves.toMatchObject({
      items: [{ id: "page-21" }],
    });
  });

  it("treats a repeated delivery as a no-op", async () => {
    const { repository, moderation } = setup();
    await expect(publish(moderation, record(), "same-delivery")).resolves.toBe("applied");
    await expect(
      publish(moderation, record({ title: "must not replace" }), "same-delivery"),
    ).resolves.toBe("duplicate");

    await expect(repository.get("gh-101")).resolves.toMatchObject({
      title: "字节跳动/基础架构 · 后端开发",
    });
  });

  it("searches content by a normalized tag alone", async () => {
    const { repository, moderation } = setup();
    await publish(
      moderation,
      record({
        id: "tag-only",
        githubIssueNumber: 350,
        title: "unrelated title",
        summary: "unrelated summary",
        markdown: "unrelated body",
        tags: ["  Go  "],
      }),
    );

    await expect(
      repository.list({ search: "go", page: 1, pageSize: 20 }),
    ).resolves.toMatchObject({ total: 1, items: [{ id: "tag-only" }] });
  });

  it("records a stale publish delivery without restoring content withdrawn by a newer event", async () => {
    const { db, repository, moderation } = setup();
    await publish(
      moderation,
      record({ updatedAt: "2026-09-01T08:00:00.000Z" }),
      "publish-t1",
    );
    await moderation.apply({
      deliveryId: "withdraw-t3",
      action: "withdraw",
      issueNumber: 101,
      ordering: moderationOrdering(
        "2026-09-01T10:00:00.000Z",
        "withdraw-t3",
      ),
    });
    await expect(
      publish(
        moderation,
        record({
          title: "delayed publish must not restore",
          updatedAt: "2026-09-01T09:00:00.000Z",
        }),
        "publish-t2",
      ),
    ).resolves.toBe("stale");

    await expect(repository.get("gh-101")).resolves.toBeNull();
    expect(
      db.prepare("SELECT delivery_id FROM webhook_deliveries WHERE delivery_id = ?").get("publish-t2"),
    ).toEqual({ delivery_id: "publish-t2" });
  });

  it("keeps an unseen newer withdrawal as a tombstone against a delayed publish", async () => {
    const { db, repository, moderation } = setup();
    const delayed = record({
      id: "unseen-withdrawal",
      githubIssueNumber: 701,
      updatedAt: "2026-09-01T09:00:00.000Z",
    });
    await moderation.apply({
      deliveryId: "unseen-withdraw-t3",
      action: "withdraw",
      issueNumber: 701,
      ordering: moderationOrdering(
        "2026-09-01T10:00:00.000Z",
        "unseen-withdraw-t3",
      ),
    });

    await expect(publish(moderation, delayed, "unseen-publish-t2")).resolves.toBe("stale");
    await expect(repository.get("unseen-withdrawal")).resolves.toBeNull();
    await expect(repository.list({ page: 1, pageSize: 20 })).resolves.toMatchObject({
      total: 0,
      items: [],
    });
    expect(
      db.prepare("SELECT delivery_id FROM webhook_deliveries WHERE delivery_id = ?").get("unseen-publish-t2"),
    ).toEqual({ delivery_id: "unseen-publish-t2" });
    await expect(publish(moderation, delayed, "unseen-publish-t2")).resolves.toBe("stale");
  });

  it.each(["reject", "ignore"] as const)(
    "keeps a newer %s decision as a tombstone against a delayed approval",
    async (action) => {
      const { repository, moderation } = setup();
      const decision = {
        deliveryId: `${action}-t3`,
        action,
        issueNumber: 703,
        ordering: {
          updatedAt: "2026-09-01T10:00:00.000Z",
          snapshotIdentity: `${action}-snapshot-t3`,
          authoritative: false,
          reviewSequence: null,
        },
      };

      await moderation.apply(decision);
      await publish(
        moderation,
        record({
          id: `stale-after-${action}`,
          githubIssueNumber: 703,
          updatedAt: "2026-09-01T09:00:00.000Z",
        }),
        `publish-before-${action}`,
      );

      await expect(repository.get(`stale-after-${action}`)).resolves.toBeNull();
    },
  );

  it("lets an authoritative snapshot correct a different decision in the same GitHub second", async () => {
    const { repository, moderation } = setup();
    const updatedAt = "2026-09-01T10:00:00.000Z";

    await publish(
      moderation,
      record({ updatedAt }),
      "same-second-publish",
      {
        updatedAt,
        snapshotIdentity: "webhook-published",
        authoritative: false,
        reviewSequence: null,
      },
    );
    const ambiguousWebhook = {
      deliveryId: "same-second-withdraw-webhook",
      action: "withdraw" as const,
      issueNumber: 101,
      updatedAt,
      ordering: {
        updatedAt,
        snapshotIdentity: "webhook-withdrawn",
        authoritative: false,
        reviewSequence: null,
      },
    };
    await expect(moderation.apply(ambiguousWebhook)).resolves.toBe("stale");
    await expect(repository.get("gh-101")).resolves.toMatchObject({
      status: "published",
    });

    const authoritativeSnapshot = {
      ...ambiguousWebhook,
      deliveryId: "same-second-withdraw-reconciliation",
      ordering: {
        ...ambiguousWebhook.ordering,
        snapshotIdentity: "reconciliation-withdrawn",
        authoritative: true,
        reviewSequence: { createdAt: updatedAt, eventId: "9001" },
      },
    };
    await expect(moderation.apply(authoritativeSnapshot)).resolves.toBe("applied");
    await expect(repository.get("gh-101")).resolves.toBeNull();
  });

  it("lets an authoritative null sequence replace a same-second non-authoritative state", async () => {
    const { db, repository, moderation } = setup();
    const updatedAt = "2026-09-01T10:00:00.000Z";

    await publish(
      moderation,
      record({ updatedAt }),
      "null-sequence-webhook-publish",
      {
        updatedAt,
        snapshotIdentity: "null-sequence-webhook",
        authoritative: false,
        reviewSequence: null,
      },
    );
    await expect(
      moderation.apply({
        deliveryId: "null-sequence-reconciliation-withdraw",
        action: "withdraw",
        issueNumber: 101,
        ordering: {
          updatedAt,
          snapshotIdentity: "null-sequence-reconciliation",
          authoritative: true,
          reviewSequence: null,
        },
      }),
    ).resolves.toBe("applied");

    await expect(repository.get("gh-101")).resolves.toBeNull();
    expect(
      db.prepare(
        "SELECT authoritative FROM moderation_issue_states WHERE github_issue_number = 101",
      ).get(),
    ).toEqual({ authoritative: 1 });
  });

  it("keeps an authoritative null sequence against another same-second unordered snapshot", async () => {
    const { repository, moderation } = setup();
    const updatedAt = "2026-09-01T10:00:00.000Z";

    await expect(
      moderation.apply({
        deliveryId: "stored-authoritative-withdraw",
        action: "withdraw",
        issueNumber: 101,
        ordering: {
          updatedAt,
          snapshotIdentity: "stored-authoritative-withdraw",
          authoritative: true,
          reviewSequence: null,
        },
      }),
    ).resolves.toBe("applied");
    await expect(
      publish(
        moderation,
        record({ updatedAt }),
        "unordered-authoritative-publish",
        {
          updatedAt,
          snapshotIdentity: "unordered-authoritative-publish",
          authoritative: true,
          reviewSequence: null,
        },
      ),
    ).resolves.toBe("stale");

    await expect(repository.list({ page: 1, pageSize: 20 })).resolves.toMatchObject({
      total: 0,
      items: [],
    });
  });

  it("keeps a newer same-second authoritative sequence when it arrives first", async () => {
    const { repository, moderation } = setup();
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

    await expect(
      moderation.apply({
        deliveryId: "sequence-withdrawal-9002",
        action: "withdraw",
        issueNumber: 101,
        ordering: newerWithdrawal,
      }),
    ).resolves.toBe("applied");
    await expect(
      publish(
        moderation,
        record({ updatedAt: sameSecond }),
        "sequence-approval-9001",
        olderApproval,
      ),
    ).resolves.toBe("stale");

    await expect(repository.list({ page: 1, pageSize: 20 })).resolves.toMatchObject({
      total: 0,
      items: [],
    });
  });

  it("applies a newer same-second authoritative sequence when it arrives last", async () => {
    const { repository, moderation } = setup();
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

    await expect(
      publish(
        moderation,
        record({ updatedAt: sameSecond }),
        "sequence-approval-9001-first",
        olderApproval,
      ),
    ).resolves.toBe("applied");
    await expect(
      moderation.apply({
        deliveryId: "sequence-withdrawal-9002-last",
        action: "withdraw",
        issueNumber: 101,
        ordering: newerWithdrawal,
      }),
    ).resolves.toBe("applied");

    await expect(repository.list({ page: 1, pageSize: 20 })).resolves.toMatchObject({
      total: 0,
      items: [],
    });
  });

  it("allows a newer publish after an unseen withdrawal and ignores later stale transitions", async () => {
    const { repository, moderation } = setup();
    await moderation.apply({
      deliveryId: "unseen-withdraw-t3",
      action: "withdraw",
      issueNumber: 702,
      ordering: moderationOrdering(
        "2026-09-01T10:00:00.000Z",
        "unseen-withdraw-t3",
      ),
    });
    await publish(
      moderation,
      record({
        id: "newer-after-tombstone",
        githubIssueNumber: 702,
        title: "newer publish",
        updatedAt: "2026-09-01T11:00:00.000Z",
      }),
      "unseen-publish-t4",
    );
    await moderation.apply({
      deliveryId: "unseen-withdraw-t2",
      action: "withdraw",
      issueNumber: 702,
      ordering: moderationOrdering(
        "2026-09-01T09:00:00.000Z",
        "unseen-withdraw-t2",
      ),
    });
    await publish(
      moderation,
      record({
        id: "newer-after-tombstone",
        githubIssueNumber: 702,
        title: "stale publish",
        updatedAt: "2026-09-01T09:00:00.000Z",
      }),
      "unseen-publish-t2",
    );

    await expect(repository.get("newer-after-tombstone")).resolves.toMatchObject({
      status: "published",
      title: "newer publish",
    });
  });

  it("does not let a stale withdrawal override a newer publish", async () => {
    const { db, repository, moderation } = setup();
    await publish(
      moderation,
      record({ updatedAt: "2026-09-01T10:00:00.000Z" }),
      "publish-t3",
    );

    await expect(
      moderation.apply({
        deliveryId: "withdraw-t2",
        action: "withdraw",
        issueNumber: 101,
        ordering: moderationOrdering(
          "2026-09-01T09:00:00.000Z",
          "withdraw-t2",
        ),
      }),
    ).resolves.toBe("stale");

    await expect(repository.get("gh-101")).resolves.toMatchObject({
      status: "published",
    });
    expect(
      db.prepare("SELECT delivery_id FROM webhook_deliveries WHERE delivery_id = ?").get("withdraw-t2"),
    ).toEqual({ delivery_id: "withdraw-t2" });
  });

  it("preserves the first publication time when a newer publish updates content", async () => {
    const { repository, moderation } = setup();
    await publish(
      moderation,
      record({
        publishedAt: "2026-09-01T08:00:00.000Z",
        updatedAt: "2026-09-01T08:00:00.000Z",
      }),
      "publish-first",
    );
    await publish(
      moderation,
      record({
        title: "newer approved content",
        tags: ["Rust"],
        publishedAt: "2026-09-02T08:00:00.000Z",
        updatedAt: "2026-09-02T08:00:00.000Z",
      }),
      "publish-newer",
    );

    await expect(repository.get("gh-101")).resolves.toMatchObject({
      title: "newer approved content",
      tags: ["Rust"],
      publishedAt: "2026-09-01T08:00:00.000Z",
    });
  });

  it.each([
    ["interview", "companyDepartment", "招聘方关键词"],
    ["resources", "format", "资源关键词"],
    ["fundamentals", "category", "基础关键词"],
    ["projects", "techStack", "项目关键词"],
    ["algorithms", "source", "算法关键词"],
  ] as const)("searches %s through its supported fields", async (regionSlug, metadataKey, needle) => {
    const { repository, moderation } = setup();
    await publish(
      moderation,
      record({
        id: `search-${regionSlug}`,
        githubIssueNumber: 400 + regionSlug.length,
        regionSlug,
        title: "普通标题",
        summary: regionSlug === "resources" ? needle : "普通摘要",
        markdown: "普通正文",
        tags: ["普通标签"],
        metadata: { [metadataKey]: needle },
      }),
    );

    await expect(
      repository.list({ regionSlug, search: needle, page: 1, pageSize: 20 }),
    ).resolves.toMatchObject({ total: 1, items: [{ id: `search-${regionSlug}` }] });
  });

  it("escapes SQL LIKE wildcard characters in literal searches", async () => {
    const { repository, moderation } = setup();
    await publish(moderation, record({ id: "literal", githubIssueNumber: 501, title: "进度 100%" }));
    await publish(moderation, record({ id: "other", githubIssueNumber: 502, title: "进度 100x" }));

    await expect(
      repository.list({ search: "100%", page: 1, pageSize: 20 }),
    ).resolves.toMatchObject({ total: 1, items: [{ id: "literal" }] });
  });

  it.each([
    ["interview", "companyDepartment", "星河科技"],
    ["interview", "position", "后端开发"],
    ["fundamentals", "category", "数据库"],
    ["projects", "techStack", "React"],
    ["algorithms", "source", "LeetCode"],
    ["algorithms", "difficulty", "medium"],
  ] as const)(
    "filters %s records by configured %s metadata",
    async (regionSlug, key, value) => {
      const { repository, moderation } = setup();
      await publish(
        moderation,
        record({ regionSlug, metadata: { [key]: value } }),
      );

      await expect(
        repository.list({
          regionSlug,
          filters: { [key]: value.toLowerCase() },
          page: 1,
          pageSize: 20,
        }),
      ).resolves.toMatchObject({ total: 1, items: [{ id: "gh-101" }] });
    },
  );

  it("rejects filter keys that are not configured for the territory", async () => {
    const { repository } = setup();

    await expect(
      repository.list({
        regionSlug: "interview",
        filters: { difficulty: "medium" },
        page: 1,
        pageSize: 20,
      }),
    ).rejects.toThrow("Unsupported content filter: difficulty");
  });

  it("fails closed when stored metadata is not an object of strings", async () => {
    const { db, repository } = setup();
    db.prepare(
      `INSERT INTO contents (
        id, github_issue_number, region_slug, status, title, metadata_json,
        created_at, published_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "invalid-metadata",
      601,
      "interview",
      "published",
      "invalid",
      '{"valid":false}',
      "2026-09-01T07:55:00.000Z",
      "2026-09-01T08:00:00.000Z",
      "2026-09-01T08:00:00.000Z",
    );

    await expect(repository.get("invalid-metadata")).rejects.toThrow("metadata");
    await expect(repository.list({ page: 1, pageSize: 20 })).rejects.toThrow("metadata");
  });
});
