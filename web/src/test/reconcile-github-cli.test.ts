import { spawnSync } from "node:child_process";

import { expect, it } from "vitest";

it(
  "starts the real reconciliation command and reaches a controlled configuration boundary",
  () => {
    const executable =
      process.platform === "win32"
        ? (process.env.ComSpec ?? "cmd.exe")
        : "pnpm";
    const args =
      process.platform === "win32"
        ? ["/d", "/s", "/c", "pnpm reconcile:github"]
        : ["reconcile:github"];
    const result = spawnSync(executable, args, {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 20_000,
      env: {
        ...process.env,
        NODE_ENV: "test",
        GITHUB_TOKEN: "test-token",
        GITHUB_OWNER: "test-owner",
        GITHUB_REPO: "test-repository",
        GITHUB_WEBHOOK_SECRET: "test-webhook-secret",
        ALTCHA_HMAC_KEY: "test-altcha-key",
        RATE_LIMIT_HMAC_KEY: "test-rate-limit-key",
        SQLITE_PATH: ":memory:",
        INTERNAL_APP_ORIGIN: "",
        GITHUB_API_BASE_URL: "",
      },
    });
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

    expect(result.status).toBe(1);
    expect(output).toContain("GitHub reconciliation failed.");
    expect(output).not.toContain("server-only");
    expect(output).not.toContain("test-token");
  },
  30_000,
);
