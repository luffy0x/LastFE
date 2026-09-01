import { afterEach, describe, expect, it, vi } from "vitest";

import { getInternalAppOrigin } from "./config";

afterEach(() => vi.unstubAllEnvs());

describe("getInternalAppOrigin", () => {
  it("lazily validates an absolute origin for reconciliation webhook delivery", () => {
    vi.stubEnv("INTERNAL_APP_ORIGIN", "http://moderation-app:3000");

    expect(getInternalAppOrigin()).toBe("http://moderation-app:3000");
  });

  it("normalizes an equivalent trailing slash", () => {
    vi.stubEnv("INTERNAL_APP_ORIGIN", "http://moderation-app:3000/");

    expect(getInternalAppOrigin()).toBe("http://moderation-app:3000");
  });

  it("rejects an origin with a path", () => {
    vi.stubEnv("INTERNAL_APP_ORIGIN", "http://moderation-app:3000/not-an-origin");

    expect(getInternalAppOrigin).toThrow("INTERNAL_APP_ORIGIN must be an origin");
  });
});
