import { describe, expect, it, vi } from "vitest";

import { log, redact, requestIdFromHeaders } from "./logging";

describe("redact", () => {
  it("redacts sensitive fields recursively", () => {
    expect(
      redact({
        token: "secret",
        nested: { cookie: "secret", code: "UPSTREAM" },
        entries: [{ authorization: "Bearer private" }],
      }),
    ).toEqual({
      token: "[REDACTED]",
      nested: { cookie: "[REDACTED]", code: "UPSTREAM" },
      entries: [{ authorization: "[REDACTED]" }],
    });
  });
});

describe("log", () => {
  it("writes one redacted JSON line", () => {
    const write = vi.spyOn(console, "error").mockImplementation(() => undefined);

    log("error", "submission.enqueue_failed", {
      requestId: "request-1",
      markdown: "private submission",
      nested: { ipAddress: "203.0.113.7" },
    });

    expect(write).toHaveBeenCalledOnce();
    expect(JSON.parse(String(write.mock.calls[0][0]))).toEqual({
      level: "error",
      event: "submission.enqueue_failed",
      requestId: "request-1",
      markdown: "[REDACTED]",
      nested: { ipAddress: "[REDACTED]" },
    });
    write.mockRestore();
  });
});

describe("requestIdFromHeaders", () => {
  it("rejects a whitespace-padded raw request ID", () => {
    const headers = { get: () => " request_42 " } as unknown as Headers;
    const requestId = requestIdFromHeaders(headers);

    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(requestId).not.toBe("request_42");
  });
});
