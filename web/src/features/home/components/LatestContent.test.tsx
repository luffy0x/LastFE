import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

it("expands the first item by default and switches on click", async () => {
  const user = userEvent.setup();
  render(<LatestContent items={items} />);

  const firstTrigger = screen.getByRole("button", { name: /示例面经标题/ });
  const secondTrigger = screen.getByRole("button", { name: /第二篇内容标题/ });

  expect(firstTrigger).toHaveAttribute("aria-expanded", "true");
  expect(secondTrigger).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByText("一面到 HR 面的完整记录。")).toBeInTheDocument();
  expect(
    screen.getAllByRole("link", { name: /阅读全文/ })[0],
  ).toHaveAttribute("href", "/content/c-1");

  await user.click(secondTrigger);
  expect(secondTrigger).toHaveAttribute("aria-expanded", "true");
  expect(firstTrigger).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByText("第二篇的摘要。")).toBeInTheDocument();
  expect(screen.getByText("投稿人：投稿人甲")).toBeInTheDocument();

  await user.click(secondTrigger);
  expect(secondTrigger).toHaveAttribute("aria-expanded", "false");
});

it("shows the empty state when there is no content", () => {
  render(<LatestContent items={[]} />);

  expect(
    screen.getByText("还没有公开内容，欢迎成为第一位投稿者。"),
  ).toBeInTheDocument();
});
