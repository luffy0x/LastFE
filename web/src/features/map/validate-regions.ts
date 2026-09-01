import type { Point, RegionDefinition } from "./types";
import { REGIONS } from "./regions";

function assertFinitePoint(point: Point, label: string) {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new Error(`${label} must contain finite coordinates`);
  }
}

function assertUnique(values: readonly string[], label: string) {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} contain duplicate values`);
  }
}

export function assertValidRegions(regions: readonly RegionDefinition[]): void {
  const slugs = regions.map(({ slug }) => slug);
  const schemaKeys = regions.map(({ schemaKey }) => schemaKey);

  assertUnique(slugs, "duplicate slug list");
  assertUnique(schemaKeys, "duplicate schema key list");

  const bySlug = new Map(regions.map((region) => [region.slug, region]));

  for (const region of regions) {
    if (!region.svgPath.trim()) {
      throw new Error(`${region.slug} territory path must not be empty`);
    }

    assertFinitePoint(region.anchor, `${region.slug} finite anchor`);
    assertFinitePoint(region.camera, `${region.slug} finite camera`);

    if (!Number.isFinite(region.camera.scale) || region.camera.scale <= 0) {
      throw new Error(`${region.slug} camera scale must be positive`);
    }

    if (region.enabled && region.href !== `/regions/${region.slug}`) {
      throw new Error(`${region.slug} href must match its slug`);
    }

    assertUnique(region.filterKeys, `${region.slug} filter keys`);
    assertUnique(region.summaryFields, `${region.slug} summary fields`);

    for (const route of region.routes) {
      if (!route.path.trim()) {
        throw new Error(`${region.slug} route path must not be empty`);
      }

      const target = bySlug.get(route.to);
      if (!target) {
        throw new Error(`${region.slug} route target ${route.to} does not exist`);
      }

      const reverseRoutes = target.routes.filter(
        (candidate) =>
          candidate.to === region.slug &&
          candidate.path === route.path &&
          candidate.reverse !== route.reverse,
      );

      if (reverseRoutes.length !== 1) {
        throw new Error(
          `${region.slug} to ${route.to} must have exactly one reverse route`,
        );
      }
    }
  }

  const enabled = regions.filter(({ enabled }) => enabled);
  if (enabled.length <= 1) return;

  const enabledSlugs = new Set(enabled.map(({ slug }) => slug));
  const visited = new Set<string>();
  const queue = [enabled[0].slug];

  while (queue.length > 0) {
    const slug = queue.shift();
    if (!slug || visited.has(slug)) continue;

    visited.add(slug);
    const region = bySlug.get(slug);
    for (const route of region?.routes ?? []) {
      if (enabledSlugs.has(route.to) && !visited.has(route.to)) {
        queue.push(route.to);
      }
    }
  }

  if (visited.size !== enabled.length) {
    throw new Error("enabled territories must form one connected graph");
  }
}

assertValidRegions(REGIONS);
