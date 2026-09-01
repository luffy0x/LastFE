import { defineConfig, devices } from "@playwright/test";
import { join } from "node:path";
import { tmpdir } from "node:os";

const e2eDatabasePath = join(
  tmpdir(),
  `knowledge-frontier-playwright-${process.pid}.sqlite`,
);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  expect: {
    timeout: 15_000,
  },
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3000",
    extraHTTPHeaders: { "x-real-ip": "127.0.0.1" },
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      name: "Fake GitHub",
      command: "pnpm exec tsx e2e/support/fake-github-server.ts",
      url: "http://127.0.0.1:4010/__test/health",
      reuseExistingServer: false,
    },
    {
      name: "Next.js",
      command: "pnpm dev --hostname 127.0.0.1",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: false,
      env: {
        ALTCHA_HMAC_KEY: "local-e2e-altcha-key",
        ALTCHA_MAX_NUMBER: "1",
        GITHUB_API_BASE_URL: "http://127.0.0.1:4010",
        GITHUB_OWNER: "local-e2e-owner",
        GITHUB_REPO: "local-e2e-private-repository",
        GITHUB_TOKEN: "local-e2e-only-token",
        GITHUB_WEBHOOK_SECRET: "local-e2e-only-key",
        INTERNAL_APP_ORIGIN: "http://127.0.0.1:3000",
        NEXT_DIST_DIR: ".next-e2e",
        RATE_LIMIT_HMAC_KEY: "local-e2e-rate-limit-key",
        SQLITE_PATH: e2eDatabasePath,
      },
    },
  ],
});
