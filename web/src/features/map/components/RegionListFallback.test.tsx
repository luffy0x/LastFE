import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { REGIONS } from "../regions";
import { RegionListFallback } from "./RegionListFallback";

it("renders a collapsed mobile disclosure with equivalent territory links", async () => {
  const user = userEvent.setup();
  const { container } = render(<RegionListFallback regions={REGIONS} />);
  const details = container.querySelector("details");
  if (!details) throw new Error("expected a details element");

  expect(details).not.toHaveAttribute("open");
  await user.click(screen.getByText("打开领地列表"));

  expect(details).toHaveAttribute("open");
  expect(screen.getAllByRole("link")).toHaveLength(10);
  expect(screen.getAllByRole("link", { name: /项目区$/ })[1]).toHaveAttribute(
    "href",
    "/regions/projects",
  );
});

it("server-renders a separate desktop territory list", () => {
  const { container } = render(<RegionListFallback regions={REGIONS} />);
  const desktopList = container.querySelector(".region-list--desktop");

  expect(desktopList).toContainElement(
    screen.getAllByRole("navigation", { name: "领地列表" })[0],
  );
  expect(desktopList?.querySelectorAll("a")).toHaveLength(5);
});
