import { existsSync, lstatSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { expect, test } from "@playwright/test";

test("stores SQLite inside a uniquely owned Playwright run directory", async ({
  request,
}) => {
  const runDirectory = process.env.KNOWLEDGE_FRONTIER_E2E_RUN_DIRECTORY;
  const ownershipToken =
    process.env.KNOWLEDGE_FRONTIER_E2E_OWNERSHIP_TOKEN;
  const databasePath = process.env.SQLITE_PATH;

  expect(runDirectory).toBeTruthy();
  expect(ownershipToken).toMatch(/^[a-f0-9]{64}$/);
  expect(databasePath).toBeTruthy();
  expect(dirname(resolve(databasePath!))).toBe(resolve(runDirectory!));
  expect(dirname(resolve(runDirectory!))).toBe(resolve(tmpdir()));
  expect(runDirectory).toMatch(/knowledge-frontier-playwright-[^\\/]+$/);
  const sentinelPath = join(
    runDirectory!,
    ".knowledge-frontier-playwright-owner",
  );
  const sentinel = lstatSync(sentinelPath);
  expect(sentinel.isFile()).toBe(true);
  expect(sentinel.isSymbolicLink()).toBe(false);
  expect(readFileSync(sentinelPath, "utf8")).toBe(ownershipToken);

  const response = await request.get("/");
  expect(response.ok()).toBe(true);
  await expect.poll(() => existsSync(databasePath!)).toBe(true);
});
