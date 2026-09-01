import { describe, expect, it } from "vitest";
import { REGION_ANCHORS, REGIONS } from "./regions";
import {
  buildMotionLegs,
  durationForDistance,
  findRegionRoute,
} from "./route-planner";

describe("route planner", () => {
  it("uses the shortest connected route", () => {
    expect(findRegionRoute(REGIONS, "interview", "algorithms")).toEqual([
      "interview",
      "fundamentals",
      "algorithms",
    ]);
  });

  it("preserves reverse traversal metadata", () => {
    const route = findRegionRoute(REGIONS, "fundamentals", "interview");

    expect(buildMotionLegs(REGIONS, route)).toEqual([
      {
        from: "fundamentals",
        to: "interview",
        fromPoint: REGION_ANCHORS.fundamentals,
        toPoint: REGION_ANCHORS.interview,
        path: "M228 166 Q360 220 500 300",
        reverse: true,
      },
    ]);
  });

  it("clamps travel time between 600 and 1000 milliseconds", () => {
    expect(durationForDistance(10)).toBe(600);
    expect(durationForDistance(400)).toBe(800);
    expect(durationForDistance(900)).toBe(1000);
  });
});
