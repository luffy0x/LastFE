import { act, render } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { SitePet } from "./SitePet";
import { PET_MAX_SCALE, PET_MIN_SCALE } from "./useSitePetDrag";

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

function fireWheel(target: EventTarget, deltaY: number) {
  act(() => {
    target.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY,
        clientX: 0,
        clientY: 0,
      }),
    );
  });
}

function mockViewport(width: number, height: number) {
  vi.spyOn(window, "innerWidth", "get").mockReturnValue(width);
  vi.spyOn(window, "innerHeight", "get").mockReturnValue(height);
}

function setupPet(viewport = { width: 1280, height: 720 }) {
  mockViewport(viewport.width, viewport.height);
  const { container } = render(<SitePet />);
  const pet = container.querySelector(".site-pet") as HTMLElement;
  // jsdom 未实现 setPointerCapture
  pet.setPointerCapture = vi.fn();
  return pet;
}

it("keeps the default corner position when pointer never moves", () => {
  const pet = setupPet();

  firePointer(pet, "pointerdown", { x: 1100, y: 500 });
  firePointer(window, "pointerup", { x: 1100, y: 500 });

  expect(pet.className).toBe("site-pet");
  expect(pet.style.left).toBe("");
  expect(pet.style.top).toBe("");
});

it("moves with the pointer once dragged beyond the threshold and clamps to viewport", () => {
  const pet = setupPet();
  // jsdom 不做真实布局，模拟一个已停靠的矩形
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
  // 连续拖动 400px 与 500px：逐步钳制，最终停在 1280-160=1120、720-240=480
  firePointer(window, "pointermove", { x: 1500, y: 940 });
  firePointer(window, "pointermove", { x: 2000, y: 1440 });

  expect(pet.className).toContain("site-pet--placed");
  expect(pet.style.left).toBe("1120px");
  expect(pet.style.top).toBe("480px");

  firePointer(window, "pointerup", { x: 2000, y: 1440 });
  // 松手后位置保持，可继续交互
  expect(pet.style.left).toBe("1120px");
});

it("scales up with the wheel and clamps scale at the max", () => {
  const pet = setupPet();

  for (let i = 0; i < 30; i += 1) fireWheel(pet, -100);

  const scale = Number.parseFloat(pet.style.transform.replace(/^scale\(|\)$/g, ""));
  expect(scale).toBeGreaterThan(1);
  expect(scale).toBeCloseTo(PET_MAX_SCALE, 5);
});

it("scales down with the wheel and clamps scale at the min", () => {
  const pet = setupPet();

  for (let i = 0; i < 30; i += 1) fireWheel(pet, 100);

  const scale = Number.parseFloat(pet.style.transform.replace(/^scale\(|\)$/g, ""));
  expect(scale).toBeLessThan(1);
  expect(scale).toBeCloseTo(PET_MIN_SCALE, 5);
});
