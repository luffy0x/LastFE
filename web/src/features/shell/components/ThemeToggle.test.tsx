import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { ThemeToggle } from "./ThemeToggle";

const setTheme = vi.fn();
let resolvedTheme: "light" | "dark" = "light";

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme, setTheme }),
}));

it("switches from light to dark", async () => {
  resolvedTheme = "light";
  const user = userEvent.setup();
  render(<ThemeToggle />);

  const toggle = screen.getByRole("button", { name: "切换到深色主题" });
  await user.click(toggle);
  expect(setTheme).toHaveBeenCalledWith("dark");
});

it("switches from dark to light", async () => {
  resolvedTheme = "dark";
  const user = userEvent.setup();
  render(<ThemeToggle />);

  const toggle = screen.getByRole("button", { name: "切换到浅色主题" });
  await user.click(toggle);
  expect(setTheme).toHaveBeenCalledWith("light");
});
