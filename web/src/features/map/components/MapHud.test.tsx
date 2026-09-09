import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { MapHud } from "./MapHud";

it("shows only the Last Frontend Developer wordmark in the map brand", () => {
  render(
    <MapHud
      stats={{ totalPublished: 0, recentPublished: 0 }}
      status="目标锁定：面经记录"
      onZoomIn={vi.fn()}
      onZoomOut={vi.fn()}
      onReset={vi.fn()}
      rejected={false}
      onRetry={vi.fn()}
    />,
  );

  expect(
    screen.getByRole("heading", { name: "Last Frontend Developer", level: 1 }),
  ).toBeVisible();
  expect(screen.queryByRole("img", { name: "LastFE 项目 Logo" })).toBeNull();
});

it("keeps the retry control at least 44 CSS pixels in both dimensions", () => {
  render(
    <MapHud
      stats={{ totalPublished: 0, recentPublished: 0 }}
      status="目标离线：面经区"
      onZoomIn={vi.fn()}
      onZoomOut={vi.fn()}
      onReset={vi.fn()}
      rejected
      onRetry={vi.fn()}
    />,
  );

  expect(screen.getByRole("button", { name: "重试同步" })).toHaveClass(
    "min-h-11",
    "min-w-11",
  );
});
