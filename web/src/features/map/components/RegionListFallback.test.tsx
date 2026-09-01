import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { REGIONS } from "../regions";
import { RegionListFallback } from "./RegionListFallback";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("starts collapsed on mobile and exposes equivalent territory links", async () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: true,
      media: "(max-width: 640px)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  );
  const user = userEvent.setup();
  const { container } = render(<RegionListFallback regions={REGIONS} />);
  const details = container.querySelector("details");
  if (!details) throw new Error("expected a details element");

  await waitFor(() => expect(details).not.toHaveAttribute("open"));
  await user.click(screen.getByText("打开领地列表"));

  expect(details).toHaveAttribute("open");
  expect(screen.getAllByRole("link")).toHaveLength(5);
  expect(screen.getByRole("link", { name: /项目区$/ })).toHaveAttribute(
    "href",
    "/regions/projects",
  );
});
