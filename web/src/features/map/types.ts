export type Point = { x: number; y: number };

export type CameraTarget = Point & { scale: number };

export type RegionRoute = {
  to: string;
  path: string;
  reverse: boolean;
};

export type RegionTheme = "amber" | "teal" | "magenta" | "indigo" | "cyan";

export type RegionDefinition = {
  slug: string;
  href: `/regions/${string}`;
  label: string;
  description: string;
  svgPath: string;
  anchor: Point;
  camera: CameraTarget;
  routes: readonly RegionRoute[];
  theme: RegionTheme;
  schemaKey:
    | "interview"
    | "resource"
    | "fundamental"
    | "project"
    | "algorithm";
  filterKeys: readonly string[];
  summaryFields: readonly string[];
  enabled: boolean;
};
