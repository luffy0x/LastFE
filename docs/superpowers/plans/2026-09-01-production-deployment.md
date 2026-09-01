# Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the completed knowledge-map application for repeatable Linux/amd64 deployment on the California server with HTTPS proxying, health checks, reconciliation scheduling, safe backups, CI, and a verified rollback runbook.

**Architecture:** Docker Compose runs the Next.js application behind Nginx with a persistent SQLite directory. A maintenance image executes reconciliation and backup commands from systemd timers, while CI builds and tests without production credentials or external mutations.

**Tech Stack:** Docker BuildKit, Docker Compose, Linux/amd64, Node.js LTS, pnpm, Next.js, Nginx, SQLite CLI, systemd timers, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-01-interview-resource-sharing-design.md`

## Global Constraints

- Complete the Career Map Experience and Content and Moderation Platform plans first; this plan packages and operates their verified application.
- Production target is one Linux/amd64 server in California.
- Nginx terminates HTTPS, compresses responses, caches immutable assets, and rate-limits anonymous submissions.
- SQLite data, logs, and backups live outside container writable layers.
- Backups run daily and retain 14 days; a restore drill is required before launch.
- GitHub reconciliation runs every 10 minutes.
- No production secret appears in source, image layers, Compose YAML, logs, tests, or examples.
- Deployment, DNS, TLS issuance, production database writes, and traffic changes require explicit user authorization before execution.
- Do not overwrite stable image tags or create git commits without explicit user authorization.

## File Structure

```text
compose.yaml                                  Production service topology
web/Dockerfile                               linux/amd64 app and maintenance targets
web/healthcheck.mjs                          Container-local HTTP health probe
web/next.config.ts                           Standalone production output
web/src/app/api/health/route.ts              Safe application and database health
web/src/server/logging.ts                    Structured redacted logger
deploy/nginx/nginx.conf                      Nginx process configuration
deploy/nginx/conf.d/site.conf.template       Proxy, cache, security, and rate rules
deploy/systemd/knowledge-reconcile.service   One-shot reconciliation unit
deploy/systemd/knowledge-reconcile.timer     Ten-minute timer
deploy/systemd/knowledge-backup.service      One-shot SQLite backup unit
deploy/systemd/knowledge-backup.timer        Daily timer
deploy/scripts/backup-sqlite.sh              Consistent backup and retention
deploy/scripts/verify-restore.sh              Non-destructive restore drill
deploy/.env.example                          Non-secret variable names
docs/operations.md                           Deploy, rollback, backup, and incident runbook
.github/workflows/ci.yml                     Build and test gate
```

---

### Task 1: Add Health Checks and Redacted Structured Logging

**Files:**
- Create: `web/src/app/api/health/route.ts`
- Create: `web/src/server/logging.ts`
- Modify: `web/src/app/api/submissions/route.ts`
- Modify: `web/src/app/api/github/webhook/route.ts`
- Modify: `web/scripts/reconcile-github.ts`
- Test: `web/src/app/api/health/route.test.ts`
- Test: `web/src/server/logging.test.ts`
- Modify: `web/src/app/api/submissions/route.test.ts`
- Modify: `web/src/app/api/github/webhook/route.test.ts`

**Interfaces:**
- Produces: `GET /api/health` returning status only, with no configuration values.
- Produces: `log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>): void` that emits one JSON line and redacts sensitive keys recursively.
- Produces: `createHealthHandler({ probeDatabase, probeDataDirectory, log }): () => Promise<Response>` for isolated tests; production `GET` uses real probes.

- [ ] **Step 1: Write failing health and redaction tests**

```ts
it("reports healthy without exposing paths or secrets", async () => {
  const GET = createHealthHandler({
    probeDatabase: vi.fn().mockResolvedValue(undefined),
    probeDataDirectory: vi.fn().mockResolvedValue(undefined),
    log: vi.fn(),
  });
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});

it("redacts sensitive fields", () => {
  expect(redact({ token: "secret", nested: { cookie: "secret", code: "UPSTREAM" } })).toEqual({
    token: "[REDACTED]", nested: { cookie: "[REDACTED]", code: "UPSTREAM" },
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `cd web; pnpm vitest run src/app/api/health/route.test.ts src/server/logging.test.ts`

Expected: FAIL because the health route and logger do not exist.

- [ ] **Step 3: Implement health probes and logging**

The database probe performs `SELECT 1`, begins an immediate transaction, creates and drops a temporary probe table, and rolls back; the directory probe creates an exclusively named zero-byte file beside the configured SQLite file and removes it in `finally`. It must never alter content rows. Return `{ "status": "ok" }` with 200 or `{ "status": "unhealthy" }` with 503; log only a request ID and error category. Redact keys matching `token`, `secret`, `password`, `authorization`, `cookie`, `body`, `markdown`, and `ip`, case-insensitively.

Replace direct console logging in the submission route, webhook route, and reconciliation CLI with `log`. Each event includes `requestId`, `event`, and `errorCategory` when applicable; moderation events may include the numeric Issue number but never its title or body. Accept an incoming request ID only when it matches `^[A-Za-z0-9._-]{1,64}$`; otherwise generate `crypto.randomUUID()`.

- [ ] **Step 4: Verify behavior**

Run: `cd web; pnpm vitest run src/app/api/health/route.test.ts src/server/logging.test.ts; pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit only if explicitly authorized**

```powershell
git add web/src/app/api/health web/src/app/api/submissions/route.ts web/src/app/api/github/webhook/route.ts web/scripts/reconcile-github.ts web/src/server/logging.ts web/src/server/logging.test.ts
git commit -m "feat(ops): add safe health and logging"
```

### Task 2: Build Linux/amd64 Application and Maintenance Images

**Files:**
- Create: `web/Dockerfile`
- Create: `web/healthcheck.mjs`
- Modify: `web/next.config.ts`
- Create: `compose.yaml`
- Create: `deploy/.env.example`
- Test: `web/Dockerfile.test.mjs`

**Interfaces:**
- Produces: `app` image target serving Next.js on port 3000.
- Produces: `maintenance` target with reconciliation code and SQLite CLI.
- Produces: Compose services `app`, `nginx`, and profile-gated `maintenance`.

- [ ] **Step 1: Write a failing static Dockerfile test**

```js
import assert from "node:assert/strict";
import fs from "node:fs";
const dockerfile = fs.readFileSync(new URL("./Dockerfile", import.meta.url), "utf8");
const healthcheck = fs.readFileSync(new URL("./healthcheck.mjs", import.meta.url), "utf8");
assert.match(dockerfile, /FROM .* AS app/);
assert.match(dockerfile, /FROM .* AS maintenance/);
assert.match(dockerfile, /COPY .*healthcheck\.mjs/);
assert.match(healthcheck, /\/api\/health/);
assert.doesNotMatch(dockerfile, /GITHUB_TOKEN|WEBHOOK_SECRET|ALTCHA_HMAC_KEY/);
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node web/Dockerfile.test.mjs`

Expected: FAIL because the Dockerfile does not exist.

- [ ] **Step 3: Implement a multi-stage Dockerfile**

Use pnpm's lockfile with `--frozen-lockfile`, run lint/typecheck/tests before the build stage, and set Next.js `output: "standalone"`. The `app` target copies only standalone output, static assets, public files, the native SQLite binding, and `healthcheck.mjs`. The `maintenance` target includes the application dependencies needed by `pnpm reconcile:github` plus the `sqlite3` CLI. Both run as an unprivileged user and declare `/data` as the SQLite volume mount.

Create this dependency-free probe; any fetch, timeout, HTTP, JSON, or status failure exits nonzero:

```js
// web/healthcheck.mjs
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 4_000);
try {
  const response = await fetch("http://127.0.0.1:3000/api/health", { signal: controller.signal });
  const body = await response.json();
  if (!response.ok || body.status !== "ok") process.exitCode = 1;
} catch {
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
```

- [ ] **Step 4: Define Compose without embedded secrets**

```yaml
services:
  app:
    build:
      context: ./web
      target: app
    env_file: ${APP_ENV_FILE:-./deploy/.env.example}
    volumes:
      - /srv/knowledge-frontier/data:/data
    expose: ["3000"]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "healthcheck.mjs"]
      interval: 30s
      timeout: 5s
      retries: 3
  nginx:
    image: nginx:alpine
    depends_on:
      app:
        condition: service_healthy
    ports: ["80:80", "443:443"]
    volumes:
      - ./deploy/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./deploy/nginx/conf.d/site.conf.template:/etc/nginx/templates/default.conf.template:ro
      - ${TLS_CERT_DIR:-./deploy/nginx/dev-certs}:/etc/nginx/tls:ro
    environment:
      TLS_CERT_PATH: /etc/nginx/tls/fullchain.pem
      TLS_KEY_PATH: /etc/nginx/tls/privkey.pem
    restart: unless-stopped
  maintenance:
    profiles: ["maintenance"]
    build:
      context: ./web
      target: maintenance
    env_file: ${APP_ENV_FILE:-./deploy/.env.example}
    volumes:
      - /srv/knowledge-frontier/data:/data
      - /srv/knowledge-frontier/backups:/backups
      - ./deploy/scripts:/opt/knowledge-frontier/scripts:ro
```

The production host sets `APP_ENV_FILE=/etc/knowledge-frontier/app.env` and `TLS_CERT_DIR` to the real certificate directory; the repository defaults exist only so `docker compose config` works without production files. `deploy/.env.example` contains exactly these empty assignments: `SQLITE_PATH=`, `GITHUB_TOKEN=`, `GITHUB_OWNER=`, `GITHUB_REPO=`, `GITHUB_WEBHOOK_SECRET=`, `ALTCHA_HMAC_KEY=`, `ALTCHA_MAX_NUMBER=`, `RATE_LIMIT_HMAC_KEY=`, `PUBLIC_BASE_URL=`, and `BACKUP_DIR=`. The application and maintenance services are not published on host ports.

- [ ] **Step 5: Build and inspect images locally**

Run: `node web/Dockerfile.test.mjs; docker compose config; docker buildx build --platform linux/amd64 --target app --load -t knowledge-frontier:test ./web`

Expected: commands exit 0; `docker history knowledge-frontier:test` contains no secret values.

- [ ] **Step 6: Commit only if explicitly authorized**

```powershell
git add web/Dockerfile web/Dockerfile.test.mjs web/healthcheck.mjs web/next.config.ts compose.yaml deploy/.env.example
git commit -m "build: package application containers"
```

### Task 3: Configure Nginx for HTTPS, Caching, and Submission Limits

**Files:**
- Create: `deploy/nginx/nginx.conf`
- Create: `deploy/nginx/conf.d/site.conf.template`
- Test: `deploy/nginx/test-config.ps1`
- Modify: `compose.yaml`

**Interfaces:**
- Produces: public ports 80/443; only Nginx reaches `app:3000`.
- Produces: `/api/submissions` edge burst protection at 12 requests/minute with burst 5; Plan 2 remains the authority for exactly 10 successful submissions per source hash per hour.
- Guarantees: `/api/github/webhook` is proxied without caching and request bodies are bounded.

- [ ] **Step 1: Write a failing configuration test**

```powershell
$main = Get-Content -Raw -LiteralPath 'deploy/nginx/nginx.conf'
$site = Get-Content -Raw -LiteralPath 'deploy/nginx/conf.d/site.conf.template'
if ($main -notmatch 'limit_req_zone\s+\$binary_remote_addr\s+zone=submissions:10m\s+rate=12r/m') { throw 'missing burst limit zone' }
if ($site -notmatch 'location = /api/submissions') { throw 'missing submission route' }
if ($site -notmatch 'limit_req\s+zone=submissions\s+burst=5\s+nodelay') { throw 'missing submission burst limit' }
if ($site -notmatch 'proxy_pass http://app:3000') { throw 'missing app upstream' }
if ($site -notmatch 'location = /api/github/webhook') { throw 'missing webhook route' }
if ($site -notmatch 'client_max_body_size 64k') { throw 'missing public body limit' }
if ($site -notmatch 'client_max_body_size 256k') { throw 'missing webhook body limit' }

$nginxRoot = (Resolve-Path -LiteralPath 'deploy/nginx').Path
docker run --rm --entrypoint sh --mount "type=bind,src=$nginxRoot,dst=/work,readonly" nginx:alpine -ec @'
apk add --no-cache openssl >/dev/null
mkdir -p /tmp/tls
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=localhost -keyout /tmp/tls/privkey.pem -out /tmp/tls/fullchain.pem >/dev/null 2>&1
cp /work/nginx.conf /etc/nginx/nginx.conf
TLS_CERT_PATH=/tmp/tls/fullchain.pem TLS_KEY_PATH=/tmp/tls/privkey.pem envsubst '${TLS_CERT_PATH} ${TLS_KEY_PATH}' < /work/conf.d/site.conf.template > /etc/nginx/conf.d/default.conf
nginx -t
'@
if ($LASTEXITCODE -ne 0) { throw 'nginx parser rejected configuration' }
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pwsh -File deploy/nginx/test-config.ps1`

Expected: FAIL because the configuration does not exist.

- [ ] **Step 3: Add explicit proxy and cache rules**

Configure HTTP-to-HTTPS redirect, TLS 1.2/1.3, security headers, gzip, immutable one-year caching for `/_next/static/`, short public caching for map assets, no caching for API routes, and a default `client_max_body_size 64k`. Override the exact webhook location to `client_max_body_size 256k`, matching Plan 2. Overwrite `X-Real-IP` and `X-Forwarded-For` instead of accepting client-supplied values. If a known upstream proxy is later introduced, list its exact CIDR with `set_real_ip_from`; otherwise derive identity from the direct peer address.

Define `limit_req_zone $binary_remote_addr zone=submissions:10m rate=12r/m` in the `http` block and apply `limit_req zone=submissions burst=5 nodelay` only to `/api/submissions`, returning 429 on exhaustion. This protects bursts but deliberately does not claim to count successful requests; the SQLite abuse store enforces the exact 10-success/hour rule. Do not apply this low limit to browsing or GitHub webhooks.

- [ ] **Step 4: Validate with the real Nginx parser**

Run: `pwsh -File deploy/nginx/test-config.ps1`

Expected: syntax is valid and static assertions pass.

- [ ] **Step 5: Commit only if explicitly authorized**

```powershell
git add deploy/nginx compose.yaml
git commit -m "build(proxy): add secure nginx gateway"
```

### Task 4: Add Backup, Restore, and Reconciliation Timers

**Files:**
- Create: `deploy/scripts/backup-sqlite.sh`
- Create: `deploy/scripts/verify-restore.sh`
- Create: `deploy/systemd/knowledge-reconcile.service`
- Create: `deploy/systemd/knowledge-reconcile.timer`
- Create: `deploy/systemd/knowledge-backup.service`
- Create: `deploy/systemd/knowledge-backup.timer`
- Test: `deploy/scripts/test-backup.sh`

**Interfaces:**
- Produces: daily consistent SQLite backup retained for 14 days.
- Produces: non-destructive restore verification into a caller-provided empty directory.
- Produces: reconciliation invocation every 10 minutes.

- [ ] **Step 1: Write a failing backup round-trip test**

```bash
#!/usr/bin/env bash
set -euo pipefail
test_root="$(mktemp -d)"
trap 'rm -rf -- "$test_root"' EXIT
sqlite3 "$test_root/source.db" 'create table probe(value text); insert into probe values("ok");'
SQLITE_PATH="$test_root/source.db" BACKUP_DIR="$test_root/backups" ./deploy/scripts/backup-sqlite.sh
./deploy/scripts/verify-restore.sh "$test_root/backups/$(ls "$test_root/backups" | head -n 1)" "$test_root/restore"
test "$(sqlite3 "$test_root/restore/restored.db" 'select value from probe;')" = "ok"
```

- [ ] **Step 2: Run the test and confirm it fails**

Run from Linux or WSL: `bash deploy/scripts/test-backup.sh`

Expected: FAIL because backup scripts do not exist.

- [ ] **Step 3: Implement safe backup and restore scripts**

`backup-sqlite.sh` must reject an empty `SQLITE_PATH`, reject `/` as `BACKUP_DIR`, create a timestamped `.db.tmp` through SQLite `.backup`, require `PRAGMA integrity_check` to equal `ok`, atomically rename to `.db`, and delete only `*.db` files directly inside the validated backup directory older than 14 days.

`verify-restore.sh` must resolve both arguments with `realpath`, require the backup to be a regular `.db` file, reject `/`, `/srv/knowledge-frontier/data`, and the live database parent as the target, create the target when absent or require it to be empty, copy the backup to `restored.db`, run `PRAGMA integrity_check`, and never replace the live database.

- [ ] **Step 4: Add exact systemd schedules**

`knowledge-reconcile.timer` uses `OnBootSec=2min` and `OnUnitActiveSec=10min`. `knowledge-backup.timer` uses `OnCalendar=*-*-* 03:30:00` with `Persistent=true`. Both services set `WorkingDirectory=/srv/knowledge-frontier/current` and use `Type=oneshot`. Reconciliation runs `docker compose --profile maintenance run --rm maintenance pnpm reconcile:github`; backup runs `docker compose --profile maintenance run --rm maintenance /opt/knowledge-frontier/scripts/backup-sqlite.sh`, using the read-only script mount from Compose. Set `UMask=0077`, bound runtime, and a non-overlapping service lock so reconciliation and backup cannot start duplicate copies.

- [ ] **Step 5: Verify scripts and units without installing them**

Run: `bash deploy/scripts/test-backup.sh; systemd-analyze verify deploy/systemd/*.service deploy/systemd/*.timer`

Expected: backup round-trip passes and systemd reports no unit errors.

- [ ] **Step 6: Commit only if explicitly authorized**

```powershell
git add deploy/scripts deploy/systemd
git commit -m "feat(ops): add reconciliation and sqlite recovery"
```

### Task 5: Add CI and the Operations Runbook

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `docs/operations.md`
- Create: `README.md`

**Interfaces:**
- Produces: pull-request checks for lint, typecheck, unit/component tests, Playwright, and production build.
- Produces: explicit first deploy, verification, rollback, backup, restore, and secret-rotation procedures.

- [ ] **Step 1: Add the CI workflow**

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
          cache-dependency-path: web/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test --run
      - run: pnpm exec playwright test
      - run: pnpm build
```

- [ ] **Step 2: Write the runbook with safe gates**

Document these ordered procedures with copyable commands and expected outputs: prepare `/srv/knowledge-frontier/{data,backups}`, create `/etc/knowledge-frontier/app.env` with mode `0600`, configure DNS/TLS, build a versioned image tag for `linux/amd64`, run `docker compose config`, start services, inspect `/api/health`, submit a synthetic non-sensitive Issue, approve it, verify publication, execute a backup, restore it into a `mktemp -d` directory, and roll back by selecting the prior immutable image tag. Before rollback, compare the target image's supported schema version with `schema_migrations`; if incompatible, restore the pre-deploy backup into a new file and switch `SQLITE_PATH` only after explicit approval. Include post-deploy DNS, TLS, time-to-first-byte, and page-availability checks from at least two independently operated China-mainland probes, while stating that the California-only deployment cannot guarantee cross-border latency.

The runbook must state that DNS changes, certificate issuance, image pushes, service restarts, production database changes, and traffic switching require explicit user approval at execution time.

- [ ] **Step 3: Add a concise README entry point**

Link the design spec, all three implementation plans, local development commands, required environment variable names, and `docs/operations.md`. Do not include example secret values.

- [ ] **Step 4: Run the complete local verification gate**

Run: `cd web; pnpm lint; pnpm typecheck; pnpm test --run; pnpm exec playwright test; pnpm build; cd ..; docker compose config`

Expected: every command exits 0 without production credentials.

- [ ] **Step 5: Commit only if explicitly authorized**

```powershell
git add .github/workflows/ci.yml docs/operations.md README.md
git commit -m "ci: add verification and operations runbook"
```

## Plan 3 Completion Gate

- A Linux/amd64 image builds reproducibly without secrets in layers.
- Nginx validates, only required routes are exposed, and anonymous submissions are rate-limited.
- Reconciliation and backups have verified schedules and a non-destructive restore test.
- CI exercises lint, typecheck, unit/component tests, Playwright, and production build.
- No production deployment or external mutation occurs until the user explicitly authorizes it.
