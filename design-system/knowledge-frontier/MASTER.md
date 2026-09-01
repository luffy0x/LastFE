# Knowledge Frontier Design System

> Read this file before implementing any page. Page overrides belong in `pages/<page-name>.md` and may only narrow these rules.

## 1. Visual theme and atmosphere

Knowledge Frontier is a cold, tactical intelligence map for students sharing job-search knowledge. It should feel like a credible command console at night: dense enough to reward exploration, restrained enough that long Chinese text remains readable, and never cartoonish.

The visual anchor is the continuous five-territory SVG map with one human operator marker. There is no marketing hero, card grid, mascot, island illustration, or decorative particle field.

## 2. Color palette and roles

All authored colors use OKLCH. Cyan is limited to telemetry, borders, and focus. Warm gold is reserved for the selected destination and primary status.

| Token | Value | Role |
| --- | --- | --- |
| `--canvas` | `oklch(0.145 0.012 235)` | Near-black navy map canvas |
| `--surface-1` | `oklch(0.19 0.014 232)` | HUD and quiet raised surfaces |
| `--surface-2` | `oklch(0.235 0.017 228)` | Intelligence panel and active overlays |
| `--text-strong` | `oklch(0.92 0.012 205)` | Main text, below pure white glare |
| `--text-muted` | `oklch(0.7 0.025 215)` | Secondary text, still WCAG AA |
| `--line-subtle` | `oklch(0.39 0.035 218 / 42%)` | Grid and quiet separators |
| `--telemetry` | `oklch(0.78 0.11 194)` | Focus, route and live telemetry |
| `--target` | `oklch(0.8 0.14 82)` | Selected territory and destination |
| `--danger` | `oklch(0.65 0.18 28)` | Errors only |
| `--success` | `oklch(0.72 0.12 154)` | Confirmed healthy or published state |
| `--region-interview` | `oklch(0.46 0.075 32)` | Muted iron red territory |
| `--region-resources` | `oklch(0.47 0.06 155)` | Muted field green territory |
| `--region-fundamentals` | `oklch(0.5 0.055 82)` | Muted ochre territory |
| `--region-projects` | `oklch(0.45 0.07 285)` | Muted violet territory |
| `--region-algorithms` | `oklch(0.47 0.065 235)` | Muted steel blue territory |

Do not use gradients on text or purple-to-blue page gradients. Functional states always include text, shape, or icon changes so color is never the only signal.

## 3. Typography rules

- Use the local stack `system-ui, "PingFang SC", "Microsoft YaHei", sans-serif` for all prose and controls. No remote font request is allowed.
- Use `ui-monospace, "Cascadia Mono", "SFMono-Regular", Consolas, monospace` only for coordinates, counters, timestamps, and small telemetry labels.
- Scale: 12px telemetry, 14px labels, 16px body, 20px panel title, 28px territory title, 40px product mark on wide screens.
- Body line height is 1.6. Long-form width is at most 68ch.
- Use weight 650 for display text, 560 for labels, 400 for prose. Use tabular numbers for counters.
- Tracking is `-0.02em` at 32px and above, `-0.01em` at 20px to 28px, and normal for body copy.

## 4. Component styling

- Buttons use clipped 6px corners, a 1px semantic boundary, and at least a 44×44px target. Hover changes border luminance and surface only. Active state uses `scale(0.97)` without shifting neighbors.
- HUD modules are edge-aligned instrument groups, not floating rounded cards. Use short corner marks, thin dividers, and surface luminance steps.
- Inputs use 6px corners, 16px text, persistent labels, muted helper copy, and a 2px telemetry focus ring.
- Territory states combine border pattern, label weight, and color: idle is quiet, hover/focus is telemetry cyan, selected is warm gold.
- The explorer is an 18×24 geometric human operator silhouette with helmet, torso, and legs. No face, emoji, mascot proportions, or raster sprite.
- The intelligence panel uses `--surface-2`, no backdrop blur, and a single map-facing divider. Content rows remain mostly cardless.

## 5. Layout principles

- The home page is one full-viewport map. UI overlays occupy edges and preserve the map center as the primary visual field.
- Spacing tokens are 4, 8, 12, 16, 24, 32, and 48px. No one-off spacing values in components.
- Desktop territory panels occupy 42% to 62% of the viewport and align right. Below 768px they become a full-height bottom sheet with safe-area padding.
- Breakpoints under test are 375, 768, 1024, and 1440px. No horizontal page scrolling is allowed.
- Use native document flow for dossiers and forms. Restrict prose to 68ch and code blocks to horizontal self-scroll.

## 6. Depth and elevation

- Depth comes from surface luminance, not dark drop shadows or glass blur.
- Level 0 is `--canvas`; level 1 is `--surface-1`; level 2 is `--surface-2`.
- A selected panel may use `box-shadow: 0 0 0 1px oklch(0.78 0.11 194 / 28%), 0 18px 60px oklch(0.08 0.02 235 / 45%)`.
- Radius tokens are `--radius-xs: 2px`, `--radius-sm: 6px`, `--radius-md: 10px`, and `--radius-pill: 999px`.

## 7. Do and do not

- Do keep the territory map continuous and visibly connected.
- Do render the equivalent territory list in server HTML.
- Do use local SVG geometry for icons and the operator.
- Do keep scanning lines and grids below text contrast.
- Do preserve visible focus, keyboard traversal, and 44px targets.
- Do not add a traditional hero, generic navigation bar, or equal card grid.
- Do not use remote fonts, emoji icons, WebGL, Canvas, Three.js, backdrop blur, or constant full-screen particle effects.
- Do not use `transition: all`, bounce easing, or animation of layout properties.
- Do not make long-form content look like a game HUD. Reading clarity wins inside dossiers.

## 8. Responsive and motion behavior

- Pointer devices support hover, click, drag, wheel zoom, and visible cursors. Touch supports tap, one-finger pan, and two-finger pinch without blocking browser-level zoom outside the map.
- Explorer travel is distance-aware from 600ms to 1000ms with `cubic-bezier(0.16, 1, 0.3, 1)`. Camera focus uses the same curve at lower amplitude.
- A new destination interrupts current travel and starts from the rendered point. No bounce or teleport.
- Under `prefers-reduced-motion`, skip travel, scanning, pulse, and camera tween while preserving the final selected state and navigation.
- Pause nonessential scanning when the document is hidden.

## 9. Agent prompt guide

Color reference: canvas `oklch(0.145 0.012 235)`, panel `oklch(0.235 0.017 228)`, text `oklch(0.92 0.012 205)`, telemetry `oklch(0.78 0.11 194)`, target `oklch(0.8 0.14 82)`.

- “Build a full-viewport strategic map on `--canvas`, with five contiguous muted territories, 1px telemetry boundaries, 6px control corners, and no marketing hero.”
- “Build a right intelligence panel on `--surface-2`, width 42% to 62%, 20px title at weight 650, 16px body at line-height 1.6, and one map-facing divider.”
- “Build a 44×44px map control using a local 20px outline SVG, 6px radius, telemetry focus ring, and active scale 0.97.”
- “Build an 18×24 SVG human operator marker, cyan rim light, warm-gold destination state, and no facial or cartoon detail.”
- “Build the mobile territory view as a full-height bottom sheet with 16px gutters, safe-area padding, focus containment, and no backdrop blur.”
