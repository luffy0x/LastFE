# Supabase Render Next.js Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixture-backed content with Supabase PostgreSQL and package the Next.js application for deployment on Render without committing production secrets.

**Architecture:** Keep the existing `ContentRepository` interface as the UI boundary. Add a server-only Supabase adapter using the service-role key, SQL migrations for published content, tags, moderation events, and abuse records, then expose the existing App Router pages and APIs through that adapter. Render runs the Next.js service and a scheduled reconciliation job; Supabase owns persistent data and database backups.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase PostgreSQL, `@supabase/supabase-js`, Zod, GitHub Issues webhook, Render Blueprint, pnpm, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-01-interview-resource-sharing-design.md`; this plan supersedes the SQLite-specific storage and deployment choices in the existing Plan 2 and Plan 3 documents.

## Global Constraints

- Keep all browser requests behind `@/utils/request`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, GitHub tokens, webhook secrets, or ALTCHA secrets to browser code.
- Public reads return only `status = 'published'` records.
- Moderation transitions are idempotent by GitHub Issue number and webhook delivery ID.
- Do not write to a production database during local tests or implementation.
- Render deployment uses environment variables and a versioned commit or image, never secrets in source control.
- Preserve the existing map UI and `ContentRepository` contract while replacing fixtures.

---

### Task 1: Add Supabase server client and database schema

**Files:**
- Create: `web/src/server/supabase/admin.ts`
- Create: `web/src/server/supabase/env.ts`
- Create: `web/supabase/migrations/001_initial_schema.sql`
- Create: `web/src/server/supabase/admin.test.ts`
- Modify: `web/package.json`
- Modify: `web/pnpm-lock.yaml`

**Interfaces:**
- Produces `getSupabaseAdmin(): SupabaseClient` for server-only modules.
- Produces `requireServerEnv(name: string): string` with clear missing-variable errors.
- SQL produces tables for `content`, `tags`, `content_tags`, `moderation_events`, `submission_fingerprints`, and `successful_submission_events`, plus indexes for published region queries and GitHub Issue idempotency.

- [x] **Step 1: Write failing environment and schema tests**
- [x] **Step 2: Run the focused tests and confirm the missing modules fail**
- [x] **Step 3: Add `@supabase/supabase-js`, server-only environment validation, and the admin client**
- [x] **Step 4: Add the idempotent SQL migration with RLS enabled and no public write policy**
- [x] **Step 5: Run the focused tests and TypeScript check**

### Task 2: Replace fixture repository with Supabase content repository

**Files:**
- Create: `web/src/server/content/supabase-repository.ts`
- Create: `web/src/server/content/search.ts`
- Create: `web/src/server/content/supabase-repository.test.ts`
- Modify: `web/src/features/content/repository.ts`
- Modify: `web/src/features/content/types.ts`
- Modify: `web/src/app/page.tsx`
- Modify: `web/src/app/regions/[slug]/page.tsx`
- Modify: `web/src/app/content/[id]/page.tsx`

**Interfaces:**
- `createSupabaseContentRepository(client): ContentRepository` implements `list`, `get`, and `stats`.
- Public queries always filter published records, use bound Supabase query values, sort by `published_at DESC, id ASC`, and paginate at 20 rows.
- Search filters remain region-driven and use the existing `RegionDefinition.filterKeys` contract.

- [x] **Step 1: Write repository tests for empty results, published-only reads, pagination, stats, and missing records**
- [x] **Step 2: Run the tests and confirm the adapter is absent**
- [x] **Step 3: Implement the adapter and switch `getContentRepository()` to Supabase when explicitly configured**
- [x] **Step 4: Keep a fixture provider for local tests and development fallback**
- [x] **Step 5: Run all unit tests, TypeScript, and production build without requiring production credentials**

### Task 3: Add submission and GitHub moderation flow

**Files:**
- Create: `web/src/features/content/submission-schemas.ts`
- Create: `web/src/server/github/issue-codec.ts`
- Create: `web/src/server/github/verify-webhook.ts`
- Create: `web/src/server/github/sync-issue.ts`
- Create: `web/src/app/api/submissions/route.ts`
- Create: `web/src/app/api/github/webhook/route.ts`
- Create: `web/src/app/api/search/route.ts`
- Create: `web/src/app/submit/page.tsx`
- Create: `web/src/app/submit/[slug]/page.tsx`
- Create: `web/src/app/submitted/page.tsx`
- Create: `web/src/features/search/components/GlobalSearch.tsx`
- Create: `web/src/server/github/sync-issue.test.ts`
- Create: `web/src/app/api/submissions/route.test.ts`
- Create: `web/src/app/api/github/webhook/route.test.ts`
- Modify: `web/src/features/map/components/MapHud.tsx`
- Modify: `web/src/features/content/components/TerritoryPanel.tsx`

**Interfaces:**
- Five region schemas validate server-side with Zod and reuse the region registry.
- Submissions become private GitHub Issues and never expose repository details to the browser.
- Webhook processing verifies HMAC signatures, applies approved/withdrawn transitions transactionally, and treats duplicate deliveries as successful no-ops.

- [ ] **Step 1: Write failing schema, codec, signature, submission, and idempotency tests**
- [ ] **Step 2: Run the focused tests and confirm the new APIs are absent**
- [ ] **Step 3: Implement schemas, server-only GitHub clients, and bounded request validation**
- [ ] **Step 4: Implement webhook state transitions and Supabase writes**
- [ ] **Step 5: Replace disabled search and submission UI with real API-backed flows**
- [ ] **Step 6: Run unit, integration, and browser tests with local GitHub doubles and isolated Supabase test data**

### Task 4: Package Next.js for Render and scheduled reconciliation

**Files:**
- Create: `render.yaml`
- Create: `web/scripts/reconcile-github.ts`
- Create: `web/src/app/api/health/route.ts`
- Create: `web/src/app/api/health/route.test.ts`
- Create: `docs/deployment/render-supabase.md`
- Modify: `web/package.json`
- Modify: `web/README.md`
- Modify: `.gitignore`

**Interfaces:**
- Render web service runs `pnpm build` and `pnpm start` with health check `/api/health`.
- Render cron invokes `pnpm reconcile:github` every 10 minutes using the same server-side environment variables.
- Health output contains status and safe error categories only, never paths, tokens, database URLs, Issue bodies, or user content.

- [ ] **Step 1: Write failing health, command, and Render manifest tests**
- [ ] **Step 2: Run the focused tests and confirm the deployment files are absent**
- [ ] **Step 3: Add the Render web service, cron service, health route, and reconciliation command**
- [ ] **Step 4: Document Supabase project setup, Render environment variables, migrations, deploy, rollback, and secret rotation**
- [ ] **Step 5: Run lint, TypeScript, unit tests, Playwright, production build, and `render.yaml` validation**
- [ ] **Step 6: Stop before production deployment until the user explicitly authorizes connecting Render to the real Supabase and GitHub environments**

## Completion Gate

- Public pages read published content from Supabase, while local tests remain isolated from production.
- All five submission types validate and create private GitHub Issues without leaking private details.
- Approved, rejected, withdrawn, duplicate, and missed-webhook flows are deterministic and tested.
- Render web and scheduled services have health checks, safe environment variable handling, and documented rollback.
- The complete verification gate passes: lint, typecheck, unit/integration tests, Playwright, production build, and deployment manifest validation.
