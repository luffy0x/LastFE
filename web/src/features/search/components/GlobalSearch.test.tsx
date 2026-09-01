import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { GlobalSearch } from "./GlobalSearch";

afterEach(() => vi.unstubAllGlobals());

it("keeps completed results visible when the open shortcut is repeated", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ groups: [] })),
  );
  const user = userEvent.setup();
  render(<GlobalSearch />);

  await user.click(screen.getByRole("button", { name: "打开全局搜索" }));
  expect(
    await screen.findByText("没有找到公开情报，请调整关键词。"),
  ).toBeVisible();

  await user.keyboard("{Control>}k{/Control}");

  expect(screen.getByText("没有找到公开情报，请调整关键词。")).toBeVisible();
  expect(screen.queryByText("正在扫描公开索引…")).toBeNull();
});
