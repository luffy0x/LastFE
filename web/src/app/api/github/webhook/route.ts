import { getSupabaseAdmin } from "@/server/supabase/admin";
import { requireServerEnv } from "@/server/supabase/env";
import {
  normalizeGitHubRepository,
  syncGitHubIssue,
} from "@/server/github/sync-issue";
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
  const signature = request.headers.get("x-hub-signature-256");

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
    repository?: {
      full_name?: string;
    };
    issue?: {
      number?: number;
      title?: string;
      body?: string | null;
      state?: string;
      labels?: unknown;
    };
  };
  const expectedRepository = normalizeGitHubRepository(
    requireServerEnv("GITHUB_REPOSITORY"),
  );
  const eventRepository = payload.repository?.full_name
    ? normalizeGitHubRepository(payload.repository.full_name)
    : "";
  if (eventRepository !== expectedRepository) {
    return Response.json(
      { ok: false, code: "WRONG_REPOSITORY" },
      { status: 403 },
    );
  }

  const issue = payload.issue;
  if (!issue?.number || !issue.title) {
    return Response.json({ ok: false, code: "INVALID_ISSUE" }, { status: 400 });
  }

  let result;
  try {
    result = await syncGitHubIssue({
      client: getSupabaseAdmin(),
      deliveryId,
      eventName,
      repository: expectedRepository,
      issue: {
        number: issue.number,
        title: issue.title,
        body: issue.body ?? null,
        state: issue.state ?? "open",
        labels: labelsFrom(issue.labels),
      },
    });
  } catch (error) {
    // GitHub 会按响应状态判断是否重试；带原因的日志让落库失败可从服务端日志直接定位
    console.error(
      JSON.stringify({
        event: "github-webhook-sync-failed",
        deliveryId,
        issueNumber: issue.number,
        reason: error instanceof Error ? error.message : String(error),
      }),
    );
    return Response.json(
      { ok: false, code: "SYNC_FAILED" },
      { status: 500 },
    );
  }

  return Response.json({ ok: true, result });
}
