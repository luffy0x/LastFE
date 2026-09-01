import { expect, it, vi } from "vitest";
import { REGIONS } from "./regions";
import { prepareRegion } from "./prepare-region";

it("prefetches and verifies the selected territory", async () => {
  const prefetch = vi.fn();
  const request = vi.fn().mockResolvedValue({ ok: true, slug: "interview" });

  await prepareRegion(REGIONS[0], { prefetch, request });

  expect(prefetch).toHaveBeenCalledWith("/regions/interview");
  expect(request).toHaveBeenCalledWith("/api/regions/interview/availability");
});
