import "server-only";

import { Octokit } from "@octokit/rest";

import { getServerConfig } from "@/server/config";

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
