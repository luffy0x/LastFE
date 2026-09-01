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
