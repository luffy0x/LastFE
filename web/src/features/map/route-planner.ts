import type { Point, RegionDefinition } from "./types";

export type MotionLeg = {
  from: string;
  to: string;
  fromPoint: Point;
  toPoint: Point;
  path: string;
  reverse: boolean;
};

export function findRegionRoute(
  regions: readonly RegionDefinition[],
  fromSlug: string,
  toSlug: string,
): readonly string[] {
  if (fromSlug === toSlug) return [fromSlug];

  const enabled = new Map(
    regions.filter(({ enabled }) => enabled).map((region) => [region.slug, region]),
  );
  if (!enabled.has(fromSlug) || !enabled.has(toSlug)) return [];

  const queue: string[][] = [[fromSlug]];
  const visited = new Set([fromSlug]);

  while (queue.length > 0) {
    const route = queue.shift();
    if (!route) break;

    const current = enabled.get(route.at(-1) ?? "");
    for (const edge of current?.routes ?? []) {
      if (!enabled.has(edge.to) || visited.has(edge.to)) continue;

      const nextRoute = [...route, edge.to];
      if (edge.to === toSlug) return nextRoute;

      visited.add(edge.to);
      queue.push(nextRoute);
    }
  }

  return [];
}

export function buildMotionLegs(
  regions: readonly RegionDefinition[],
  route: readonly string[],
): readonly MotionLeg[] {
  const bySlug = new Map(regions.map((region) => [region.slug, region]));

  return route.slice(0, -1).map((from, index) => {
    const to = route[index + 1];
    const fromRegion = bySlug.get(from);
    const toRegion = bySlug.get(to);
    const edge = fromRegion?.routes.find((candidate) => candidate.to === to);

    if (!fromRegion || !toRegion || !edge) {
      throw new Error(`route leg ${from} to ${to} is not configured`);
    }

    return {
      from,
      to,
      fromPoint: fromRegion.anchor,
      toPoint: toRegion.anchor,
      path: edge.path,
      reverse: edge.reverse,
    };
  });
}

export function durationForDistance(distance: number): number {
  return Math.min(1000, Math.max(600, distance * 2));
}
