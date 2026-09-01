import "server-only";

import type { Submission } from "@/features/submissions/types";
import { compareReviewEventIds } from "@/server/moderation-ordering";
import type { SubmissionQueue } from "@/server/submissions/queue";

import { createGitHubClient, type GitHubClient } from "./client";
import { encodeIssue } from "./issue-codec";
import {
  decideModerationState,
  type GitHubIssueSnapshot,
  type ModerationDecision,
  type ReviewRelevantEvent,
} from "./sync-issue";
import type { ReconcileIssueSnapshot } from "./reconcile";

const REVIEW_EVENT_PAGE_SIZE = 100;

class GitHubHistoryError extends Error {
  readonly code = "GITHUB" as const;

  constructor() {
    super("GitHub review history failed (GITHUB)");
    this.name = "GitHubHistoryError";
  }
}

function normalizeReviewEvent(value: unknown): ReviewRelevantEvent | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const event = value as Record<string, unknown>;
  if (event.event !== "labeled" && event.event !== "unlabeled") return null;
  const label = event.label;
  if (!label || Array.isArray(label) || typeof label !== "object") return null;
  const name = (label as Record<string, unknown>).name;
  if (name !== "approved" && name !== "unpublish") return null;
  if (
    (typeof event.id !== "number" && typeof event.id !== "string") ||
    typeof event.created_at !== "string" ||
    !Number.isFinite(Date.parse(event.created_at))
  ) {
    throw new Error("GitHub review history is invalid");
  }
  return {
    id: String(event.id),
    action: event.event,
    label: name,
    createdAt: event.created_at,
  };
}

function isLaterReviewEvent(
  candidate: ReviewRelevantEvent,
  current: ReviewRelevantEvent | null,
): boolean {
  if (!current) return true;

  const timestampDifference =
    Date.parse(candidate.createdAt) - Date.parse(current.createdAt);
  if (timestampDifference !== 0) return timestampDifference > 0;

  return compareReviewEventIds(candidate.id, current.id) > 0;
}

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
  ): Promise<readonly ReconcileIssueSnapshot[]> {
    const response = await this.client.octokit.rest.search.issuesAndPullRequests({
      q: `repo:${this.client.owner}/${this.client.repo} is:issue label:submission`,
      sort: "updated",
      order: "desc",
      page,
      per_page: 100,
    });

    const snapshots: ReconcileIssueSnapshot[] = [];
    for (const issue of response.data.items) {
      const labels = issue.labels.flatMap((label) => {
        if (typeof label === "string") return [label];
        return label.name ? [label.name] : [];
      });
      snapshots.push({
        number: issue.number,
        title: issue.title,
        body: issue.body ?? "",
        labels,
        state: issue.state as GitHubIssueSnapshot["state"],
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
      });
    }
    return snapshots;
  }

  async enrichReview(
    issue: ReconcileIssueSnapshot,
  ): Promise<GitHubIssueSnapshot> {
    let latestRelevantEvent: ReviewRelevantEvent | null = null;
    if (
      issue.labels.includes("approved") ||
      issue.labels.includes("unpublish")
    ) {
      try {
        for (let eventPage = 1; ; eventPage += 1) {
          const events = await this.client.octokit.rest.issues.listEvents({
            owner: this.client.owner,
            repo: this.client.repo,
            issue_number: issue.number,
            page: eventPage,
            per_page: REVIEW_EVENT_PAGE_SIZE,
          });
          for (const value of events.data as unknown[]) {
            const candidate = normalizeReviewEvent(value);
            if (candidate && isLaterReviewEvent(candidate, latestRelevantEvent)) {
              latestRelevantEvent = candidate;
            }
          }
          if (events.data.length < REVIEW_EVENT_PAGE_SIZE) break;
        }
      } catch {
        throw new GitHubHistoryError();
      }
    }
    return {
      ...issue,
      review: { source: "reconciliation", latestRelevantEvent },
    };
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
