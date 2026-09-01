import "server-only";

import { createHash } from "node:crypto";

import type { Submission } from "@/features/submissions/types";
import type {
  ContentModerationStore,
  ContentSyncCommand,
} from "@/server/content/sqlite-repository";

import { decodeIssue } from "./issue-codec";

export type ReviewRelevantEvent = {
  id: string;
  action: "labeled" | "unlabeled";
  label: "approved" | "unpublish";
  createdAt: string;
};

export type GitHubReviewEvidence =
  | {
      source: "webhook";
      action: string;
      changedLabel: string | null;
    }
  | {
      source: "reconciliation";
      latestRelevantEvent: ReviewRelevantEvent | null;
    };

export type GitHubIssueSnapshot = {
  number: number;
  title: string;
  body: string;
  labels: readonly string[];
  state: "open" | "closed";
  createdAt: string;
  updatedAt: string;
  review: GitHubReviewEvidence;
};

export type ModerationDecision =
  | "published"
  | "withdrawn"
  | "rejected"
  | "ignored";

export type ModerationState = {
  isClosed: boolean;
  labels: ReadonlySet<string>;
};

export type SyncResult = ModerationDecision | "duplicate" | "stale";

export type SyncIssueDependencies = {
  moderation: ContentModerationStore;
  ensureReviewState(
    issueNumber: number,
    decision: ModerationDecision,
  ): Promise<void>;
  invalidate(paths: readonly string[]): Promise<void>;
};

export type SyncIssueErrorCode =
  | "INVALID_ISSUE"
  | "DATABASE"
  | "CACHE"
  | "GITHUB";

export class SyncIssueError extends Error {
  constructor(readonly code: SyncIssueErrorCode) {
    super(`Issue synchronization failed (${code})`);
    this.name = "SyncIssueError";
  }
}

export function decideModerationState(
  state: ModerationState,
): ModerationDecision {
  if (state.labels.has("unpublish")) return "withdrawn";
  if (state.labels.has("approved")) return "published";
  if (state.isClosed) return "rejected";
  return "ignored";
}

export function moderationDecisionFor(
  event: GitHubIssueSnapshot,
): ModerationDecision {
  const snapshotDecision = decideModerationState({
    isClosed: event.state === "closed",
    labels: new Set(event.labels),
  });
  if (snapshotDecision !== "published") return snapshotDecision;

  const latestAction =
    event.review.source === "webhook"
      ? {
          action: event.review.action,
          label: event.review.changedLabel,
        }
      : event.review.latestRelevantEvent;
  if (latestAction?.label === "unpublish") return "withdrawn";
  if (
    latestAction?.action === "labeled" &&
    latestAction.label === "approved"
  ) {
    return "published";
  }
  return "ignored";
}

export function moderationSnapshotIdentity(
  event: GitHubIssueSnapshot,
  decision: ModerationDecision,
): string {
  const canonical = JSON.stringify({
    issueNumber: event.number,
    state: event.state,
    labels: [...new Set(event.labels)].sort(),
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    title: event.title,
    body: event.body,
    review: event.review,
    decision,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

type PublishedRecord = Extract<
  ContentSyncCommand,
  { action: "publish" }
>["record"];

function contentFields(submission: Submission): Pick<
  PublishedRecord,
  "summary" | "metadata" | "markdown" | "externalUrl"
> {
  switch (submission.regionSlug) {
    case "interview":
      return {
        summary: null,
        metadata: {
          companyDepartment: submission.companyDepartment,
          position: submission.position,
        },
        markdown: submission.markdown,
        externalUrl: null,
      };
    case "resources":
      return {
        summary: submission.summary ?? null,
        metadata: {},
        markdown: null,
        externalUrl: submission.url,
      };
    case "fundamentals":
      return {
        summary: null,
        metadata: { category: submission.category },
        markdown: submission.markdown,
        externalUrl: null,
      };
    case "projects":
      return {
        summary: null,
        metadata: { techStack: submission.techStack.join(" / ") },
        markdown: submission.markdown,
        externalUrl: submission.demoUrl ?? submission.repositoryUrl ?? null,
      };
    case "algorithms":
      return {
        summary: null,
        metadata: {
          source: submission.source,
          difficulty: submission.difficulty,
        },
        markdown: submission.markdown,
        externalUrl: submission.problemUrl ?? null,
      };
  }
}

function publishCommand(
  event: GitHubIssueSnapshot,
  deliveryId: string,
  decision: ModerationDecision,
  submission: Submission,
): ContentSyncCommand {
  return {
    deliveryId,
    action: "publish",
    ordering: {
      updatedAt: event.updatedAt,
      snapshotIdentity: moderationSnapshotIdentity(event, decision),
      authoritative: event.review.source === "reconciliation",
    },
    record: {
      id: `gh-${event.number}`,
      githubIssueNumber: event.number,
      regionSlug: submission.regionSlug,
      title: submission.title,
      nickname: submission.nickname ?? null,
      tags: submission.tags,
      publishedAt: event.updatedAt,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      status: "published",
      ...contentFields(submission),
    },
  };
}

function commandFor(
  event: GitHubIssueSnapshot,
  deliveryId: string,
  decision: ModerationDecision,
  submission: Submission,
): ContentSyncCommand {
  if (decision === "published") {
    return publishCommand(event, deliveryId, decision, submission);
  }
  return {
    deliveryId,
    action:
      decision === "withdrawn"
        ? "withdraw"
        : decision === "rejected"
          ? "reject"
          : "ignore",
    issueNumber: event.number,
    ordering: {
      updatedAt: event.updatedAt,
      snapshotIdentity: moderationSnapshotIdentity(event, decision),
      authoritative: event.review.source === "reconciliation",
    },
  };
}

function validTimestamp(value: string): boolean {
  return value.length > 0 && Number.isFinite(Date.parse(value));
}

function decodeSubmission(event: GitHubIssueSnapshot): Submission {
  if (
    !Number.isSafeInteger(event.number) ||
    event.number < 1 ||
    !validTimestamp(event.createdAt) ||
    !validTimestamp(event.updatedAt) ||
    !event.labels.includes("submission")
  ) {
    throw new SyncIssueError("INVALID_ISSUE");
  }

  let submission: Submission;
  try {
    submission = decodeIssue({
      title: event.title,
      body: event.body,
      labels: [...event.labels],
    });
  } catch {
    throw new SyncIssueError("INVALID_ISSUE");
  }

  if (!event.labels.includes(`region:${submission.regionSlug}`)) {
    throw new SyncIssueError("INVALID_ISSUE");
  }
  return submission;
}

export async function syncIssue(
  event: GitHubIssueSnapshot,
  deliveryId: string,
  dependencies: SyncIssueDependencies,
): Promise<SyncResult> {
  if (!deliveryId.trim()) throw new SyncIssueError("INVALID_ISSUE");

  const submission = decodeSubmission(event);
  const decision = moderationDecisionFor(event);
  let result: "applied" | "duplicate" | "stale";
  try {
    result = await dependencies.moderation.apply(
      commandFor(event, deliveryId, decision, submission),
    );
  } catch {
    throw new SyncIssueError("DATABASE");
  }

  if (result === "stale") return "stale";

  const contentId = `gh-${event.number}`;
  try {
    await dependencies.invalidate([
      "/",
      `/regions/${submission.regionSlug}`,
      `/content/${contentId}`,
      "/api/search",
    ]);
  } catch {
    throw new SyncIssueError("CACHE");
  }

  try {
    await dependencies.ensureReviewState(event.number, decision);
  } catch {
    throw new SyncIssueError("GITHUB");
  }

  return result === "duplicate" ? "duplicate" : decision;
}
