import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/content/repository", () => ({
  getContentRepository: () => ({
    list: vi.fn(() =>
      Promise.resolve({
        items: [{ id: "one", title: "React", regionSlug: "resources" }],
        page: 1,
        pageSize: 20,
        total: 1,
      }),
    ),
  }),
}));

describe("GET /api/search", () => {
  it("returns public content search results", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("https://lastfe.test/api/search?q=react&region=resources"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      page: { total: 1 },
    });
  });
});
