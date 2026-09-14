import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { CATEGORIES } from "../categories";
import type { ContentSummary, Page } from "../types";
import { CategoryPage } from "./CategoryPage";

const interview = CATEGORIES.find(({ slug }) => slug === "interview")!;
const fundamentals = CATEGORIES.find(({ slug }) => slug === "fundamentals")!;
const algorithms = CATEGORIES.find(({ slug }) => slug === "algorithms")!;

function emptyPage(): Page<ContentSummary> {
  return { items: [], page: 1, total: 0, pageSize: 20 };
}

const sampleItem: ContentSummary = {
  id: "c-1",
  regionSlug: "interview",
  title: "某大厂前端一面记录",
  summary: "从自我介绍到反问环节。",
  nickname: "阿酥",
  tags: ["前端"],
  publishedAt: "2026-09-01T00:00:00.000Z",
  metadata: { companyDepartment: "某大厂", position: "前端工程师" },
};

it("renders category intro, per-category filters and content list", () => {
  render(
    <CategoryPage
      category={interview}
      page={{ items: [sampleItem], page: 1, total: 1, pageSize: 20 }}
      query={{}}
    />,
  );

  expect(
    screen.getByRole("heading", { name: "面经记录" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("公司/部门")).toBeInTheDocument();
  expect(screen.getByLabelText("岗位")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "某大厂前端一面记录" }),
  ).toHaveAttribute("href", "/content/c-1");
  const grid = document.querySelector(".content-grid");
  expect(grid).not.toBeNull();
  expect(grid?.firstElementChild?.className).toContain("content-card");
  expect(
    screen.getByRole("link", { name: "向面经记录投稿" }),
  ).toHaveAttribute("href", "/submit/interview");
});

it("shows distinct empty states for no content vs no filter result", () => {
  const { rerender } = render(
    <CategoryPage category={interview} page={emptyPage()} query={{}} />,
  );
  expect(screen.getByText("该分类还没有公开内容。")).toBeInTheDocument();

  rerender(
    <CategoryPage
      category={interview}
      page={emptyPage()}
      query={{ q: "不存在" }}
    />,
  );
  expect(
    screen.getByText("没有符合当前条件的公开内容。"),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "清除搜索与筛选" }),
  ).toHaveAttribute("href", "/regions/interview");
});

it("paginates while preserving query params", () => {
  render(
    <CategoryPage
      category={interview}
      page={{ items: [sampleItem], page: 2, total: 45, pageSize: 20 }}
      query={{ q: "前端" }}
    />,
  );

  expect(screen.getByRole("link", { name: "上一页" })).toHaveAttribute(
    "href",
    "/regions/interview?q=%E5%89%8D%E7%AB%AF",
  );
  expect(screen.getByRole("link", { name: "下一页" })).toHaveAttribute(
    "href",
    "/regions/interview?q=%E5%89%8D%E7%AB%AF&page=3",
  );
  expect(screen.getByText("第 2 / 3 页")).toBeInTheDocument();
});

it("renders select options for the difficulty filter", () => {
  const algorithms = CATEGORIES.find(({ slug }) => slug === "algorithms")!;
  render(<CategoryPage category={algorithms} page={emptyPage()} query={{}} />);

  const difficulty = screen.getByLabelText("难度");
  expect(difficulty.tagName).toBe("SELECT");
  expect(screen.getByRole("option", { name: "简单" })).toBeInTheDocument();
});

it("renders the static site recommendation cards only for algorithms", () => {
  const algorithms = CATEGORIES.find(({ slug }) => slug === "algorithms")!;

  const { container, rerender } = render(
    <CategoryPage category={algorithms} page={emptyPage()} query={{}} />,
  );

  expect(
    screen.getByRole("heading", { name: "刷题网站推荐" }),
  ).toBeInTheDocument();
  expect(
    container.querySelectorAll(".algorithm-site-card"),
  ).toHaveLength(4);
  expect(
    screen.getByRole("link", { name: /codetop/ }),
  ).toHaveAttribute("href", "https://codetop.cc");

  rerender(
    <CategoryPage category={interview} page={emptyPage()} query={{}} />,
  );
  expect(
    screen.queryByRole("heading", { name: "刷题网站推荐" }),
  ).not.toBeInTheDocument();
});

it("groups knowledge files under collapsed multi-expand topic accordions", async () => {
  const user = userEvent.setup();
  const vueItem = {
    ...sampleItem,
    id: "c-2",
    title: "Vue 核心知识",
    summary: "用于验证二级资料菜单。",
    metadata: { category: "Vue" },
  };
  const reactItem = {
    ...sampleItem,
    id: "c-1",
    title: "React 核心知识",
    metadata: { category: "React" },
  };
  const { container, rerender } = render(
    <CategoryPage
      category={fundamentals}
      page={{ items: [vueItem, reactItem], page: 1, total: 2, pageSize: 20 }}
      query={{}}
    />,
  );

  const reactTrigger = screen.getByRole("button", { name: /React/ });
  const vueTrigger = screen.getByRole("button", { name: /Vue/ });
  expect(reactTrigger).toHaveAttribute("aria-expanded", "false");
  expect(vueTrigger).toHaveAttribute("aria-expanded", "false");

  await user.click(reactTrigger);
  await user.click(vueTrigger);
  expect(reactTrigger).toHaveAttribute("aria-expanded", "true");
  expect(vueTrigger).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("link", { name: /React 核心知识/ })).toHaveAttribute(
    "href",
    "/content/c-1",
  );
  expect(container.querySelector(".accordion-list")).not.toBeNull();

  rerender(
    <CategoryPage
      category={algorithms}
      page={{ items: [reactItem], page: 1, total: 1, pageSize: 20 }}
      query={{}}
    />,
  );
  expect(container.querySelector(".accordion-list")).not.toBeNull();
  expect(screen.getByRole("button", { name: /React/ })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

it("uses the requested topic order for knowledge groups", () => {
  const topics = [
    "React",
    "操作系统",
    "Web 安全",
    "浏览器",
    "计算机网络",
    "AI / Agent",
    "CSS",
    "TypeScript",
    "HTML",
    "Vue",
    "工程化",
    "JavaScript",
  ];
  const items = topics.map((topic, index) => ({
    ...sampleItem,
    id: `topic-${index}`,
    title: `${topic} Markdown`,
    metadata: { category: topic },
  }));

  const { container } = render(
    <CategoryPage
      category={fundamentals}
      page={{ items, page: 1, total: items.length, pageSize: 20 }}
      query={{}}
    />,
  );

  expect(
    Array.from(container.querySelectorAll(".accordion-item__title")).map(
      (element) => element.textContent,
    ),
  ).toEqual([
    "HTML",
    "CSS",
    "JavaScript",
    "浏览器",
    "计算机网络",
    "Web 安全",
    "操作系统",
    "TypeScript",
    "工程化",
    "React",
    "Vue",
    "AI / Agent",
  ]);
});
