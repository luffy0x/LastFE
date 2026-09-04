import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Render deployment manifest", () => {
  it("declares the web service, cron reconciliation, and health endpoint", async () => {
    const manifest = await readFile(resolve(process.cwd(), "../render.yaml"), "utf8");

    expect(manifest).toMatch(/type:\s*web/);
    expect(manifest).toMatch(/healthCheckPath:\s*\/api\/health/);
    expect(manifest).toMatch(/type:\s*cron/);
    expect(manifest).toMatch(/pnpm reconcile:github/);
    expect(manifest).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(manifest).toMatch(/RATE_LIMIT_HMAC_KEY/);
  });
});
