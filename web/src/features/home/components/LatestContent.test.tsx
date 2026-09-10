import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { LatestContent } from "./LatestContent";

const items = [
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
  {
    id: "c-2",
    regionSlug: "algorithms",
    title: "第二篇内容标题",
    summary: "第二篇的摘要。",
    nickname: "投稿人甲",
    tags: [],
    publishedAt: "2026-09-07T00:00:00.000Z",
    metadata: {},
  },
];

it("renders a grid of cards linking to the detail page", () => {
  const { container } = render(<LatestContent items={items} />);

  expect(container.querySelector(".content-grid")).not.toBeNull();
  expect(
    screen.getByRole("link", { name: "示例面经标题" }),
  ).toHaveAttribute("href", "/content/c-1");
  expect(
    screen.getByRole("link", { name: "第二篇内容标题" }),
  ).toHaveAttribute("href", "/content/c-2");
  expect(screen.getByText("一面到 HR 面的完整记录。")).toBeInTheDocument();
  expect(screen.getByText("面经记录 · 2026/09/08")).toBeInTheDocument();
  expect(screen.getByText("算法手撕 · 2026/09/07")).toBeInTheDocument();
});

it("shows the empty state when there is no content", () => {
  render(<LatestContent items={[]} />);

  expect(
    screen.getByText("还没有公开内容，欢迎成为第一位投稿者。"),
  ).toBeInTheDocument();
});
