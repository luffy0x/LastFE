import "server-only";

import { Octokit } from "@octokit/rest";

import { getServerConfig } from "@/server/config";
import type { ModerationDecision } from "./sync-issue";

export type GitHubClient = {
  octokit: Octokit;
  owner: string;
  repo: string;
};

let client: GitHubClient | undefined;

export function createGitHubClient(): GitHubClient {
  if (client) return client;

  const { github } = getServerConfig();
  client = {
    octokit: new Octokit({
      auth: github.token,
      ...(github.apiBaseUrl ? { baseUrl: github.apiBaseUrl } : {}),
    }),
    owner: github.owner,
    repo: github.repo,
  };
  return client;
}

export async function ensureGitHubReviewState(
  issueNumber: number,
  decision: ModerationDecision,
  githubClient: GitHubClient = createGitHubClient(),
): Promise<void> {
  if (decision !== "published") return;

  const issue = {
    owner: githubClient.owner,
    repo: githubClient.repo,
    issue_number: issueNumber,
  };
  try {
    await githubClient.octokit.rest.issues.removeLabel({
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
  await githubClient.octokit.rest.issues.addLabels({
    ...issue,
    labels: ["published"],
  });
  await githubClient.octokit.rest.issues.update({
    ...issue,
    state: "closed",
  });
}
