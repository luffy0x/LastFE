import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SubmitPage from "./page";

describe("submission directory", () => {
  it("renders one tactical directory entry for every enabled territory", () => {
    render(<SubmitPage />);

    expect(
      screen.getByRole("main", { name: "选择投稿领地" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /进入.*投稿表/ })).toHaveLength(5);
    expect(screen.getByRole("link", { name: "进入面经区投稿表" })).toHaveAttribute(
      "href",
      "/submit/interview",
    );
  });
});
