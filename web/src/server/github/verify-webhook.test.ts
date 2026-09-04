import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyGitHubWebhookSignature } from "./verify-webhook";

describe("verifyGitHubWebhookSignature", () => {
  it("accepts only the matching sha256 GitHub signature", () => {
    const body = JSON.stringify({ action: "labeled" });
    const secret = "test-secret";
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

    expect(verifyGitHubWebhookSignature(body, signature, secret)).toBe(true);
    expect(verifyGitHubWebhookSignature(body, "sha256=bad", secret)).toBe(false);
  });
});
