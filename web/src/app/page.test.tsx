import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import HomePage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    prefetch: vi.fn(),
    push: vi.fn(),
  }),
}));

vi.mock("next/server", () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/content/repository", () => ({
  getContentRepository: () => ({
    stats: () => Promise.resolve({ totalPublished: 18, recentPublished: 4 }),
  }),
}));

it("renders the strategic map landmark", async () => {
  render(await HomePage({ searchParams: Promise.resolve({}) }));

  expect(
    screen.getByRole("main", { name: "求职战略地图" }),
  ).toBeInTheDocument();
});

it("starts at the valid territory named by the region query", async () => {
  render(
    await HomePage({
      searchParams: Promise.resolve({ region: "projects" }),
    }),
  );

  expect(
    screen.getByRole("img", { name: "探索者当前位置：项目区" }),
  ).toHaveAttribute("transform", "translate(232 357)");
  expect(screen.getByRole("button", { name: "进入项目区" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
