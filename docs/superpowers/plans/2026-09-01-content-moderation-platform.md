# Content and Moderation Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixture content with SQLite-backed search, five validated anonymous submission forms, safe Markdown rendering, and GitHub Issues approval, rejection, withdrawal, and reconciliation.

**Architecture:** The UI consumes the `ContentRepository` contract established in Plan 1. A SQLite adapter owns published data, territory-specific Zod schemas validate form payloads, a GitHub queue serializes submissions into private Issues, and one idempotent synchronization service handles both webhooks and scheduled reconciliation.

**Tech Stack:** Next.js App Router, TypeScript, SQLite via `better-sqlite3`, Zod, React Markdown, Remark GFM, Octokit, self-hosted ALTCHA, Vitest, Testing Library, Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-01-interview-resource-sharing-design.md`

## Global Constraints

- Complete the Career Map Experience plan first; this plan extends its region registry, request helper, routes, and `ContentRepository` contract.
- All five territories accept anonymous submissions and use the same private GitHub Issues review workflow.
- The public database stores only published or withdrawn content; pending submissions remain in GitHub.
- Issue labels are `submission`, `pending`, `region:<slug>`, `approved`, `published`, and `unpublish` as applicable.
- Raw HTML in Markdown is disabled; user links allow only `http` and `https` and render with `nofollow noopener noreferrer`.
- Default successful submission limit is 10 per source IP per hour, with self-hosted ALTCHA and 24-hour duplicate-content rejection.
- Browser requests go through `@/utils/request`; server GitHub operations go through the single `GitHubSubmissionQueue` adapter.
- Tests may create temporary SQLite databases; do not write to any production or user database during implementation.
- Never commit or log secrets, full submission bodies, tokens, cookies, or source IPs.
- Do not create a git commit unless the user explicitly authorizes commits.

## File Structure

```text
web/src/server/config.ts                              Validated server environment
web/src/server/db/client.ts                           SQLite connection factory
web/src/server/db/migrate.ts                          Ordered migration runner
web/src/server/db/migrations/0001_content.sql         Content, tags, deliveries, dedupe schema
web/src/server/content/sqlite-repository.ts           ContentRepository implementation
web/src/server/content/search.ts                      Parameterized search query builder
web/src/features/submissions/types.ts                 Submission contracts
web/src/features/submissions/schemas.ts               Five Zod schemas and registry
web/src/server/github/issue-codec.ts                   Safe server-only Issue title/body codec
web/src/features/submissions/components/SubmissionForm.tsx  Config-driven form shell
web/src/features/submissions/components/fields/*.tsx  Reusable text, tags, URL, select, and Markdown fields
web/src/app/submit/page.tsx                           Territory chooser
web/src/app/submit/[slug]/page.tsx                    Territory-specific form route
web/src/app/submitted/page.tsx                        Success route
web/src/app/api/challenge/route.ts                    ALTCHA challenge endpoint
web/src/app/api/submissions/route.ts                  Anonymous submission endpoint
web/src/server/security/challenge.ts                  ALTCHA adapter contract
web/src/server/security/rate-limit.ts                 Rate and content-fingerprint checks
web/src/server/github/client.ts                       Octokit construction
web/src/server/github/submission-queue.ts             Issue creation adapter
web/src/server/github/verify-webhook.ts               HMAC verification
web/src/server/github/sync-issue.ts                    Idempotent state transition service
web/src/app/api/github/webhook/route.ts               Webhook route
web/scripts/reconcile-github.ts                       Webhook-loss repair command
web/src/features/markdown/SafeMarkdown.tsx             Safe content renderer
web/src/features/search/components/GlobalSearch.tsx    HUD search overlay
web/src/app/api/search/route.ts                        Public grouped-search endpoint
web/e2e/support/fake-github-server.ts                  Local-only GitHub API double
web/e2e/submission-moderation.spec.ts                 Full moderation flow
```

---

### Task 1: Create the SQLite Schema and Repository Adapter

**Files:**
- Create: `web/src/server/db/client.ts`
- Create: `web/src/server/db/migrate.ts`
- Create: `web/src/server/db/migrations/0001_content.sql`
- Create: `web/src/server/content/sqlite-repository.ts`
- Create: `web/src/server/content/search.ts`
- Modify: `web/src/features/content/repository.ts`
- Test: `web/src/server/content/sqlite-repository.test.ts`

**Interfaces:**
- Consumes: `ContentRepository`, `ContentQuery`, `ContentRecord`, and `Page<T>` from Plan 1.
- Produces: `createSqliteContentStores(database): { repository: ContentRepository; moderation: ContentModerationStore }`.
- Produces: `openDatabase(path: string): Database` and `migrate(database): void`.
- Produces: `ContentModerationStore.apply(command: ContentSyncCommand): Promise<"applied" | "duplicate">`, with the delivery insert and content transition in one SQLite transaction.

- [ ] **Step 1: Install the SQLite driver and write a failing repository test**

Run: `cd web; pnpm add better-sqlite3; pnpm add -D @types/better-sqlite3`

```ts
const PUBLISHED_INTERVIEW: ContentRecord & { githubIssueNumber: number } = {
  id: "gh-101",
  githubIssueNumber: 101,
  regionSlug: "interview",
  title: "字节跳动/基础架构 · 后端开发",
  summary: null,
  nickname: null,
  tags: ["一面", "Go"],
  publishedAt: "2026-09-01T08:00:00.000Z",
  createdAt: "2026-09-01T07:55:00.000Z",
  updatedAt: "2026-09-01T08:00:00.000Z",
  metadata: { companyDepartment: "字节跳动/基础架构", position: "后端开发" },
  markdown: "面试记录",
  externalUrl: null,
  status: "published",
};

it("publishes and lists one record by territory", async () => {
  const db = openDatabase(":memory:");
  migrate(db);
  const { repository, moderation } = createSqliteContentStores(db);
  await moderation.apply({ deliveryId: "seed-101", action: "publish", record: PUBLISHED_INTERVIEW });
  const page = await repository.list({ regionSlug: "interview", page: 1, pageSize: 20 });
  expect(page.items).toHaveLength(1);
  expect(page.items[0].id).toBe(PUBLISHED_INTERVIEW.id);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd web; pnpm vitest run src/server/content/sqlite-repository.test.ts`

Expected: FAIL because the database adapter does not exist.

- [ ] **Step 3: Add the initial migration**

```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
CREATE TABLE contents (
  id TEXT PRIMARY KEY,
  github_issue_number INTEGER NOT NULL UNIQUE,
  region_slug TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('published', 'withdrawn')),
  title TEXT NOT NULL,
  summary TEXT,
  nickname TEXT,
  markdown TEXT,
  external_url TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  published_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE tags (id INTEGER PRIMARY KEY, normalized TEXT NOT NULL UNIQUE, label TEXT NOT NULL);
CREATE TABLE content_tags (
  content_id TEXT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (content_id, tag_id)
);
CREATE TABLE webhook_deliveries (
  delivery_id TEXT PRIMARY KEY,
  processed_at TEXT NOT NULL
);
CREATE TABLE submission_fingerprints (
  fingerprint TEXT PRIMARY KEY,
  source_hash TEXT NOT NULL,
  reservation_id TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK (state IN ('reserved', 'submitted')),
  expires_at TEXT NOT NULL
);
CREATE TABLE successful_submission_events (
  source_hash TEXT NOT NULL,
  succeeded_at TEXT NOT NULL
);
CREATE TABLE reconciliation_cursors (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE INDEX contents_region_published_idx ON contents(region_slug, published_at DESC);
CREATE INDEX contents_status_updated_idx ON contents(status, updated_at DESC);
CREATE INDEX successful_submission_events_window_idx
  ON successful_submission_events(source_hash, succeeded_at DESC);
```

- [ ] **Step 4: Implement migrations and parameterized repository methods**

Keep the Plan 1 `ContentRepository` read-only and add a separate moderation boundary:

```ts
export type ContentSyncCommand =
  | { deliveryId: string; action: "publish"; record: ContentRecord & { githubIssueNumber: number } }
  | { deliveryId: string; action: "withdraw"; issueNumber: number; updatedAt: string }
  | { deliveryId: string; action: "reject" | "ignore"; issueNumber: number };

export interface ContentModerationStore {
  apply(command: ContentSyncCommand): Promise<"applied" | "duplicate">;
}
```

Wrap content and tag upserts in one SQLite transaction. Normalize tags for uniqueness while preserving the first accepted user-facing spelling in `tags.label`. Parse `metadata_json` only after verifying it is a JSON object of string values. The public `list` and `get` methods always include `status = 'published'`; withdrawal remains addressable only through moderation repository methods. Build every predicate with bound SQLite parameters and escape `%`, `_`, and the escape character in literal search text. Search interview title/company/position/tags/body; resources title/summary/tags; fundamentals title/category/tags/body; projects title/technology stack/tags/body; and algorithms title/source/difficulty/tags/body. Sort by `published_at DESC, id ASC` and use a fixed page size of 20. Keep `submission_fingerprints` and `successful_submission_events` behind the Task 4 abuse-store interface, delete expired rows during bounded write operations, and never store a raw source IP.

- [ ] **Step 5: Verify database behavior**

Run: `cd web; pnpm vitest run src/server/content/sqlite-repository.test.ts`

Expected: PASS for insert, update, withdrawal, tag replacement, published-only reads, seven-day stats, pagination, and duplicate delivery idempotency.

- [ ] **Step 6: Commit only if explicitly authorized**

```powershell
git add web/src/server/db web/src/server/content web/src/features/content/repository.ts
git commit -m "feat(content): add sqlite content repository"
```

### Task 2: Define the Five Submission Schemas

**Files:**
- Create: `web/src/features/submissions/types.ts`
- Create: `web/src/features/submissions/schemas.ts`
- Test: `web/src/features/submissions/schemas.test.ts`
- Modify: `web/src/features/map/types.ts`
- Modify: `web/src/features/map/regions.ts`

**Interfaces:**
- Produces: discriminated `Submission` union.
- Produces: `SubmissionFieldDefinition` and per-region `submissionFields` arrays consumed by the generic form.
- Produces: `SUBMISSION_SCHEMAS` keyed by the five `schemaKey` values.
- Produces: `parseSubmission(regionSlug: string, input: unknown): Submission`.
- Produces: `isSafeHttpUrl(url: string): boolean` for schema and Markdown link policy reuse.

- [ ] **Step 1: Write failing schema tests**

```ts
const VALID_INTERVIEW_INPUT = {
  regionSlug: "interview",
  companyDepartment: "字节跳动/基础架构",
  position: "后端开发",
  tags: ["一面", "Go"],
  nickname: "",
  markdown: "面试记录",
};

it("rejects unsafe resource URLs", () => {
  expect(() => parseSubmission("resources", {
    title: "资料",
    url: "javascript:alert(1)",
    tags: ["Java"],
  })).toThrow(/http/i);
});

it("generates an interview title from company and position", () => {
  const submission = parseSubmission("interview", VALID_INTERVIEW_INPUT);
  expect(submission.title).toBe("字节跳动/基础架构 · 后端开发");
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `cd web; pnpm vitest run src/features/submissions/schemas.test.ts`

Expected: FAIL because schema parsing does not exist.

- [ ] **Step 3: Implement the exact schema registry**

```ts
export const SUBMISSION_SCHEMAS = {
  interview: z.object({
    regionSlug: z.literal("interview"), companyDepartment: singleLineText(1, 80),
    position: singleLineText(1, 80), tags, nickname, markdown,
  }).transform((value) => ({ ...value, title: `${value.companyDepartment} · ${value.position}` })),
  resource: z.object({
    regionSlug: z.literal("resources"), title: singleLineText(1, 120), url: safeHttpUrl,
    summary: text(0, 2000).optional(), tags, nickname,
  }),
  fundamental: z.object({
    regionSlug: z.literal("fundamentals"), title: singleLineText(1, 120),
    category: singleLineText(1, 60), tags, nickname, markdown,
  }),
  project: z.object({
    regionSlug: z.literal("projects"), title: singleLineText(1, 120), techStack: tags,
    repositoryUrl: safeHttpUrl.optional(), demoUrl: safeHttpUrl.optional(), tags, nickname, markdown,
  }),
  algorithm: z.object({
    regionSlug: z.literal("algorithms"), title: singleLineText(1, 120), source: singleLineText(1, 60),
    difficulty: z.enum(["easy", "medium", "hard"]), problemUrl: safeHttpUrl.optional(),
    tags, nickname, markdown,
  }),
} as const;
```

Define `text`, `singleLineText`, `tags`, `nickname`, `markdown`, and `safeHttpUrl` once. `singleLineText` trims and rejects CR, LF, and control characters so Issue titles remain one line. `markdown` accepts 1 UTF-8 byte through 50 KiB, tags contain 1–5 values of 1–24 characters and reject duplicates after Unicode normalization, trim, and locale-independent lowercase conversion, nickname converts an empty string to `undefined` and is at most 40 characters, and URL parsing accepts only `http:` and `https:`. The resulting `Submission` union keeps the literal `regionSlug`, maps absent nicknames to `undefined`, and retains the user-facing tag spelling.

Define `SubmissionFieldDefinition` as `{ name: string; label: string; kind: "text" | "tags" | "url" | "select" | "markdown"; required: boolean; maxLength?: number; options?: readonly { value: string; label: string }[] }`. Add exact arrays to the five `REGIONS` entries: interview uses company/department, position, tags, nickname, Markdown; resources uses title, URL, summary, tags, nickname; fundamentals uses title, category, tags, nickname, Markdown; projects uses title, technology stack, repository URL, demo URL, tags, nickname, Markdown; algorithms uses title, source, difficulty (`easy`, `medium`, `hard`), problem URL, tags, nickname, and Markdown. Keep field names identical to the Zod schema properties.

- [ ] **Step 4: Connect region `schemaKey` values and test every boundary**

Add table-driven cases containing the concrete boundary values: `""`, `"   "`, six one-character tags, `['Go', ' go ']`, an 81-character company, a 50 KiB + 1 byte Markdown string, `difficulty: "expert"`, and `javascript:` URLs. Assert that a project with both optional links absent is valid and that every territory accepts an omitted nickname.

- [ ] **Step 5: Run focused tests**

Run: `cd web; pnpm vitest run src/features/submissions/schemas.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit only if explicitly authorized**

```powershell
git add web/src/features/submissions web/src/features/map/regions.ts
git commit -m "feat(submissions): validate territory payloads"
```

### Task 3: Render Safe Markdown and External Links

**Files:**
- Create: `web/src/features/markdown/SafeMarkdown.tsx`
- Test: `web/src/features/markdown/SafeMarkdown.test.tsx`
- Modify: `web/src/features/content/components/Dossier.tsx`

**Interfaces:**
- Produces: `SafeMarkdown({ source: string })`.
- Guarantees: no raw HTML interpretation and safe attributes on external links.

- [ ] **Step 1: Install Markdown dependencies and write failing security tests**

Run: `cd web; pnpm add react-markdown remark-gfm`

```tsx
it("does not execute or render raw HTML", () => {
  render(<SafeMarkdown source={'<script>alert(1)</script><img src=x onerror=alert(2)>'} />);
  expect(document.querySelector("script")).toBeNull();
  expect(document.querySelector("img")).toBeNull();
});

it("hardens external links", () => {
  render(<SafeMarkdown source="[资料](https://example.com/file)" />);
  expect(screen.getByRole("link", { name: "资料" })).toHaveAttribute(
    "rel", "nofollow noopener noreferrer",
  );
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `cd web; pnpm vitest run src/features/markdown/SafeMarkdown.test.tsx`

Expected: FAIL because `SafeMarkdown` does not exist.

- [ ] **Step 3: Implement the renderer without raw-HTML plugins**

```tsx
export function SafeMarkdown({ source }: { source: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      urlTransform={(url) => isSafeHttpUrl(url) ? url : ""}
      components={{
        a: (props) => <a {...props} target="_blank" rel="nofollow noopener noreferrer" />,
      }}
    >
      {source}
    </ReactMarkdown>
  );
}
```

Do not add `rehype-raw`. Style headings, paragraphs, tables, code, quotes, and links through Tailwind typography utilities or tokenized global component classes. `Dossier` renders `externalUrl` as a clearly marked “站外链接（本站不托管或检查文件）” control, opens it in a new tab, and applies the same `rel` attributes.

- [ ] **Step 4: Verify Markdown and dossier rendering**

Run: `cd web; pnpm vitest run src/features/markdown src/features/content/components/Dossier.test.tsx`

Expected: PASS for raw HTML, dangerous schemes, GFM tables, code fences, and long links.

- [ ] **Step 5: Commit only if explicitly authorized**

```powershell
git add web/src/features/markdown web/src/features/content/components/Dossier.tsx
git commit -m "feat(content): render safe markdown dossiers"
```

### Task 4: Build Config-Driven Submission Forms and Abuse Checks

**Files:**
- Modify: `web/src/utils/request.ts`
- Create: `web/src/features/submissions/components/SubmissionForm.tsx`
- Create: `web/src/features/submissions/components/fields/TextField.tsx`
- Create: `web/src/features/submissions/components/fields/TagField.tsx`
- Create: `web/src/features/submissions/components/fields/UrlField.tsx`
- Create: `web/src/features/submissions/components/fields/SelectField.tsx`
- Create: `web/src/features/submissions/components/fields/MarkdownField.tsx`
- Create: `web/src/server/security/challenge.ts`
- Create: `web/src/server/security/rate-limit.ts`
- Create: `web/src/server/security/abuse-store.ts`
- Create: `web/src/app/api/challenge/route.ts`
- Create: `web/src/app/api/submissions/route.ts`
- Create: `web/src/app/submit/page.tsx`
- Create: `web/src/app/submit/[slug]/page.tsx`
- Create: `web/src/app/submitted/page.tsx`
- Test: `web/src/app/api/submissions/route.test.ts`
- Test: `web/src/features/submissions/components/SubmissionForm.test.tsx`

**Interfaces:**
- Consumes and preserves Plan 1's `request<T>(input: string, init?: RequestInit & { timeoutMs?: number }): Promise<T>` contract.
- Produces: `ChallengeService = { create(): Promise<AltchaChallenge>; verify(payload: unknown): Promise<boolean> }`.
- Produces: `SubmissionQueue = { enqueue(submission: Submission): Promise<{ issueNumber: number }> }`; Task 5 provides the real adapter.
- Produces: `AbuseStore.reserve(input: { sourceHash: string; fingerprint: string; now: Date }): Promise<{ reservationId: string }>`; `recordSuccess(reservationId: string, now: Date): Promise<void>`; and `release(reservationId: string): Promise<void>`.
- `SubmissionRouteDependencies` is `{ challenge: ChallengeService; abuse: AbuseStore; queue: SubmissionQueue; hashSource(ip: string): string; now(): Date }`.
- Produces: `createSubmissionHandler(dependencies: SubmissionRouteDependencies): (request: Request) => Promise<Response>`; production `POST` is created from server-only dependencies.

- [ ] **Step 1: Add self-hosted ALTCHA and write failing API tests**

Run: `cd web; pnpm add altcha altcha-lib`

```ts
const VALID_INTERVIEW_INPUT = {
  regionSlug: "interview",
  companyDepartment: "字节跳动/基础架构",
  position: "后端开发",
  tags: ["一面"],
  markdown: "面试记录",
  altcha: { algorithm: "SHA-256", challenge: "test", number: 1, salt: "test", signature: "test" },
};
const FAKE_QUEUE: SubmissionQueue = { enqueue: vi.fn().mockResolvedValue({ issueNumber: 101 }) };
const FAKE_ABUSE: AbuseStore = {
  reserve: vi.fn().mockResolvedValue({ reservationId: "reservation-1" }),
  recordSuccess: vi.fn().mockResolvedValue(undefined),
  release: vi.fn().mockResolvedValue(undefined),
};
const makeRequest = (body: unknown) => new Request("http://localhost/api/submissions", {
  method: "POST",
  headers: { "content-type": "application/json", "x-real-ip": "203.0.113.10" },
  body: JSON.stringify(body),
});
const handler = createSubmissionHandler({
  challenge: { create: vi.fn(), verify: vi.fn().mockResolvedValue(false) },
  abuse: FAKE_ABUSE,
  queue: FAKE_QUEUE,
  hashSource: () => "hashed-test-source",
  now: () => new Date("2026-09-01T08:00:00.000Z"),
});

it("rejects a submission when challenge verification fails", async () => {
  const response = await handler(makeRequest(VALID_INTERVIEW_INPUT));
  expect(response.status).toBe(422);
  expect(FAKE_QUEUE.enqueue).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `cd web; pnpm vitest run src/app/api/submissions/route.test.ts`

Expected: FAIL because the route and adapters do not exist.

- [ ] **Step 3: Implement request, challenge, rate, and dedupe boundaries**

The route sequence is fixed: reject `Content-Length` above 64 KiB, read at most 64 KiB and parse JSON, reject a non-empty raw honeypot field, verify the territory schema, verify ALTCHA, derive an HMAC-SHA256 source hash from Nginx's overwritten `X-Real-IP` value with `RATE_LIMIT_HMAC_KEY`, and compute a SHA-256 fingerprint over canonical JSON of the parsed submission excluding nickname, ALTCHA, and honeypot fields. Reserve both limits in one SQLite transaction. `reserve` deletes expired rows, rejects an unexpired matching fingerprint, creates a five-minute reservation lease, and rejects when successful events plus active reservations reach 10 within one hour. Enqueue only after reservation succeeds. On queue success, atomically promote the fingerprint reservation to a 24-hour `submitted` record and append a successful event; on queue failure, release that reservation and return a retryable upstream error. Never persist or log the raw IP.

Use this response contract:

```ts
type SubmissionResponse =
  | { ok: true; issueNumber: number }
  | { ok: false; code: "INVALID" | "CHALLENGE" | "RATE_LIMIT" | "DUPLICATE" | "UPSTREAM"; message: string };
```

Return 201 for success, 400 for `INVALID`, 422 for `CHALLENGE`, 429 for `RATE_LIMIT`, 409 for `DUPLICATE`, and 503 for `UPSTREAM`. Add `Retry-After` only to 429 and 503 responses; never include an Issue URL or internal exception string.

- [ ] **Step 4: Implement the generic accessible field renderer**

Map each `SubmissionFieldDefinition.kind` to the reusable field component with an exhaustive `never` check; do not branch on region slug in `SubmissionForm`. Each visible field has a persistent `<label>`, help text when limits matter, and an inline error connected with `aria-describedby`. Keep entered values after any server error. The submit control shows a loading state and remains disabled only while the current request is active.

`SubmissionForm` obtains a fresh challenge from `/api/challenge`, submits through `@/utils/request`, and only calls `router.replace("/submitted")` after `{ ok: true }`. Map `SubmissionResponse.code` to a form-level message, retain all field state, refresh ALTCHA after `CHALLENGE`, and focus the first invalid field after local or server validation. The hidden honeypot input is named `website` and remains empty for a valid submission.

- [ ] **Step 5: Verify forms and endpoint behavior**

Run: `cd web; pnpm vitest run src/features/submissions src/app/api/submissions`

Expected: PASS for success, invalid fields, failed challenge, duplicate payload, rate limit, upstream failure, preserved input, and focus on the first invalid field.

- [ ] **Step 6: Commit only if explicitly authorized**

```powershell
git add web/src/utils web/src/features/submissions web/src/server/security web/src/app/api/challenge web/src/app/api/submissions web/src/app/submit web/src/app/submitted
git commit -m "feat(submissions): add anonymous territory forms"
```

### Task 5: Queue Submissions as Private GitHub Issues

**Files:**
- Create: `web/src/server/config.ts`
- Create: `web/src/server/github/client.ts`
- Create: `web/src/server/github/submission-queue.ts`
- Create: `web/src/server/github/issue-codec.ts`
- Test: `web/src/server/github/issue-codec.test.ts`
- Test: `web/src/server/github/submission-queue.test.ts`
- Modify: `web/src/app/api/submissions/route.ts`
- Create: `web/.env.example`

**Interfaces:**
- Produces: `encodeIssue(submission): { title: string; body: string; labels: string[] }`.
- Produces: `decodeIssue(issue): Submission`.
- Produces: `GitHubSubmissionQueue.enqueue(submission): Promise<{ issueNumber: number }>`.

- [ ] **Step 1: Install Octokit and write failing codec tests**

Run: `cd web; pnpm add @octokit/rest`

```ts
const VALID_INTERVIEW = parseSubmission("interview", {
  regionSlug: "interview",
  companyDepartment: "字节跳动/基础架构",
  position: "后端开发",
  tags: ["一面"],
  markdown: "面试记录",
});

it("round-trips user text without sentinel injection", () => {
  const input = { ...VALID_INTERVIEW, markdown: "text --> more text" };
  const encoded = encodeIssue(input);
  expect(decodeIssue({ title: encoded.title, body: encoded.body, labels: encoded.labels })).toEqual(input);
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `cd web; pnpm vitest run src/server/github/issue-codec.test.ts`

Expected: FAIL because the codec does not exist.

- [ ] **Step 3: Implement a versioned base64url metadata envelope**

```ts
const splitSubmission = (submission: Submission) => {
  const { markdown, summary, ...metadata } = submission;
  return {
    metadata,
    prose: submission.regionSlug === "resources" ? summary ?? "" : markdown ?? "",
  };
};

export function encodeIssue(submission: Submission) {
  const { metadata, prose } = splitSubmission(submission);
  const marker = `<!-- submission:v1:${Buffer.from(JSON.stringify(metadata)).toString("base64url")} -->`;
  return {
    title: `[${submission.regionSlug}] ${submission.title}`,
    body: `${marker}\n<!-- submission-content -->\n${prose}`,
    labels: ["submission", "pending", `region:${submission.regionSlug}`],
  };
}
```

`decodeIssue` must accept exactly one leading `submission:v1` marker followed immediately by the fixed `submission-content` delimiter. Decode metadata, treat the complete delimiter tail as `summary` for resources or `markdown` for the other four territories, and call `parseSubmission` again. Text that merely resembles a marker later in the prose is content, not metadata. This lets a maintainer correct the visible prose in GitHub before re-adding `approved`, while malformed prefixes fail closed.

- [ ] **Step 4: Implement the least-privilege Octokit adapter**

Create one Octokit instance from server-only validated variables `GITHUB_TOKEN`, `GITHUB_OWNER`, and `GITHUB_REPO`. Validate `GITHUB_WEBHOOK_SECRET`, `ALTCHA_HMAC_KEY`, `RATE_LIMIT_HMAC_KEY`, and `SQLITE_PATH` in the same server-only module, but resolve configuration lazily at runtime so `next build` does not need production credentials. Call `octokit.rest.issues.create` with the encoded title, body, and labels. Return only the Issue number to the browser. Permit `GITHUB_API_BASE_URL` only when `NODE_ENV !== "production"` so Playwright can use the local fake server.

- [ ] **Step 5: Verify no secret or private URL crosses the API boundary**

Run: `cd web; pnpm vitest run src/server/github src/app/api/submissions/route.test.ts`

Expected: PASS and response snapshots contain no token, repository URL, or full submission body.

- [ ] **Step 6: Commit only if explicitly authorized**

```powershell
git add web/src/server/config.ts web/src/server/github web/src/app/api/submissions/route.ts web/.env.example
git commit -m "feat(moderation): queue submissions in github issues"
```

### Task 6: Process Signed Webhooks Idempotently

**Files:**
- Create: `web/src/server/github/verify-webhook.ts`
- Create: `web/src/server/github/sync-issue.ts`
- Create: `web/src/app/api/github/webhook/route.ts`
- Test: `web/src/server/github/verify-webhook.test.ts`
- Test: `web/src/server/github/sync-issue.test.ts`
- Test: `web/src/app/api/github/webhook/route.test.ts`

**Interfaces:**
- Produces: `verifyGitHubSignature(rawBody: Uint8Array, signature: string | null, secret: string): boolean`.
- Produces: `GitHubIssueSnapshot = { number: number; title: string; body: string; labels: readonly string[]; state: "open" | "closed"; createdAt: string; updatedAt: string }`.
- Produces: `ModerationDecision = "published" | "withdrawn" | "rejected" | "ignored"`.
- Produces: `SyncIssueDependencies = { moderation: ContentModerationStore; ensureReviewState(issueNumber: number, decision: ModerationDecision): Promise<void>; invalidate(paths: readonly string[]): Promise<void> }`.
- Produces: `syncIssue(event: GitHubIssueSnapshot, deliveryId: string, dependencies: SyncIssueDependencies): Promise<SyncResult>`.
- `SyncResult` is `ModerationDecision | "duplicate"`.

- [ ] **Step 1: Write failing HMAC and transition tests**

```ts
const BODY = new TextEncoder().encode('{"action":"labeled"}');
const sign = (body: Uint8Array, secret: string) =>
  `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

it("rejects a body signed with the wrong secret", () => {
  expect(verifyGitHubSignature(BODY, sign(BODY, "wrong"), "correct")).toBe(false);
});

it("publishes an approved submission once", async () => {
  const submission = parseSubmission("interview", {
    regionSlug: "interview",
    companyDepartment: "字节跳动/基础架构",
    position: "后端开发",
    tags: ["一面"],
    markdown: "面试记录",
  });
  const encoded = encodeIssue(submission);
  const APPROVED_EVENT: GitHubIssueSnapshot = {
    number: 101,
    title: encoded.title,
    body: encoded.body,
    labels: [...encoded.labels, "approved"],
    state: "open",
    createdAt: "2026-09-01T08:00:00.000Z",
    updatedAt: "2026-09-01T08:05:00.000Z",
  };
  const DEPS: SyncIssueDependencies = {
    moderation: {
      apply: vi.fn()
        .mockResolvedValueOnce("applied")
        .mockResolvedValueOnce("duplicate"),
    },
    ensureReviewState: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
  };
  expect(await syncIssue(APPROVED_EVENT, "delivery-1", DEPS)).toBe("published");
  expect(await syncIssue(APPROVED_EVENT, "delivery-1", DEPS)).toBe("duplicate");
  expect(DEPS.moderation.apply).toHaveBeenCalledTimes(2);
  expect(DEPS.invalidate).toHaveBeenCalledTimes(2);
  expect(DEPS.ensureReviewState).toHaveBeenCalledTimes(2);
  expect(DEPS.ensureReviewState).toHaveBeenLastCalledWith(101, "published");
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `cd web; pnpm vitest run src/server/github/verify-webhook.test.ts src/server/github/sync-issue.test.ts`

Expected: FAIL because webhook processing does not exist.

- [ ] **Step 3: Implement constant-time signature verification**

Reject `Content-Length` above 256 KiB and stop streaming after 256 KiB. Compute `sha256=` plus an HMAC-SHA256 hex digest over the exact raw request bytes and compare equal-length buffers with `timingSafeEqual`. Reject a missing or malformed signature before JSON parsing. Accept only the GitHub `issues` event and require a non-empty `X-GitHub-Delivery` header.

- [ ] **Step 4: Implement the state machine in one transaction**

```ts
type ModerationState = {
  isClosed: boolean;
  labels: ReadonlySet<string>;
};

function decide(state: ModerationState): SyncResult {
  if (state.labels.has("unpublish")) return "withdrawn";
  if (state.labels.has("approved")) return "published";
  if (state.isClosed) return "rejected";
  return "ignored";
}
```

Require the `submission` label and an exact `region:<payload regionSlug>` label. Decode and revalidate the Issue, derive a stable public ID `gh-<issue number>`, map `createdAt` from the Issue creation time, set `publishedAt` to the Issue update time on the first approved insert and preserve it on later updates, and map `updatedAt` from the current Issue update. Pass one `ContentSyncCommand` to `ContentModerationStore.apply`. That store inserts the delivery ID and applies the content transition atomically. After either `"applied"` or `"duplicate"`, invalidate `/`, `/regions/<slug>`, `/content/<id>`, and `/api/search`; repeated invalidation is intentional so a prior post-commit cache failure can recover. Do not invalidate unrelated territory routes.

Then call `ensureReviewState` idempotently with the computed `ModerationDecision`: published removes `pending`, adds `published`, and closes the Issue; withdrawn leaves `unpublish` in place and ensures public withdrawal; rejected and ignored do not publish. If `apply` returns `duplicate`, still pass the original decision to `ensureReviewState` so a previous GitHub label-write failure can recover, then return `"duplicate"`. Propagate label, database, and cache failures with a safe error category so GitHub retries and reconciliation can repair them.

- [ ] **Step 5: Verify webhook route behavior**

Run: `cd web; pnpm vitest run src/server/github src/app/api/github/webhook`

Expected: PASS for bad signatures, duplicate deliveries, approved, rejected, withdrawn, republished, malformed markers, and out-of-order events.

- [ ] **Step 6: Commit only if explicitly authorized**

```powershell
git add web/src/server/github web/src/app/api/github/webhook
git commit -m "feat(moderation): sync approved github issues"
```

### Task 7: Add Reconciliation for Missed Webhooks

**Files:**
- Create: `web/scripts/reconcile-github.ts`
- Create: `web/src/server/github/reconcile.ts`
- Test: `web/src/server/github/reconcile.test.ts`
- Modify: `web/src/server/db/client.ts`
- Modify: `web/package.json`

**Interfaces:**
- Produces: `ReconcileDependencies = { since: string; listIssues(page: number, perPage: number): Promise<readonly GitHubIssueSnapshot[]>; syncIssue(issue: GitHubIssueSnapshot, deliveryId: string): Promise<SyncResult> }`.
- Produces: `reconcileIssues(dependencies: ReconcileDependencies): Promise<ReconcileReport>`, where `ReconcileReport = { scanned: number; synced: number; failed: number }`.
- Produces: `ReconciliationCursorStore = { read(name: string): Promise<string | null>; write(name: string, value: string): Promise<void> }`.
- Produces: `pnpm reconcile:github` command for Plan 3 scheduling.

- [ ] **Step 1: Write a failing reconciliation test**

```ts
const changedIssue = (number: number): GitHubIssueSnapshot => ({
  number,
  title: `[interview] submission-${number}`,
  body: "encoded-test-body",
  labels: ["submission", "approved"],
  state: "open",
  createdAt: "2026-09-01T08:00:00.000Z",
  updatedAt: `2026-09-01T08:0${number}:00.000Z`,
});
const TEST_RECONCILE_DEPS: ReconcileDependencies = {
  since: "2026-09-01T07:00:00.000Z",
  listIssues: vi.fn()
    .mockResolvedValueOnce([changedIssue(1), changedIssue(2), changedIssue(3)])
    .mockResolvedValueOnce([]),
  syncIssue: vi.fn()
    .mockResolvedValueOnce("published")
    .mockResolvedValueOnce("withdrawn")
    .mockRejectedValueOnce(new Error("temporary upstream failure")),
};

it("syncs every changed submission issue and reports failures", async () => {
  const report = await reconcileIssues(TEST_RECONCILE_DEPS);
  expect(report).toEqual({ scanned: 3, synced: 2, failed: 1 });
  expect(TEST_RECONCILE_DEPS.syncIssue).toHaveBeenCalledTimes(3);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd web; pnpm vitest run src/server/github/reconcile.test.ts`

Expected: FAIL because reconciliation does not exist.

- [ ] **Step 3: Implement bounded pagination and reuse `syncIssue`**

The Octokit-backed `listIssues` requests only Issues carrying `submission`, orders by `updated`, uses exactly 100 Issues per page, and filters out pull requests. Stop before processing an Issue when `updatedAt < since`, or after an empty page. Feed each normalized Issue into the same idempotent state service used by webhooks with delivery ID `reconcile:<issue number>:<updatedAt>`. Continue after individual failures, return counts and safe error categories, and never print Issue bodies.

- [ ] **Step 4: Add and verify the CLI entry point**

Add `"reconcile:github": "tsx scripts/reconcile-github.ts"` and install `tsx` as a development dependency. At startup, capture `startedAt`, read cursor `github-issues`, and use the Unix epoch on the first run so no older pending Issue is skipped. Update the cursor to `startedAt` only after a full scan with `failed === 0`; otherwise leave it unchanged for the next ten-minute run. All writes remain idempotent. The process exits nonzero when `failed > 0`.

Run: `cd web; pnpm vitest run src/server/github/reconcile.test.ts; pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit only if explicitly authorized**

```powershell
git add web/scripts web/src/server/db/client.ts web/src/server/github/reconcile.ts web/src/server/github/reconcile.test.ts web/package.json web/pnpm-lock.yaml
git commit -m "feat(moderation): reconcile missed github events"
```

### Task 8: Replace Fixtures and Verify the Full Content Flow

**Files:**
- Modify: `web/src/features/content/repository.ts`
- Create: `web/src/features/search/components/GlobalSearch.tsx`
- Create: `web/src/app/api/search/route.ts`
- Modify: `web/src/features/map/components/MapHud.tsx`
- Modify: `web/src/app/regions/[slug]/page.tsx`
- Modify: `web/src/app/content/[id]/page.tsx`
- Create: `web/e2e/submission-moderation.spec.ts`
- Create: `web/e2e/support/fake-github-server.ts`
- Test: `web/src/server/content/search.test.ts`

**Interfaces:**
- Consumes: SQLite repository, submission schemas, GitHub queue, and sync service.
- Produces: real global and territory search plus the complete anonymous moderation loop.
- Produces: `SearchGroup = { regionSlug: string; items: readonly ContentSummary[] }` and `searchAll(repository: ContentRepository, query: string): Promise<readonly SearchGroup[]>`.
- Produces: `GET /api/search?q=<query>` returning `{ groups: readonly SearchGroup[] }` in `REGIONS` order.

- [ ] **Step 1: Write failing search and end-to-end tests**

```ts
const summary = (id: string, regionSlug: string, title: string): ContentSummary => ({
  id,
  regionSlug,
  title,
  summary: null,
  nickname: null,
  tags: ["Redis"],
  publishedAt: "2026-09-01T08:00:00.000Z",
  metadata: {},
});
const repository: ContentRepository = {
  get: vi.fn().mockResolvedValue(null),
  stats: vi.fn().mockResolvedValue({ totalPublished: 2, recentPublished: 2 }),
  list: vi.fn(async ({ regionSlug }) => ({
    items: regionSlug === "interview"
      ? [summary("gh-1", "interview", "Redis 面经")]
      : regionSlug === "fundamentals"
        ? [summary("gh-2", "fundamentals", "Redis 持久化")]
        : [],
    page: 1,
    pageSize: 20,
    total: regionSlug === "interview" || regionSlug === "fundamentals" ? 1 : 0,
  })),
};

it("groups global results by territory", async () => {
  const results = await searchAll(repository, "Redis");
  expect(results.map((group) => group.regionSlug)).toEqual(["interview", "fundamentals"]);
});
```

```ts
const TEST_WEBHOOK_KEY = "local-e2e-only-key";

async function fillInterviewForm(page: Page) {
  await page.getByLabel("公司/部门").fill("字节跳动/基础架构");
  await page.getByLabel("岗位").fill("后端开发");
  await page.getByLabel("标签").fill("一面");
  await page.getByLabel("Markdown 正文").fill("面试记录");
  await expect(page.getByText("验证完成")).toBeVisible();
}

async function approveQueuedIssueThroughTestWebhook(request: APIRequestContext) {
  const latest = await request.get("http://127.0.0.1:4010/__test/issues/latest");
  const issue = await latest.json();
  const rawBody = JSON.stringify({
    action: "labeled",
    label: { name: "approved" },
    issue: { ...issue, labels: [...issue.labels, { name: "approved" }] },
  });
  const signature = `sha256=${createHmac("sha256", TEST_WEBHOOK_KEY).update(rawBody).digest("hex")}`;
  const response = await request.post("/api/github/webhook", {
    data: rawBody,
    headers: {
      "content-type": "application/json",
      "x-github-delivery": "e2e-delivery-1",
      "x-github-event": "issues",
      "x-hub-signature-256": signature,
    },
  });
  expect(response.ok()).toBe(true);
}

test("anonymous submission becomes public only after approval", async ({ page, request }) => {
  await page.goto("/submit/interview");
  await fillInterviewForm(page);
  await page.getByRole("button", { name: "提交审核" }).click();
  await expect(page).toHaveURL(/\/submitted$/);
  await approveQueuedIssueThroughTestWebhook(request);
  await page.goto("/regions/interview");
  await expect(page.getByText("字节跳动/基础架构 · 后端开发")).toBeVisible();
});
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `cd web; pnpm vitest run src/server/content/search.test.ts; pnpm exec playwright test e2e/submission-moderation.spec.ts`

Expected: FAIL while the application still uses fixtures.

- [ ] **Step 3: Switch the repository provider to SQLite**

Create one server-only repository per process, initialized from validated `SQLITE_PATH`. Keep the fixture adapter available only to unit tests. Implement global search grouped by configured territory order and territory search with allowed filter keys from `REGIONS`; reject unknown query keys with 400, clamp `page` to integers ≥1, and keep `pageSize` fixed at 20. `GET /api/search` returns only published summaries and sets no private cache headers.

- [ ] **Step 4: Wire the HUD search overlay and real content pages**

The HUD search opens a keyboard-accessible dialog, uses a small `useDeferredValue`-based query state (no hand-rolled timer), calls `/api/search` only through `@/utils/request`, and links each result directly to `/content/[id]`. Territory pages submit only allowed query parameters and show a clear empty state with a reset-filters action.

`fake-github-server.ts` listens only on `127.0.0.1:4010`, implements the Issue create/update endpoints used by Octokit, stores records in memory, and exposes `GET /__test/issues/latest` only in that test process. Configure Playwright `webServer` entries to start it and the Next.js app with a temporary SQLite path, `GITHUB_API_BASE_URL=http://127.0.0.1:4010`, the literal test-only HMAC key above, and ALTCHA work factor `1` so the real browser widget reaches its visible “验证完成” state quickly. The test does not bypass production challenge verification. Add equivalent submit cases for resources, fundamentals, projects, and algorithms, plus rejection, withdrawal, duplicate delivery, and a failed upstream response that preserves form fields.

- [ ] **Step 5: Run the complete Plan 2 gate**

Run: `cd web; pnpm lint; pnpm typecheck; pnpm test --run; pnpm exec playwright test; pnpm build`

Expected: all commands exit 0, with GitHub calls mocked and SQLite isolated to test databases.

- [ ] **Step 6: Commit only if explicitly authorized**

```powershell
git add web
git commit -m "feat(content): complete moderated knowledge platform"
```

## Plan 2 Completion Gate

- All five territory forms create private, labeled GitHub Issues without exposing repository details.
- Only signed, approved events create public records; rejection, withdrawal, republishing, duplicates, and missed webhooks are deterministic.
- Public search, filters, dossiers, Markdown, external links, and anonymous error paths satisfy the spec.
- Lint, typecheck, unit/component tests, Playwright, and production build all pass without real external mutations.
