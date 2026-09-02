import { spawnSync } from "node:child_process";
import path from "node:path";

import { expect, it } from "vitest";

const runReconciliationCli = (
  environment: NodeJS.ProcessEnv,
): ReturnType<typeof spawnSync> => {
  const executable =
    process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "pnpm";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "pnpm reconcile:github"]
      : ["reconcile:github"];

  return spawnSync(executable, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 20_000,
    env: environment,
  });
};

const outputFrom = (result: ReturnType<typeof spawnSync>): string =>
  `${result.stdout ?? ""}${result.stderr ?? ""}`;

const expectStructuredFailure = (output: string): void => {
  const logLine = output
    .split(/\r?\n/)
    .find((line) => line.startsWith('{"requestId":'));

  expect(logLine).toBeDefined();
  expect(JSON.parse(logLine!)).toMatchObject({
    level: "error",
    event: "github.reconciliation.failed",
    errorCategory: "reconciliation",
    requestId: expect.any(String),
  });
};

it(
  "starts the real reconciliation command and reaches a controlled configuration boundary",
  () => {
    const result = runReconciliationCli({
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
    });
    const output = outputFrom(result);

    expect(result.status).toBe(1);
    expectStructuredFailure(output);
    expect(output).not.toContain("server-only");
    expect(output).not.toContain("test-token");
  },
  30_000,
);

it(
  "redacts configuration initialization failures from the real CLI",
  () => {
    const result = runReconciliationCli({
      ...process.env,
      NODE_ENV: "test",
      GITHUB_TOKEN: "",
    });
    const output = outputFrom(result);

    expect(result.status).toBe(1);
    expectStructuredFailure(output);
    expect(output).not.toContain("GITHUB_TOKEN is required");
    expect(output).not.toContain(process.cwd());
  },
  30_000,
);

it(
  "redacts database initialization diagnostics and paths from the real CLI",
  () => {
    const privatePathMarker = path.join(
      process.cwd(),
      "private-path-marker",
      "missing",
      "database.db",
    );
    const result = runReconciliationCli({
      ...process.env,
      NODE_ENV: "test",
      GITHUB_TOKEN: "test-token",
      GITHUB_OWNER: "test-owner",
      GITHUB_REPO: "test-repository",
      GITHUB_WEBHOOK_SECRET: "test-webhook-secret",
      ALTCHA_HMAC_KEY: "test-altcha-key",
      RATE_LIMIT_HMAC_KEY: "test-rate-limit-key",
      SQLITE_PATH: privatePathMarker,
      INTERNAL_APP_ORIGIN: "http://127.0.0.1:3000",
      GITHUB_API_BASE_URL: "",
    });
    const output = outputFrom(result);

    expect(result.status).toBe(1);
    expectStructuredFailure(output);
    expect(output).not.toContain("Cannot open database");
    expect(output).not.toContain(privatePathMarker);
    expect(output).not.toContain(process.cwd());
  },
  30_000,
);
