import { useEffect, useRef, useState } from "react";
import { REGIONS } from "../regions";
import type { Point } from "../types";
import type { MapCameraState } from "./use-map-camera";

export const MAP_SESSION_KEY = "knowledge-frontier:map:v1";

export type MapSessionSnapshot = {
  camera: MapCameraState;
  explorerPoint: Point;
  selectedSlug: string | null;
};

const enabledSlugs: ReadonlySet<string> = new Set(
  REGIONS.filter(({ enabled }) => enabled).map(({ slug }) => slug),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFinitePoint(value: unknown): value is Point {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    typeof value.y === "number" &&
    Number.isFinite(value.y)
  );
}

function isFiniteCamera(value: unknown): value is MapCameraState {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    typeof value.y === "number" &&
    Number.isFinite(value.y) &&
    typeof value.scale === "number" &&
    Number.isFinite(value.scale) &&
    value.scale > 0
  );
}

function parseSnapshot(raw: string | null): MapSessionSnapshot | null {
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || !isFiniteCamera(value.camera)) return null;
    if (!isFinitePoint(value.explorerPoint)) return null;
    if (
      value.selectedSlug !== null &&
      (typeof value.selectedSlug !== "string" ||
        !enabledSlugs.has(value.selectedSlug))
    ) {
      return null;
    }

    return {
      camera: {
        x: value.camera.x,
        y: value.camera.y,
        scale: value.camera.scale,
      },
      explorerPoint: {
        x: value.explorerPoint.x,
        y: value.explorerPoint.y,
      },
      selectedSlug: value.selectedSlug,
    };
  } catch {
    return null;
  }
}

export function useMapSession({
  camera,
  explorerPoint,
  selectedSlug,
}: MapSessionSnapshot, {
  restoreStored = true,
}: { restoreStored?: boolean } = {}): { restored: MapSessionSnapshot | null } {
  const [restored, setRestored] = useState<MapSessionSnapshot | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const skipFirstWrite = useRef(false);

  useEffect(() => {
    const snapshot = restoreStored
      ? parseSnapshot(sessionStorage.getItem(MAP_SESSION_KEY))
      : null;
    skipFirstWrite.current = snapshot !== null;
    setRestored(snapshot);
    setStorageReady(true);
  }, [restoreStored]);

  useEffect(() => {
    if (!storageReady) return;
    if (skipFirstWrite.current) {
      skipFirstWrite.current = false;
      return;
    }

    sessionStorage.setItem(
      MAP_SESSION_KEY,
      JSON.stringify({ camera, explorerPoint, selectedSlug }),
    );
  }, [camera, explorerPoint, selectedSlug, storageReady]);

  return { restored };
}
