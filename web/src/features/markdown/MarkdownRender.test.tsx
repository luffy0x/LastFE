import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { MarkdownRender } from "./MarkdownRender";

it("wraps markdown by default and lets the reader disable wrapping", async () => {
  const user = userEvent.setup();
  const { container } = render(
    <MarkdownRender content="这是一段需要根据阅读偏好切换换行方式的内容。" />,
  );
  const markdown = container.firstElementChild;

  expect(markdown).toHaveAttribute("data-wrap", "true");

  const toggle = screen.getByRole("button", { name: "关闭自动换行" });
  expect(toggle).toHaveAttribute("aria-pressed", "true");

  await user.click(toggle);

  expect(markdown).toHaveAttribute("data-wrap", "false");
  expect(
    screen.getByRole("button", { name: "开启自动换行" }),
  ).toHaveAttribute("aria-pressed", "false");
});

it("copies a fenced code block and reports completion", async () => {
  const user = userEvent.setup();
  render(
    <MarkdownRender content={"```ts\nconst answer = 42;\n```"} />,
  );

  await user.click(screen.getByRole("button", { name: "复制代码" }));

  expect(await navigator.clipboard.readText()).toBe("const answer = 42;");
  expect(screen.getByRole("button", { name: "已复制" })).toBeVisible();
});

it("collapses and expands each fenced code block independently", async () => {
  const user = userEvent.setup();
  render(
    <MarkdownRender
      content={
        "```text\n第一段录音转写\n```\n\n```text\n第二段录音转写\n```"
      }
    />,
  );

  const collapseButtons = screen.getAllByRole("button", { name: "收起代码" });
  expect(collapseButtons).toHaveLength(2);
  expect(collapseButtons[0]).toHaveAttribute("aria-expanded", "true");

  await user.click(collapseButtons[0]);

  expect(screen.getByText("第一段录音转写")).not.toBeVisible();
  expect(screen.getByText("第二段录音转写")).toBeVisible();
  const expandButton = screen.getByRole("button", { name: "展开代码" });
  expect(expandButton).toHaveAttribute("aria-expanded", "false");

  await user.click(expandButton);

  expect(screen.getByText("第一段录音转写")).toBeVisible();
});

it("scrolls overflowing tables with directional controls", async () => {
  const user = userEvent.setup();
  render(
    <MarkdownRender
      content={"| 字段 | 值 |\n| --- | --- |\n| 状态 | 已验证 |"}
    />,
  );

  const viewport = screen.getByRole("region", { name: "表格滚动区域" });
  Object.defineProperties(viewport, {
    clientWidth: { configurable: true, value: 300 },
    scrollWidth: { configurable: true, value: 900 },
    scrollLeft: { configurable: true, value: 0, writable: true },
    scrollBy: {
      configurable: true,
      value: ({ left }: ScrollToOptions) => {
        viewport.scrollLeft += left ?? 0;
        fireEvent.scroll(viewport);
      },
    },
  });
  fireEvent(window, new Event("resize"));

  expect(screen.getByRole("button", { name: "向左滚动表格" })).toBeDisabled();
  const scrollRight = screen.getByRole("button", { name: "向右滚动表格" });
  expect(scrollRight).toBeEnabled();

  await user.click(scrollRight);

  expect(viewport.scrollLeft).toBeGreaterThan(0);
});

it("renders markdown headings within the detail page hierarchy", () => {
  render(<MarkdownRender content={"# 面试过程\n\n## 技术追问"} />);

  expect(
    screen.getByRole("heading", { name: "面试过程", level: 2 }),
  ).toHaveClass("markdown-render__heading--1");
  expect(
    screen.getByRole("heading", { name: "技术追问", level: 3 }),
  ).toHaveClass("markdown-render__heading--2");
  expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
});

it("uses shared render rules for semantic markdown structures", () => {
  const { container } = render(
    <MarkdownRender
      content={
        "> 重点复盘\n\n- 浏览器缓存\n- 网络协议\n\n`Promise.all`\n\n---\n\n| 字段 | 值 |\n| --- | --- |\n| 状态 | 已验证 |"
      }
    />,
  );

  expect(container.firstElementChild).toHaveClass("markdown-render");
  expect(container.querySelector("blockquote")).toHaveClass(
    "markdown-render__blockquote",
  );
  expect(container.querySelector("ul")).toHaveClass("markdown-render__list");
  expect(screen.getByText("Promise.all")).toHaveClass(
    "markdown-render__inline-code",
  );
  expect(container.querySelector("hr")).toHaveClass("markdown-render__rule");
  expect(screen.getByRole("table")).toHaveClass("markdown-render__table");
  expect(screen.getByRole("table").parentElement).toHaveClass(
    "markdown-render__table-scroll",
  );
});

it("renders raw HTML as text instead of live elements", () => {
  render(
    <MarkdownRender
      content={'<script>alert(1)</script><img src=x onerror=alert(2)>'}
    />,
  );

  expect(document.querySelector("script")).toBeNull();
  expect(document.querySelector("img")).toBeNull();
});

it.each([
  ["javascript URL", "javascript:alert(1)"],
  ["data URL", "data:text/html,unsafe"],
  ["relative URL", "/outside-file"],
  ["protocol-relative URL", "//example.com/outside-file"],
  ["overlong URL", `https://example.com/${"a".repeat(2_029)}`],
  ["non-canonical URL", "https:example.com/path"],
])("renders %s as non-clickable text", (_label, unsafeUrl) => {
  render(<MarkdownRender content={`[危险链接](${unsafeUrl})`} />);

  expect(screen.queryByRole("link", { name: "危险链接" })).toBeNull();
  expect(screen.getByText("危险链接")).toBeVisible();
});

it("does not emit Markdown images that could load external files", () => {
  render(
    <MarkdownRender content="![tracker](https://example.com/tracker.png)" />,
  );

  expect(document.querySelector("img")).toBeNull();
});

it("hardens HTTP and HTTPS links opened from markdown", () => {
  render(
    <MarkdownRender
      content={"[HTTP](http://example.com/a) and [HTTPS](https://example.com/b)"}
    />,
  );

  ["HTTP", "HTTPS"].forEach((name) => {
    const link = screen.getByRole("link", { name });
    expect(link).toHaveClass("markdown-render__link");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "nofollow noopener noreferrer");
  });
});

it("renders GFM tables and fenced code blocks", () => {
  render(
    <MarkdownRender
      content={
        "| 字段 | 值 |\n| --- | --- |\n| 状态 | 已验证 |\n\n```ts\nconst safe = true;\n```"
      }
    />,
  );

  expect(screen.getByRole("table")).toBeVisible();
  expect(screen.getByRole("columnheader", { name: "字段" })).toBeVisible();
  expect(screen.getByRole("cell", { name: "已验证" })).toBeVisible();
  expect(screen.getByText("const safe = true;")).toHaveClass(
    "markdown-render__code",
  );
});

it("renders long URLs and unbroken words without dropping their content", () => {
  const longUrl = "https://example.com/" + "path/".repeat(80);
  const longWord = "超长字段".repeat(80);

  render(<MarkdownRender content={`[${longUrl}](${longUrl})\n\n${longWord}`} />);

  expect(screen.getByRole("link", { name: longUrl })).toBeVisible();
  expect(screen.getByText(longWord)).toBeVisible();
});
