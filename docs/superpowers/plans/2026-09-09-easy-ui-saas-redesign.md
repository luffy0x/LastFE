# Easy UI SaaS 全站重设计实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the full-screen strategic map with an Ez SaaS-style, search-first knowledge platform across all pages, with light/dark themes, while preserving every existing URL, the content repository boundary, the submission review flow, and all API behavior.

**Architecture:** Split business category data out of the map geometry config into `features/content/categories.ts`. Build a shared shell (`SiteHeader`/`SiteFooter`/`ThemeProvider`) in the root layout, rewrite the five page routes with new shared components, then delete the map feature and its dedicated tests. All data access continues through `ContentRepository`; all browser API calls continue through `@/utils/request`.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4 (PostCSS), next-themes, lucide-react, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-09-09-easy-ui-saas-redesign-design.md`

## Global Constraints

- Do not downgrade Next.js, React, or Tailwind CSS versions.
- Only add dependencies: `next-themes`, `lucide-react`.
- Preserve existing routes: `/`, `/regions/[slug]`, `/content/[id]`, `/submit`, `/submit/[slug]`, `/submitted` and all API routes.
- Do not change Supabase schema, GitHub review flow, or deployment configuration.
- Copy tone: use 分类/内容/投稿/搜索; never 情报/领地/任务/战略地图 in user-facing copy.
- Interactive targets at least 44×44 CSS pixels; mobile form text at least 16px.
- Both themes use semantic tokens only; no hard-coded colors in business components.
- Respect `prefers-reduced-motion`; no persistent or reading-disturbing animation.
- Verify 375, 768, 1024, 1440px widths: no horizontal scroll, no nav/content overlap.

---

### Task 1: Migrate category config to the content domain

**Files:**
- Create: `web/src/features/content/categories.ts`
- Create: `web/src/features/content/categories.test.ts`
- Modify: `web/src/features/content/submission-schemas.ts` (import source only)
- Modify: `web/src/server/content/search.ts` (import source only)
- Modify: `web/src/app/api/regions/[slug]/availability/route.ts` (import source only)
- Modify: `web/src/proxy.ts` (import source only)

**Interfaces:**
- Produces: `CategoryDefinition` type = `RegionDefinition` minus `svgPath`/`anchor`/`camera`/`routes`; field names `slug`, `href`, `label`, `description`, `theme`, `schemaKey`, `submissionFields`, `filterKeys`, `summaryFields`, `enabled` unchanged so consumers need no renames.
- Produces: `CATEGORIES` constant with the same five entries and identical business data as current `REGIONS`.
- The `SubmissionFieldDefinition` and theme types move with it; `features/map/types.ts` is deleted in Task 7, so the type definitions must live in the content domain now.

**Steps:**
- [ ] Create `categories.ts` with `CategoryDefinition`, `SubmissionFieldDefinition`, `CATEGORIES` (copy business fields verbatim from `REGIONS`; drop geometry).
- [ ] Unit test: five categories, unique slugs, enabled categories all have href/submissionFields/filterKeys, and business data matches the previous `REGIONS` entries.
- [ ] Repoint the four non-map consumers (`submission-schemas.ts`, `server/content/search.ts`, availability route, `proxy.ts`) from `@/features/map/regions` to `@/features/content/categories`.
- [ ] `pnpm test --run` and `pnpm typecheck` pass.

### Task 2: Install theme dependencies and rebuild global tokens

**Files:**
- Modify: `web/package.json` (add `next-themes`, `lucide-react`)
- Modify: `web/src/app/globals.css` (rewrite token layer)

**Interfaces:**
- Produces semantic tokens in `@theme inline`: `background`, `foreground`, `surface` (card), `surface-muted`, `muted` (secondary text), `line` (border), `primary` (indigo accent), `primary-foreground`, plus existing font stacks.
- `:root` holds light values; `.dark` (class strategy required by next-themes `attribute="class"`) holds dark values.
- Keep `.skip-link`, focus-visible outline, reduced-motion guard, box-sizing reset. Delete all map/territory/dossier/submission-page CSS in Task 7; new component CSS lands per-task below.

**Steps:**
- [ ] `pnpm add next-themes lucide-react` in `web/`.
- [ ] Rewrite the token section of `globals.css`: light theme = white/light-gray backgrounds, dark text, indigo primary; dark theme = dark slate-blue backgrounds, light text, raised border/text contrast. Both meet WCAG AA for body text.
- [ ] `pnpm lint` passes (no Tailwind syntax errors).

### Task 3: Shared shell — SiteHeader, SiteFooter, ThemeProvider

**Files:**
- Create: `web/src/features/shell/components/SiteHeader.tsx`
- Create: `web/src/features/shell/components/SiteHeader.test.tsx`
- Create: `web/src/features/shell/components/SiteFooter.tsx`
- Create: `web/src/features/shell/components/ThemeProvider.tsx`
- Create: `web/src/features/shell/components/ThemeToggle.tsx`
- Create: `web/src/features/shell/components/ThemeToggle.test.tsx`
- Create: `web/src/features/shell/components/MobileNav.tsx`
- Modify: `web/src/app/layout.tsx`
- Modify: `web/src/app/globals.css` (shell styles appended)

**Interfaces:**
- `ThemeProvider`: wraps `next-themes` `ThemeProvider` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`. Mounted in root layout around the whole body.
- `ThemeToggle`: client button using `useTheme`, renders Sun/Moon lucide icons, `aria-label="切换主题"`, min 44×44.
- `SiteHeader`: server component shell + client `MobileNav`. Contains product wordmark linking `/`, five category links (from `CATEGORIES`), `GlobalSearch` trigger, `ThemeToggle`, and a primary 投稿 button linking `/submit`. Sticky top, semantic `header`/`nav`, `aria-label="主导航"`.
- `MobileNav`: below 768px collapses category links into an accessible menu (button `aria-expanded`, Escape closes, focus moves into menu on open and back to trigger on close). Search and submit stay directly reachable.
- `SiteFooter`: site description + links (投稿、GitHub-free 静态说明), semantic `contentinfo`.
- Root layout: `<html lang="zh-CN" suppressHydrationWarning>`, body renders `ThemeProvider > SiteHeader + children + SiteFooter`. Pages stop declaring their own full-bleed backgrounds.

**Steps:**
- [ ] Implement components and styles (header height 64px desktop, 56px mobile; container max-width 1120px).
- [ ] Component tests: theme toggle flips class via next-themes mock; mobile nav opens/closes with keyboard; header renders five category links and submit CTA.
- [ ] No hydration warning test: render layout tree in jsdom with `suppressHydrationWarning` present on `html`.
- [ ] `pnpm test --run` passes.

### Task 4: Rework GlobalSearch copy and styling hooks

**Files:**
- Modify: `web/src/features/search/components/GlobalSearch.tsx`
- Modify: `web/src/features/search/components/useGlobalSearch.ts` (copy strings only, if any)
- Modify: `web/src/features/search/components/GlobalSearch.test.tsx`

**Interfaces:**
- Same trigger + `<dialog>` behavior, same `/api/search` fetching through `@/utils/request`, same Ctrl+K shortcut.
- Copy changes: trigger text 搜索全部内容, dialog title 全局搜索, status strings without 情报/扫描 metaphors. Region labels resolve from `CATEGORIES`.
- Restyle via existing class names redefined in the new token layer; keep dialog semantics and focus restore.

**Steps:**
- [ ] Replace map-domain copy and `REGIONS` import with `CATEGORIES`.
- [ ] Update tests to assert new copy and category labels.
- [ ] `pnpm test --run` passes.

### Task 5: Home page — search hero, stats, categories, latest, submission guide

**Files:**
- Modify: `web/src/app/page.tsx`
- Modify: `web/src/app/page.test.tsx`
- Create: `web/src/features/home/components/SearchHero.tsx`
- Create: `web/src/features/home/components/CategoryGrid.tsx`
- Create: `web/src/features/home/components/LatestContent.tsx`
- Create: `web/src/features/home/components/ContentCard.tsx`
- Create: `web/src/features/home/components/SubmissionGuide.tsx`
- Create: `web/src/features/home/components/home.test.tsx`

**Interfaces:**
- `page.tsx` (server): `await connection()`, calls `stats()` and `list({ page: 1, pageSize: 20 })` (no regionSlug → cross-category latest; confirm repository supports this — if `list` requires regionSlug, call per-category and merge by `publishedAt` desc, take top 10). Renders sections in spec order 3.2. Drops `?region=` handling.
- `SearchHero`: product positioning headline, large search input that submits to open the global search dialog (or focuses header trigger — reuse `GlobalSearch` behavior by embedding a trigger variant prop `size="hero"`), secondary link to `/submit`.
- `CategoryGrid`/`CategoryCard`: five cards from `CATEGORIES` with label, description, lucide icon per slug (`Briefcase`, `BookOpen`, `Layers`, `FolderGit2`, `Code2`), link to `/regions/[slug]`.
- `LatestContent`: list of `ContentCard` (title link to `/content/[id]`, category label badge, nickname ?? 匿名, date, tags, summary).
- `SubmissionGuide`: explains review-before-public and privacy boundaries; CTA to `/submit`.
- `ContentCard` is shared: reused by region page and latest list.

**Steps:**
- [ ] Implement components + server page assembly.
- [ ] Tests: home renders five category entries, stats numbers, latest items from mocked repository, submission guide link; no map markup.
- [ ] `pnpm test --run` passes.

### Task 6: Region page and content detail page

**Files:**
- Modify: `web/src/app/regions/[slug]/page.tsx`
- Create: `web/src/features/content/components/CategoryPage.tsx` (replaces TerritoryPanel)
- Create: `web/src/features/content/components/CategoryPage.test.tsx`
- Delete: `web/src/features/content/components/TerritoryPanel.tsx`, `TerritoryPanel.test.tsx`, `hooks/use-mobile-sheet-focus.ts`
- Modify: `web/src/features/content/components/Dossier.tsx` (copy + breadcrumb)
- Modify: `web/src/features/content/components/Dossier.test.tsx`

**Interfaces:**
- Region page keeps URL, search params (`q`, filter keys, `tags`, `page`) and the same `list()` query construction. Layout: breadcrumb (首页 / 分类名), category intro header, filter/search form (GET, same field names so deep links keep working), `ContentCard` list, distinct empty states for 无内容 vs 无筛选结果 with 清除筛选 link, pagination identical semantics (上一页/下一页/第 x / y 页), submit entry linking `/submit/[slug]`.
- Detail page keeps `get(id)`, 404 on missing/withdrawn. `Dossier` becomes reading-first single column: breadcrumb (首页 / 分类 / 标题), title, author, published date, category + tags, max-width ~720px `MarkdownRender`, external link block unchanged (rel/target/文案), back-to-category and submit links. Rename copy: 记录者→作者, remove DOSSIER/档案 language; keep class hooks minimal and new-token based (rename classes is fine since CSS is rewritten).

**Steps:**
- [ ] Implement `CategoryPage` and rewrite region route without backdrop/map imports.
- [ ] Update `Dossier` copy/breadcrumb and restyle hooks.
- [ ] Tests: filter form renders per-category fields, empty states differ, pagination links carry query params; dossier 404 path stays in page test via existing API tests.
- [ ] `pnpm test --run` passes.

### Task 7: Submission flow pages

**Files:**
- Modify: `web/src/app/submit/page.tsx`
- Modify: `web/src/app/submit/page.test.tsx`
- Modify: `web/src/app/submit/[slug]/page.tsx`
- Modify: `web/src/app/submit/[slug]/page.test.tsx`
- Modify: `web/src/app/submitted/page.tsx`
- Modify: `web/src/app/submitted/page.test.tsx`
- Modify: `web/src/features/content/components/SubmissionForm.tsx` (copy only)

**Interfaces:**
- `/submit`: same five-category directory, new copy (选择投稿分类), safety note unchanged in substance.
- `/submit/[slug]`: same `SubmissionForm` and field rendering; header copy 向{label}投稿; review explanation retained. Keep honeypot, validation attributes, pending/error semantics, success redirect to `/submitted`.
- `/submitted`: keep message, actions become 返回首页 / 继续投稿.
- Form styles move to the new token layer (shared `.form-field` baseline: 44px min height, 16px text, token borders/focus).

**Steps:**
- [ ] Rewrite pages under shared shell with new copy; update `SubmissionForm` strings (递交审核队列→提交审核 etc.).
- [ ] Update page tests for new copy; keep behavior assertions (params, notFound, form presence).
- [ ] `pnpm test --run` passes.

### Task 8: Delete the map feature and map-only tests

**Files:**
- Delete: `web/src/features/map/` (all components, hooks, camera-state, route-planner, prepare-region, validate-regions, regions, types + tests)
- Delete: `web/e2e/map-navigation.spec.ts`
- Modify: `web/src/app/globals.css` (remove all map/territory/legacy classes)

**Interfaces:**
- No remaining import of `features/map` anywhere (`grep` must be empty).
- `globals.css` contains only tokens, base resets, shell, home, category, dossier, submission, search-dialog, markdown styles under the new design.

**Steps:**
- [ ] Delete map directory and e2e spec; strip legacy CSS.
- [ ] `grep -rn "features/map" src e2e` returns nothing.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test --run` pass.

### Task 9: E2E coverage for the new experience

**Files:**
- Create: `web/e2e/site-navigation.spec.ts`
- Modify: `web/e2e/ui-layout.spec.ts` (replace map assertions with shell/page assertions)
- Keep: `web/e2e/submission-moderation.spec.ts` (verify selectors still match; update copy-based locators if needed)
- Keep: `web/e2e/run-directory.spec.ts`

**Interfaces:**
- `site-navigation.spec.ts`: home → category via header nav and via category card; home → search dialog → result → content detail; home → submit CTA → `/submit` → `/submit/[slug]`; theme toggle switches `html` class and persists across reload; mobile (375px) header menu keyboard path.
- `ui-layout.spec.ts`: at 375/768/1024/1440 assert no `document.documentElement.scrollWidth > innerWidth`, header height bounds, primary controls ≥44px, mobile menu reachable; keep the existing submission form geometry checks, updating class names if changed.

**Steps:**
- [ ] Write new specs; adjust `submission-moderation.spec.ts` locators only where copy changed.
- [ ] `pnpm exec playwright test` passes for all specs.

### Task 10: Full verification and doc alignment

**Files:**
- Modify: `README.md` (文档入口 list gains this plan; no behavior text change needed beyond accuracy)
- Modify: `docs/superpowers/specs/2026-09-09-easy-ui-saas-redesign-design.md` status line → 已实现 (date)

**Steps:**
- [ ] `pnpm lint && pnpm typecheck && pnpm test --run && pnpm build` all green.
- [ ] `pnpm exec playwright test` green; clean `.next-e2e` after.
- [ ] Confirm acceptance criteria from spec §8.2 item by item.
- [ ] Update spec status and README links.
