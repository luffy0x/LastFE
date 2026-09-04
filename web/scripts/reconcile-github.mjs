import { createClient } from "@supabase/supabase-js";

const PAYLOAD_START = "<!-- lastfe-submission:v1";
const PAYLOAD_END = "-->";

function requireServerEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required server environment variable: ${name}`);
  return value;
}

function getSupabaseAdmin() {
  return createClient(
    requireServerEnv("SUPABASE_URL"),
    requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}

function githubApiBaseUrl() {
  return process.env.GITHUB_API_BASE_URL?.replace(/\/$/, "") ?? "https://api.github.com";
}

function normalizeIssue(issue) {
  return {
    number: issue.number,
    title: issue.title,
    body: issue.body,
    state: issue.state,
    labels: issue.labels
      .map((label) => (typeof label === "string" ? label : (label.name ?? "")))
      .filter(Boolean),
  };
}

function parseSubmissionIssueBody(body) {
  const start = body.indexOf(PAYLOAD_START);
  if (start === -1) throw new Error("missing submission payload");
  const payloadStart = start + PAYLOAD_START.length;
  const end = body.indexOf(PAYLOAD_END, payloadStart);
  if (end === -1) throw new Error("missing submission payload");
  return JSON.parse(Buffer.from(body.slice(payloadStart, end).trim(), "base64url").toString("utf8"));
}

function hasLabel(issue, label) {
  return issue.labels.some((candidate) => candidate.trim().toLocaleLowerCase() === label);
}

function summaryFrom(markdown, fallback) {
  if (fallback) return fallback;
  if (!markdown) return null;
  return markdown.replace(/^#{1,6}\s+/gm, "").replace(/\s+/g, " ").trim().slice(0, 180);
}

async function recordDelivery(client, issue, deliveryId, eventName, status) {
  const { error } = await client.from("moderation_events").insert({
    delivery_id: deliveryId,
    github_issue_number: issue.number,
    event_name: `${eventName}:${status}`,
  });
  if (error) throw new Error(`moderation event write failed: ${error.message}`);
}

async function syncGitHubIssue(client, deliveryId, eventName, issue) {
  const duplicate = await client
    .from("moderation_events")
    .select("delivery_id")
    .eq("delivery_id", deliveryId)
    .maybeSingle();
  if (duplicate.error) throw new Error(`moderation lookup failed: ${duplicate.error.message}`);
  if (duplicate.data) return { status: "duplicate" };

  const contentId = `github-issue-${issue.number}`;
  if (!hasLabel(issue, "submission")) {
    await recordDelivery(client, issue, deliveryId, eventName, "ignored");
    return { status: "ignored" };
  }

  if (hasLabel(issue, "unpublish")) {
    const { error } = await client
      .from("content")
      .update({ status: "withdrawn", updated_at: new Date().toISOString() })
      .eq("github_issue_number", issue.number);
    if (error) throw new Error(`content withdrawal failed: ${error.message}`);
    await recordDelivery(client, issue, deliveryId, eventName, "withdrawn");
    return { status: "withdrawn" };
  }

  if (!hasLabel(issue, "approved")) {
    await recordDelivery(client, issue, deliveryId, eventName, issue.state === "closed" ? "rejected" : "ignored");
    return { status: issue.state === "closed" ? "rejected" : "ignored" };
  }

  const submission = parseSubmissionIssueBody(issue.body ?? "");
  const timestamp = new Date().toISOString();
  const { error } = await client.from("content").upsert(
    {
      id: contentId,
      github_issue_number: issue.number,
      region_slug: submission.regionSlug,
      status: "published",
      title: submission.title,
      summary: summaryFrom(submission.markdown, submission.summary),
      nickname: submission.nickname,
      markdown: submission.markdown,
      external_url: submission.externalUrl,
      metadata_json: submission.metadata,
      published_at: timestamp,
      updated_at: timestamp,
    },
    { onConflict: "github_issue_number" },
  );
  if (error) throw new Error(`content upsert failed: ${error.message}`);
  await recordDelivery(client, issue, deliveryId, eventName, "published");
  return { status: "published" };
}

async function listSubmissionIssues() {
  const repository = requireServerEnv("GITHUB_REPOSITORY");
  const token = requireServerEnv("GITHUB_TOKEN");
  const url = new URL(`${githubApiBaseUrl()}/repos/${repository}/issues`);
  url.searchParams.set("state", "all");
  url.searchParams.set("labels", "submission");
  url.searchParams.set("sort", "updated");
  url.searchParams.set("direction", "desc");
  url.searchParams.set("per_page", "100");

  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub reconciliation fetch failed: ${response.status}`);
  }

  const issues = await response.json();
  return issues.filter((issue) => !issue.pull_request);
}

async function main() {
  const client = getSupabaseAdmin();
  const issues = await listSubmissionIssues();
  let synced = 0;
  let failed = 0;

  for (const issue of issues) {
    try {
      await syncGitHubIssue(
        client,
        `reconcile:${issue.number}:${issue.updated_at}`,
        "reconcile",
        normalizeIssue(issue),
      );
      synced += 1;
    } catch (error) {
      failed += 1;
      console.error(
        JSON.stringify({
          event: "github-reconcile-failed",
          issueNumber: issue.number,
          errorCategory: error instanceof Error ? error.name : "unknown",
        }),
      );
    }
  }

  console.log(JSON.stringify({ event: "github-reconcile-complete", synced, failed }));
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      event: "github-reconcile-crashed",
      errorCategory: error instanceof Error ? error.name : "unknown",
    }),
  );
  process.exitCode = 1;
});
