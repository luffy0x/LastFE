import assert from "node:assert/strict";
import fs from "node:fs";

const dockerfile = fs.readFileSync(new URL("./Dockerfile", import.meta.url), "utf8");
const healthcheck = fs.readFileSync(new URL("./healthcheck.mjs", import.meta.url), "utf8");

assert.match(dockerfile, /FROM .* AS app/);
assert.match(dockerfile, /FROM .* AS maintenance/);
assert.match(dockerfile, /COPY .*healthcheck\.mjs/);
assert.match(healthcheck, /\/api\/health/);
assert.doesNotMatch(dockerfile, /GITHUB_TOKEN|WEBHOOK_SECRET|ALTCHA_HMAC_KEY/);
