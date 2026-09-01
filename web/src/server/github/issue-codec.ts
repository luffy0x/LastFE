import "server-only";

import { parseSubmission } from "@/features/submissions/schemas";
import type { Submission } from "@/features/submissions/types";

export type SubmissionIssue = {
  title: string;
  body: string;
  labels: string[];
};

const ISSUE_ENVELOPE =
  /^<!-- submission:v1:([A-Za-z0-9_-]+) -->\n<!-- submission-content -->\n([\s\S]*)$/;

const splitSubmission = (submission: Submission) => {
  if (submission.regionSlug === "resources") {
    const { summary, ...metadata } = submission;
    return { metadata, prose: summary ?? "" };
  }

  const { markdown, ...metadata } = submission;
  return { metadata, prose: markdown };
};

export function encodeIssue(submission: Submission): SubmissionIssue {
  const { metadata, prose } = splitSubmission(submission);
  const marker = `<!-- submission:v1:${Buffer.from(JSON.stringify(metadata)).toString("base64url")} -->`;

  return {
    title: `[${submission.regionSlug}] ${submission.title}`,
    body: `${marker}\n<!-- submission-content -->\n${prose}`,
    labels: ["submission", "pending", `region:${submission.regionSlug}`],
  };
}

export function decodeIssue(issue: SubmissionIssue): Submission {
  const match = ISSUE_ENVELOPE.exec(issue.body);
  if (!match) throw new Error("Malformed submission issue envelope");

  let metadata: unknown;
  try {
    metadata = JSON.parse(Buffer.from(match[1], "base64url").toString("utf8"));
  } catch {
    throw new Error("Malformed submission issue metadata");
  }
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") {
    throw new Error("Submission issue metadata must be an object");
  }

  const regionSlug = (metadata as Record<string, unknown>).regionSlug;
  if (typeof regionSlug !== "string") {
    throw new Error("Submission issue metadata has no region");
  }

  const prose = match[2];
  return parseSubmission(regionSlug, {
    ...metadata,
    ...(regionSlug === "resources" ? { summary: prose } : { markdown: prose }),
  });
}
