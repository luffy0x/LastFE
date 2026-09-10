import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { ALGORITHM_SITES } from "../site-icons";
import { AlgorithmSiteCards } from "./AlgorithmSiteCards";

it("renders one external link card per recommended site", () => {
  render(<AlgorithmSiteCards />);

  expect(
    screen.getByRole("heading", { name: "刷题网站推荐" }),
  ).toBeInTheDocument();

  for (const { site, url } of ALGORITHM_SITES) {
    const link = screen.getByRole("link", { name: new RegExp(site) });
    expect(link).toHaveAttribute("href", url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "nofollow noopener noreferrer");
  }
});

it("shows each site icon as decorative image from local assets", () => {
  const { container } = render(<AlgorithmSiteCards />);

  const icons = container.querySelectorAll<HTMLImageElement>(
    ".algorithm-site-card__icon img",
  );
  expect(icons).toHaveLength(ALGORITHM_SITES.length);
  icons.forEach((icon, index) => {
    expect(icon).toHaveAttribute("src", ALGORITHM_SITES[index].icon);
    expect(icon).toHaveAttribute("alt", "");
  });
});
