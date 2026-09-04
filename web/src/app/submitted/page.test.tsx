import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import SubmittedPage from "./page";

it("explains moderation and offers clear return paths", () => {
  render(<SubmittedPage />);

  expect(screen.getByRole("heading", { name: "投稿已进入审核队列" })).toBeVisible();
  expect(screen.getByText(/不会立即公开/)).toBeVisible();
  expect(screen.getByRole("link", { name: "返回战略地图" })).toHaveAttribute(
    "href",
    "/",
  );
  expect(screen.getByRole("link", { name: "继续投稿" })).toHaveAttribute(
    "href",
    "/submit",
  );
});
