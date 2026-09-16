import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeGitHubRepository,
  syncGitHubIssue,
} from "../src/server/github/sync-issue.ts";

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

async function listSubmissionIssues(repository) {
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
  const repository = normalizeGitHubRepository(
    requireServerEnv("GITHUB_REPOSITORY"),
  );
  const issues = await listSubmissionIssues(repository);
  let synced = 0;
  let failed = 0;

  for (const issue of issues) {
    try {
      await syncGitHubIssue({
        client,
        deliveryId: `reconcile:${repository}:${issue.number}:${issue.updated_at}`,
        eventName: "reconcile",
        repository,
        issue: normalizeIssue(issue),
      });
      synced += 1;
    } catch (error) {
      failed += 1;
      console.error(
        JSON.stringify({
          event: "github-reconcile-failed",
          issueNumber: issue.number,
          errorCategory: error instanceof Error ? error.name : "unknown",
          reason: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  console.log(JSON.stringify({ event: "github-reconcile-complete", synced, failed }));
  if (failed > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(
      JSON.stringify({
        event: "github-reconcile-crashed",
        errorCategory: error instanceof Error ? error.name : "unknown",
      }),
    );
    process.exitCode = 1;
  });
}
