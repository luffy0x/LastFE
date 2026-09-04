import { getSupabaseAdmin } from "@/server/supabase/admin";
import { requireServerEnv } from "@/server/supabase/env";
import { syncGitHubIssue } from "@/server/github/sync-issue";
import {
  readBoundedBody,
  verifyGitHubWebhookSignature,
} from "@/server/github/verify-webhook";

export const runtime = "nodejs";

type GitHubLabel = string | { name?: string | null };

function labelsFrom(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((label: GitHubLabel) =>
      typeof label === "string" ? label : (label.name ?? ""),
    )
    .filter(Boolean);
}

export async function POST(request: Request) {
  const body = await readBoundedBody(request);
  const secret = requireServerEnv("GITHUB_WEBHOOK_SECRET");
  const signature = request.headers.get("x-github-signature-256");

  if (!verifyGitHubWebhookSignature(body, signature, secret)) {
    return Response.json({ ok: false, code: "BAD_SIGNATURE" }, { status: 401 });
  }

  const eventName = request.headers.get("x-github-event") ?? "";
  const deliveryId = request.headers.get("x-github-delivery") ?? "";
  if (!deliveryId) {
    return Response.json({ ok: false, code: "MISSING_DELIVERY" }, { status: 400 });
  }

  if (eventName !== "issues") {
    return Response.json({ ok: true, status: "ignored" });
  }

  const payload = JSON.parse(body) as {
    issue?: {
      number?: number;
      title?: string;
      body?: string | null;
      state?: string;
      labels?: unknown;
    };
  };
  const issue = payload.issue;
  if (!issue?.number || !issue.title) {
    return Response.json({ ok: false, code: "INVALID_ISSUE" }, { status: 400 });
  }

  const result = await syncGitHubIssue({
    client: getSupabaseAdmin(),
    deliveryId,
    eventName,
    issue: {
      number: issue.number,
      title: issue.title,
      body: issue.body ?? null,
      state: issue.state ?? "open",
      labels: labelsFrom(issue.labels),
    },
  });

  return Response.json({ ok: true, result });
}
