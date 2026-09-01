import { describe, expect, it, vi } from "vitest";

import { createChallengeHandler } from "./route";

describe("challenge route", () => {
  it("returns a self-hosted challenge without caching", async () => {
    const challenge = {
      algorithm: "SHA-256" as const,
      challenge: "challenge",
      maxnumber: 100,
      salt: "salt",
      signature: "signature",
    };
    const response = await createChallengeHandler({
      create: vi.fn().mockResolvedValue(challenge),
      verify: vi.fn(),
    })();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual(challenge);
  });

  it("fails closed without exposing challenge configuration errors", async () => {
    const response = await createChallengeHandler({
      create: vi.fn().mockRejectedValue(new Error("secret leaked")),
      verify: vi.fn(),
    })();
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(body).not.toContain("secret leaked");
  });
});
