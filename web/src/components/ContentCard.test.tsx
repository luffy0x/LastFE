import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { ContentCard, contentCardTint } from "./ContentCard";

it("links the whole card to href with the title as accessible name", () => {
  render(
    <ContentCard
      href="/content/c-1"
      title="某大厂前端一面记录"
      description="从自我介绍到反问环节。"
    />,
  );

  expect(
    screen.getByRole("link", { name: "某大厂前端一面记录" }),
  ).toHaveAttribute("href", "/content/c-1");
  expect(screen.getByText("从自我介绍到反问环节。")).toBeInTheDocument();
  expect(screen.getByText("阅读全文")).toBeInTheDocument();
});

it("renders eyebrow, custom action and heading level", () => {
  render(
    <ContentCard
      href="/submit/interview"
      title="面经记录"
      eyebrow="内容分类"
      description="公司与岗位实战记录。"
      action="去投稿"
      headingLevel="h2"
    />,
  );

  expect(screen.getByRole("heading", { level: 2, name: "面经记录" }))
    .toBeInTheDocument();
  expect(screen.getByText("内容分类")).toBeInTheDocument();
  expect(screen.getByText("去投稿")).toBeInTheDocument();
});

it("applies the requested tint class", () => {
  const { container, rerender } = render(
    <ContentCard href="/content/c-1" title="t" tint="graphite" />,
  );
  expect(container.firstChild).toHaveClass("content-card--graphite");

  rerender(<ContentCard href="/content/c-1" title="t" tint="violet" />);
  expect(container.firstChild).toHaveClass("content-card--violet");
});

it("cycles tints blue, violet, graphite", () => {
  expect(contentCardTint(0)).toBe("blue");
  expect(contentCardTint(1)).toBe("violet");
  expect(contentCardTint(2)).toBe("graphite");
  expect(contentCardTint(3)).toBe("blue");
});

it("adds external link attributes when external is set", () => {
  render(
    <ContentCard href="https://example.com" title="外部内容" external />,
  );

  const link = screen.getByRole("link", { name: "外部内容" });
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "nofollow noopener noreferrer");
});
