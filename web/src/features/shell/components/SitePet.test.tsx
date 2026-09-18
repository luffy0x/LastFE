import { act, render } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { SitePet } from "./SitePet";

function firePointer(
  target: EventTarget,
  type: string,
  { x, y, pointerId = 1 }: { x: number; y: number; pointerId?: number },
) {
  act(() => {
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId,
        button: 0,
      }),
    );
  });
}

function mockViewport(width: number, height: number) {
  vi.spyOn(window, "innerWidth", "get").mockReturnValue(width);
  vi.spyOn(window, "innerHeight", "get").mockReturnValue(height);
}

it("keeps the default corner position when pointer never moves", () => {
  const { container } = render(<SitePet />);
  const pet = container.querySelector(".site-pet") as HTMLElement;

  firePointer(pet, "pointerdown", { x: 1100, y: 500 });
  firePointer(window, "pointerup", { x: 1100, y: 500 });

  expect(pet.className).toBe("site-pet");
  expect(pet.style.left).toBe("");
  expect(pet.style.top).toBe("");
});

it("moves with the pointer once dragged beyond the threshold and clamps to viewport", () => {
  mockViewport(1280, 720);
  const { container } = render(<SitePet />);
  const pet = container.querySelector(".site-pet") as HTMLElement;
  // jsdom 未实现 setPointerCapture
  pet.setPointerCapture = vi.fn();
  // jsdom 不做真实布局，直接模拟初始停靠矩形
  vi.spyOn(pet, "getBoundingClientRect").mockReturnValue({
    left: 1084,
    top: 440,
    right: 1244,
    bottom: 680,
    width: 160,
    height: 240,
    x: 1084,
    y: 440,
    toJSON: () => ({}),
  } as DOMRect);

  firePointer(pet, "pointerdown", { x: 1100, y: 440 });
  // 拖到视口外 (1400, 800)：应钳制到 1280-160=1120、720-240=480
  firePointer(window, "pointermove", { x: 1400, y: 800 });

  expect(pet.className).toContain("site-pet--placed");
  expect(pet.style.left).toBe("1120px");
  expect(pet.style.top).toBe("480px");

  firePointer(window, "pointerup", { x: 1400, y: 800 });
  // 松手后位置保持，可继续交互
  expect(pet.style.left).toBe("1120px");
});
