import { describe, expect, it, vi } from "vitest";

import {
  ensureGitHubReviewState,
  type GitHubClient,
} from "./client";

function fakeClient() {
  const removeLabel = vi.fn().mockResolvedValue({});
  const addLabels = vi.fn().mockResolvedValue({});
  const update = vi.fn().mockResolvedValue({});
  const client = {
    owner: "moderation-owner",
    repo: "private-submissions",
    octokit: { rest: { issues: { removeLabel, addLabels, update } } },
  } as unknown as GitHubClient;
  return { client, removeLabel, addLabels, update };
}

describe("ensureGitHubReviewState", () => {
  it("repairs the published label state and closes an approved issue", async () => {
    const { client, removeLabel, addLabels, update } = fakeClient();

    await ensureGitHubReviewState(101, "published", client);

    expect(removeLabel).toHaveBeenCalledWith({
      owner: "moderation-owner",
      repo: "private-submissions",
      issue_number: 101,
      name: "pending",
    });
    expect(addLabels).toHaveBeenCalledWith({
      owner: "moderation-owner",
      repo: "private-submissions",
      issue_number: 101,
      labels: ["published"],
    });
    expect(update).toHaveBeenCalledWith({
      owner: "moderation-owner",
      repo: "private-submissions",
      issue_number: 101,
      state: "closed",
    });
  });

  it("continues an idempotent publish repair when pending is already absent", async () => {
    const { client, removeLabel, addLabels, update } = fakeClient();
    removeLabel.mockRejectedValue({ status: 404 });

    await expect(
      ensureGitHubReviewState(101, "published", client),
    ).resolves.toBeUndefined();
    expect(addLabels).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it.each(["withdrawn", "rejected", "ignored"] as const)(
    "does not publish a %s issue",
    async (decision) => {
      const { client, removeLabel, addLabels, update } = fakeClient();

      await ensureGitHubReviewState(101, decision, client);

      expect(removeLabel).not.toHaveBeenCalled();
      expect(addLabels).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    },
  );
});
