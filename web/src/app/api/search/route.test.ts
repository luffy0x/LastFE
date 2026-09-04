import { describe, expect, it } from "vitest";

import type { ContentRepository } from "@/features/content/repository";

import { createSearchHandler } from "./route";

const repository: ContentRepository = {
  async get() {
    return null;
  },
  async stats() {
    return { totalPublished: 0, recentPublished: 0 };
  },
  async list() {
    return { items: [], page: 1, pageSize: 20, total: 0 };
  },
};

describe("GET /api/search", () => {
  it("returns grouped public results with an explicitly public cache policy", async () => {
    const response = await createSearchHandler(repository)(
      new Request("http://localhost/api/search?q=Redis"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("public");
    expect(response.headers.get("cache-control")).not.toContain("private");
    await expect(response.json()).resolves.toEqual({ groups: [] });
  });

  it("rejects unknown or repeated query parameters", async () => {
    const handler = createSearchHandler(repository);

    await expect(
      handler(new Request("http://localhost/api/search?q=Redis&debug=1")),
    ).resolves.toMatchObject({ status: 400 });
    await expect(
      handler(new Request("http://localhost/api/search?q=Redis&q=SQL")),
    ).resolves.toMatchObject({ status: 400 });
  });

  it("returns a retryable response when the repository is unavailable", async () => {
    const unavailableRepository: ContentRepository = {
      ...repository,
      async list() {
        throw new Error("database unavailable");
      },
    };

    const response = await createSearchHandler(unavailableRepository)(
      new Request("http://localhost/api/search?q=Redis"),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBe("60");
  });
});
