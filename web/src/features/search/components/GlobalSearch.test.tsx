import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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

it("refetches the same query after a real close and reopen", async () => {
  let requestCount = 0;
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (!url.endsWith("q=fresh")) {
      return Promise.resolve(Response.json({ groups: [] }));
    }

    requestCount += 1;
    return Promise.resolve(
      Response.json({
        groups: [
          {
            regionSlug: "fundamentals",
            items: [
              {
                id: `fresh-${requestCount}`,
                regionSlug: "fundamentals",
                title: requestCount === 1 ? "旧搜索结果" : "新搜索结果",
                summary: null,
                nickname: null,
                tags: ["fresh"],
                publishedAt: "2026-09-02T00:00:00.000Z",
                metadata: {},
              },
            ],
          },
        ],
      }),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<GlobalSearch />);

  await user.click(screen.getByRole("button", { name: "打开全局搜索" }));
  await user.type(
    screen.getByRole("searchbox", { name: "搜索全部公开情报" }),
    "fresh",
  );
  expect(
    await screen.findByRole("link", { name: /旧搜索结果/ }),
  ).toBeVisible();

  await user.click(screen.getByRole("button", { name: "关闭全局搜索" }));
  await user.click(screen.getByRole("button", { name: "打开全局搜索" }));

  expect(
    await screen.findByRole("link", { name: /新搜索结果/ }),
  ).toBeVisible();
  expect(
    fetchMock.mock.calls.filter(([input]) => String(input).endsWith("q=fresh")),
  ).toHaveLength(2);
});

it("ignores a request from a closed dialog after the same query is reopened", async () => {
  const freshResolvers: Array<(response: Response) => void> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      if (!String(input).endsWith("q=fresh")) {
        return Promise.resolve(Response.json({ groups: [] }));
      }
      return new Promise<Response>((resolve) => freshResolvers.push(resolve));
    }),
  );
  const user = userEvent.setup();
  render(<GlobalSearch />);

  await user.click(screen.getByRole("button", { name: "打开全局搜索" }));
  await user.type(
    screen.getByRole("searchbox", { name: "搜索全部公开情报" }),
    "fresh",
  );
  await waitFor(() => expect(freshResolvers).toHaveLength(1));
  await user.click(screen.getByRole("button", { name: "关闭全局搜索" }));
  await user.click(screen.getByRole("button", { name: "打开全局搜索" }));
  await waitFor(() => expect(freshResolvers).toHaveLength(2));

  await act(async () => {
    freshResolvers[1](
      Response.json({
        groups: [
          {
            regionSlug: "fundamentals",
            items: [
              {
                id: "new-result",
                regionSlug: "fundamentals",
                title: "新请求结果",
                summary: null,
                nickname: null,
                tags: ["fresh"],
                publishedAt: "2026-09-02T00:00:00.000Z",
                metadata: {},
              },
            ],
          },
        ],
      }),
    );
  });
  expect(
    await screen.findByRole("link", { name: /新请求结果/ }),
  ).toBeVisible();

  await act(async () => {
    freshResolvers[0](
      Response.json({
        groups: [
          {
            regionSlug: "fundamentals",
            items: [
              {
                id: "stale-result",
                regionSlug: "fundamentals",
                title: "旧请求结果",
                summary: null,
                nickname: null,
                tags: ["fresh"],
                publishedAt: "2026-09-02T00:00:00.000Z",
                metadata: {},
              },
            ],
          },
        ],
      }),
    );
  });

  expect(screen.getByRole("link", { name: /新请求结果/ })).toBeVisible();
  expect(screen.queryByRole("link", { name: /旧请求结果/ })).toBeNull();
});
