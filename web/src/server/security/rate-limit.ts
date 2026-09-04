import { createHash, createHmac } from "node:crypto";

import type { SubmissionInput } from "@/features/content/submission-schemas";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

export function createSourceHasher(secret: string): (source: string) => string {
  if (!secret) throw new Error("RATE_LIMIT_HMAC_KEY is required");
  return (source) => createHmac("sha256", secret).update(source).digest("hex");
}

export function fingerprintSubmission(submission: SubmissionInput): string {
  const content = Object.fromEntries(
    Object.entries(submission).filter(([key]) => key !== "nickname"),
  );

  return createHash("sha256")
    .update(JSON.stringify(canonicalize(content)))
    .digest("hex");
}
