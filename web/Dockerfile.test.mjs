import assert from "node:assert/strict";
import fs from "node:fs";

const dockerfile = fs.readFileSync(new URL("./Dockerfile", import.meta.url), "utf8");
const healthcheck = fs.readFileSync(new URL("./healthcheck.mjs", import.meta.url), "utf8");

assert.match(
  dockerfile,
  /^FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS base$/m,
);
assert.match(dockerfile, /FROM .* AS app/);
assert.match(dockerfile, /FROM .* AS maintenance/);
assert.match(dockerfile, /COPY .*healthcheck\.mjs/);
assert.match(healthcheck, /\/api\/health/);
assert.doesNotMatch(dockerfile, /GITHUB_TOKEN|WEBHOOK_SECRET|ALTCHA_HMAC_KEY/);
assert.match(dockerfile, /ENV COREPACK_HOME="\/corepack"/);
assert.match(dockerfile, /chown --recursive 1001:1001 "\$COREPACK_HOME"/);

const maintenance = dockerfile.slice(dockerfile.indexOf("FROM base AS maintenance"));
assert.match(maintenance, /ENV NODE_ENV=production/);
