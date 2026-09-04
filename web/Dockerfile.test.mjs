import assert from "node:assert/strict";
import fs from "node:fs";

const dockerfile = fs.readFileSync(new URL("./Dockerfile", import.meta.url), "utf8");
const healthcheck = fs.readFileSync(new URL("./healthcheck.mjs", import.meta.url), "utf8");

assert.match(
  dockerfile,
  /^FROM node:24\.14\.1-bookworm-slim@sha256:b506e7321f176aae77317f99d67a24b272c1f09f1d10f1761f2773447d8da26c AS base$/m,
);
assert.match(dockerfile, /FROM .* AS app/);
assert.match(dockerfile, /FROM .* AS maintenance/);
assert.match(dockerfile, /COPY .*healthcheck\.mjs/);
assert.match(healthcheck, /\/api\/health/);
assert.doesNotMatch(dockerfile, /GITHUB_TOKEN|WEBHOOK_SECRET|SUPABASE_SERVICE_ROLE_KEY/);
assert.doesNotMatch(dockerfile, /better-sqlite3|sqlite3|VOLUME \["\/data/);
assert.doesNotMatch(dockerfile, /pnpm test --run/);
assert.match(dockerfile, /ENV COREPACK_HOME="\/corepack"/);
assert.match(dockerfile, /chown --recursive 1001:1001 "\$COREPACK_HOME"/);

const maintenance = dockerfile.slice(dockerfile.indexOf("FROM base AS maintenance"));
assert.match(maintenance, /ENV NODE_ENV=production/);
assert.match(maintenance, /CMD \["pnpm", "reconcile:github"\]/);
