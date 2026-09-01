import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { REGIONS } from "@/features/map/regions";
import { fixtureContentRepository } from "../fixture-repository";
import { TerritoryPanel } from "./TerritoryPanel";

function setMobileViewport(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches,
      media: "(max-width: 767px)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

it("shows only content from the requested territory", async () => {
  const page = await fixtureContentRepository.list({
    regionSlug: "interview",
    page: 1,
    pageSize: 20,
  });

  render(<TerritoryPanel region={REGIONS[0]} page={page} />);

  expect(
    screen.getByRole("heading", { name: "面经区", level: 1 }),
  ).toBeVisible();
  expect(screen.getByText("字节跳动/基础架构 · 后端开发")).toBeVisible();
  expect(screen.queryByText("动态规划训练路线")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "返回战略地图" })).toHaveAttribute(
    "href",
    "/?region=interview",
  );
  expect(screen.getByRole("link", { name: "向面经区投稿" })).toHaveAttribute(
    "href",
    "/submit/interview",
  );
});

it("focuses the territory heading when the mobile sheet opens", async () => {
  setMobileViewport(true);
  const page = await fixtureContentRepository.list({
    regionSlug: "interview",
    page: 1,
    pageSize: 20,
  });

  render(<TerritoryPanel region={REGIONS[0]} page={page} />);

  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "面经区" })).toHaveFocus(),
  );
});

it("wraps mobile focus inside the territory sheet", async () => {
  setMobileViewport(true);
  const user = userEvent.setup();
  const page = await fixtureContentRepository.list({
    regionSlug: "interview",
    page: 1,
    pageSize: 20,
  });

  render(<TerritoryPanel region={REGIONS[0]} page={page} />);
  const links = screen.getAllByRole("link");
  const firstLink = screen.getByRole("link", { name: "返回战略地图" });
  const lastLink = links.at(-1);
  if (!lastLink) throw new Error("expected a dossier link");
  firstLink.focus();

  await user.tab({ shift: true });

  expect(lastLink).toHaveFocus();
});

it("renders only configured filters and preserves their query values", async () => {
  const page = await fixtureContentRepository.list({
    regionSlug: "interview",
    page: 1,
    pageSize: 20,
  });

  render(
    <TerritoryPanel
      region={REGIONS[0]}
      page={page}
      query={{ q: "Redis", companyDepartment: "字节", tags: "一面" }}
    />,
  );

  expect(screen.getByRole("searchbox", { name: "领地搜索" })).toHaveValue(
    "Redis",
  );
  expect(screen.getByRole("textbox", { name: "公司/部门" })).toHaveValue(
    "字节",
  );
  expect(screen.getByRole("textbox", { name: "标签" })).toHaveValue("一面");
  expect(screen.queryByRole("textbox", { name: "知识分类" })).toBeNull();
});

it("offers a reset action when active filters have no results", () => {
  render(
    <TerritoryPanel
      region={REGIONS[0]}
      page={{ items: [], page: 1, pageSize: 20, total: 0 }}
      query={{ q: "不存在" }}
    />,
  );

  expect(screen.getByText("没有符合当前条件的公开档案。")).toBeVisible();
  expect(screen.getByRole("link", { name: "清除搜索与筛选" })).toHaveAttribute(
    "href",
    "/regions/interview",
  );
});

it("links between result pages while preserving active filters", () => {
  render(
    <TerritoryPanel
      region={REGIONS[0]}
      page={{
        items: [],
        page: 1,
        pageSize: 20,
        total: 21,
      }}
      query={{ q: "Redis", tags: "一面" }}
    />,
  );

  expect(screen.getByRole("link", { name: "下一页" })).toHaveAttribute(
    "href",
    "/regions/interview?q=Redis&tags=%E4%B8%80%E9%9D%A2&page=2",
  );
  expect(screen.getByText("第 1 / 2 页")).toBeVisible();
});
