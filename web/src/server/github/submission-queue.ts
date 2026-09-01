import "server-only";

import type { Submission } from "@/features/submissions/types";
import type { SubmissionQueue } from "@/server/submissions/queue";

import { createGitHubClient, type GitHubClient } from "./client";
import { encodeIssue } from "./issue-codec";

export class GitHubSubmissionQueue implements SubmissionQueue {
  constructor(private readonly client: GitHubClient = createGitHubClient()) {}

  async enqueue(submission: Submission): Promise<{ issueNumber: number }> {
    const issue = encodeIssue(submission);
    const response = await this.client.octokit.rest.issues.create({
      owner: this.client.owner,
      repo: this.client.repo,
      ...issue,
    });
    return { issueNumber: response.data.number };
  }
}
