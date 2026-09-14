import { describe, expect, it } from "vitest";

import { buildCuratedRow } from "../../../scripts/import-curated.mjs";

describe("curated knowledge import", () => {
  it("maps a fundamentals entry to the public content contract", () => {
    const row = buildCuratedRow({
      entry: {
        id: "fundamental-html",
        region: "fundamentals",
        category: "HTML",
        title: "HTML 核心知识",
        tags: ["语义化", "表单"],
        difficulty: null,
      },
      markdown: "# HTML 核心知识\n\n> 分类：HTML\n\nHTML 用于描述文档结构。",
      timestamp: "2026-09-14T00:00:00.000Z",
    });

    expect(row).toEqual({
      id: "curated-bagu-fundamental-html",
      region_slug: "fundamentals",
      status: "published",
      title: "HTML 核心知识",
      summary: "HTML 用于描述文档结构。",
      nickname: null,
      markdown: "# HTML 核心知识\n\n> 分类：HTML\n\nHTML 用于描述文档结构。",
      external_url: null,
      metadata_json: { category: "HTML" },
      published_at: "2026-09-14T00:00:00.000Z",
      updated_at: "2026-09-14T00:00:00.000Z",
      tags: ["语义化", "表单"],
    });
  });

  it("maps an algorithms entry with normalized difficulty and a neutral source", () => {
    const row = buildCuratedRow({
      entry: {
        id: "algorithm-async-retry",
        region: "algorithms",
        category: "JavaScript",
        title: "异步重试",
        tags: ["手写题", "异步"],
        difficulty: "中等",
      },
      markdown: "# 异步重试\n\n重试需要限制次数。",
      timestamp: "2026-09-14T00:00:00.000Z",
    });

    expect(row.metadata_json).toEqual({
      category: "JavaScript",
      source: "整理资料",
      difficulty: "medium",
    });
    expect(row.tags).toEqual(["手写题", "异步"]);
  });

  it("rejects manifest entries that cannot satisfy a public category contract", () => {
    expect(() =>
      buildCuratedRow({
        entry: {
          id: "invalid",
          region: "algorithms",
          category: "JavaScript",
          title: "无难度题",
          tags: ["测试"],
          difficulty: null,
        },
        markdown: "# 无难度题\n\n正文",
        timestamp: "2026-09-14T00:00:00.000Z",
      }),
    ).toThrow("算法资料缺少有效难度");
  });
});
