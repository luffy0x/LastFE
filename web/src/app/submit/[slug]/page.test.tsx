import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SubmissionPage, { generateStaticParams } from "./page";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/utils/request", () => ({
  request: vi.fn().mockRejectedValue(new Error("offline in page test")),
  RequestError: class RequestError extends Error {},
}));

vi.mock("altcha", () => ({}));
vi.mock("altcha/i18n/zh-cn", () => ({}));

describe("territory submission page", () => {
  it("prebuilds enabled territory slugs", () => {
    expect(generateStaticParams()).toEqual([
      { slug: "interview" },
      { slug: "resources" },
      { slug: "fundamentals" },
      { slug: "projects" },
      { slug: "algorithms" },
    ]);
  });

  it("renders the configured form with return and safety paths", async () => {
    render(
      await SubmissionPage({
        params: Promise.resolve({ slug: "interview" }),
      }),
    );

    expect(screen.getByRole("heading", { name: "面经区投稿" })).toBeVisible();
    expect(screen.getByRole("link", { name: "返回投稿目录" })).toHaveAttribute(
      "href",
      "/submit",
    );
    expect(screen.getByText(/不要提交个人隐私/)).toBeVisible();
  });

  it("rejects an unknown territory slug", async () => {
    await expect(
      SubmissionPage({ params: Promise.resolve({ slug: "unknown" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
