import { describe, expect, it } from "vitest";
import { REGIONS } from "./regions";
import type { RegionDefinition } from "./types";
import { assertValidRegions } from "./validate-regions";

function replaceRegion(
  slug: string,
  update: (region: RegionDefinition) => RegionDefinition,
) {
  return REGIONS.map((region) =>
    region.slug === slug ? update(region) : region,
  );
}

describe("assertValidRegions", () => {
  it("accepts the five connected initial territories", () => {
    expect(() => assertValidRegions(REGIONS)).not.toThrow();
  });

  it("provides exactly one opposite route for every edge", () => {
    for (const region of REGIONS) {
      for (const route of region.routes) {
        const target = REGIONS.find(({ slug }) => slug === route.to);
        const reverseEdges = target?.routes.filter(
          (candidate) =>
            candidate.to === region.slug &&
            candidate.path === route.path &&
            candidate.reverse !== route.reverse,
        );

        expect(reverseEdges).toHaveLength(1);
      }
    }
  });

  it("rejects duplicate slugs", () => {
    expect(() => assertValidRegions([REGIONS[0], REGIONS[0]])).toThrow(
      /duplicate slug/i,
    );
  });

  it("rejects an enabled territory with no route to the graph", () => {
    const isolated = {
      ...REGIONS[0],
      slug: "isolated",
      href: "/regions/isolated",
      schemaKey: "isolated",
      routes: [],
    } as unknown as RegionDefinition;

    expect(() => assertValidRegions([...REGIONS, isolated])).toThrow(
      /connected/i,
    );
  });

  it("rejects a route to an unknown territory", () => {
    const invalid = replaceRegion("interview", (region) => ({
      ...region,
      routes: [...region.routes, { to: "unknown", path: "M0 0L1 1", reverse: false }],
    }));

    expect(() => assertValidRegions(invalid)).toThrow(/route target/i);
  });

  it("rejects a missing reverse route", () => {
    const invalid = replaceRegion("fundamentals", (region) => ({
      ...region,
      routes: region.routes.filter(({ to }) => to !== "interview"),
    }));

    expect(() => assertValidRegions(invalid)).toThrow(/reverse route/i);
  });

  it.each([
    ["territory path", { svgPath: "" }, /territory path/i],
    ["route path", { routes: [{ to: "fundamentals", path: "", reverse: false }] }, /route path/i],
    ["anchor", { anchor: { x: Number.NaN, y: 20 } }, /finite anchor/i],
    ["camera", { camera: { x: 20, y: Number.POSITIVE_INFINITY, scale: 1 } }, /finite camera/i],
    ["camera scale", { camera: { x: 20, y: 20, scale: 0 } }, /camera scale/i],
    ["href", { href: "/regions/projects" }, /href/i],
    ["filter keys", { filterKeys: ["tags", "tags"] }, /filter keys/i],
    ["summary fields", { summaryFields: ["author", "author"] }, /summary fields/i],
  ] as const)("rejects an invalid %s", (_label, replacement, message) => {
    const invalid = replaceRegion("interview", (region) => ({
      ...region,
      ...replacement,
    })) as readonly RegionDefinition[];

    expect(() => assertValidRegions(invalid)).toThrow(message);
  });

  it("rejects duplicate schema keys", () => {
    const invalid = replaceRegion("resources", (region) => ({
      ...region,
      schemaKey: "interview",
    }));

    expect(() => assertValidRegions(invalid)).toThrow(/duplicate schema key/i);
  });
});
