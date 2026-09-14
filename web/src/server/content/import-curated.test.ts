import { describe, expect, it } from "vitest";

import { buildCuratedRow } from "../../../scripts/import-curated.mjs";

describe("curated knowledge import", () => {
  it("maps a fundamentals entry to the public content contract", () => {
    const sourceMarkdown = [
      "# HTML 核心知识",
      "",
      "> 分类：HTML",
      "> 标签：语义化、表单",
      "> 整理状态：待人工复核",
      "## 语义化",
      "",
      "HTML 用于描述文档结构。",
    ].join("\n");
    const row = buildCuratedRow({
      entry: {
        id: "fundamental-html",
        region: "fundamentals",
        category: "HTML",
        title: "HTML 核心知识",
        tags: ["语义化", "表单"],
        difficulty: null,
        status: "待人工复核",
      },
      markdown: sourceMarkdown,
      timestamp: "2026-09-14T00:00:00.000Z",
    });

    expect(row).toEqual({
      id: "curated-bagu-fundamental-html",
      region_slug: "fundamentals",
      status: "published",
      title: "HTML 核心知识",
      summary: "HTML 用于描述文档结构。",
      nickname: null,
      markdown: "## 语义化\n\nHTML 用于描述文档结构。",
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
        status: "待人工复核",
      },
      markdown: [
        "# 异步重试",
        "",
        "> 分类：JavaScript",
        "> 标签：手写题、异步",
        "> 难度：中等",
        "> 整理状态：待人工复核",
        "#### 实现",
        "",
        "重试需要限制次数。",
      ].join("\n"),
      timestamp: "2026-09-14T00:00:00.000Z",
    });

    expect(row.metadata_json).toEqual({
      category: "JavaScript",
      source: "整理资料",
      difficulty: "medium",
    });
    expect(row.tags).toEqual(["手写题", "异步"]);
    expect(row.markdown).toBe("#### 实现\n\n重试需要限制次数。");
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

  it("rejects malformed emphasis markers outside fenced code blocks", () => {
    const entry = {
      id: "malformed-emphasis",
      region: "fundamentals",
      category: "JavaScript",
      title: "异常加粗标记",
      tags: ["Markdown"],
      difficulty: null,
      status: "待人工复核",
    };
    const reviewHeader = [
      "# 异常加粗标记",
      "",
      "> 分类：JavaScript",
      "> 标签：Markdown",
      "> 整理状态：待人工复核",
      "",
    ].join("\n");

    expect(() =>
      buildCuratedRow({
        entry,
        markdown: `${reviewHeader}**基本****数据类型**`,
      }),
    ).toThrow("资料包含异常加粗标记：malformed-emphasis");

    expect(() =>
      buildCuratedRow({
        entry,
        markdown: `${reviewHeader}\`\`\`js\nconst marker = "****";\n\`\`\``,
      }),
    ).not.toThrow();
  });
});
