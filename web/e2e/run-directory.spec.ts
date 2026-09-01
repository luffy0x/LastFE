import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";

import { expect, test } from "@playwright/test";

test("stores SQLite inside a uniquely owned Playwright run directory", async ({
  request,
}) => {
  const runDirectory = process.env.KNOWLEDGE_FRONTIER_E2E_RUN_DIRECTORY;
  const databasePath = process.env.SQLITE_PATH;

  expect(runDirectory).toBeTruthy();
  expect(databasePath).toBeTruthy();
  expect(dirname(resolve(databasePath!))).toBe(resolve(runDirectory!));
  expect(dirname(resolve(runDirectory!))).toBe(resolve(tmpdir()));
  expect(runDirectory).toMatch(/knowledge-frontier-playwright-[^\\/]+$/);

  const response = await request.get("/");
  expect(response.ok()).toBe(true);
  await expect.poll(() => existsSync(databasePath!)).toBe(true);
});
