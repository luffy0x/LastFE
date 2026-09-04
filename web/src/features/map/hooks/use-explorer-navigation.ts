import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildMotionLegs,
  durationForDistance,
  findRegionRoute,
  type MotionLeg,
} from "../route-planner";
import type { Point, RegionDefinition } from "../types";

export type ExplorerMotionHandle = {
  finished: Promise<Point>;
  cancel(): Point;
};

export type ExplorerMotionAdapter = {
  start(
    legs: readonly MotionLeg[],
    from: Point,
    durationMs: number,
  ): ExplorerMotionHandle;
};

export type ExplorerNavigationOptions = {
  regions: readonly RegionDefinition[];
  initialRegion: string;
  initialSelectedSlug?: string | null;
  prepare(region: RegionDefinition): Promise<void>;
  focus?(region: RegionDefinition): void;
  navigate(href: string): void;
  motion: ExplorerMotionAdapter;
  reducedMotion: boolean;
};

export type ExplorerNavigationState = {
  currentPoint: Point;
  targetSlug: string | null;
  phase: "idle" | "moving" | "loading" | "failed";
  selectRegion(slug: string): void;
  restore(point: Point, selectedSlug: string | null): void;
  retry(): void;
  cancel(): void;
};

function routeDistance(legs: readonly MotionLeg[], from: Point): number {
  let distance = 0;
  let cursor = from;

  for (const leg of legs) {
    distance += Math.hypot(
      leg.toPoint.x - cursor.x,
      leg.toPoint.y - cursor.y,
    );
    cursor = leg.toPoint;
  }

  return distance;
}

export function useExplorerNavigation({
  regions,
  initialRegion,
  initialSelectedSlug = null,
  prepare,
  focus,
  navigate,
  motion,
  reducedMotion,
}: ExplorerNavigationOptions): ExplorerNavigationState {
  const initial = regions.find(({ slug }) => slug === initialRegion);
  if (!initial) throw new Error(`unknown initial territory: ${initialRegion}`);

  const [currentPoint, setCurrentPoint] = useState<Point>(initial.anchor);
  const [targetSlug, setTargetSlug] = useState<string | null>(
    initialSelectedSlug,
  );
  const [phase, setPhase] = useState<ExplorerNavigationState["phase"]>("idle");
  const pointRef = useRef<Point>(initial.anchor);
  const currentSlugRef = useRef(initial.slug);
  const tokenRef = useRef(0);
  const mountedRef = useRef(false);
  const activeMotionRef = useRef<ExplorerMotionHandle | null>(null);

  const runSelection = useCallback(
    (slug: string) => {
      const target = regions.find(
        (region) => region.slug === slug && region.enabled,
      );
      if (!target) return;

      const interruptedPoint = activeMotionRef.current?.cancel();
      if (interruptedPoint) {
        pointRef.current = interruptedPoint;
        setCurrentPoint(interruptedPoint);
      }

      const selectionToken = ++tokenRef.current;
      setTargetSlug(slug);
      focus?.(target);

      let preparation: Promise<void>;
      try {
        preparation = Promise.resolve(prepare(target));
      } catch (error) {
        preparation = Promise.reject(error);
      }
      let preparationFinished = false;
      void preparation.then(
        () => {
          preparationFinished = true;
        },
        () => {
          preparationFinished = true;
        },
      );

      let motionFinished: Promise<Point>;
      if (reducedMotion) {
        pointRef.current = target.anchor;
        currentSlugRef.current = target.slug;
        setCurrentPoint(target.anchor);
        setPhase("loading");
        activeMotionRef.current = null;
        motionFinished = Promise.resolve(target.anchor);
      } else {
        const route = findRegionRoute(regions, currentSlugRef.current, slug);
        const legs = buildMotionLegs(regions, route);
        const duration = durationForDistance(routeDistance(legs, pointRef.current));
        const activeMotion = motion.start(legs, pointRef.current, duration);
        activeMotionRef.current = activeMotion;
        setPhase("moving");
        motionFinished = activeMotion.finished;
      }

      void motionFinished.then((point) => {
        if (selectionToken !== tokenRef.current || !mountedRef.current) return;

        pointRef.current = point;
        currentSlugRef.current = target.slug;
        activeMotionRef.current = null;
        setCurrentPoint(point);
        if (!preparationFinished) setPhase("loading");
      });

      void Promise.allSettled([motionFinished, preparation]).then(
        ([motionResult, preparationResult]) => {
          if (selectionToken !== tokenRef.current || !mountedRef.current) {
            return;
          }

          const finalPoint =
            motionResult.status === "fulfilled"
              ? motionResult.value
              : target.anchor;
          pointRef.current = finalPoint;
          currentSlugRef.current = target.slug;
          activeMotionRef.current = null;
          setCurrentPoint(finalPoint);

          if (preparationResult.status === "rejected") {
            setPhase("failed");
            return;
          }

          setPhase("idle");
          navigate(target.href);
        },
      );
    },
    [focus, motion, navigate, prepare, reducedMotion, regions],
  );

  const retry = useCallback(() => {
    if (targetSlug) runSelection(targetSlug);
  }, [runSelection, targetSlug]);

  const restore = useCallback(
    (point: Point, selectedSlug: string | null) => {
      const selectedRegion = selectedSlug
        ? regions.find(
            (region) => region.slug === selectedSlug && region.enabled,
          )
        : null;
      const nearestRegion = regions
        .filter(({ enabled }) => enabled)
        .reduce<RegionDefinition | null>((nearest, region) => {
          if (!nearest) return region;
          const nearestDistance = Math.hypot(
            nearest.anchor.x - point.x,
            nearest.anchor.y - point.y,
          );
          const candidateDistance = Math.hypot(
            region.anchor.x - point.x,
            region.anchor.y - point.y,
          );
          return candidateDistance < nearestDistance ? region : nearest;
        }, null);

      tokenRef.current += 1;
      activeMotionRef.current?.cancel();
      activeMotionRef.current = null;
      pointRef.current = point;
      currentSlugRef.current = (selectedRegion ?? nearestRegion ?? initial).slug;
      setCurrentPoint(point);
      setTargetSlug(selectedRegion?.slug ?? null);
      setPhase("idle");
    },
    [initial, regions],
  );

  const cancel = useCallback(() => {
    tokenRef.current += 1;
    const point = activeMotionRef.current?.cancel();
    activeMotionRef.current = null;
    if (point) {
      pointRef.current = point;
      setCurrentPoint(point);
    }
    setTargetSlug(null);
    setPhase("idle");
  }, []);

  useEffect(
    () => {
      mountedRef.current = true;

      return () => {
        mountedRef.current = false;
        activeMotionRef.current?.cancel();
      };
    },
    [],
  );

  return {
    currentPoint,
    targetSlug,
    phase,
    selectRegion: runSelection,
    restore,
    retry,
    cancel,
  };
}
