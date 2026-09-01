import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MotionLeg } from "../route-planner";
import { createExplorerMotionAdapter, ExplorerMarker } from "./ExplorerMarker";

afterEach(() => {
  vi.useRealTimers();
});

describe("explorer motion adapter", () => {
  it("settles at the destination when the browser animation never finishes", async () => {
    vi.useFakeTimers();
    render(
      <svg>
        <ExplorerMarker
          point={{ x: 100, y: 100 }}
          regionLabel="八股区"
          targetLocked
        />
      </svg>,
    );
    const marker = screen.getByRole("img", {
      name: "探索者当前位置：八股区",
    });
    const cancel = vi.fn();
    Object.defineProperty(marker, "animate", {
      configurable: true,
      value: vi.fn(() => ({
        currentTime: 0,
        finished: new Promise<Animation>(() => undefined),
        cancel,
      })),
    });
    const leg: MotionLeg = {
      from: "fundamentals",
      to: "interview",
      fromPoint: { x: 100, y: 100 },
      toPoint: { x: 200, y: 180 },
      path: "M100 100L200 180",
      reverse: false,
    };
    const settled = vi.fn();

    void createExplorerMotionAdapter()
      .start([leg], leg.fromPoint, 600)
      .finished.then(settled);
    await vi.advanceTimersByTimeAsync(700);

    expect(settled).toHaveBeenCalledWith(leg.toPoint);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("settles once at the interrupted point when cancel wins the race", async () => {
    vi.useFakeTimers();
    render(
      <svg>
        <ExplorerMarker
          point={{ x: 100, y: 100 }}
          regionLabel="八股区"
          targetLocked
        />
      </svg>,
    );
    const marker = screen.getByRole("img", {
      name: "探索者当前位置：八股区",
    });
    let finishNativeAnimation!: (animation: Animation) => void;
    const nativeFinished = new Promise<Animation>((resolve) => {
      finishNativeAnimation = resolve;
    });
    const cancel = vi.fn();
    const animation = {
      currentTime: 300,
      finished: nativeFinished,
      cancel,
    } as unknown as Animation;
    Object.defineProperty(marker, "animate", {
      configurable: true,
      value: vi.fn(() => animation),
    });
    const leg: MotionLeg = {
      from: "fundamentals",
      to: "interview",
      fromPoint: { x: 100, y: 100 },
      toPoint: { x: 200, y: 180 },
      path: "M100 100L200 180",
      reverse: false,
    };
    const handle = createExplorerMotionAdapter().start(
      [leg],
      leg.fromPoint,
      600,
    );
    const settled = vi.fn();
    void handle.finished.then(settled);

    expect(handle.cancel()).toEqual(leg.fromPoint);
    finishNativeAnimation(animation);
    await vi.runAllTimersAsync();

    expect(settled).toHaveBeenCalledTimes(1);
    expect(settled).toHaveBeenCalledWith(leg.fromPoint);
    expect(cancel).toHaveBeenCalledOnce();
  });
});
