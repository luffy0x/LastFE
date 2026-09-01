# Career Map Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-shaped Next.js frontend whose home page is a full-screen sci-fi strategy map with five configurable territories, keyboard/touch navigation, a moving explorer, and fixture-backed territory content panels.

**Architecture:** A typed region registry is the source of truth for SVG geometry, routes, camera targets, visual tokens, and field-schema keys. A focused SVG map engine owns pan/zoom and explorer motion, while server-rendered territory routes consume a repository interface that initially points to fixtures and is replaced by SQLite in Plan 2.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Zod, Web Animations API, Vitest, Testing Library, Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-01-interview-resource-sharing-design.md`

## Global Constraints

- The home page is a full-screen sci-fi strategy map, not a traditional hero or card grid.
- Initial territories are `interview`, `resources`, `fundamentals`, `projects`, and `algorithms`.
- Rendering uses SVG, CSS, and Web Animations API; do not add Canvas, WebGL, or Three.js.
- Territory navigation must work with pointer, touch, keyboard, and an equivalent territory list.
- Normal explorer travel lasts 600–1000 ms; reduced-motion mode navigates immediately.
- All browser-side API requests go through `@/utils/request`.
- Use Tailwind and theme tokens; do not add ad-hoc CSS module files or inline React styles.
- Do not use Emoji as interface icons.
- Do not create a git commit unless the user explicitly authorizes commits.

## File Structure

```text
.gitignore                                      Generated and local-only exclusions
web/package.json                                Frontend scripts and dependencies
web/vitest.config.ts                            Unit/component test configuration
web/playwright.config.ts                        Browser test configuration
web/src/test/setup.ts                           Testing Library matchers
web/src/app/layout.tsx                          Root metadata and application shell
web/src/app/page.tsx                            Full-screen strategic map route
web/src/app/globals.css                         Tailwind imports and design tokens
web/src/app/regions/[slug]/page.tsx             Territory route
web/src/app/content/[id]/page.tsx               Fixture-backed dossier route
web/src/features/map/types.ts                   Region, point, edge, and camera contracts
web/src/features/map/regions.ts                 Five initial territory definitions
web/src/features/map/validate-regions.ts        Build-time configuration validation
web/src/features/map/route-planner.ts           Pure shortest-path and motion helpers
web/src/features/map/prepare-region.ts          Prefetch and availability check
web/src/features/map/hooks/use-map-camera.ts    Pan, zoom, pinch, and reset state
web/src/features/map/hooks/use-explorer-navigation.ts  Prefetch, motion, cancellation, navigation
web/src/features/map/hooks/use-map-session.ts   Validated session restoration
web/src/features/map/components/StrategicMap.tsx       Map composition
web/src/features/map/components/RegionLayer.tsx        Accessible territory SVG layer
web/src/features/map/components/ExplorerMarker.tsx     Character marker
web/src/features/map/components/MapHud.tsx             Brand, search, stats, controls
web/src/features/map/components/RegionListFallback.tsx Equivalent list navigation
web/src/features/content/types.ts                Stable repository-facing content types
web/src/features/content/repository.ts           ContentRepository interface and provider
web/src/features/content/fixture-repository.ts   Plan 1 fixture adapter
web/src/features/content/components/TerritoryPanel.tsx Map-backed content panel
web/src/features/content/components/Dossier.tsx        Readable content detail
web/src/app/api/regions/[slug]/availability/route.ts  Destination readiness endpoint
web/src/utils/request.ts                         Only browser request helper
web/scripts/check-map-assets.mjs                 Static map asset budget
web/e2e/map-navigation.spec.ts                   End-to-end map behavior
```

---

### Task 1: Scaffold the Next.js App and Test Harness

**Files:**
- Create: `.gitignore`
- Create: `web/package.json`
- Create: `web/vitest.config.ts`
- Create: `web/playwright.config.ts`
- Create: `web/src/test/setup.ts`
- Modify: `web/src/app/layout.tsx`
- Modify: `web/src/app/page.tsx`
- Modify: `web/src/app/globals.css`
- Test: `web/src/app/page.test.tsx`

**Interfaces:**
- Produces: `web` package with `dev`, `build`, `lint`, `typecheck`, `test`, and `test:e2e` scripts.
- Produces: root `<main aria-label="求职战略地图">` mount point for the map.

- [ ] **Step 1: Scaffold the application without overwriting root documentation**

Run:

```powershell
pnpm dlx create-next-app@latest web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
cd web
pnpm add zod
pnpm add -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
```

Add these root exclusions:

```gitignore
.superpowers/
web/.next/
web/node_modules/
web/playwright-report/
web/test-results/
*.db
*.db-shm
*.db-wal
.env*
!.env.example
```

- [ ] **Step 2: Write the failing shell test**

```tsx
// web/src/app/page.test.tsx
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

it("renders the strategic map landmark", () => {
  render(<HomePage />);
  expect(screen.getByRole("main", { name: "求职战略地图" })).toBeInTheDocument();
});
```

- [ ] **Step 3: Run the test and confirm the expected failure**

Run: `cd web; pnpm vitest run src/app/page.test.tsx`

Expected: FAIL because the generated page does not expose the required landmark.

- [ ] **Step 4: Add the minimal application shell and test configuration**

```tsx
// web/src/app/page.tsx
export default function HomePage() {
  return <main aria-label="求职战略地图" className="min-h-dvh bg-background text-foreground" />;
}
```

Configure Vitest with `environment: "jsdom"`, the `@/` alias, and `src/test/setup.ts` importing `@testing-library/jest-dom/vitest`. Add the six scripts named in the Interfaces block to `package.json`.

Use these exact scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:e2e": "playwright test"
  }
}
```

```ts
// web/vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "jsdom", setupFiles: ["./src/test/setup.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

- [ ] **Step 5: Verify the foundation**

Run: `cd web; pnpm lint; pnpm typecheck; pnpm test --run; pnpm build`

Expected: all commands exit 0.

- [ ] **Step 6: Commit only if the user explicitly authorizes commits**

```powershell
git add .gitignore web
git commit -m "build(web): scaffold career map application"
```

### Task 2: Define and Validate the Territory Registry

**Files:**
- Create: `web/src/features/map/types.ts`
- Create: `web/src/features/map/regions.ts`
- Create: `web/src/features/map/validate-regions.ts`
- Test: `web/src/features/map/validate-regions.test.ts`

**Interfaces:**
- Produces: `Point`, `CameraTarget`, `RegionRoute`, `RegionTheme`, and `RegionDefinition`.
- Produces: `REGIONS: readonly RegionDefinition[]`.
- Produces: `assertValidRegions(regions: readonly RegionDefinition[]): void`.
- Consumed by: map rendering, route planning, region pages, and Plan 2 submission schemas.

- [ ] **Step 1: Write failing registry validation tests**

```ts
import { describe, expect, it } from "vitest";
import { assertValidRegions } from "./validate-regions";
import { REGIONS } from "./regions";

describe("assertValidRegions", () => {
  it("accepts the five connected initial territories", () => {
    expect(() => assertValidRegions(REGIONS)).not.toThrow();
  });

  it("rejects duplicate slugs", () => {
    expect(() => assertValidRegions([REGIONS[0], REGIONS[0]])).toThrow(/duplicate slug/i);
  });

  it("rejects an enabled territory with no route to the graph", () => {
    const isolated = { ...REGIONS[0], slug: "isolated", routes: [] };
    expect(() => assertValidRegions([...REGIONS, isolated])).toThrow(/connected/i);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd web; pnpm vitest run src/features/map/validate-regions.test.ts`

Expected: FAIL because the registry modules do not exist.

- [ ] **Step 3: Define the contracts**

```ts
// web/src/features/map/types.ts
export type Point = { x: number; y: number };
export type CameraTarget = Point & { scale: number };
export type RegionRoute = { to: string; path: string; reverse: boolean };
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
  schemaKey: "interview" | "resource" | "fundamental" | "project" | "algorithm";
  filterKeys: readonly string[];
  summaryFields: readonly string[];
  enabled: boolean;
};
```

- [ ] **Step 4: Add the five exact registry entries and validation**

Use these stable slugs, anchors, and SVG paths:

```ts
export const REGION_ANCHORS = {
  interview: { x: 228, y: 166 },
  resources: { x: 683, y: 153 },
  fundamentals: { x: 500, y: 300 },
  projects: { x: 232, y: 385 },
  algorithms: { x: 759, y: 372 },
} as const;

export const REGION_PATHS = {
  interview: "M61 73H383L414 194L329 278L49 245L35 152Z",
  resources: "M383 73H943L957 198L650 250L414 194Z",
  fundamentals: "M329 278L414 194L650 250L610 420L379 418Z",
  projects: "M49 245L329 278L379 418L300 552L42 470Z",
  algorithms: "M650 250L957 198L970 510L610 420Z",
} as const;
```

Add both directed entries for each route below. The first direction stores `reverse: false`; the opposite direction stores the same `path` with `reverse: true`, so motion samples the SVG path from length to zero.

| Forward route | SVG path |
| --- | --- |
| `interview` → `fundamentals` | `M228 166 Q360 220 500 300` |
| `resources` → `fundamentals` | `M683 153 Q600 220 500 300` |
| `projects` → `fundamentals` | `M232 385 Q360 365 500 300` |
| `algorithms` → `fundamentals` | `M759 372 Q630 350 500 300` |
| `interview` → `projects` | `M228 166 Q190 280 232 385` |
| `resources` → `algorithms` | `M683 153 Q790 245 759 372` |

Extend the test to assert that every edge has exactly one reverse edge with the same `path` and the opposite `reverse` flag. `assertValidRegions` must check unique slugs, non-empty territory and route paths, finite anchors/cameras, positive camera scale, valid route targets, bidirectional edge symmetry, and graph connectivity across all enabled territories.

Use `href: "/regions/<slug>"` for each entry. Set `filterKeys` to `companyDepartment, position, tags` for interview; `tags` for resources; `category, tags` for fundamentals; `techStack, tags` for projects; and `source, difficulty, tags` for algorithms. Set `summaryFields` to the same identifying metadata used by the corresponding content row. Validation rejects an enabled region when `href` does not exactly match its slug, `schemaKey` is duplicated, or either field list contains duplicates.

- [ ] **Step 5: Run focused and full tests**

Run: `cd web; pnpm vitest run src/features/map/validate-regions.test.ts; pnpm test --run`

Expected: PASS.

- [ ] **Step 6: Commit only if explicitly authorized**

```powershell
git add web/src/features/map
git commit -m "feat(map): add validated territory registry"
```

### Task 3: Render the Accessible Strategic Map

**Files:**
- Create: `web/src/features/map/components/StrategicMap.tsx`
- Create: `web/src/features/map/components/RegionLayer.tsx`
- Create: `web/src/features/map/components/ExplorerMarker.tsx`
- Create: `web/src/features/map/components/MapHud.tsx`
- Create: `web/src/features/map/components/RegionListFallback.tsx`
- Modify: `web/src/app/page.tsx`
- Modify: `web/src/app/globals.css`
- Test: `web/src/features/map/components/StrategicMap.test.tsx`

**Interfaces:**
- Consumes: `REGIONS` and `RegionDefinition`.
- Produces: `StrategicMap({ regions, stats, onSelectRegion })`, where `stats` is `{ totalPublished: number; recentPublished: number }`.
- Produces: every enabled region as a keyboard-operable SVG button and an equivalent list item.

- [ ] **Step 1: Write failing accessibility tests**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { REGIONS } from "../regions";
import { StrategicMap } from "./StrategicMap";

const user = userEvent.setup();
const onSelect = vi.fn();
render(<StrategicMap regions={REGIONS} stats={{ totalPublished: 0, recentPublished: 0 }} onSelectRegion={onSelect} />);
expect(screen.getByRole("button", { name: "进入面经区" })).toHaveAttribute("tabindex", "0");
screen.getByRole("button", { name: "进入面经区" }).focus();
await user.keyboard("{Enter}");
expect(onSelect).toHaveBeenCalledWith("interview");
expect(screen.getByRole("navigation", { name: "领地列表" })).toBeVisible();
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd web; pnpm vitest run src/features/map/components/StrategicMap.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement semantic SVG regions and the fixed HUD**

`RegionLayer` must render each territory as:

```tsx
<g
  role="button"
  tabIndex={0}
  aria-label={`进入${region.label}`}
  data-region={region.slug}
  onClick={() => onSelect(region.slug)}
  onKeyDown={(event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(region.slug);
    }
  }}
>
  <path d={region.svgPath} className="region-fill" />
  <text x={region.anchor.x} y={region.anchor.y}>{region.label}</text>
</g>
```

Give the interactive SVG surface `role="application"` and `aria-label="战略地图画布"`. Render the product mark, global-search trigger, total-published count, seven-day recently-published count, zoom controls, reset control, map instructions, current territory status, and visible territory-list control. The search trigger may open a disabled “内容索引将在数据层接入后启用” status in Plan 1; Plan 2 replaces it with real search. `RegionListFallback` is server-rendered as ordinary links inside a native `<details>` element outside the client-only map controller, so it remains operable when hydration or animation code fails. Use local SVG icons with accessible labels.

`ExplorerMarker` is a compact 18×24 SVG humanoid operator silhouette with a helmet, torso, and two-leg stance, rendered in cyan rim light with a warm-gold destination pulse. It must read as a person at all four target widths without using an Emoji, mascot face, cartoon proportions, or a raster asset.

- [ ] **Step 4: Add the sci-fi visual tokens**

Define Tailwind-backed CSS variables for near-black/navy background, cyan border/glow, muted territory colors, warm-gold target state, visible focus rings, 16px body text, and 1.5+ line height. Keep scanning/grid effects low contrast and disable nonessential effects under reduced motion.

- [ ] **Step 5: Verify semantics and production build**

Run: `cd web; pnpm vitest run src/features/map/components/StrategicMap.test.tsx; pnpm lint; pnpm typecheck; pnpm build`

Expected: PASS and no inaccessible unlabeled control warnings.

- [ ] **Step 6: Commit only if explicitly authorized**

```powershell
git add web/src/app web/src/features/map/components
git commit -m "feat(map): render accessible strategic map"
```

### Task 4: Add Pan, Zoom, Pinch, and Reset

**Files:**
- Create: `web/src/features/map/hooks/use-map-camera.ts`
- Test: `web/src/features/map/hooks/use-map-camera.test.tsx`
- Modify: `web/src/features/map/components/StrategicMap.tsx`

**Interfaces:**
- Produces: `MapCameraState = { x: number; y: number; scale: number }`.
- Produces: `CameraBounds = { minX: number; maxX: number; minY: number; maxY: number; minScale: number; maxScale: number }`.
- Produces: `clampCamera(state: MapCameraState, bounds: CameraBounds): MapCameraState`.
- Produces: `useMapCamera({ bounds, initial }: { bounds: CameraBounds; initial: MapCameraState }): MapCameraApi` with `panBy`, `zoomAt`, `focus`, `reset`, and pointer handlers.

- [ ] **Step 1: Write failing camera math tests**

```ts
it("clamps scale and translation", () => {
  const bounds = { minX: -420, maxX: 420, minY: -240, maxY: 240, minScale: 0.8, maxScale: 2.4 };
  expect(clampCamera({ x: 9000, y: -9000, scale: 9 }, bounds)).toEqual({
    x: bounds.maxX,
    y: bounds.minY,
    scale: 2.4,
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `cd web; pnpm vitest run src/features/map/hooks/use-map-camera.test.tsx`

Expected: FAIL because `clampCamera` is undefined.

- [ ] **Step 3: Implement camera state with Pointer Events**

Use one hook to track active pointers, derive one-pointer pan and two-pointer pinch distance, clamp transforms, and expose a transform string:

```ts
export type MapCameraApi = {
  state: MapCameraState;
  transform: string;
  panBy(delta: Point): void;
  zoomAt(nextScale: number, origin: Point): void;
  focus(target: CameraTarget): void;
  reset(): void;
  bind: {
    onPointerDown(event: React.PointerEvent): void;
    onPointerMove(event: React.PointerEvent): void;
    onPointerUp(event: React.PointerEvent): void;
    onPointerCancel(event: React.PointerEvent): void;
    onWheel(event: React.WheelEvent): void;
  };
};
```

The map passes `bounds: { minX: -420, maxX: 420, minY: -240, maxY: 240, minScale: 0.8, maxScale: 2.4 }` and the global camera as `initial`. Call `setPointerCapture()` on pointer down, retain both active touch pointers for pinch calculations, and release/cancel them on pointer up or pointer cancel. Do not prevent browser zoom globally. Prevent default only while the user is actively manipulating the map surface.

- [ ] **Step 4: Wire the controls and test reset behavior**

Add this reset assertion after dispatching a pointer pan and wheel zoom; separately assert the rendered control classes include `min-h-11 min-w-11` (44 CSS pixels under the default 4px Tailwind spacing):

```tsx
const surface = screen.getByRole("application", { name: "战略地图画布" });
fireEvent.pointerDown(surface, { pointerId: 1, clientX: 100, clientY: 100 });
fireEvent.pointerMove(surface, { pointerId: 1, clientX: 140, clientY: 120 });
fireEvent.pointerUp(surface, { pointerId: 1, clientX: 140, clientY: 120 });
fireEvent.wheel(surface, { deltaY: -120, clientX: 200, clientY: 200 });
await user.click(screen.getByRole("button", { name: "复位地图" }));
expect(screen.getByTestId("camera-layer")).toHaveAttribute("transform", "translate(0 0) scale(1)");
expect(screen.getByRole("button", { name: "复位地图" })).toHaveClass("min-h-11", "min-w-11");
```

- [ ] **Step 5: Run focused and full tests**

Run: `cd web; pnpm vitest run src/features/map/hooks/use-map-camera.test.tsx; pnpm test --run`

Expected: PASS.

- [ ] **Step 6: Commit only if explicitly authorized**

```powershell
git add web/src/features/map
git commit -m "feat(map): add bounded pan and zoom controls"
```

### Task 5: Implement Explorer Route Planning and Cancellable Motion

**Files:**
- Create: `web/src/features/map/route-planner.ts`
- Create: `web/src/features/map/prepare-region.ts`
- Create: `web/src/features/map/hooks/use-explorer-navigation.ts`
- Create: `web/src/app/api/regions/[slug]/availability/route.ts`
- Create: `web/src/utils/request.ts`
- Test: `web/src/features/map/route-planner.test.ts`
- Test: `web/src/features/map/hooks/use-explorer-navigation.test.tsx`
- Modify: `web/src/features/map/components/ExplorerMarker.tsx`
- Modify: `web/src/features/map/components/StrategicMap.tsx`

**Interfaces:**
- Produces: `findRegionRoute(regions: readonly RegionDefinition[], fromSlug: string, toSlug: string): readonly string[]`.
- Produces: `buildMotionLegs(regions: readonly RegionDefinition[], route: readonly string[]): readonly MotionLeg[]`, where `MotionLeg = { from: string; to: string; fromPoint: Point; toPoint: Point; path: string; reverse: boolean }`.
- Produces: `durationForDistance(distance: number): number`, clamped to 600–1000 ms.
- Produces: `request<T>(input: string, init?: RequestInit & { timeoutMs?: number }): Promise<T>` and `RegionAvailability = { ok: true; slug: string }`.
- Produces: `prepareRegion(region: RegionDefinition, dependencies: { prefetch(href: string): void; request: typeof request }): Promise<void>`.
- Produces: `useExplorerNavigation(options: ExplorerNavigationOptions): ExplorerNavigationState`.
- `ExplorerNavigationOptions` is `{ regions: readonly RegionDefinition[]; initialRegion: string; prepare(region: RegionDefinition): Promise<void>; focus(region: RegionDefinition): void; navigate(href: string): void; motion: ExplorerMotionAdapter; reducedMotion: boolean }`.
- `ExplorerNavigationState` is `{ currentPoint: Point; targetSlug: string | null; phase: "idle" | "moving" | "loading" | "failed"; selectRegion(slug: string): void; retry(): void; cancel(): void }`.
- `ExplorerMotionAdapter.start(legs: readonly MotionLeg[], from: Point, durationMs: number)` returns `{ finished: Promise<Point>; cancel(): Point }`; `cancel()` returns the last rendered point.

- [ ] **Step 1: Write failing route and cancellation tests**

```ts
import { act, renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { REGION_ANCHORS, REGIONS } from "../regions";
import type { Point } from "../types";
import { buildMotionLegs, findRegionRoute } from "../route-planner";
import { useExplorerNavigation, type ExplorerMotionAdapter } from "./use-explorer-navigation";

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

it("navigates only to the latest selected territory", async () => {
  vi.useFakeTimers();
  const navigate = vi.fn();
  const motion: ExplorerMotionAdapter = {
    start: vi.fn((legs, from, durationMs) => {
      let point = from;
      let resolveFinished!: (point: Point) => void;
      const finished = new Promise<Point>((resolve) => { resolveFinished = resolve; });
      const timer = setTimeout(() => {
        point = legs.at(-1)?.toPoint ?? from;
        resolveFinished(point);
      }, durationMs);
      return {
        finished,
        cancel: () => { clearTimeout(timer); return point; },
      };
    }),
  };
  const options = {
    regions: REGIONS,
    initialRegion: "fundamentals",
    prepare: vi.fn().mockResolvedValue(undefined),
    focus: vi.fn(),
    navigate,
    motion,
    reducedMotion: false,
  };
  const { result } = renderHook(() => useExplorerNavigation(options));
  act(() => result.current.selectRegion("resources"));
  act(() => result.current.selectRegion("projects"));
  await act(() => vi.runAllTimersAsync());
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(navigate).toHaveBeenCalledWith("/regions/projects");
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `cd web; pnpm vitest run src/features/map/route-planner.test.ts src/features/map/hooks/use-explorer-navigation.test.tsx`

Expected: FAIL because the planner and hook do not exist.

- [ ] **Step 3: Implement BFS planning and SVG path motion**

Use breadth-first search over enabled territory edges. `buildMotionLegs` resolves each adjacent slug pair to its declared `RegionRoute`, retaining `reverse`. The browser adapter converts each route path into points with `SVGPathElement.getTotalLength()` and `getPointAtLength()`; sample from total length toward zero when `reverse` is true, prepend the preserved cancellation point as the first keyframe, and remove adjacent duplicate points. `durationForDistance` returns `Math.min(1000, Math.max(600, distance * 2))`. Use Web Animations API behind the injected adapter so tests use the deterministic `motion` fake defined in Step 1 with fake timers.

Selection calls `focus(region)` so the camera eases toward the configured target while the explorer moves. Cancellation must call the active adapter's `cancel()`, clear the pending navigation token, store the returned rendered point, and create a new path from that point to the latest target. `prepareRegion` calls Next.js `router.prefetch(region.href)` and then uses `@/utils/request` to verify `/api/regions/${region.slug}/availability`; navigation occurs only when preparation and the current motion promise both resolve and their selection token is still current.

The availability route returns `{ ok: true, slug } satisfies RegionAvailability` only for an enabled `REGIONS` entry and returns `{ ok: false, code: "REGION_NOT_FOUND" }` with 404 otherwise. Implement `request<T>` once with JSON parsing, a default 8-second timeout, caller-signal forwarding, non-2xx `RequestError` normalization, and no token storage. Task 4 of Plan 2 modifies this same helper; it must not create a second request client.

- [ ] **Step 4: Add reduced-motion and prefetch-failure behavior**

When reduced motion is true, set the character to the destination anchor without delay, but still wait for `prepare` before navigating. When preparation rejects, let any active motion finish, set `phase: "failed"`, keep the character at the destination, and expose `retry()` without routing to an error page. A retry reuses the current destination and only navigates after a fresh successful preparation.

- [ ] **Step 5: Run all map tests**

Run: `cd web; pnpm vitest run src/features/map`

Expected: PASS, including rapid target replacement.

- [ ] **Step 6: Commit only if explicitly authorized**

```powershell
git add web/src/features/map web/src/app/api/regions web/src/utils/request.ts
git commit -m "feat(map): animate explorer territory travel"
```

### Task 6: Add Fixture-Backed Territory and Dossier Routes

**Files:**
- Create: `web/src/features/content/types.ts`
- Create: `web/src/features/content/repository.ts`
- Create: `web/src/features/content/fixture-repository.ts`
- Create: `web/src/features/content/components/TerritoryPanel.tsx`
- Create: `web/src/features/content/components/Dossier.tsx`
- Create: `web/src/app/regions/[slug]/page.tsx`
- Create: `web/src/app/content/[id]/page.tsx`
- Test: `web/src/features/content/components/TerritoryPanel.test.tsx`
- Test: `web/src/features/content/fixture-repository.test.ts`

**Interfaces:**
- Produces: `ContentRecord`, `ContentSummary`, `ContentQuery`, `PublishedStats`, and `Page<T>`.
- Produces: `ContentRepository.list(query): Promise<Page<ContentSummary>>`, `ContentRepository.get(id): Promise<ContentRecord | null>`, and `ContentRepository.stats(now?: Date): Promise<PublishedStats>`.
- Produces: `getContentRepository(): ContentRepository`, initially returning the fixture adapter.

- [ ] **Step 1: Write failing repository and page tests**

```tsx
it("shows only content from the requested territory", async () => {
  const page = await fixtureContentRepository.list({ regionSlug: "interview", page: 1, pageSize: 20 });
  render(<TerritoryPanel region={REGIONS[0]} page={page} />);
  expect(screen.getByText("字节跳动/基础架构 · 后端开发")).toBeVisible();
  expect(screen.queryByText("动态规划训练路线")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd web; pnpm vitest run src/features/content/fixture-repository.test.ts`

Expected: FAIL because the route and repository do not exist.

- [ ] **Step 3: Define stable content contracts**

```ts
export type ContentStatus = "published" | "withdrawn";
export type ContentSummary = {
  id: string;
  regionSlug: string;
  title: string;
  summary: string | null;
  nickname: string | null;
  tags: readonly string[];
  publishedAt: string;
  metadata: Readonly<Record<string, string>>;
};
export type ContentRecord = ContentSummary & {
  markdown: string | null;
  externalUrl: string | null;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
};
export type ContentQuery = {
  regionSlug?: string;
  search?: string;
  tags?: readonly string[];
  page: number;
  pageSize: 20;
};
export type Page<T> = { items: readonly T[]; page: number; total: number; pageSize: number };
export type PublishedStats = { totalPublished: number; recentPublished: number };
```

- [ ] **Step 4: Implement the fixture adapter and map-backed panel**

Seed exactly two published records per initial territory: “字节跳动/基础架构 · 后端开发” and “腾讯/云架构 · 后端开发” for interview; “React TypeScript 学习路线” and “操作系统公开课” for resources; “Redis 持久化” and “HTTP 缓存机制” for fundamentals; “实时协作编辑器” and “校园二手交易平台” for projects; and “动态规划训练路线” and “二分答案题解” for algorithms. Give each pair distinct tags and metadata values that exercise its configured filters. `stats()` counts all published fixtures and records published in the last seven days. The home route passes those values to `MapHud`. The territory route validates `slug` against `REGIONS`, obtains one page from the repository, and renders the approved right-side intelligence panel over a dimmed map background. The dossier route returns `notFound()` for unknown or withdrawn fixture records and includes a link back to its owning territory.

- [ ] **Step 5: Verify territory and dossier routes**

Run: `cd web; pnpm vitest run src/features/content 'src/app/regions/[slug]'`

Expected: PASS.

- [ ] **Step 6: Commit only if explicitly authorized**

```powershell
git add web/src/features/content web/src/app/regions web/src/app/content
git commit -m "feat(content): add map-backed territory pages"
```

### Task 7: Verify Responsive and End-to-End Map Navigation

**Files:**
- Create: `web/e2e/map-navigation.spec.ts`
- Create: `web/scripts/check-map-assets.mjs`
- Create: `web/src/features/map/hooks/use-map-session.ts`
- Test: `web/src/features/map/hooks/use-map-session.test.tsx`
- Modify: `web/playwright.config.ts`
- Modify: `web/src/features/map/components/RegionListFallback.tsx`
- Modify: `web/src/features/content/components/TerritoryPanel.tsx`

**Interfaces:**
- Consumes: the complete Plan 1 UI.
- Produces: browser-level regression coverage at 375, 768, 1024, and 1440 CSS pixels.
- Produces: screenshot baselines for those four widths and an asset budget check that limits any map texture to 256 KiB and serialized territory geometry to 32 KiB.
- Produces: `MapSessionSnapshot = { camera: MapCameraState; explorerPoint: Point; selectedSlug: string | null }`.
- Produces: `useMapSession({ camera, explorerPoint, selectedSlug }): { restored: MapSessionSnapshot | null }`, backed by validated `sessionStorage` key `knowledge-frontier:map:v1`.

- [ ] **Step 1: Write failing Playwright scenarios**

```ts
test("moves the explorer and enters the selected territory", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入算法区" }).click();
  await expect(page).toHaveURL(/\/regions\/algorithms$/);
  await expect(page.getByRole("heading", { name: "算法区" })).toBeVisible();
});

test("territory list provides equivalent mobile navigation", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: "打开领地列表" }).click();
  await page.getByRole("link", { name: "项目区" }).click();
  await expect(page).toHaveURL(/\/regions\/projects$/);
});

test("replaces an in-flight destination without opening the old territory", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入学习资料区" }).click();
  await page.getByRole("button", { name: "进入项目区" }).click();
  await expect(page).toHaveURL(/\/regions\/projects$/);
});

test("reduced motion enters without a travel delay", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "进入八股区" }).click();
  await expect(page).toHaveURL(/\/regions\/fundamentals$/);
});
```

- [ ] **Step 2: Run the scenarios and confirm restoration behavior fails**

Run: `cd web; pnpm exec playwright test e2e/map-navigation.spec.ts`

Expected: the browser-Back restoration and mobile focus-containment scenarios FAIL because `useMapSession` and the bottom-sheet focus logic do not exist yet; the navigation scenarios from Task 5 remain green.

- [ ] **Step 3: Complete mobile panel and deep-link restoration**

At widths below 768px, render the territory panel as a full-height bottom sheet, preserve a 44px close target, move focus to its heading, keep focus within the open panel, and return focus to the trigger when it closes.

`useMapSession` writes camera, explorer point, and selection changes to `sessionStorage`, parses stored JSON defensively, rejects non-finite coordinates or unknown slugs, and exposes the last valid snapshot on map mount. A browser Back navigation to `/` restores that snapshot. On a direct `/regions/[slug]` visit, ignore session state for the background and set the explorer and camera to that region. The “返回战略地图” control links to `/?region=<slug>`; the home route treats this explicit query as higher priority than stored state and starts with the same region selected.

Add unit tests for valid restoration, corrupt JSON, non-finite coordinates, and an unknown slug. Extend Playwright coverage to use keyboard Enter, pointer selection, a two-pointer pinch gesture, reset, browser Back restoration, preparation failure with retry, rapid destination replacement, reduced motion, and the equivalent territory list. Generate the initial four approved baselines with `pnpm exec playwright test e2e/map-navigation.spec.ts --update-snapshots` after inspecting the live page.

- [ ] **Step 4: Run the full Plan 1 gate**

Run: `cd web; node scripts/check-map-assets.mjs; pnpm lint; pnpm typecheck; pnpm test --run; pnpm exec playwright test; pnpm build`

Expected: all commands exit 0 at all four target viewport sizes.

- [ ] **Step 5: Manually inspect the four target widths**

Inspect the full-page baselines named `map-375.png`, `map-768.png`, `map-1024.png`, and `map-1440.png`. Confirm no horizontal page scroll, no obscured focus, no clipped Chinese labels, no cumulative layout shift score above 0.1 when the map loads, and readable territory labels without relying on color alone. `check-map-assets.mjs` reads the region registry source plus files under `web/public/map`, fails when the UTF-8 geometry source exceeds 32 KiB or any texture exceeds 262,144 bytes, and exits zero when `web/public/map` does not exist.

- [ ] **Step 6: Commit only if explicitly authorized**

```powershell
git add web
git commit -m "test(map): cover responsive territory navigation"
```

## Plan 1 Completion Gate

- A new visitor can navigate all five territories from the game map without backend services.
- Pointer, touch, keyboard, reduced-motion, interruption, direct-link, and return-to-map paths are covered.
- Fixture content demonstrates the final page contracts that Plan 2 replaces without changing page components.
- Lint, typecheck, unit/component tests, Playwright, and production build all pass.
