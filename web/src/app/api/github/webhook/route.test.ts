import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import type { GitHubIssueSnapshot, SyncResult } from "@/server/github/sync-issue";

import { createWebhookHandler, createWebhookRoute } from "./route";

const SECRET = "webhook-secret";
const VALID_PAYLOAD = {
  action: "labeled",
  label: {
    id: 3,
    node_id: "label-3",
    url: "https://example.invalid/3",
    name: "approved",
    color: "fff",
    default: false,
    description: null,
  },
  issue: {
    number: 101,
    title: "[interview] 字节跳动/基础架构 · 后端开发",
    body: "encoded issue body",
    labels: [
      { id: 1, node_id: "label-1", url: "https://example.invalid/1", name: "submission", color: "fff", default: false, description: null },
      { id: 2, node_id: "label-2", url: "https://example.invalid/2", name: "region:interview", color: "fff", default: false, description: null },
      { id: 3, node_id: "label-3", url: "https://example.invalid/3", name: "approved", color: "fff", default: false, description: null },
    ],
    state: "open",
    created_at: "2026-09-01T08:00:00.000Z",
    updated_at: "2026-09-01T08:05:00.000Z",
  },
};

const signature = (body: Uint8Array, secret = SECRET) =>
  `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

function request(
  body: Uint8Array,
  headers: Record<string, string> = {},
): Request {
  return new Request("http://localhost/api/github/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-event": "issues",
      "x-github-delivery": "delivery-1",
      "x-hub-signature-256": signature(body),
      ...headers,
    },
    body: body as unknown as BodyInit,
  });
}

function setup(result: SyncResult = "published") {
  const synchronize = vi.fn<
    (issue: GitHubIssueSnapshot, deliveryId: string) => Promise<SyncResult>
  >().mockResolvedValue(result);
  return {
    synchronize,
    handler: createWebhookHandler({ webhookSecret: SECRET, synchronize }),
  };
}

describe("GitHub webhook route", () => {
  it("retries production initialization after a transient failure", async () => {
    const loadHandler = vi
      .fn<() => Promise<(request: Request) => Promise<Response>>>()
      .mockRejectedValueOnce(new Error("temporary database failure"))
      .mockResolvedValueOnce(async () => Response.json({ ok: true }));
    const endpoint = createWebhookRoute(loadHandler);
    const incoming = new Request("http://localhost/api/github/webhook", {
      method: "POST",
    });

    const failed = await endpoint(incoming.clone());
    const retried = await endpoint(incoming.clone());
    const cached = await endpoint(incoming.clone());

    expect(failed.status).toBe(503);
    expect(retried.status).toBe(200);
    expect(cached.status).toBe(200);
    await expect(retried.json()).resolves.toEqual({ ok: true });
    expect(loadHandler).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight production initialization across concurrent requests", async () => {
    type Handler = (request: Request) => Promise<Response>;
    let resolveHandler!: (handler: Handler) => void;
    const loading = new Promise<Handler>((resolve) => {
      resolveHandler = resolve;
    });
    const loadHandler = vi.fn(() => loading);
    const endpoint = createWebhookRoute(loadHandler);
    const incoming = new Request("http://localhost/api/github/webhook", {
      method: "POST",
    });

    const first = endpoint(incoming.clone());
    const second = endpoint(incoming.clone());
    expect(loadHandler).toHaveBeenCalledTimes(1);

    resolveHandler(async () => Response.json({ ok: true }));
    await expect(first).resolves.toMatchObject({ status: 200 });
    await expect(second).resolves.toMatchObject({ status: 200 });
    expect(loadHandler).toHaveBeenCalledTimes(1);
  });

  it("verifies raw bytes and synchronizes an issues delivery", async () => {
    const raw = new TextEncoder().encode(JSON.stringify(VALID_PAYLOAD));
    const { handler, synchronize } = setup();

    const response = await handler(request(raw));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      result: "published",
    });
    expect(synchronize).toHaveBeenCalledWith(
      {
        number: 101,
        title: VALID_PAYLOAD.issue.title,
        body: VALID_PAYLOAD.issue.body,
        labels: ["submission", "region:interview", "approved"],
        state: "open",
        createdAt: "2026-09-01T08:00:00.000Z",
        updatedAt: "2026-09-01T08:05:00.000Z",
        review: {
          source: "webhook",
          action: "labeled",
          changedLabel: "approved",
        },
      },
      "delivery-1",
    );
  });

  it("rejects a bad signature before parsing invalid JSON", async () => {
    const raw = new TextEncoder().encode("private malformed body");
    const { handler, synchronize } = setup();
    const unsigned = request(raw, { "x-hub-signature-256": signature(raw, "wrong") });

    const response = await handler(unsigned);
    const body = await response.text();

    expect(response.status).toBe(401);
    expect(body).not.toContain("private malformed body");
    expect(body).not.toContain(unsigned.headers.get("x-hub-signature-256")!);
    expect(synchronize).not.toHaveBeenCalled();
  });

  it.each([
    ["a missing delivery", { "x-github-delivery": "" }],
    ["an unsupported event", { "x-github-event": "push" }],
  ])("rejects %s", async (_name, headers) => {
    const raw = new TextEncoder().encode(JSON.stringify(VALID_PAYLOAD));
    const { handler, synchronize } = setup();

    const response = await handler(request(raw, headers));

    expect(response.status).toBe(400);
    expect(synchronize).not.toHaveBeenCalled();
  });

  it("rejects a declared body above 256 KiB without reading it", async () => {
    const raw = new TextEncoder().encode(JSON.stringify(VALID_PAYLOAD));
    const { handler, synchronize } = setup();
    const oversized = request(raw, { "content-length": String(256 * 1024 + 1) });

    const response = await handler(oversized);

    expect(response.status).toBe(413);
    expect(synchronize).not.toHaveBeenCalled();
  });

  it("cancels a streamed body as soon as it exceeds 256 KiB", async () => {
    let cancelled = false;
    let emittedChunks = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        emittedChunks += 1;
        controller.enqueue(new Uint8Array(64 * 1024));
        if (emittedChunks === 20) controller.close();
      },
      cancel() {
        cancelled = true;
      },
    });
    const { handler, synchronize } = setup();
    const streamed = new Request("http://localhost/api/github/webhook", {
      method: "POST",
      headers: {
        "x-github-event": "issues",
        "x-github-delivery": "delivery-stream",
        "x-hub-signature-256": `sha256=${"0".repeat(64)}`,
      },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const response = await handler(streamed);

    expect(response.status).toBe(413);
    expect(cancelled).toBe(true);
    expect(emittedChunks).toBeLessThanOrEqual(6);
    expect(synchronize).not.toHaveBeenCalled();
  });

  it("returns a safe retryable category when synchronization fails", async () => {
    const raw = new TextEncoder().encode(JSON.stringify(VALID_PAYLOAD));
    const synchronize = vi
      .fn<(issue: GitHubIssueSnapshot, deliveryId: string) => Promise<SyncResult>>()
      .mockRejectedValue(
        new Error("token ghp_private, signature, and encoded issue body"),
      );
    const log = vi.fn();
    const handler = createWebhookHandler({
      webhookSecret: SECRET,
      synchronize,
      log,
    });

    const response = await handler(request(raw, { "x-request-id": "request_42" }));
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(body).toContain('"code":"SYNC"');
    expect(body).not.toContain("ghp_private");
    expect(body).not.toContain("encoded issue body");
    expect(log).toHaveBeenCalledWith("error", "webhook.sync_failed", {
      requestId: "request_42",
      issueNumber: 101,
      errorCategory: "synchronization",
    });
  });
});
