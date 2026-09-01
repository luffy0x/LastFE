import { act, render, renderHook, waitFor } from "@testing-library/react";
import { StrictMode, useLayoutEffect, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REGION_ANCHORS, REGIONS } from "../regions";
import type { Point } from "../types";
import {
  useExplorerNavigation,
  type ExplorerMotionAdapter,
  type ExplorerNavigationOptions,
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

function SelectBeforePassiveEffects({
  options,
}: {
  options: ExplorerNavigationOptions;
}) {
  const navigation = useExplorerNavigation(options);
  const hasSelected = useRef(false);

  useLayoutEffect(() => {
    if (hasSelected.current) return;
    hasSelected.current = true;
    navigation.selectRegion("interview");
  }, [navigation]);

  return <output data-phase={navigation.phase}>{navigation.phase}</output>;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useExplorerNavigation", () => {
  it("keeps a selection made before the initial Strict Mode passive effect cycle", async () => {
    const navigate = vi.fn();
    const motion: ExplorerMotionAdapter = {
      start: (_legs, from) => ({
        finished: Promise.resolve(from),
        cancel: () => from,
      }),
    };

    const { getByText } = render(
      <StrictMode>
        <SelectBeforePassiveEffects
          options={{
            regions: REGIONS,
            initialRegion: "fundamentals",
            prepare: () => Promise.resolve(),
            focus: vi.fn(),
            navigate,
            motion,
            reducedMotion: false,
          }}
        />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(getByText("idle")).toBeInTheDocument();
      expect(navigate).toHaveBeenCalledWith("/regions/interview");
    });
  });

  it("cancels navigation when the explorer unmounts during a selection", async () => {
    let finishPreparation!: () => void;
    const prepare = () =>
      new Promise<void>((resolve) => {
        finishPreparation = resolve;
      });
    const navigate = vi.fn();
    const motion = timedMotion();
    const { result, unmount } = renderHook(() =>
      useExplorerNavigation({
        regions: REGIONS,
        initialRegion: "fundamentals",
        prepare,
        focus: vi.fn(),
        navigate,
        motion,
        reducedMotion: false,
      }),
    );

    act(() => result.current.selectRegion("interview"));
    unmount();
    await act(async () => finishPreparation());

    expect(navigate).not.toHaveBeenCalled();
  });

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
