import { describe, expect, it } from "vitest";

import { ALGORITHM_SITES } from "./site-icons";

describe("ALGORITHM_SITES", () => {
  it("contains the four recommended practice sites in order", () => {
    expect(ALGORITHM_SITES.map(({ site }) => site)).toEqual([
      "codetop",
      "LeetCode 力扣",
      "洛谷",
      "Codefun2000",
    ]);
  });

  it("points every site to a safe external url and an in-house icon", () => {
    for (const { url, icon } of ALGORITHM_SITES) {
      expect(url).toMatch(/^https:\/\//);
      expect(icon).toMatch(/^\/site-icons\//);
    }
  });
});
