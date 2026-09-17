import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ALGORITHM_SITES, RESUME_SITES } from "../site-icons";
import { RecommendedSiteCards } from "./RecommendedSiteCards";

describe("RecommendedSiteCards", () => {
  it("renders one external link card per recommended algorithm site", () => {
    render(
      <RecommendedSiteCards title="刷题网站推荐" sites={ALGORITHM_SITES} />,
    );

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
    const { container } = render(
      <RecommendedSiteCards title="刷题网站推荐" sites={ALGORITHM_SITES} />,
    );

    const icons = container.querySelectorAll<HTMLImageElement>(
      ".algorithm-site-card__icon img",
    );
    expect(icons).toHaveLength(ALGORITHM_SITES.length);
    icons.forEach((icon, index) => {
      expect(icon).toHaveAttribute("src", ALGORITHM_SITES[index].icon);
      expect(icon).toHaveAttribute("alt", "");
    });
  });

  it("renders the resume sites with their own heading", () => {
    render(
      <RecommendedSiteCards title="简历制作网站推荐" sites={RESUME_SITES} />,
    );

    expect(
      screen.getByRole("heading", { name: "简历制作网站推荐" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /简历大师/ }),
    ).toHaveAttribute("href", "https://honoz.top/");
    expect(
      screen.getByRole("link", { name: /Reactive Resume/ }),
    ).toHaveAttribute("href", "https://rxresu.me/");
  });
});
