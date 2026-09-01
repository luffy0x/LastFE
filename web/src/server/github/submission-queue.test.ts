import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseSubmission } from "@/features/submissions/schemas";
import { createSqliteContentStores } from "@/server/content/sqlite-repository";
import { openDatabase } from "@/server/db/client";
import { migrate } from "@/server/db/migrate";

const createIssue = vi.fn();
const getIssue = vi.fn();
const removeLabel = vi.fn();
const addLabels = vi.fn();
const updateIssue = vi.fn();
const listIssueEvents = vi.fn();
const searchIssuesAndPullRequests = vi.fn();

vi.mock("./client", () => ({
  createGitHubClient: () => ({
    owner: "moderation-owner",
    repo: "private-submissions",
    octokit: {
      rest: {
        issues: {
          create: createIssue,
          get: getIssue,
          removeLabel,
          addLabels,
          update: updateIssue,
          listEvents: listIssueEvents,
        },
        search: { issuesAndPullRequests: searchIssuesAndPullRequests },
      },
    },
  }),
}));

import { GitHubSubmissionQueue } from "./submission-queue";
import { encodeIssue } from "./issue-codec";
import { syncIssue, type SyncIssueDependencies } from "./sync-issue";

describe("GitHubSubmissionQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createIssue.mockResolvedValue({ data: { number: 42 } });
    getIssue.mockResolvedValue({
      data: {
        state: "open",
        labels: [{ name: "approved" }, { name: "pending" }],
        title: "[interview] candidate",
        body: "encoded-submission",
        created_at: "2026-09-01T08:00:00.000Z",
        updated_at: "2026-09-01T08:05:00.000Z",
      },
    });
    removeLabel.mockResolvedValue({});
    addLabels.mockResolvedValue({});
    updateIssue.mockResolvedValue({});
    listIssueEvents.mockResolvedValue({ data: [] });
    searchIssuesAndPullRequests.mockResolvedValue({ data: { items: [] } });
  });

  it("creates a private moderation issue and returns only its number", async () => {
    const queue = new GitHubSubmissionQueue();
    const submission = parseSubmission("interview", {
      regionSlug: "interview",
      companyDepartment: "字节跳动/基础架构",
      position: "后端开发",
      tags: ["一面"],
      markdown: "面试记录",
    });

    await expect(queue.enqueue(submission)).resolves.toEqual({ issueNumber: 42 });
    expect(createIssue).toHaveBeenCalledWith({
      owner: "moderation-owner",
      repo: "private-submissions",
      title: "[interview] 字节跳动/基础架构 · 后端开发",
      body: expect.stringContaining("<!-- submission-content -->\n面试记录"),
      labels: ["submission", "pending", "region:interview"],
    });
  });

  it("lists basic issues through an issues-only server query without reading history", async () => {
    searchIssuesAndPullRequests.mockResolvedValue({
      data: {
        items: [
        {
          number: 41,
          title: "[interview] candidate",
          body: "encoded-submission",
          labels: [{ name: "submission" }, { name: "approved" }],
          state: "open",
          created_at: "2026-09-01T08:00:00.000Z",
          updated_at: "2026-09-01T08:05:00.000Z",
        },
      ],
      },
    });
    const queue = new GitHubSubmissionQueue();

    await expect(queue.listSubmissionIssues(3)).resolves.toEqual([
      {
        number: 41,
        title: "[interview] candidate",
        body: "encoded-submission",
        labels: ["submission", "approved"],
        state: "open",
        createdAt: "2026-09-01T08:00:00.000Z",
        updatedAt: "2026-09-01T08:05:00.000Z",
      },
    ]);
    expect(searchIssuesAndPullRequests).toHaveBeenCalledExactlyOnceWith({
      q: "repo:moderation-owner/private-submissions is:issue label:submission",
      sort: "updated",
      order: "desc",
      page: 3,
      per_page: 100,
    });
    expect(listIssueEvents).not.toHaveBeenCalled();
  });

  it("enriches a basic issue from paged history and selects the newest event independently of response order", async () => {
    searchIssuesAndPullRequests.mockResolvedValue({
      data: {
        items: [
          {
            number: 42,
            title: "[interview] candidate",
            body: "encoded-submission",
            labels: [{ name: "submission" }, { name: "approved" }],
            state: "closed",
            created_at: "2026-09-01T08:00:00.000Z",
            updated_at: "2026-09-01T08:05:00.000Z",
          },
        ],
      },
    });
    listIssueEvents
      .mockResolvedValueOnce({
        data: Array.from({ length: 100 }, (_, index) => ({
          id: 6000 + index,
          event: "labeled",
          label: { name: "approved" },
          created_at: "2026-09-01T08:04:00.000Z",
        })),
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 7003,
            event: "unlabeled",
            label: { name: "unpublish" },
            created_at: "2026-09-01T08:05:00.000Z",
          },
          {
            id: 7002,
            event: "labeled",
            label: { name: "approved" },
            created_at: "2026-09-01T08:05:00.000Z",
          },
        ],
      });
    getIssue.mockResolvedValue({
      data: {
        state: "closed",
        labels: [{ name: "submission" }, { name: "approved" }],
        title: "[interview] candidate",
        body: "encoded-submission",
        created_at: "2026-09-01T08:00:00.000Z",
        updated_at: "2026-09-01T08:05:00.000Z",
      },
    });

    const queue = new GitHubSubmissionQueue();
    const [issue] = await queue.listSubmissionIssues(1);
    const snapshot = await queue.enrichReview(issue);

    expect(snapshot.review).toEqual({
      source: "reconciliation",
      latestRelevantEvent: {
        id: "7002",
        action: "labeled",
        label: "approved",
        createdAt: "2026-09-01T08:05:00.000Z",
      },
    });
    expect(listIssueEvents).toHaveBeenNthCalledWith(1, {
      owner: "moderation-owner",
      repo: "private-submissions",
      issue_number: 42,
      page: 1,
      per_page: 100,
    });
    expect(listIssueEvents).toHaveBeenNthCalledWith(2, {
      owner: "moderation-owner",
      repo: "private-submissions",
      issue_number: 42,
      page: 2,
      per_page: 100,
    });
  });

  it("orders mixed-case non-decimal review event IDs by code point", async () => {
    const createdAt = "2026-09-01T08:05:00.000Z";
    listIssueEvents.mockResolvedValue({
      data: [
        {
          id: "a",
          event: "labeled",
          label: { name: "approved" },
          created_at: createdAt,
        },
        {
          id: "B",
          event: "labeled",
          label: { name: "unpublish" },
          created_at: createdAt,
        },
      ],
    });
    getIssue.mockResolvedValue({
      data: {
        state: "open",
        labels: [{ name: "submission" }, { name: "approved" }],
        title: "[interview] candidate",
        body: "encoded-submission",
        created_at: "2026-09-01T08:00:00.000Z",
        updated_at: createdAt,
      },
    });
    const queue = new GitHubSubmissionQueue();

    const snapshot = await queue.enrichReview({
      number: 42,
      title: "[interview] candidate",
      body: "encoded-submission",
      labels: ["submission", "approved"],
      state: "open",
      createdAt: "2026-09-01T08:00:00.000Z",
      updatedAt: createdAt,
    });

    expect(snapshot.review).toEqual({
      source: "reconciliation",
      latestRelevantEvent: {
        id: "a",
        action: "labeled",
        label: "approved",
        createdAt,
      },
    });
  });

  it.each([
    [
      "withdrawal before reapproval",
      [
        {
          id: 9002,
          event: "labeled",
          label: { name: "unpublish" },
          created_at: "2026-09-01T10:00:00.000Z",
        },
        {
          id: 9003,
          event: "labeled",
          label: { name: "approved" },
          created_at: "2026-09-01T10:00:00.000Z",
        },
      ],
    ],
    [
      "reapproval before withdrawal",
      [
        {
          id: 9003,
          event: "labeled",
          label: { name: "approved" },
          created_at: "2026-09-01T10:00:00.000Z",
        },
        {
          id: 9002,
          event: "labeled",
          label: { name: "unpublish" },
          created_at: "2026-09-01T10:00:00.000Z",
        },
      ],
    ],
  ])(
    "keeps explicit same-second reapproval live after a stale withdrawal snapshot (%s)",
    async (_order, history) => {
    const encoded = encodeIssue(
      parseSubmission("interview", {
        regionSlug: "interview",
        companyDepartment: "字节跳动/基础架构",
        position: "后端开发",
        tags: ["一面"],
        markdown: "面试记录",
      }),
    );
    const updatedAt = "2026-09-01T10:00:00.000Z";
    const baseIssue = {
      number: 42,
      title: encoded.title,
      body: encoded.body,
      state: "open" as const,
      createdAt: "2026-09-01T08:00:00.000Z",
      updatedAt,
    };
    const queue = new GitHubSubmissionQueue();
    const database = openDatabase(":memory:");
    migrate(database);
    const { repository, moderation } = createSqliteContentStores(database);
    const dependencies: SyncIssueDependencies = {
      moderation,
      ensureReviewState: vi.fn().mockResolvedValue(undefined),
      invalidate: vi.fn().mockResolvedValue(undefined),
    };

    const asIssueResponse = (labels: readonly string[]) => ({
      data: {
        state: "open",
        labels: labels.map((name) => ({ name })),
        title: encoded.title,
        body: encoded.body,
        created_at: baseIssue.createdAt,
        updated_at: baseIssue.updatedAt,
      },
    });
    getIssue
      .mockResolvedValueOnce(
        asIssueResponse([...encoded.labels, "approved", "unpublish"]),
      )
      .mockResolvedValueOnce(asIssueResponse([...encoded.labels, "approved"]));
    listIssueEvents.mockResolvedValue({ data: history });
    const staleWithdrawal = await queue.enrichReview({
      ...baseIssue,
      labels: [...encoded.labels, "approved", "unpublish"],
    });
    expect(staleWithdrawal.review).toEqual({
      source: "reconciliation",
      latestRelevantEvent: {
        id: "9002",
        action: "labeled",
        label: "unpublish",
        createdAt: updatedAt,
      },
    });
    await expect(
      syncIssue(staleWithdrawal, "queue-withdrawal-9002", dependencies),
    ).resolves.toBe("withdrawn");
    await expect(
      repository.list({ page: 1, pageSize: 20 }),
    ).resolves.toMatchObject({ total: 0, items: [] });

    const currentReapproval = await queue.enrichReview({
      ...baseIssue,
      labels: [...encoded.labels, "approved"],
    });
    expect(currentReapproval.review).toEqual({
      source: "reconciliation",
      latestRelevantEvent: {
        id: "9003",
        action: "labeled",
        label: "approved",
        createdAt: updatedAt,
      },
    });
    await expect(
      syncIssue(currentReapproval, "queue-reapproval-9003", dependencies),
    ).resolves.toBe("published");
    await expect(
      repository.list({ page: 1, pageSize: 20 }),
    ).resolves.toMatchObject({ total: 1, items: [{ id: "gh-42" }] });
    database.close();
    },
  );

  it("keeps missed same-second review removals from locking published content", async () => {
    const encoded = encodeIssue(
      parseSubmission("interview", {
        regionSlug: "interview",
        companyDepartment: "字节跳动/基础架构",
        position: "后端开发",
        tags: ["一面"],
        markdown: "面试记录",
      }),
    );
    const updatedAt = "2026-09-01T10:00:00.000Z";
    const initial = {
      number: 42,
      title: encoded.title,
      body: encoded.body,
      labels: [...encoded.labels, "approved"],
      state: "open" as const,
      createdAt: "2026-09-01T08:00:00.000Z",
      updatedAt,
    };
    const current = {
      ...initial,
      labels: encoded.labels,
      state: "closed" as const,
    };
    const asIssueResponse = (snapshot: typeof initial | typeof current) => ({
      data: {
        state: snapshot.state,
        labels: snapshot.labels.map((name) => ({ name })),
        title: snapshot.title,
        body: snapshot.body,
        created_at: snapshot.createdAt,
        updated_at: snapshot.updatedAt,
      },
    });
    const reviewHistory = [
      {
        id: 9001,
        event: "labeled",
        label: { name: "approved" },
        created_at: updatedAt,
      },
      {
        id: 9002,
        event: "labeled",
        label: { name: "unpublish" },
        created_at: updatedAt,
      },
      {
        id: 9003,
        event: "unlabeled",
        label: { name: "unpublish" },
        created_at: updatedAt,
      },
      {
        id: 9004,
        event: "unlabeled",
        label: { name: "approved" },
        created_at: updatedAt,
      },
    ];
    const queue = new GitHubSubmissionQueue();
    const database = openDatabase(":memory:");
    migrate(database);
    const { repository, moderation } = createSqliteContentStores(database);
    const dependencies: SyncIssueDependencies = {
      moderation,
      ensureReviewState: vi.fn().mockResolvedValue(undefined),
      invalidate: vi.fn().mockResolvedValue(undefined),
    };

    getIssue
      .mockResolvedValueOnce(asIssueResponse(initial))
      .mockResolvedValueOnce(asIssueResponse(current))
      .mockResolvedValueOnce(asIssueResponse(current));
    listIssueEvents
      .mockResolvedValueOnce({ data: [reviewHistory[0]] })
      .mockResolvedValueOnce({ data: reviewHistory })
      .mockResolvedValueOnce({ data: reviewHistory });

    const published = await queue.enrichReview(initial);
    await expect(
      syncIssue(published, "queue-approved-9001", dependencies),
    ).resolves.toBe("published");

    const reconciled = await queue.enrichReview(initial);

    expect(reconciled).toMatchObject({
      labels: encoded.labels,
      state: "closed",
      review: {
        source: "reconciliation",
        latestRelevantEvent: {
          id: "9004",
          action: "unlabeled",
          label: "approved",
          createdAt: updatedAt,
        },
      },
    });
    await expect(
      syncIssue(reconciled, "queue-removed-approval-9004", dependencies),
    ).resolves.toBe("rejected");
    await expect(
      repository.list({ page: 1, pageSize: 20 }),
    ).resolves.toMatchObject({ total: 0, items: [] });
    database.close();
  });

  it("uses the current same-second reapproval body instead of a stale search body", async () => {
    const stale = encodeIssue(
      parseSubmission("interview", {
        regionSlug: "interview",
        companyDepartment: "字节跳动/基础架构",
        position: "后端开发",
        tags: ["一面"],
        markdown: "旧版面试记录",
      }),
    );
    const current = encodeIssue(
      parseSubmission("interview", {
        regionSlug: "interview",
        companyDepartment: "字节跳动/基础架构",
        position: "后端开发",
        tags: ["一面"],
        markdown: "重新批准后的面试记录",
      }),
    );
    const updatedAt = "2026-09-01T10:00:00.000Z";
    const staleSnapshot = {
      number: 42,
      title: stale.title,
      body: stale.body,
      labels: [...stale.labels, "approved"],
      state: "open" as const,
      createdAt: "2026-09-01T08:00:00.000Z",
      updatedAt,
    };
    const currentSnapshot = {
      ...staleSnapshot,
      title: current.title,
      body: current.body,
      labels: [...current.labels, "approved"],
    };
    const asIssueResponse = (snapshot: typeof staleSnapshot) => ({
      data: {
        state: snapshot.state,
        labels: snapshot.labels.map((name) => ({ name })),
        title: snapshot.title,
        body: snapshot.body,
        created_at: snapshot.createdAt,
        updated_at: snapshot.updatedAt,
      },
    });
    const reviewHistory = [
      {
        id: 9001,
        event: "labeled",
        label: { name: "approved" },
        created_at: updatedAt,
      },
      {
        id: 9002,
        event: "labeled",
        label: { name: "unpublish" },
        created_at: updatedAt,
      },
      {
        id: 9003,
        event: "unlabeled",
        label: { name: "unpublish" },
        created_at: updatedAt,
      },
      {
        id: 9004,
        event: "unlabeled",
        label: { name: "approved" },
        created_at: updatedAt,
      },
      {
        id: 9005,
        event: "labeled",
        label: { name: "approved" },
        created_at: updatedAt,
      },
    ];
    const queue = new GitHubSubmissionQueue();
    const database = openDatabase(":memory:");
    migrate(database);
    const { repository, moderation } = createSqliteContentStores(database);
    const dependencies: SyncIssueDependencies = {
      moderation,
      ensureReviewState: vi.fn().mockResolvedValue(undefined),
      invalidate: vi.fn().mockResolvedValue(undefined),
    };

    getIssue
      .mockResolvedValueOnce(asIssueResponse(staleSnapshot))
      .mockResolvedValueOnce(asIssueResponse(currentSnapshot))
      .mockResolvedValueOnce(asIssueResponse(currentSnapshot));
    listIssueEvents
      .mockResolvedValueOnce({ data: [reviewHistory[0]] })
      .mockResolvedValueOnce({ data: reviewHistory })
      .mockResolvedValueOnce({ data: reviewHistory });

    await expect(
      syncIssue(
        await queue.enrichReview(staleSnapshot),
        "queue-approved-9001",
        dependencies,
      ),
    ).resolves.toBe("published");
    const reapproved = await queue.enrichReview(staleSnapshot);

    expect(reapproved).toMatchObject({
      title: current.title,
      body: current.body,
      review: { latestRelevantEvent: { id: "9005" } },
    });
    await expect(
      syncIssue(reapproved, "queue-reapproved-9005", dependencies),
    ).resolves.toBe("published");
    await expect(repository.get("gh-42")).resolves.toMatchObject({
      markdown: "重新批准后的面试记录",
    });
    database.close();
  });

  it("returns no review sequence when an unpublish snapshot lacks a matching event", async () => {
    listIssueEvents.mockResolvedValue({
      data: [
        {
          id: 9001,
          event: "labeled",
          label: { name: "approved" },
          created_at: "2026-09-01T10:00:00.000Z",
        },
      ],
    });
    getIssue.mockResolvedValue({
      data: {
        state: "open",
        labels: [
          { name: "submission" },
          { name: "approved" },
          { name: "unpublish" },
        ],
        title: "[interview] candidate",
        body: "encoded-submission",
        created_at: "2026-09-01T08:00:00.000Z",
        updated_at: "2026-09-01T10:00:00.000Z",
      },
    });
    const queue = new GitHubSubmissionQueue();

    await expect(
      queue.enrichReview({
        number: 42,
        title: "[interview] candidate",
        body: "encoded-submission",
        labels: ["submission", "approved", "unpublish"],
        state: "open",
        createdAt: "2026-09-01T08:00:00.000Z",
        updatedAt: "2026-09-01T10:00:00.000Z",
      }),
    ).resolves.toMatchObject({
      review: { source: "reconciliation", latestRelevantEvent: null },
    });
  });

  it("converts history failures into a safe GitHub error", async () => {
    const privateResponse = {
      title: "private issue title",
      body: "private issue body",
      token: "private-token",
      url: "https://private.example/history",
    };
    listIssueEvents.mockRejectedValue(privateResponse);
    const queue = new GitHubSubmissionQueue();

    let caught: unknown;
    try {
      await queue.enrichReview({
        number: 42,
        title: privateResponse.title,
        body: privateResponse.body,
        labels: ["submission", "approved"],
        state: "open",
        createdAt: "2026-09-01T08:00:00.000Z",
        updatedAt: "2026-09-01T08:05:00.000Z",
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({ code: "GITHUB" });
    expect(String(caught)).not.toContain(privateResponse.title);
    expect(String(caught)).not.toContain(privateResponse.body);
    expect(String(caught)).not.toContain(privateResponse.token);
    expect(String(caught)).not.toContain(privateResponse.url);
  });

  it("repairs publication only when the live issue still requests approval", async () => {
    const queue = new GitHubSubmissionQueue();

    await queue.ensureReviewState(101, "published");

    expect(getIssue).toHaveBeenCalledWith({
      owner: "moderation-owner",
      repo: "private-submissions",
      issue_number: 101,
    });
    expect(removeLabel).toHaveBeenCalledWith({
      owner: "moderation-owner",
      repo: "private-submissions",
      issue_number: 101,
      name: "pending",
    });
    expect(addLabels).toHaveBeenCalledWith({
      owner: "moderation-owner",
      repo: "private-submissions",
      issue_number: 101,
      labels: ["published"],
    });
    expect(updateIssue).toHaveBeenCalledWith({
      owner: "moderation-owner",
      repo: "private-submissions",
      issue_number: 101,
      state: "closed",
    });
  });

  it("continues publication repair when pending is already absent", async () => {
    removeLabel.mockRejectedValue({ status: 404 });
    const queue = new GitHubSubmissionQueue();

    await expect(
      queue.ensureReviewState(101, "published"),
    ).resolves.toBeUndefined();

    expect(addLabels).toHaveBeenCalledTimes(1);
    expect(updateIssue).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["withdrawal", "open", [{ name: "approved" }, { name: "unpublish" }]],
    ["rejection", "closed", [{ name: "pending" }]],
  ] as const)(
    "does not let a stale approved delivery overwrite a newer live %s",
    async (_name, state, labels) => {
      getIssue.mockResolvedValue({ data: { state, labels } });
      const queue = new GitHubSubmissionQueue();

      await queue.ensureReviewState(101, "published");

      expect(getIssue).toHaveBeenCalledWith({
        owner: "moderation-owner",
        repo: "private-submissions",
        issue_number: 101,
      });
      expect(removeLabel).not.toHaveBeenCalled();
      expect(addLabels).not.toHaveBeenCalled();
      expect(updateIssue).not.toHaveBeenCalled();
    },
  );

  it.each(["withdrawn", "rejected", "ignored"] as const)(
    "does not publish a %s reconciliation request",
    async (decision) => {
      const queue = new GitHubSubmissionQueue();

      await queue.ensureReviewState(101, decision);

      expect(getIssue).not.toHaveBeenCalled();
      expect(removeLabel).not.toHaveBeenCalled();
      expect(addLabels).not.toHaveBeenCalled();
      expect(updateIssue).not.toHaveBeenCalled();
    },
  );
});
