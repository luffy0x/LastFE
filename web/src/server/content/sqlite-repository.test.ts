import { describe, expect, it } from "vitest";
import { openDatabase } from "../db/client";
import { migrate } from "../db/migrate";
import {
  createSqliteContentStores,
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

async function publish(
  moderation: ReturnType<typeof setup>["moderation"],
  content: PublishedRecord,
  deliveryId = `delivery-${content.id}`,
) {
  return moderation.apply({ deliveryId, action: "publish", record: content });
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
        updatedAt: "2026-09-02T08:00:00.000Z",
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
      updatedAt: BASE_TIME,
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
      updatedAt: "2026-09-01T10:00:00.000Z",
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
    ).resolves.toBe("applied");

    await expect(repository.get("gh-101")).resolves.toBeNull();
    expect(
      db.prepare("SELECT delivery_id FROM webhook_deliveries WHERE delivery_id = ?").get("publish-t2"),
    ).toEqual({ delivery_id: "publish-t2" });
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
        updatedAt: "2026-09-01T09:00:00.000Z",
      }),
    ).resolves.toBe("applied");

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
