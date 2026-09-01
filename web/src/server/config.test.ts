import { afterEach, describe, expect, it, vi } from "vitest";

import { getInternalAppOrigin, getServerConfig, getSqlitePath } from "./config";

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

describe("getSqlitePath", () => {
  it("returns a trimmed configured database path", () => {
    vi.stubEnv("SQLITE_PATH", "  C:/tmp/content.sqlite  ");

    expect(getSqlitePath()).toBe("C:/tmp/content.sqlite");
  });

  it("rejects a missing database path", () => {
    vi.stubEnv("SQLITE_PATH", " ");

    expect(getSqlitePath).toThrow("SQLITE_PATH is required");
  });
});

describe("getServerConfig", () => {
  it("normalizes the optional GitHub API base URL for Octokit", () => {
    vi.stubEnv("GITHUB_API_BASE_URL", " http://127.0.0.1:4010/ ");
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    vi.stubEnv("GITHUB_OWNER", "test-owner");
    vi.stubEnv("GITHUB_REPO", "test-repository");
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", "test-webhook-secret");
    vi.stubEnv("ALTCHA_HMAC_KEY", "test-altcha-key");
    vi.stubEnv("RATE_LIMIT_HMAC_KEY", "test-rate-limit-key");
    vi.stubEnv("SQLITE_PATH", "test.sqlite");

    expect(getServerConfig().github.apiBaseUrl).toBe("http://127.0.0.1:4010");
  });
});
