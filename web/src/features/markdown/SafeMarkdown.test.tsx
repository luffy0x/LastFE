import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { SafeMarkdown } from "./SafeMarkdown";

it("renders raw HTML as text instead of live elements", () => {
  render(
    <SafeMarkdown
      source={'<script>alert(1)</script><img src=x onerror=alert(2)>'}
    />,
  );

  expect(document.querySelector("script")).toBeNull();
  expect(document.querySelector("img")).toBeNull();
});

it.each(["javascript:alert(1)", "data:text/html,unsafe"]) (
  "does not expose %s as a dangerous link destination",
  (unsafeUrl) => {
    render(<SafeMarkdown source={`[危险链接](${unsafeUrl})`} />);

    expect(screen.getByText("危险链接").closest("a")).not.toHaveAttribute(
      "href",
      unsafeUrl,
    );
  },
);

it("hardens HTTP and HTTPS links opened from markdown", () => {
  render(
    <SafeMarkdown
      source={"[HTTP](http://example.com/a) and [HTTPS](https://example.com/b)"}
    />,
  );

  ["HTTP", "HTTPS"].forEach((name) => {
    const link = screen.getByRole("link", { name });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "nofollow noopener noreferrer");
  });
});

it("renders GFM tables and fenced code blocks", () => {
  render(
    <SafeMarkdown
      source={"| 字段 | 值 |\n| --- | --- |\n| 状态 | 已验证 |\n\n```ts\nconst safe = true;\n```"}
    />,
  );

  expect(screen.getByRole("table")).toBeVisible();
  expect(screen.getByRole("columnheader", { name: "字段" })).toBeVisible();
  expect(screen.getByRole("cell", { name: "已验证" })).toBeVisible();
  expect(screen.getByText("const safe = true;")).toHaveProperty(
    "tagName",
    "CODE",
  );
});

it("renders long URLs and unbroken words without dropping their content", () => {
  const longUrl = "https://example.com/" + "path/".repeat(80);
  const longWord = "超长字段".repeat(80);

  render(<SafeMarkdown source={`[${longUrl}](${longUrl})\n\n${longWord}`} />);

  expect(screen.getByRole("link", { name: longUrl })).toBeVisible();
  expect(screen.getByText(longWord)).toBeVisible();
});
