import { describe, expect, it, vi } from "vitest";
import { buildSubmissionIssue } from "./issue-codec";
import { syncGitHubIssue } from "./sync-issue";

function query(result: Record<string, unknown>) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    upsert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    insert: vi.fn(() => Promise.resolve(result)),
    delete: vi.fn(() => builder),
  };
  return builder;
}

describe("syncGitHubIssue", () => {
  it("treats a repeated delivery id as an idempotent no-op", async () => {
    const eventQuery = query({
      data: { delivery_id: "delivery-1" },
      error: null,
    });
    const client = { from: vi.fn(() => eventQuery) };

    await expect(
      syncGitHubIssue({
        client,
        deliveryId: "delivery-1",
        eventName: "issues",
        repository: "luffy0x/lastfe-moderation",
        issue: {
          number: 12,
          title: "[interview] 字节一面",
          body: "not parsed because duplicate",
          labels: ["submission", "approved"],
          state: "open",
        },
      }),
    ).resolves.toEqual({ status: "duplicate" });

    expect(eventQuery.upsert).not.toHaveBeenCalled();
  });

  it("publishes approved issue content into Supabase and records delivery", async () => {
    const issue = buildSubmissionIssue({
      regionSlug: "interview",
      title: "字节跳动 · 后端 · 一面",
      tags: ["后端"],
      markdown: "## 过程\n\n聊缓存。",
      metadata: {
        company: "字节跳动",
        position: "后端",
        round: "一面",
      },
    });
    const duplicateQuery = query({ data: null, error: null });
    const existingContentQuery = query({ data: null, error: null });
    const contentQuery = query({ data: null, error: null });
    const deleteTagsQuery = query({ data: null, error: null });
    const tagQuery = query({ data: { id: 33 }, error: null });
    const contentTagQuery = query({ data: null, error: null });
    const eventQuery = query({ data: null, error: null });
    const client = {
      from: vi
        .fn()
        .mockReturnValueOnce(duplicateQuery)
        .mockReturnValueOnce(existingContentQuery)
        .mockReturnValueOnce(contentQuery)
        .mockReturnValueOnce(deleteTagsQuery)
        .mockReturnValueOnce(tagQuery)
        .mockReturnValueOnce(contentTagQuery)
        .mockReturnValueOnce(eventQuery),
    };

    await expect(
      syncGitHubIssue({
        client,
        deliveryId: "delivery-2",
        eventName: "issues",
        repository: "luffy0x/lastfe-moderation",
        issue: {
          number: 13,
          title: issue.title,
          body: issue.body,
          labels: ["submission", "approved"],
          state: "open",
        },
      }),
    ).resolves.toEqual({
      status: "published",
      contentId: "github-repo-77a55e21a31c-issue-13",
    });

    expect(contentQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "github-repo-77a55e21a31c-issue-13",
        github_repository: "luffy0x/lastfe-moderation",
        github_issue_number: 13,
        status: "published",
        region_slug: "interview",
      }),
      { onConflict: "github_repository,github_issue_number" },
    );
    expect(eventQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ delivery_id: "delivery-2" }),
    );
    expect(tagQuery.upsert).toHaveBeenCalledWith(
      { label: "后端", normalized: "后端" },
      { onConflict: "normalized" },
    );
    expect(contentTagQuery.upsert).toHaveBeenCalledWith(
      { content_id: "github-repo-77a55e21a31c-issue-13", tag_id: 33 },
      { onConflict: "content_id,tag_id" },
    );
  });

  it("keeps the original published_at when re-publishing an already stored issue", async () => {
    const issue = buildSubmissionIssue({
      regionSlug: "interview",
      title: "字节跳动 · 后端 · 一面",
      tags: ["后端"],
      markdown: "## 过程\n\n聊缓存。",
      metadata: {
        company: "字节跳动",
        position: "后端",
        round: "一面",
      },
    });
    const duplicateQuery = query({ data: null, error: null });
    const existingContentQuery = query({
      data: {
        id: "github-issue-13",
        published_at: "2026-09-11T10:00:00.000Z",
      },
      error: null,
    });
    const contentQuery = query({ data: null, error: null });
    const deleteTagsQuery = query({ data: null, error: null });
    const tagQuery = query({ data: { id: 33 }, error: null });
    const contentTagQuery = query({ data: null, error: null });
    const eventQuery = query({ data: null, error: null });
    const client = {
      from: vi
        .fn()
        .mockReturnValueOnce(duplicateQuery)
        .mockReturnValueOnce(existingContentQuery)
        .mockReturnValueOnce(contentQuery)
        .mockReturnValueOnce(deleteTagsQuery)
        .mockReturnValueOnce(tagQuery)
        .mockReturnValueOnce(contentTagQuery)
        .mockReturnValueOnce(eventQuery),
    };

    await expect(
      syncGitHubIssue({
        client,
        deliveryId: "delivery-3",
        eventName: "issues",
        repository: "luffy0x/lastfe",
        issue: {
          number: 13,
          title: issue.title,
          body: issue.body,
          labels: ["submission", "approved"],
          state: "open",
        },
      }),
    ).resolves.toEqual({ status: "published", contentId: "github-issue-13" });

    expect(contentQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "github-issue-13",
        github_repository: "luffy0x/lastfe",
        published_at: "2026-09-11T10:00:00.000Z",
      }),
      { onConflict: "github_repository,github_issue_number" },
    );
  });

  it("keeps identical issue numbers from different repositories isolated", async () => {
    const issue = buildSubmissionIssue({
      regionSlug: "interview",
      title: "字节跳动 · 后端 · 一面",
      tags: ["后端"],
      markdown: "## 过程\n\n同号投稿。",
      metadata: {
        company: "字节跳动",
        position: "后端",
        round: "一面",
      },
    });

    function clientForNewContent() {
      const duplicateQuery = query({ data: null, error: null });
      const existingContentQuery = query({ data: null, error: null });
      const contentQuery = query({ data: null, error: null });
      const deleteTagsQuery = query({ data: null, error: null });
      const tagQuery = query({ data: { id: 33 }, error: null });
      const contentTagQuery = query({ data: null, error: null });
      const eventQuery = query({ data: null, error: null });
      return {
        client: {
          from: vi
            .fn()
            .mockReturnValueOnce(duplicateQuery)
            .mockReturnValueOnce(existingContentQuery)
            .mockReturnValueOnce(contentQuery)
            .mockReturnValueOnce(deleteTagsQuery)
            .mockReturnValueOnce(tagQuery)
            .mockReturnValueOnce(contentTagQuery)
            .mockReturnValueOnce(eventQuery),
        },
        contentQuery,
      };
    }

    const oldRepository = clientForNewContent();
    const newRepository = clientForNewContent();
    const issueSnapshot = {
      number: 7,
      title: issue.title,
      body: issue.body,
      labels: ["submission", "approved"],
      state: "open",
    };

    const oldResult = await syncGitHubIssue({
      client: oldRepository.client,
      deliveryId: "old-delivery",
      eventName: "issues",
      repository: "luffy0x/lastfe",
      issue: issueSnapshot,
    });
    const newResult = await syncGitHubIssue({
      client: newRepository.client,
      deliveryId: "new-delivery",
      eventName: "issues",
      repository: "luffy0x/lastfe-moderation",
      issue: issueSnapshot,
    });

    expect(oldResult).toEqual({
      status: "published",
      contentId: "github-repo-b0a5f3e13560-issue-7",
    });
    expect(newResult).toEqual({
      status: "published",
      contentId: "github-repo-77a55e21a31c-issue-7",
    });
    expect(oldRepository.contentQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ github_repository: "luffy0x/lastfe" }),
      { onConflict: "github_repository,github_issue_number" },
    );
    expect(newRepository.contentQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ github_repository: "luffy0x/lastfe-moderation" }),
      { onConflict: "github_repository,github_issue_number" },
    );
  });

  it("withdraws content only inside the event repository", async () => {
    const duplicateQuery = query({ data: null, error: null });
    const withdrawalQuery = query({ data: null, error: null });
    const eventQuery = query({ data: null, error: null });
    const client = {
      from: vi
        .fn()
        .mockReturnValueOnce(duplicateQuery)
        .mockReturnValueOnce(withdrawalQuery)
        .mockReturnValueOnce(eventQuery),
    };

    await syncGitHubIssue({
      client,
      deliveryId: "withdraw-delivery",
      eventName: "issues",
      repository: "luffy0x/lastfe-moderation",
      issue: {
        number: 7,
        title: "withdrawn",
        body: null,
        labels: ["submission", "unpublish"],
        state: "open",
      },
    });

    expect(withdrawalQuery.eq).toHaveBeenNthCalledWith(
      1,
      "github_repository",
      "luffy0x/lastfe-moderation",
    );
    expect(withdrawalQuery.eq).toHaveBeenNthCalledWith(
      2,
      "github_issue_number",
      7,
    );
  });
});
