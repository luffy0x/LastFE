import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

describe("POST /api/submissions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("creates a private GitHub issue without returning repository details", async () => {
    vi.stubEnv("GITHUB_TOKEN", "github-token");
    vi.stubEnv("GITHUB_REPOSITORY", "owner/private-review");
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          Response.json({ number: 22, html_url: "https://github.test/private" }, { status: 201 }),
        ),
      ),
    );

    const response = await POST(
      new Request("https://lastfe.test/api/submissions", {
        method: "POST",
        body: JSON.stringify({
          regionSlug: "resources",
          title: "React 路线",
          tags: ["React"],
          externalUrl: "https://react.dev/learn",
          metadata: {},
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.status).toBe(201);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/owner/private-review/issues",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer github-token",
        }),
      }),
    );
  });
});
