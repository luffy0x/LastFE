import "server-only";

import type { Submission } from "@/features/submissions/types";
import type { SubmissionQueue } from "@/server/submissions/queue";

import { createGitHubClient, type GitHubClient } from "./client";
import { encodeIssue } from "./issue-codec";
import {
  decideModerationState,
  type GitHubIssueSnapshot,
  type ModerationDecision,
} from "./sync-issue";

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

  async listSubmissionIssues(
    page: number,
  ): Promise<readonly GitHubIssueSnapshot[]> {
    const response = await this.client.octokit.rest.search.issuesAndPullRequests({
      q: `repo:${this.client.owner}/${this.client.repo} is:issue label:submission`,
      sort: "updated",
      order: "desc",
      page,
      per_page: 100,
    });

    return response.data.items.map((issue) => {
      const labels = issue.labels.flatMap((label) => {
        if (typeof label === "string") return [label];
        return label.name ? [label.name] : [];
      });

      return {
        number: issue.number,
        title: issue.title,
        body: issue.body ?? "",
        labels,
        state: issue.state as GitHubIssueSnapshot["state"],
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
      };
    });
  }

  async ensureReviewState(
    issueNumber: number,
    requestedDecision: ModerationDecision,
  ): Promise<void> {
    if (requestedDecision !== "published") return;

    const issue = {
      owner: this.client.owner,
      repo: this.client.repo,
      issue_number: issueNumber,
    };
    const response = await this.client.octokit.rest.issues.get(issue);
    const labels = new Set(
      response.data.labels.flatMap((label) => {
        if (typeof label === "string") return [label];
        return label.name ? [label.name] : [];
      }),
    );
    const liveDecision = decideModerationState({
      isClosed: response.data.state === "closed",
      labels,
    });
    if (liveDecision !== "published") return;

    try {
      await this.client.octokit.rest.issues.removeLabel({
        ...issue,
        name: "pending",
      });
    } catch (error) {
      if (
        !error ||
        typeof error !== "object" ||
        !("status" in error) ||
        error.status !== 404
      ) {
        throw error;
      }
    }
    await this.client.octokit.rest.issues.addLabels({
      ...issue,
      labels: ["published"],
    });
    await this.client.octokit.rest.issues.update({
      ...issue,
      state: "closed",
    });
  }
}
