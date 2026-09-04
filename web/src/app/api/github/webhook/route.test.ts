import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/content/repository", () => ({
  getContentRepository: vi.fn(),
}));
vi.mock("@/server/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(() => ({ from: vi.fn() })),
}));
vi.mock("@/server/github/sync-issue", () => ({
  syncGitHubIssue: vi.fn(() => Promise.resolve({ status: "ignored" })),
}));

describe("POST /api/github/webhook", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("rejects requests with a bad signature", async () => {
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", "secret");
    const { POST } = await import("./route");

    const response = await POST(
      new Request("https://lastfe.test/api/github/webhook", {
        method: "POST",
        body: JSON.stringify({ action: "labeled" }),
        headers: {
          "x-github-signature-256": "sha256=bad",
          "x-github-delivery": "delivery-1",
          "x-github-event": "issues",
        },
      }),
    );

    expect(response.status).toBe(401);
  });

  it("accepts signed issue events and dispatches sync", async () => {
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", "secret");
    const body = JSON.stringify({
      action: "labeled",
      issue: {
        number: 9,
        title: "[interview] 字节一面",
        body: "body",
        state: "open",
        labels: [{ name: "submission" }, { name: "approved" }],
      },
    });
    const signature = `sha256=${createHmac("sha256", "secret").update(body).digest("hex")}`;
    const { POST } = await import("./route");
    const { syncGitHubIssue } = await import("@/server/github/sync-issue");

    const response = await POST(
      new Request("https://lastfe.test/api/github/webhook", {
        method: "POST",
        body,
        headers: {
          "x-github-signature-256": signature,
          "x-github-delivery": "delivery-2",
          "x-github-event": "issues",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(syncGitHubIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryId: "delivery-2",
        issue: expect.objectContaining({ number: 9 }),
      }),
    );
  });
});
