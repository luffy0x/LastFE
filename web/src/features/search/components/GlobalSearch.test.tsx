import { act, fireEvent, render, screen } from "@testing-library/react";
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

it("keeps completed results when a deferred query is rapidly reverted", async () => {
  let resolveFoo: ((response: Response) => void) | undefined;
  const fooResponse = new Promise<Response>((resolve) => {
    resolveFoo = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      return url.endsWith("q=foo")
        ? fooResponse
        : Promise.resolve(Response.json({ groups: [] }));
    }),
  );
  const user = userEvent.setup();
  render(<GlobalSearch />);

  await user.click(screen.getByRole("button", { name: "打开全局搜索" }));
  const searchbox = screen.getByRole("searchbox", {
    name: "搜索全部公开情报",
  });
  fireEvent.change(searchbox, { target: { value: "foo" } });
  expect(await screen.findByText("正在扫描公开索引…")).toBeVisible();
  resolveFoo?.(
    Response.json({
      groups: [
        {
          regionSlug: "fundamentals",
          items: [
            {
              id: "foo-result",
              regionSlug: "fundamentals",
              title: "Foo 完成结果",
              summary: null,
              nickname: null,
              tags: ["foo"],
              publishedAt: "2026-09-02T00:00:00.000Z",
              metadata: {},
            },
          ],
        },
      ],
    }),
  );
  expect(
    await screen.findByRole("link", { name: /Foo 完成结果/ }),
  ).toBeVisible();

  act(() => {
    fireEvent.change(searchbox, { target: { value: "foox" } });
    fireEvent.change(searchbox, { target: { value: "foo" } });
  });

  expect(screen.getByRole("link", { name: /Foo 完成结果/ })).toBeVisible();
  expect(screen.queryByText("正在扫描公开索引…")).toBeNull();
});
