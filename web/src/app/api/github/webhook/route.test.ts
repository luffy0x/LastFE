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

function signedRequest(body: string, delivery: string): Request {
  return new Request("https://lastfe.test/api/github/webhook", {
    method: "POST",
    body,
    headers: {
      "x-github-signature-256": `sha256=${createHmac("sha256", "secret").update(body).digest("hex")}`,
      "x-github-delivery": delivery,
      "x-github-event": "issues",
    },
  });
}

describe("POST /api/github/webhook", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
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

  it("logs safe diagnostics when signature verification fails", async () => {
    const secret = "super-secret-value";
    const body = '{"action":"labeled","private":"do-not-log"}';
    const signature = `sha256=${"a".repeat(64)}`;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", secret);
    const { POST } = await import("./route");

    const response = await POST(
      new Request("https://lastfe.test/api/github/webhook", {
        method: "POST",
        body,
        headers: {
          "x-github-signature-256": signature,
          "x-github-delivery": "delivery-diagnostic",
          "x-github-event": "issues",
          "x-request-id": "request-1",
        },
      }),
    );

    expect(response.status).toBe(401);
    expect(warnSpy).toHaveBeenCalledOnce();
    const serializedLog = String(warnSpy.mock.calls[0][0]);
    expect(JSON.parse(serializedLog)).toEqual({
      level: "warn",
      event: "github.webhook_signature_mismatch",
      deliveryId: "delivery-diagnostic",
      eventName: "issues",
      requestId: "request-1",
      runtimeId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      ),
      webhookKeyBytes: 18,
      webhookKeyFingerprint: "03767fbe4857",
      payloadBytes: 43,
      payloadSha256:
        "6452273ae5503e45c5e4b01e8169c52aa4aff1cc5985ee650d5b49734382bfd8",
      providedSignaturePrefix: "sha256=aaaaaaaaaaaa",
      expectedSignaturePrefix: "sha256=a79c996ef1ea",
    });
    expect(serializedLog).not.toContain(secret);
    expect(serializedLog).not.toContain(body);
    expect(serializedLog).not.toContain(signature);
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

  it("returns a 500 with a logged reason when sync fails", async () => {
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", "secret");
    const { POST } = await import("./route");
    const { syncGitHubIssue } = await import("@/server/github/sync-issue");
    vi.mocked(syncGitHubIssue).mockRejectedValueOnce(
      new Error("Issue body does not contain a LastFE submission payload"),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const body = JSON.stringify({
      action: "labeled",
      issue: {
        number: 10,
        title: "[interview] 字节一面",
        body: "body",
        state: "open",
        labels: [{ name: "submission" }, { name: "approved" }],
      },
    });
    const response = await POST(signedRequest(body, "delivery-3"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "SYNC_FAILED",
    });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("github-webhook-sync-failed"),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Issue body does not contain"),
    );
    errorSpy.mockRestore();
  });
});
