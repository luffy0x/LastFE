import type { request as requestFunction } from "@/utils/request";
import type { RegionDefinition } from "./types";

export type RegionAvailability = { ok: true; slug: string };

type PrepareRegionDependencies = {
  prefetch(href: string): void;
  request: typeof requestFunction;
};

export async function prepareRegion(
  region: RegionDefinition,
  dependencies: PrepareRegionDependencies,
): Promise<void> {
  dependencies.prefetch(region.href);
  const availability = await dependencies.request<RegionAvailability>(
    `/api/regions/${region.slug}/availability`,
  );

  if (!availability.ok || availability.slug !== region.slug) {
    throw new Error(`territory ${region.slug} is not ready`);
  }
}
