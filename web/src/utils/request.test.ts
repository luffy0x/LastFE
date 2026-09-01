import { afterEach, describe, expect, it, vi } from "vitest";
import { request, RequestError } from "./request";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("request", () => {
  it("parses successful JSON responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(request<{ ok: boolean }>("/health")).resolves.toEqual({
      ok: true,
    });
  });

  it("normalizes non-success responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: "REGION_NOT_FOUND" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const pending = request("/missing");

    await expect(pending).rejects.toMatchObject({
      name: "RequestError",
      status: 404,
      code: "REGION_NOT_FOUND",
    });
    await expect(pending).rejects.toBeInstanceOf(RequestError);
  });
});
