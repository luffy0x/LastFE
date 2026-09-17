import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { SiteHeader } from "./SiteHeader";

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/features/search/components/GlobalSearch", () => ({
  GlobalSearch: () => <div data-testid="global-search" />,
}));

it("renders the brand, category links and the submit entry", () => {
  render(<SiteHeader />);

  const brand = screen.getByRole("link", { name: /LastFE/ });
  expect(brand).toHaveAttribute("href", "/");
  expect(brand.querySelector("svg")).toHaveAttribute("viewBox", "0 0 32 32");
  expect(brand.querySelector("svg")).toHaveAttribute("width", "20");
  expect(brand.querySelector("svg")).toHaveAttribute("height", "20");
  expect(brand.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  const nav = screen.getByRole("navigation", { name: "主导航" });
  const links = [
    "学习资料",
    "项目推荐",
    "八股盛宴",
    "算法手撕",
    "简历制作",
    "投递记录",
    "面经记录",
  ];
  for (const label of links) {
    expect(
      screen.getByRole("link", { name: label }),
    ).toBeInTheDocument();
  }
  expect(nav).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "投稿" })).toHaveAttribute(
    "href",
    "/submit",
  );
  expect(screen.getByTestId("global-search")).toBeInTheDocument();
});

it("opens the mobile menu, focuses the first link and closes on Escape", async () => {
  const user = userEvent.setup();
  render(<SiteHeader />);

  const trigger = screen.getByRole("button", { name: "打开导航菜单" });
  await user.click(trigger);

  expect(trigger).toHaveAttribute("aria-expanded", "true");
  const mobileNav = screen.getByRole("navigation", {
    name: "移动端分类导航",
  });
  const firstLink = screen.getAllByRole("link", { name: "学习资料" }).at(-1);
  expect(mobileNav).toContainElement(firstLink ?? null);
  expect(firstLink).toHaveFocus();

  await user.keyboard("{Escape}");
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(trigger).toHaveFocus();
});
