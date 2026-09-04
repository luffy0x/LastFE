import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { fixtureContentRepository } from "../fixture-repository";
import { Dossier } from "./Dossier";

it("renders a readable dossier with a route back to its territory", async () => {
  const record = await fixtureContentRepository.get("interview-byte-infra");
  if (!record) throw new Error("fixture missing");

  render(<Dossier record={record} />);

  expect(
    screen.getByRole("heading", {
      name: "字节跳动/基础架构 · 后端开发",
      level: 1,
    }),
  ).toBeVisible();
  expect(screen.getByRole("link", { name: "返回面经区" })).toHaveAttribute(
    "href",
    "/regions/interview",
  );
});

it("labels and hardens a safe external dossier link", async () => {
  const record = await fixtureContentRepository.get("resource-react-typescript");
  if (!record) throw new Error("fixture missing");

  render(<Dossier record={record} />);

  const externalLink = screen.getByRole("link", {
    name: "站外链接（本站不托管或检查文件）",
  });
  expect(externalLink).toHaveAttribute(
    "href",
    "https://react.dev/learn/typescript",
  );
  expect(externalLink).toHaveAttribute("target", "_blank");
  expect(externalLink).toHaveAttribute("rel", "nofollow noopener noreferrer");
});

it("withholds an unsafe external dossier URL", async () => {
  const record = await fixtureContentRepository.get("resource-react-typescript");
  if (!record) throw new Error("fixture missing");

  render(<Dossier record={{ ...record, externalUrl: "javascript:alert(1)" }} />);

  expect(document.querySelector('a[href^="javascript:"]')).toBeNull();
});
