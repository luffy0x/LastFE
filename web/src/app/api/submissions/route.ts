import { buildSubmissionIssue } from "@/server/github/issue-codec";
import { parseSubmissionInput } from "@/features/content/submission-schemas";
import { requireServerEnv } from "@/server/supabase/env";

export const runtime = "nodejs";

function githubApiBaseUrl(): string {
  return process.env.GITHUB_API_BASE_URL?.replace(/\/$/, "") ?? "https://api.github.com";
}

function jsonError(message: string, status: number, code: string): Response {
  return Response.json({ ok: false, code, message }, { status });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("请求体必须是 JSON", 400, "INVALID_JSON");
  }

  if (
    payload &&
    typeof payload === "object" &&
    "website" in payload &&
    typeof (payload as { website?: unknown }).website === "string" &&
    (payload as { website: string }).website.trim()
  ) {
    return jsonError("投稿内容不符合要求", 400, "INVALID_SUBMISSION");
  }

  let issue;
  try {
    issue = buildSubmissionIssue(parseSubmissionInput(payload));
  } catch {
    return jsonError("投稿内容不符合要求", 400, "INVALID_SUBMISSION");
  }

  const repository = requireServerEnv("GITHUB_REPOSITORY");
  const token = requireServerEnv("GITHUB_TOKEN");
  const response = await fetch(`${githubApiBaseUrl()}/repos/${repository}/issues`, {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify(issue),
  });

  if (!response.ok) {
    return jsonError("审核队列暂时不可用，请稍后重试", 502, "GITHUB_UNAVAILABLE");
  }

  return Response.json({ ok: true }, { status: 201 });
}
