import { afterEach, describe, expect, it, vi } from "vitest";

describe("GET /api/health", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("reports fixture mode as healthy without leaking configuration", async () => {
    vi.stubEnv("CONTENT_REPOSITORY", "fixture");
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      checks: { app: "ok", content: "fixture" },
    });
  });

  it("reports missing Supabase configuration safely", async () => {
    vi.stubEnv("CONTENT_REPOSITORY", "supabase");
    vi.stubEnv("SUPABASE_URL", "");
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      status: "unhealthy",
      checks: { app: "ok", content: "configuration" },
    });
    expect(JSON.stringify(body)).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
