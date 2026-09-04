import { useCallback, useMemo, useRef, useState } from "react";
import type { PointerEvent, WheelEvent } from "react";
import type { CameraTarget, Point } from "../types";

export type MapCameraState = Point & { scale: number };

export type CameraBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minScale: number;
  maxScale: number;
};

export type MapCameraApi = {
  state: MapCameraState;
  transform: string;
  panBy(delta: Point): void;
  zoomAt(nextScale: number, origin: Point): void;
  focus(target: CameraTarget): void;
  restore(state: MapCameraState): void;
  reset(): void;
  bind: {
    onPointerDown(event: PointerEvent<SVGSVGElement>): void;
    onPointerMove(event: PointerEvent<SVGSVGElement>): void;
    onPointerUp(event: PointerEvent<SVGSVGElement>): void;
    onPointerCancel(event: PointerEvent<SVGSVGElement>): void;
    onWheel(event: WheelEvent<SVGSVGElement>): void;
  };
};

export function clampCamera(
  state: MapCameraState,
  bounds: CameraBounds,
): MapCameraState {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, state.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, state.y)),
    scale: Math.min(bounds.maxScale, Math.max(bounds.minScale, state.scale)),
  };
}

function pointFromEvent(event: PointerEvent<SVGSVGElement>): Point {
  return { x: event.clientX, y: event.clientY };
}

function distance(first: Point, second: Point) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function midpoint(first: Point, second: Point): Point {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

export function useMapCamera({
  bounds,
  initial,
}: {
  bounds: CameraBounds;
  initial: MapCameraState;
}): MapCameraApi {
  const [state, setState] = useState(() => clampCamera(initial, bounds));
  const pointers = useRef(new Map<number, Point>());
  const lastPanPoint = useRef<Point | null>(null);
  const pinch = useRef<{ distance: number; midpoint: Point } | null>(null);

  const panBy = useCallback(
    (delta: Point) => {
      setState((current) =>
        clampCamera(
          { ...current, x: current.x + delta.x, y: current.y + delta.y },
          bounds,
        ),
      );
    },
    [bounds],
  );

  const zoomAt = useCallback(
    (nextScale: number, origin: Point) => {
      setState((current) => {
        const scale = Math.min(
          bounds.maxScale,
          Math.max(bounds.minScale, nextScale),
        );
        const ratio = scale / current.scale;

        return clampCamera(
          {
            x: origin.x - (origin.x - current.x) * ratio,
            y: origin.y - (origin.y - current.y) * ratio,
            scale,
          },
          bounds,
        );
      });
    },
    [bounds],
  );

  const focus = useCallback(
    (target: CameraTarget) => {
      setState(
        clampCamera(
          {
            x: 500 - target.x * target.scale,
            y: 300 - target.y * target.scale,
            scale: target.scale,
          },
          bounds,
        ),
      );
    },
    [bounds],
  );

  const restore = useCallback(
    (snapshot: MapCameraState) => setState(clampCamera(snapshot, bounds)),
    [bounds],
  );

  const reset = useCallback(
    () => setState(clampCamera(initial, bounds)),
    [bounds, initial],
  );

  const onPointerDown = useCallback((event: PointerEvent<SVGSVGElement>) => {
    if ((event.target as Element | null)?.closest("[data-region]")) return;

    const point = pointFromEvent(event);
    pointers.current.set(event.pointerId, point);
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic pointer events in browser tests may not create an active
      // pointer capture target. The in-memory pointer set still exercises the
      // same pan/pinch path.
    }

    const active = [...pointers.current.values()];
    if (active.length === 1) {
      lastPanPoint.current = point;
    } else if (active.length === 2) {
      pinch.current = {
        distance: distance(active[0], active[1]),
        midpoint: midpoint(active[0], active[1]),
      };
    }
  }, []);

  const onPointerMove = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (!pointers.current.has(event.pointerId)) return;

      event.preventDefault();
      pointers.current.set(event.pointerId, pointFromEvent(event));
      const active = [...pointers.current.values()];

      if (active.length === 1 && lastPanPoint.current) {
        const next = active[0];
        panBy({
          x: next.x - lastPanPoint.current.x,
          y: next.y - lastPanPoint.current.y,
        });
        lastPanPoint.current = next;
        return;
      }

      if (active.length === 2 && pinch.current) {
        const nextDistance = distance(active[0], active[1]);
        const nextMidpoint = midpoint(active[0], active[1]);
        const previousPinch = pinch.current;

        setState((current) => {
          const scale = Math.min(
            bounds.maxScale,
            Math.max(
              bounds.minScale,
              current.scale * (nextDistance / previousPinch.distance),
            ),
          );
          const ratio = scale / current.scale;

          return clampCamera(
            {
              x:
                nextMidpoint.x -
                (previousPinch.midpoint.x - current.x) * ratio,
              y:
                nextMidpoint.y -
                (previousPinch.midpoint.y - current.y) * ratio,
              scale,
            },
            bounds,
          );
        });

        pinch.current = { distance: nextDistance, midpoint: nextMidpoint };
      }
    },
    [bounds, panBy],
  );

  const finishPointer = useCallback((event: PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const active = [...pointers.current.values()];
    lastPanPoint.current = active[0] ?? null;
    pinch.current = null;
  }, []);

  const onWheel = useCallback(
    (event: WheelEvent<SVGSVGElement>) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.12 : 0.88;
      zoomAt(state.scale * factor, { x: event.clientX, y: event.clientY });
    },
    [state.scale, zoomAt],
  );

  const bind = useMemo(
    () => ({
      onPointerDown,
      onPointerMove,
      onPointerUp: finishPointer,
      onPointerCancel: finishPointer,
      onWheel,
    }),
    [finishPointer, onPointerDown, onPointerMove, onWheel],
  );

  return {
    state,
    transform: `translate(${state.x} ${state.y}) scale(${state.scale})`,
    panBy,
    zoomAt,
    focus,
    restore,
    reset,
    bind,
  };
}
