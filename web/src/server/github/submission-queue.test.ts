import { describe, expect, it, vi } from "vitest";

import { parseSubmission } from "@/features/submissions/schemas";

const createIssue = vi.fn();

vi.mock("./client", () => ({
  createGitHubClient: () => ({
    owner: "moderation-owner",
    repo: "private-submissions",
    octokit: { rest: { issues: { create: createIssue } } },
  }),
}));

import { GitHubSubmissionQueue } from "./submission-queue";

describe("GitHubSubmissionQueue", () => {
  it("creates a private moderation issue and returns only its number", async () => {
    createIssue.mockResolvedValue({ data: { number: 42 } });
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
});
