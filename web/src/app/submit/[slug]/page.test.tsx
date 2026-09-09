import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import SubmitRegionPage from "./page";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

it("uses the selected territory in the submission heading", async () => {
  render(
    await SubmitRegionPage({
      params: Promise.resolve({ slug: "algorithms" }),
    }),
  );

  expect(
    screen.getByRole("heading", { name: "向算法手撕递交情报", level: 1 }),
  ).toBeVisible();
});
