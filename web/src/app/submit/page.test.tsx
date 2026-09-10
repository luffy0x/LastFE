import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SubmitPage from "./page";

describe("submission directory", () => {
  it("keeps the directory guidance concise", () => {
    render(<SubmitPage />);

    expect(
      screen.getByText(
        "选择与你的内容最贴近的分类后提交。内容不会直接公开，审核通过后才会出现。",
      ),
    ).toBeInTheDocument();
  });

  it("renders one directory entry for every enabled category", () => {
    render(<SubmitPage />);

    expect(
      screen.getByRole("heading", { name: "选择投稿分类", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "面经记录" }),
    ).toHaveAttribute("href", "/submit/interview");
    expect(
      screen.getByRole("link", { name: "算法手撕" }),
    ).toHaveAttribute("href", "/submit/algorithms");
    expect(
      screen.getByRole("heading", { name: "面经记录", level: 2 }),
    ).toBeInTheDocument();
  });
});
