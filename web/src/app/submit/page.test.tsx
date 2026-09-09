import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SubmitPage from "./page";

describe("submission directory", () => {
  it("keeps the directory guidance concise", () => {
    render(<SubmitPage />);

    expect(
      screen.getByText("选择与你的内容最贴近的领域后提交。"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "每份情报只进入一个领地。选择最贴近内容主题的入口，提交后将由维护者人工审核。",
      ),
    ).not.toBeInTheDocument();
  });

  it("renders one tactical directory entry for every enabled territory", () => {
    render(<SubmitPage />);

    expect(
      screen.getByRole("main", { name: "选择投稿领地" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /进入.*投稿表/ })).toHaveLength(5);
    expect(screen.getByRole("link", { name: "进入面经记录投稿表" })).toHaveAttribute(
      "href",
      "/submit/interview",
    );
  });
});
