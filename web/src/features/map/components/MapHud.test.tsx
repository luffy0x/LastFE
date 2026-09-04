import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { MapHud } from "./MapHud";

it("keeps the retry control at least 44 CSS pixels in both dimensions", () => {
  render(
    <MapHud
      stats={{ totalPublished: 0, recentPublished: 0 }}
      status="目标离线：面经区"
      onZoomIn={vi.fn()}
      onZoomOut={vi.fn()}
      onReset={vi.fn()}
      failed
      onRetry={vi.fn()}
    />,
  );

  expect(screen.getByRole("button", { name: "重试同步" })).toHaveClass(
    "min-h-11",
    "min-w-11",
  );
});
