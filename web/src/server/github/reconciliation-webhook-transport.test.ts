import { describe, expect, it, vi } from "vitest";

import { createWebhookHandler } from "@/app/api/github/webhook/route";

import { createReconciliationWebhookTransport } from "./reconciliation-webhook-transport";
import type { GitHubIssueSnapshot } from "./sync-issue";

const WEBHOOK_SECRET = "test-webhook-secret";
const ISSUE: GitHubIssueSnapshot = {
  number: 101,
  title: "[interview] candidate",
  body: "encoded test submission",
  labels: ["submission", "region:interview", "approved"],
  state: "open",
  createdAt: "2026-09-01T08:00:00.000Z",
  updatedAt: "2026-09-01T08:05:00.000Z",
};

describe("reconciliation webhook transport", () => {
  it("posts a correctly signed synthetic issues delivery through the existing webhook handler", async () => {
    const synchronize = vi.fn().mockResolvedValue("published");
    const handler = createWebhookHandler({ webhookSecret: WEBHOOK_SECRET, synchronize });
    const fetch = vi.fn((input: string | URL, init?: RequestInit) =>
      handler(new Request(input, init)),
    );
    const transport = createReconciliationWebhookTransport({
      appOrigin: "http://moderation-app:3000",
      webhookSecret: WEBHOOK_SECRET,
      fetch,
    });

    await expect(
      transport.syncIssue(ISSUE, "reconcile:101:2026-09-01T08:05:00.000Z"),
    ).resolves.toBe("published");
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      "http://moderation-app:3000/api/github/webhook",
      expect.objectContaining({ method: "POST" }),
    );
    expect(synchronize).toHaveBeenCalledExactlyOnceWith(
      ISSUE,
      "reconcile:101:2026-09-01T08:05:00.000Z",
    );
  });

  it("returns a safe failure when the webhook endpoint rejects a reconciliation delivery", async () => {
    const privateIssue = { ...ISSUE, body: "private submission body" };
    const transport = createReconciliationWebhookTransport({
      appOrigin: "http://moderation-app:3000",
      webhookSecret: WEBHOOK_SECRET,
      fetch: vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    });

    let caught: unknown;
    try {
      await transport.syncIssue(privateIssue, "reconcile:101:2026-09-01T08:05:00.000Z");
    } catch (error) {
      caught = error;
    }

    expect(String(caught)).toContain("WEBHOOK");
    expect(String(caught)).not.toContain(privateIssue.body);
    expect(String(caught)).not.toContain(WEBHOOK_SECRET);
  });
});
