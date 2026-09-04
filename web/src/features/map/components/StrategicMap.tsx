"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { cameraStateForTarget, MAP_CAMERA_BOUNDS } from "../camera-state";
import { useExplorerNavigation } from "../hooks/use-explorer-navigation";
import { useMapCamera } from "../hooks/use-map-camera";
import { useMapSession } from "../hooks/use-map-session";
import type { RegionDefinition } from "../types";
import {
  createExplorerMotionAdapter,
  ExplorerMarker,
} from "./ExplorerMarker";
import { MapHud } from "./MapHud";
import { RegionLayer } from "./RegionLayer";
import { RegionListFallback } from "./RegionListFallback";

type StrategicMapProps = {
  regions: readonly RegionDefinition[];
  stats: { totalPublished: number; recentPublished: number };
  onSelectRegion: (slug: string) => void;
  prepareDestination?: (region: RegionDefinition) => Promise<void>;
  navigate?: (href: string) => void;
  reducedMotion?: boolean;
  initialRegionSlug?: string;
};

const EXPLORER_MOTION = createExplorerMotionAdapter();

const readyImmediately = async () => undefined;
const ignoreNavigation = () => undefined;
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot() {
  return typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia(reducedMotionQuery).matches
    : false;
}

export function StrategicMap({
  regions,
  stats,
  onSelectRegion,
  prepareDestination = readyImmediately,
  navigate = ignoreNavigation,
  reducedMotion,
  initialRegionSlug,
}: StrategicMapProps) {
  const mapRef = useRef<HTMLElement>(null);
  const enabledRegions = regions.filter(({ enabled }) => enabled);
  const explicitRegion = enabledRegions.find(
    ({ slug }) => slug === initialRegionSlug,
  );
  const initialRegion =
    explicitRegion ??
    enabledRegions.find(({ slug }) => slug === "fundamentals") ??
    enabledRegions[0];
  const initialCamera = explicitRegion
    ? cameraStateForTarget(explicitRegion.camera)
    : { x: 0, y: 0, scale: 1 };
  const camera = useMapCamera({
    bounds: MAP_CAMERA_BOUNDS,
    initial: initialCamera,
  });
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
  const focusCamera = camera.focus;
  const focusRegion = useCallback(
    (region: RegionDefinition) => focusCamera(region.camera),
    [focusCamera],
  );
  const explorer = useExplorerNavigation({
    regions,
    initialRegion: initialRegion?.slug ?? "fundamentals",
    initialSelectedSlug: explicitRegion?.slug ?? null,
    prepare: prepareDestination,
    focus: focusRegion,
    navigate,
    motion: EXPLORER_MOTION,
    reducedMotion: reducedMotion ?? prefersReducedMotion,
  });
  const { restored } = useMapSession(
    {
      camera: camera.state,
      explorerPoint: explorer.currentPoint,
      selectedSlug: explorer.targetSlug,
    },
    { restoreStored: !explicitRegion },
  );
  const restoreCamera = camera.restore;
  const restoreExplorer = explorer.restore;

  useEffect(() => {
    if (!restored || explicitRegion) return;
    restoreCamera(restored.camera);
    restoreExplorer(restored.explorerPoint, restored.selectedSlug);
  }, [explicitRegion, restoreCamera, restoreExplorer, restored]);

  const restoredFocusSlug = restored?.selectedSlug;
  useEffect(() => {
    const focusSlug = explicitRegion?.slug ?? restoredFocusSlug;
    if (!focusSlug) return;
    mapRef.current
      ?.querySelector<SVGGElement>(`[data-region="${focusSlug}"]`)
      ?.focus();
  }, [explicitRegion, restoredFocusSlug]);
  const currentRegion =
    enabledRegions.find(({ slug }) => slug === explorer.targetSlug) ?? initialRegion;

  if (!currentRegion) return null;

  const selectRegion = (slug: string) => {
    onSelectRegion(slug);
    explorer.selectRegion(slug);
  };

  const status =
    explorer.phase === "moving"
      ? `行进中：${currentRegion.label}`
      : explorer.phase === "loading"
        ? `同步情报：${currentRegion.label}`
        : explorer.phase === "failed"
          ? `目标离线：${currentRegion.label}`
          : explorer.targetSlug
            ? `目标锁定：${currentRegion.label}`
            : `待命：${currentRegion.label}`;

  return (
    <section
      ref={mapRef}
      className="strategic-map"
      aria-label="战略地图界面"
    >
      <div className="strategic-map__frame" aria-hidden="true" />
      <svg
        role="application"
        aria-label="战略地图画布"
        viewBox="0 0 1000 600"
        preserveAspectRatio="xMidYMid meet"
        className="strategic-map__canvas"
        {...camera.bind}
      >
        <defs>
          <pattern id="command-grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M50 0H0V50" className="map-grid-line" />
          </pattern>
          <pattern
            id="sector-hatch"
            width="18"
            height="18"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(28)"
          >
            <path d="M0 0V18" className="sector-hatch-line" />
          </pattern>
        </defs>
        <rect width="1000" height="600" className="map-field" />
        <rect width="1000" height="600" fill="url(#command-grid)" />
        <g
          data-testid="camera-layer"
          className="camera-layer"
          transform={camera.transform}
        >
          <g className="territory-network">
            {enabledRegions.map((region) => (
              <RegionLayer
                key={region.slug}
                region={region}
                selected={explorer.targetSlug === region.slug}
                onSelect={selectRegion}
              />
            ))}
          </g>
          <g className="route-network" aria-hidden="true">
            {enabledRegions.flatMap((region) =>
              region.routes
                .filter(({ reverse }) => !reverse)
                .map((route) => (
                  <path key={`${region.slug}-${route.to}`} d={route.path} />
                )),
            )}
          </g>
          <ExplorerMarker
            point={explorer.currentPoint}
            regionLabel={currentRegion.label}
            targetLocked={explorer.targetSlug !== null}
          />
        </g>
      </svg>

      <MapHud
        stats={stats}
        status={status}
        onZoomIn={() =>
          camera.zoomAt(camera.state.scale + 0.2, { x: 500, y: 300 })
        }
        onZoomOut={() =>
          camera.zoomAt(camera.state.scale - 0.2, { x: 500, y: 300 })
        }
        onReset={camera.reset}
        failed={explorer.phase === "failed"}
        onRetry={explorer.retry}
      />
      <RegionListFallback regions={regions} />
    </section>
  );
}
