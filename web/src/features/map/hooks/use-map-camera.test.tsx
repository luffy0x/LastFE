import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StrategicMap } from "../components/StrategicMap";
import { REGIONS } from "../regions";
import { clampCamera, useMapCamera } from "./use-map-camera";

const bounds = {
  minX: -420,
  maxX: 420,
  minY: -240,
  maxY: 240,
  minScale: 0.8,
  maxScale: 2.4,
};

describe("map camera", () => {
  it("clamps scale and translation", () => {
    expect(clampCamera({ x: 9000, y: -9000, scale: 9 }, bounds)).toEqual({
      x: bounds.maxX,
      y: bounds.minY,
      scale: 2.4,
    });
  });

  it("pans, zooms around a point, and resets", () => {
    const { result } = renderHook(() =>
      useMapCamera({ bounds, initial: { x: 0, y: 0, scale: 1 } }),
    );

    act(() => result.current.panBy({ x: 40, y: 20 }));
    expect(result.current.state).toEqual({ x: 40, y: 20, scale: 1 });

    act(() => result.current.zoomAt(2, { x: 100, y: 100 }));
    expect(result.current.state).toEqual({ x: -20, y: -60, scale: 2 });

    act(() => result.current.reset());
    expect(result.current.transform).toBe("translate(0 0) scale(1)");
  });

  it("restores a persisted camera through the same bounds", () => {
    const { result } = renderHook(() =>
      useMapCamera({ bounds, initial: { x: 0, y: 0, scale: 1 } }),
    );

    act(() => result.current.restore({ x: 900, y: -900, scale: 1.4 }));

    expect(result.current.state).toEqual({ x: 420, y: -240, scale: 1.4 });
  });

  it("does not capture a pointer until it becomes a drag", () => {
    render(
      <StrategicMap
        regions={REGIONS}
        stats={{ totalPublished: 0, recentPublished: 0 }}
        onSelectRegion={vi.fn()}
      />,
    );
    const surface = screen.getByRole("application", { name: "战略地图画布" });
    const setPointerCapture = vi.fn();
    Object.defineProperty(surface, "setPointerCapture", {
      configurable: true,
      value: setPointerCapture,
    });

    fireEvent.pointerDown(surface, { pointerId: 7, clientX: 100, clientY: 100 });
    expect(setPointerCapture).not.toHaveBeenCalled();

    fireEvent.pointerMove(surface, { pointerId: 7, clientX: 120, clientY: 100 });
    expect(setPointerCapture).toHaveBeenCalledWith(7);
  });

  it("captures both pinch pointers and releases them when they finish", () => {
    render(
      <StrategicMap
        regions={REGIONS}
        stats={{ totalPublished: 0, recentPublished: 0 }}
        onSelectRegion={vi.fn()}
      />,
    );
    const surface = screen.getByRole("application", { name: "战略地图画布" });
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    Object.defineProperties(surface, {
      setPointerCapture: { configurable: true, value: setPointerCapture },
      hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
      releasePointerCapture: {
        configurable: true,
        value: releasePointerCapture,
      },
    });

    fireEvent.pointerDown(surface, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerDown(surface, { pointerId: 2, clientX: 200, clientY: 100 });
    expect(setPointerCapture.mock.calls).toEqual([[1], [2]]);

    fireEvent.pointerUp(surface, { pointerId: 2 });
    fireEvent.pointerCancel(surface, { pointerId: 1 });
    expect(releasePointerCapture.mock.calls).toEqual([[2], [1]]);
  });

  it("resets pointer pan and wheel zoom from the HUD", async () => {
    const user = userEvent.setup();
    render(
      <StrategicMap
        regions={REGIONS}
        stats={{ totalPublished: 0, recentPublished: 0 }}
        onSelectRegion={vi.fn()}
      />,
    );
    const surface = screen.getByRole("application", { name: "战略地图画布" });

    fireEvent.pointerDown(surface, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: 140, clientY: 120 });
    fireEvent.pointerUp(surface, { pointerId: 1, clientX: 140, clientY: 120 });
    fireEvent.wheel(surface, { deltaY: -120, clientX: 200, clientY: 200 });
    await user.click(screen.getByRole("button", { name: "复位地图" }));

    expect(screen.getByTestId("camera-layer")).toHaveAttribute(
      "transform",
      "translate(0 0) scale(1)",
    );
    expect(screen.getByRole("button", { name: "复位地图" })).toHaveClass(
      "min-h-11",
      "min-w-11",
    );
  });
});
