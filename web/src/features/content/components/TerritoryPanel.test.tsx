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
