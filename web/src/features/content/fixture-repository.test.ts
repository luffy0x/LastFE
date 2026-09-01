import { describe, expect, it } from "vitest";
import { fixtureContentRepository } from "./fixture-repository";

describe("fixtureContentRepository", () => {
  it("lists only content from the requested territory", async () => {
    const page = await fixtureContentRepository.list({
      regionSlug: "interview",
      page: 1,
      pageSize: 20,
    });

    expect(page.total).toBe(2);
    expect(page.items.map(({ title }) => title)).toEqual([
      "字节跳动/基础架构 · 后端开发",
      "腾讯/云架构 · 后端开发",
    ]);
  });

  it.each([
    ["持久化", "fundamental-redis-persistence"],
    ["故障排查", "interview-tencent-cloud"],
    ["动态规划", "algorithm-dynamic-programming"],
    ["课程与讲义", "resource-operating-systems"],
  ])("searches content for %s", async (search, expectedId) => {
    const page = await fixtureContentRepository.list({
      search,
      page: 1,
      pageSize: 20,
    });

    expect(page.items.map(({ id }) => id)).toContain(expectedId);
  });

  it("counts published and recent records", async () => {
    await expect(
      fixtureContentRepository.stats(new Date("2026-09-01T12:00:00.000Z")),
    ).resolves.toEqual({ totalPublished: 10, recentPublished: 5 });
  });
});
