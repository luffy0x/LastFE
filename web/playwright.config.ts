import { defineConfig, devices } from "@playwright/test";

import { initializeRunDirectory } from "./e2e/support/run-directory-ownership";

const { e2eRunDirectory, ownershipToken } = initializeRunDirectory();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  expect: {
    timeout: 15_000,
  },
  reporter: [
    ["line"],
    ["html"],
    [
      "./e2e/support/run-directory-cleanup-reporter.ts",
      { e2eRunDirectory, ownershipToken },
    ],
  ],
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
        CONTENT_REPOSITORY: "fixture",
        GITHUB_API_BASE_URL: "http://127.0.0.1:4010",
        GITHUB_REPOSITORY: "local-e2e-owner/local-e2e-private-repository",
        GITHUB_TOKEN: "local-e2e-only-token",
        GITHUB_WEBHOOK_SECRET: "local-e2e-only-key",
        NEXT_DIST_DIR: ".next-e2e",
      },
    },
  ],
});
