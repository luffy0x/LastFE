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

class GitHubReviewError extends Error {
  readonly code = "GITHUB" as const;

  constructor() {
    super("GitHub review reconciliation failed (GITHUB)");
    this.name = "GitHubReviewError";
  }
}

const REVIEW_SNAPSHOT_ATTEMPTS = 2;

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

function latestReviewEvent(
  events: readonly ReviewRelevantEvent[],
  predicate: (event: ReviewRelevantEvent) => boolean = () => true,
): ReviewRelevantEvent | null {
  return events
    .filter(predicate)
    .reduce<ReviewRelevantEvent | null>(
      (latest, event) => isLaterReviewEvent(event, latest) ? event : latest,
      null,
    );
}

function labelsFromIssue(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error("GitHub issue labels are invalid");
  return value.flatMap((label) => {
    if (typeof label === "string") return [label];
    if (!label || Array.isArray(label) || typeof label !== "object") return [];
    const name = (label as Record<string, unknown>).name;
    return typeof name === "string" ? [name] : [];
  });
}

function refreshedSnapshot(
  issueNumber: number,
  value: unknown,
): ReconcileIssueSnapshot {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error("GitHub issue is invalid");
  }
  const issue = value as Record<string, unknown>;
  if (
    (issue.state !== "open" && issue.state !== "closed") ||
    typeof issue.title !== "string" ||
    (typeof issue.body !== "string" && issue.body !== null) ||
    typeof issue.created_at !== "string" ||
    !Number.isFinite(Date.parse(issue.created_at)) ||
    typeof issue.updated_at !== "string" ||
    !Number.isFinite(Date.parse(issue.updated_at))
  ) {
    throw new Error("GitHub issue is invalid");
  }
  return {
    number: issueNumber,
    title: issue.title,
    body: issue.body ?? "",
    labels: labelsFromIssue(issue.labels),
    state: issue.state,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
  };
}

function hasSameSnapshotFields(
  left: ReconcileIssueSnapshot,
  right: ReconcileIssueSnapshot,
): boolean {
  return (
    left.number === right.number &&
    left.title === right.title &&
    left.body === right.body &&
    left.state === right.state &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt &&
    [...left.labels].sort().join("\u0000") === [...right.labels].sort().join("\u0000")
  );
}

function needsReviewHistory(issue: ReconcileIssueSnapshot): boolean {
  return (
    issue.state === "closed" ||
    issue.labels.includes("approved") ||
    issue.labels.includes("unpublish")
  );
}

function reviewEventForSnapshot(
  issue: ReconcileIssueSnapshot,
  events: readonly ReviewRelevantEvent[],
): ReviewRelevantEvent | null {
  if (issue.labels.includes("unpublish")) {
    return latestReviewEvent(
      events,
      (event) => event.action === "labeled" && event.label === "unpublish",
    );
  }
  if (issue.labels.includes("approved")) {
    return latestReviewEvent(events, (event) => {
      if (event.action === "labeled" && event.label === "approved") {
        return true;
      }
      return (
        event.action === "unlabeled" &&
        event.label === "unpublish" &&
        events.some(
          (candidate) =>
            candidate.action === "labeled" &&
            candidate.label === "unpublish" &&
            isLaterReviewEvent(event, candidate),
        )
      );
    });
  }
  return latestReviewEvent(events, (event) => event.action === "unlabeled");
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
    let snapshot = issue;
    try {
      for (
        let attempt = 0;
        attempt < REVIEW_SNAPSHOT_ATTEMPTS;
        attempt += 1
      ) {
        if (!needsReviewHistory(snapshot)) {
          return {
            ...snapshot,
            review: { source: "reconciliation", latestRelevantEvent: null },
          };
        }
        const reviewEvents: ReviewRelevantEvent[] = [];
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
            if (candidate) reviewEvents.push(candidate);
          }
          if (events.data.length < REVIEW_EVENT_PAGE_SIZE) break;
        }
        const response = await this.client.octokit.rest.issues.get({
          owner: this.client.owner,
          repo: this.client.repo,
          issue_number: snapshot.number,
        });
        const refreshed = refreshedSnapshot(snapshot.number, response.data);
        if (!hasSameSnapshotFields(snapshot, refreshed)) {
          snapshot = refreshed;
          continue;
        }
        return {
          ...snapshot,
          review: {
            source: "reconciliation",
            latestRelevantEvent: reviewEventForSnapshot(snapshot, reviewEvents),
          },
        };
      }
    } catch {
      throw new GitHubReviewError();
    }
    throw new GitHubReviewError();
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
