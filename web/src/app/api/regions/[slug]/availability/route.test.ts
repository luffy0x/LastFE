import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("region availability route", () => {
  it("returns availability for an enabled territory", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ slug: "interview" }),
    } as RouteContext<"/api/regions/[slug]/availability">);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      slug: "interview",
    });
  });

  it("returns 404 for an unknown territory", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ slug: "unknown" }),
    } as RouteContext<"/api/regions/[slug]/availability">);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "REGION_NOT_FOUND",
    });
  });
});
