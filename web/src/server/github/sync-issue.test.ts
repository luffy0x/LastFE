import { describe, expect, it, vi } from "vitest";
import { buildSubmissionIssue } from "./issue-codec";
import { syncGitHubIssue } from "./sync-issue";

function query(result: Record<string, unknown>) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    upsert: vi.fn(() => builder),
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
      title: "字节一面",
      tags: ["后端"],
      markdown: "## 过程\n\n聊缓存。",
      metadata: {
        companyDepartment: "字节/基础架构",
        position: "后端",
      },
    });
    const duplicateQuery = query({ data: null, error: null });
    const contentQuery = query({ data: null, error: null });
    const deleteTagsQuery = query({ data: null, error: null });
    const tagQuery = query({ data: { id: 33 }, error: null });
    const contentTagQuery = query({ data: null, error: null });
    const eventQuery = query({ data: null, error: null });
    const client = {
      from: vi
        .fn()
        .mockReturnValueOnce(duplicateQuery)
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
        github_issue_number: 13,
        status: "published",
        region_slug: "interview",
      }),
      { onConflict: "github_issue_number" },
    );
    expect(eventQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ delivery_id: "delivery-2" }),
    );
    expect(tagQuery.upsert).toHaveBeenCalledWith(
      { label: "后端", normalized: "后端" },
      { onConflict: "normalized" },
    );
    expect(contentTagQuery.upsert).toHaveBeenCalledWith(
      { content_id: "github-issue-13", tag_id: 33 },
      { onConflict: "content_id,tag_id" },
    );
  });
});
