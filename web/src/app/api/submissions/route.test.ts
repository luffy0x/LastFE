import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AbuseStoreError } from "@/server/security/abuse-store";

import {
  createSubmissionHandler,
  POST,
  type AbuseStore,
  type SubmissionQueue,
} from "./route";

const VALID_INTERVIEW_INPUT = {
  regionSlug: "interview",
  companyDepartment: "字节跳动/基础架构",
  position: "后端开发",
  tags: ["一面"],
  markdown: "面试记录",
  altcha: {
    algorithm: "SHA-256",
    challenge: "test",
    number: 1,
    salt: "test",
    signature: "test",
  },
};

const makeRequest = (body: unknown) =>
  new Request("http://localhost/api/submissions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-real-ip": "203.0.113.10",
    },
    body: JSON.stringify(body),
  });

describe("createSubmissionHandler", () => {
  let queue: SubmissionQueue;
  let abuse: AbuseStore;

  beforeEach(() => {
    queue = {
      enqueue: vi.fn().mockResolvedValue({ issueNumber: 101 }),
    };
    abuse = {
      reserve: vi.fn().mockResolvedValue({ reservationId: "reservation-1" }),
      recordSuccess: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("rejects a submission when challenge verification fails", async () => {
    const handler = createSubmissionHandler({
      challenge: {
        create: vi.fn(),
        verify: vi.fn().mockResolvedValue(false),
      },
      abuse,
      queue,
      hashSource: () => "hashed-test-source",
      now: () => new Date("2026-09-01T08:00:00.000Z"),
    });

    const response = await handler(makeRequest(VALID_INTERVIEW_INPUT));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "CHALLENGE",
      message: "验证未通过，请刷新验证后重试。",
    });
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("fails closed when challenge verification is unavailable", async () => {
    const handler = createSubmissionHandler({
      challenge: {
        create: vi.fn(),
        verify: vi.fn().mockRejectedValue(new Error("secret verification failure")),
      },
      abuse,
      queue,
      hashSource: () => "hashed-test-source",
      now: () => new Date("2026-09-01T08:00:00.000Z"),
    });

    const response = await handler(makeRequest(VALID_INTERVIEW_INPUT));
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(body).not.toContain("secret verification failure");
    expect(body).not.toContain("面试记录");
    expect(abuse.reserve).not.toHaveBeenCalled();
  });

  it("rejects a declared body larger than 64 KiB before reading it", async () => {
    const challenge = {
      create: vi.fn(),
      verify: vi.fn().mockResolvedValue(true),
    };
    const handler = createSubmissionHandler({
      challenge,
      abuse,
      queue,
      hashSource: () => "hashed-test-source",
      now: () => new Date("2026-09-01T08:00:00.000Z"),
    });
    const request = makeRequest(VALID_INTERVIEW_INPUT);
    request.headers.set("content-length", String(64 * 1024 + 1));

    const response = await handler(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "INVALID",
    });
    expect(challenge.verify).not.toHaveBeenCalled();
  });

  it("stops a streamed body when it exceeds 64 KiB without content-length", async () => {
    let cancelled = false;
    let emittedChunks = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        emittedChunks += 1;
        controller.enqueue(new Uint8Array(16 * 1024));
        if (emittedChunks === 20) controller.close();
      },
      cancel() {
        cancelled = true;
      },
    });
    const handler = createSubmissionHandler({
      challenge: { create: vi.fn(), verify: vi.fn().mockResolvedValue(true) },
      abuse,
      queue,
      hashSource: () => "hashed-test-source",
      now: () => new Date("2026-09-01T08:00:00.000Z"),
    });
    const request = new Request("http://localhost/api/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const response = await handler(request);

    expect(response.status).toBe(400);
    expect(cancelled).toBe(true);
    expect(emittedChunks).toBeLessThanOrEqual(6);
  });

  it("rejects a non-empty raw honeypot before schema and challenge work", async () => {
    const challenge = {
      create: vi.fn(),
      verify: vi.fn().mockResolvedValue(true),
    };
    const handler = createSubmissionHandler({
      challenge,
      abuse,
      queue,
      hashSource: () => "hashed-test-source",
      now: () => new Date("2026-09-01T08:00:00.000Z"),
    });

    const response = await handler(
      makeRequest({ ...VALID_INTERVIEW_INPUT, website: " " }),
    );

    expect(response.status).toBe(400);
    expect(challenge.verify).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("rejects a non-string honeypot before schema and challenge work", async () => {
    const challenge = {
      create: vi.fn(),
      verify: vi.fn().mockResolvedValue(true),
    };
    const handler = createSubmissionHandler({
      challenge,
      abuse,
      queue,
      hashSource: () => "hashed-test-source",
      now: () => new Date("2026-09-01T08:00:00.000Z"),
    });

    const response = await handler(
      makeRequest({ ...VALID_INTERVIEW_INPUT, website: ["bot"] }),
    );

    expect(response.status).toBe(400);
    expect(challenge.verify).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("returns INVALID for a territory schema failure without exposing details", async () => {
    const challenge = {
      create: vi.fn(),
      verify: vi.fn().mockResolvedValue(true),
    };
    const handler = createSubmissionHandler({
      challenge,
      abuse,
      queue,
      hashSource: () => "hashed-test-source",
      now: () => new Date("2026-09-01T08:00:00.000Z"),
    });

    const response = await handler(
      makeRequest({ ...VALID_INTERVIEW_INPUT, position: "" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "INVALID",
      message: "投稿内容无效，请检查后重试。",
    });
    expect(challenge.verify).not.toHaveBeenCalled();
  });

  it("fails closed without the proxy-owned X-Real-IP header", async () => {
    const handler = createSubmissionHandler({
      challenge: { create: vi.fn(), verify: vi.fn().mockResolvedValue(true) },
      abuse,
      queue,
      hashSource: vi.fn(),
      now: () => new Date("2026-09-01T08:00:00.000Z"),
    });
    const request = makeRequest(VALID_INTERVIEW_INPUT);
    request.headers.delete("x-real-ip");
    request.headers.set("x-forwarded-for", "198.51.100.7");

    const response = await handler(request);

    expect(response.status).toBe(400);
    expect(abuse.reserve).not.toHaveBeenCalled();
  });

  it("reserves the hashed source and canonical content before enqueueing", async () => {
    const hashSource = vi.fn().mockReturnValue("hashed-test-source");
    const now = new Date("2026-09-01T08:00:00.000Z");
    const handler = createSubmissionHandler({
      challenge: { create: vi.fn(), verify: vi.fn().mockResolvedValue(true) },
      abuse,
      queue,
      hashSource,
      now: () => now,
    });
    const expectedFingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          companyDepartment: "字节跳动/基础架构",
          markdown: "面试记录",
          position: "后端开发",
          regionSlug: "interview",
          tags: ["一面"],
          title: "字节跳动/基础架构 · 后端开发",
        }),
      )
      .digest("hex");

    const response = await handler(makeRequest(VALID_INTERVIEW_INPUT));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true, issueNumber: 101 });
    expect(hashSource).toHaveBeenCalledWith("203.0.113.10");
    expect(abuse.reserve).toHaveBeenCalledWith({
      sourceHash: "hashed-test-source",
      fingerprint: expectedFingerprint,
      now,
    });
    expect(queue.enqueue).toHaveBeenCalledWith(
      expect.not.objectContaining({ altcha: expect.anything() }),
    );
    expect(abuse.recordSuccess).toHaveBeenCalledWith("reservation-1", now);
    expect(
      vi.mocked(abuse.reserve).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(queue.enqueue).mock.invocationCallOrder[0]);
    expect(
      vi.mocked(queue.enqueue).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(abuse.recordSuccess).mock.invocationCallOrder[0]);
  });

  it.each([
    ["DUPLICATE", 409, false],
    ["RATE_LIMIT", 429, true],
  ] as const)(
    "maps %s reservation rejection without enqueueing",
    async (code, status, hasRetryAfter) => {
      vi.mocked(abuse.reserve).mockRejectedValue(new AbuseStoreError(code));
      const handler = createSubmissionHandler({
        challenge: { create: vi.fn(), verify: vi.fn().mockResolvedValue(true) },
        abuse,
        queue,
        hashSource: () => "hashed-test-source",
        now: () => new Date("2026-09-01T08:00:00.000Z"),
      });

      const response = await handler(makeRequest(VALID_INTERVIEW_INPUT));

      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toMatchObject({ ok: false, code });
      expect(response.headers.has("retry-after")).toBe(hasRetryAfter);
      expect(queue.enqueue).not.toHaveBeenCalled();
    },
  );

  it("releases the reservation and returns a safe retryable error when enqueue fails", async () => {
    vi.mocked(queue.enqueue).mockRejectedValue(
      new Error(
        "failed for 203.0.113.10 with body 面试记录 at https://github.com/private/issues/1",
      ),
    );
    const handler = createSubmissionHandler({
      challenge: { create: vi.fn(), verify: vi.fn().mockResolvedValue(true) },
      abuse,
      queue,
      hashSource: () => "hashed-test-source",
      now: () => new Date("2026-09-01T08:00:00.000Z"),
    });

    const response = await handler(makeRequest(VALID_INTERVIEW_INPUT));
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(body).toContain('"code":"UPSTREAM"');
    expect(body).not.toContain("github.com");
    expect(body).not.toContain("203.0.113.10");
    expect(body).not.toContain("面试记录");
    expect(abuse.release).toHaveBeenCalledWith("reservation-1");
    expect(abuse.recordSuccess).not.toHaveBeenCalled();
  });

  it("keeps production configuration lazy and fails closed when secrets are absent", async () => {
    vi.stubEnv("ALTCHA_HMAC_KEY", "");
    vi.stubEnv("RATE_LIMIT_HMAC_KEY", "");
    vi.stubEnv("SQLITE_PATH", "");

    const response = await POST(makeRequest(VALID_INTERVIEW_INPUT));

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("60");
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "UPSTREAM",
    });
    vi.unstubAllEnvs();
  });
});
