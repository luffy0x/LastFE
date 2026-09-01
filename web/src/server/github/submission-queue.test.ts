import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseSubmission } from "@/features/submissions/schemas";

const createIssue = vi.fn();
const getIssue = vi.fn();
const removeLabel = vi.fn();
const addLabels = vi.fn();
const updateIssue = vi.fn();

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
        },
      },
    },
  }),
}));

import { GitHubSubmissionQueue } from "./submission-queue";

describe("GitHubSubmissionQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createIssue.mockResolvedValue({ data: { number: 42 } });
    getIssue.mockResolvedValue({
      data: {
        state: "open",
        labels: [{ name: "approved" }, { name: "pending" }],
      },
    });
    removeLabel.mockResolvedValue({});
    addLabels.mockResolvedValue({});
    updateIssue.mockResolvedValue({});
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
