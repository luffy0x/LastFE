import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REGION_ANCHORS, REGIONS } from "../regions";
import type { Point } from "../types";
import {
  useExplorerNavigation,
  type ExplorerMotionAdapter,
} from "./use-explorer-navigation";

function timedMotion(): ExplorerMotionAdapter {
  return {
    start: vi.fn((legs, from, durationMs) => {
      let point = from;
      let resolveFinished!: (point: Point) => void;
      const finished = new Promise<Point>((resolve) => {
        resolveFinished = resolve;
      });
      const timer = setTimeout(() => {
        point = legs.at(-1)?.toPoint ?? from;
        resolveFinished(point);
      }, durationMs);

      return {
        finished,
        cancel: () => {
          clearTimeout(timer);
          resolveFinished(point);
          return point;
        },
      };
    }),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useExplorerNavigation", () => {
  it("navigates only to the latest selected territory", async () => {
    vi.useFakeTimers();
    const navigate = vi.fn();
    const motion = timedMotion();
    const options = {
      regions: REGIONS,
      initialRegion: "fundamentals",
      prepare: vi.fn().mockResolvedValue(undefined),
      focus: vi.fn(),
      navigate,
      motion,
      reducedMotion: false,
    };
    const { result } = renderHook(() => useExplorerNavigation(options));

    act(() => result.current.selectRegion("resources"));
    act(() => result.current.selectRegion("projects"));
    await act(() => vi.runAllTimersAsync());

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/regions/projects");
  });

  it("moves immediately but waits for preparation under reduced motion", async () => {
    let finishPreparation!: () => void;
    const prepare = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishPreparation = resolve;
        }),
    );
    const navigate = vi.fn();
    const motion = timedMotion();
    const { result } = renderHook(() =>
      useExplorerNavigation({
        regions: REGIONS,
        initialRegion: "fundamentals",
        prepare,
        focus: vi.fn(),
        navigate,
        motion,
        reducedMotion: true,
      }),
    );

    act(() => result.current.selectRegion("algorithms"));

    expect(result.current.currentPoint).toEqual(REGION_ANCHORS.algorithms);
    expect(result.current.phase).toBe("loading");
    expect(motion.start).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();

    await act(async () => finishPreparation());
    expect(navigate).toHaveBeenCalledWith("/regions/algorithms");
  });

  it("keeps the explorer at the destination and retries failed preparation", async () => {
    vi.useFakeTimers();
    const prepare = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    const navigate = vi.fn();
    const { result } = renderHook(() =>
      useExplorerNavigation({
        regions: REGIONS,
        initialRegion: "fundamentals",
        prepare,
        focus: vi.fn(),
        navigate,
        motion: timedMotion(),
        reducedMotion: false,
      }),
    );

    act(() => result.current.selectRegion("interview"));
    await act(() => vi.runAllTimersAsync());

    expect(result.current.phase).toBe("failed");
    expect(result.current.currentPoint).toEqual(REGION_ANCHORS.interview);
    expect(navigate).not.toHaveBeenCalled();

    act(() => result.current.retry());
    await act(() => vi.runAllTimersAsync());

    expect(prepare).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledWith("/regions/interview");
  });

  it("restores a persisted point and selected territory without navigating", () => {
    const navigate = vi.fn();
    const { result } = renderHook(() =>
      useExplorerNavigation({
        regions: REGIONS,
        initialRegion: "fundamentals",
        prepare: vi.fn().mockResolvedValue(undefined),
        focus: vi.fn(),
        navigate,
        motion: timedMotion(),
        reducedMotion: false,
      }),
    );

    act(() =>
      result.current.restore(REGION_ANCHORS.algorithms, "algorithms"),
    );

    expect(result.current.currentPoint).toEqual(REGION_ANCHORS.algorithms);
    expect(result.current.targetSlug).toBe("algorithms");
    expect(result.current.phase).toBe("idle");
    expect(navigate).not.toHaveBeenCalled();
  });
});
