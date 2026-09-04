import type { CameraTarget } from "./types";

export type CameraState = {
  x: number;
  y: number;
  scale: number;
};

export type CameraLimits = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minScale: number;
  maxScale: number;
};

export const MAP_CAMERA_BOUNDS: CameraLimits = {
  minX: -420,
  maxX: 420,
  minY: -240,
  maxY: 240,
  minScale: 0.8,
  maxScale: 2.4,
};

const cleanCoordinate = (value: number) => Math.round(value * 1000) / 1000;

export function cameraStateForTarget(
  target: CameraTarget,
  bounds: CameraLimits = MAP_CAMERA_BOUNDS,
): CameraState {
  return {
    x: cleanCoordinate(
      Math.min(bounds.maxX, Math.max(bounds.minX, 500 - target.x * target.scale)),
    ),
    y: cleanCoordinate(
      Math.min(bounds.maxY, Math.max(bounds.minY, 300 - target.y * target.scale)),
    ),
    scale: Math.min(bounds.maxScale, Math.max(bounds.minScale, target.scale)),
  };
}

export function cameraTransform(state: CameraState): string {
  return `translate(${state.x} ${state.y}) scale(${state.scale})`;
}
