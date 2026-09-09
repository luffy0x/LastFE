import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import HomePage from "./page";

vi.mock("next/server", () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}));

vi.mock("@/features/content/repository", () => ({
  getContentRepository: () => ({
    stats: () =>
      Promise.resolve({ totalPublished: 18, recentPublished: 4 }),
    list: () =>
      Promise.resolve({
        items: [
          {
            id: "c-1",
            regionSlug: "interview",
            title: "示例面经标题",
            summary: "一面到 HR 面的完整记录。",
            nickname: null,
            tags: ["前端", "React"],
            publishedAt: "2026-09-08T00:00:00.000Z",
            metadata: {},
          },
        ],
        page: 1,
        total: 1,
        pageSize: 20,
      }),
  }),
}));

it("renders the search-first home page with stats, categories and latest content", async () => {
  render(await HomePage());

  expect(screen.getByRole("main", { name: "首页" })).toBeInTheDocument();
  expect(
    screen.getByRole("heading", {
      name: "搜索面经、八股、项目与算法，直接抵达内容",
    }),
  ).toBeInTheDocument();

  expect(screen.getByText("18")).toBeInTheDocument();
  expect(screen.getByText("公开内容")).toBeInTheDocument();
  expect(screen.getByText("4")).toBeInTheDocument();
  expect(screen.getByText("近七日新增")).toBeInTheDocument();

  for (const label of [
    "面经记录",
    "学习资料",
    "八股盛宴",
    "项目推荐",
    "算法手撕",
  ]) {
    expect(screen.getByRole("link", { name: new RegExp(label) })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/regions\//),
    );
  }

  expect(
    screen.getByRole("link", { name: "示例面经标题" }),
  ).toHaveAttribute("href", "/content/c-1");
  expect(screen.getByText("一面到 HR 面的完整记录。")).toBeInTheDocument();

  expect(
    screen.getByRole("link", { name: "开始投稿" }),
  ).toHaveAttribute("href", "/submit");
});
