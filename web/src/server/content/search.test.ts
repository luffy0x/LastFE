import { describe, expect, it } from "vitest";

import type { ContentRepository } from "@/features/content/repository";
import type { ContentSummary } from "@/features/content/types";

import { parsePage, searchAll } from "./search";

const summary = (
  id: string,
  regionSlug: string,
  title: string,
): ContentSummary => ({
  id,
  regionSlug,
  title,
  summary: null,
  nickname: null,
  tags: ["Redis"],
  publishedAt: "2026-09-01T08:00:00.000Z",
  metadata: {},
});

function repositoryWithResults(): ContentRepository {
  return {
    async get() {
      return null;
    },
    async stats() {
      return { totalPublished: 2, recentPublished: 2 };
    },
    async list({ regionSlug }) {
      const items =
        regionSlug === "interview"
          ? [summary("gh-1", "interview", "Redis 面经")]
          : regionSlug === "fundamentals"
            ? [summary("gh-2", "fundamentals", "Redis 持久化")]
            : [];
      return { items, page: 1, pageSize: 20, total: items.length };
    },
  };
}

describe("public content search", () => {
  it("groups global results in configured territory order", async () => {
    const results = await searchAll(repositoryWithResults(), " Redis ");

    expect(results.map((group) => group.regionSlug)).toEqual([
      "interview",
      "fundamentals",
    ]);
    expect(results.flatMap((group) => group.items.map(({ id }) => id))).toEqual([
      "gh-1",
      "gh-2",
    ]);
  });

  it.each([
    [undefined, 1],
    ["", 1],
    ["0", 1],
    ["-2", 1],
    ["1.5", 1],
    ["not-a-number", 1],
    ["3", 3],
  ])("clamps page value %s to %i", (value, expected) => {
    expect(parsePage(value)).toBe(expected);
  });
});
