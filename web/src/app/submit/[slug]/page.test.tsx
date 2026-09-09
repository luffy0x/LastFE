import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import SubmitCategoryPage from "./page";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

it("uses the selected category in the submission heading", async () => {
  render(
    await SubmitCategoryPage({
      params: Promise.resolve({ slug: "algorithms" }),
    }),
  );

  expect(
    screen.getByRole("heading", { name: "向算法手撕投稿", level: 1 }),
  ).toBeVisible();
});
