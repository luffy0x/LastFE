import { describe, expect, it, vi } from "vitest";

import {
  AbuseStoreError,
  type AbuseStore,
} from "@/server/security/supabase-abuse-store";
import type { SubmissionInput } from "@/features/content/submission-schemas";

import { createSubmissionHandler } from "./route";

const validSubmission = {
  regionSlug: "resources",
  title: "React 路线",
  tags: ["React"],
  externalUrl: "https://react.dev/learn",
  metadata: {},
};

function request(body: unknown, headers: HeadersInit = {}) {
  return new Request("https://lastfe.test/api/submissions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-real-ip": "203.0.113.10",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function dependencies(overrides: Partial<{
  abuse: AbuseStore;
  enqueue: (submission: SubmissionInput) => Promise<Response>;
}> = {}) {
  const abuse: AbuseStore = overrides.abuse ?? {
    reserve: vi.fn(() => Promise.resolve({ reservationId: "reservation-1" })),
    recordSuccess: vi.fn(() => Promise.resolve()),
    release: vi.fn(() => Promise.resolve()),
  };
  const enqueue =
    overrides.enqueue ??
    vi.fn(() => Promise.resolve(Response.json({ number: 22 }, { status: 201 })));

  return {
    abuse,
    enqueue,
    handler: createSubmissionHandler({
      abuse,
      enqueue,
      hashSource: vi.fn(() => "hashed-source"),
      now: vi.fn(() => new Date("2026-09-04T08:00:00.000Z")),
    }),
  };
}

describe("POST /api/submissions", () => {
  it("reserves abuse state, enqueues the issue, and records success", async () => {
    const { abuse, enqueue, handler } = dependencies();

    const response = await handler(request(validSubmission));

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.status).toBe(201);
    expect(abuse.reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceHash: "hashed-source",
        fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining(validSubmission));
    expect(abuse.recordSuccess).toHaveBeenCalledWith(
      "reservation-1",
      new Date("2026-09-04T08:00:00.000Z"),
    );
  });

  it("rejects oversized bodies before reserving abuse state", async () => {
    const { abuse, handler } = dependencies();

    const response = await handler(
      request(validSubmission, { "content-length": String(64 * 1024 + 1) }),
    );

    expect(response.status).toBe(400);
    expect(abuse.reserve).not.toHaveBeenCalled();
  });

  it("rejects duplicate submissions and rate-limited sources", async () => {
    const duplicate = dependencies({
      abuse: {
        reserve: vi.fn(() => Promise.reject(new AbuseStoreError("DUPLICATE"))),
        recordSuccess: vi.fn(),
        release: vi.fn(),
      },
    });
    const duplicateResponse = await duplicate.handler(request(validSubmission));
    await expect(duplicateResponse.json()).resolves.toMatchObject({
      code: "DUPLICATE",
    });
    expect(duplicateResponse.status).toBe(409);

    const limited = dependencies({
      abuse: {
        reserve: vi.fn(() => Promise.reject(new AbuseStoreError("RATE_LIMIT"))),
        recordSuccess: vi.fn(),
        release: vi.fn(),
      },
    });
    const rateLimitResponse = await limited.handler(request(validSubmission));
    await expect(rateLimitResponse.json()).resolves.toMatchObject({
      code: "RATE_LIMIT",
    });
    expect(rateLimitResponse.status).toBe(429);
    expect(rateLimitResponse.headers.get("retry-after")).toBe("3600");
  });

  it("releases the reservation when GitHub enqueue fails", async () => {
    const enqueue = vi.fn(() =>
      Promise.resolve(Response.json({ message: "nope" }, { status: 500 })),
    );
    const { abuse, handler } = dependencies({ enqueue });

    const response = await handler(request(validSubmission));

    await expect(response.json()).resolves.toMatchObject({
      code: "GITHUB_UNAVAILABLE",
    });
    expect(response.status).toBe(502);
    expect(abuse.release).toHaveBeenCalledWith("reservation-1");
  });
});
