import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, expect, it, vi } from "vitest";
import type { FullResult } from "@playwright/test/reporter";

import RunDirectoryCleanupReporter from "../../e2e/support/run-directory-cleanup-reporter";
import { initializeRunDirectory } from "../../e2e/support/run-directory-ownership";

const RUN_DIRECTORY_ENV = "KNOWLEDGE_FRONTIER_E2E_RUN_DIRECTORY";
const OWNERSHIP_TOKEN_ENV = "KNOWLEDGE_FRONTIER_E2E_OWNERSHIP_TOKEN";
const RUN_DIRECTORY_PREFIX = "knowledge-frontier-playwright-";
const OWNERSHIP_SENTINEL = ".knowledge-frontier-playwright-owner";
const originalExitCode = process.exitCode;
const testDirectories = new Set<string>();

afterEach(() => {
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();

  for (const directory of testDirectories) {
    if (existsSync(directory)) rmSync(directory, { recursive: true, force: true });
  }
  testDirectories.clear();
});

it("does not delete a prefix-shaped temp directory without matching ownership", async () => {
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  const externalDirectory = mkdtempSync(join(tmpdir(), RUN_DIRECTORY_PREFIX));
  const preservedFile = join(externalDirectory, "keep.txt");
  testDirectories.add(externalDirectory);
  writeFileSync(preservedFile, "preserve me", "utf8");
  writeFileSync(
    join(externalDirectory, OWNERSHIP_SENTINEL),
    "a".repeat(64),
    "utf8",
  );

  const options = {
    e2eRunDirectory: externalDirectory,
    ownershipToken: "b".repeat(64),
  };
  const reporter = new RunDirectoryCleanupReporter(options);
  const result = await reporter.onEnd({ status: "passed" } as FullResult);

  expect(result).toEqual({ status: "failed" });
  expect(readFileSync(preservedFile, "utf8")).toBe("preserve me");
});

it("does not adopt an externally supplied prefix-shaped directory", async () => {
  const externalDirectory = mkdtempSync(join(tmpdir(), RUN_DIRECTORY_PREFIX));
  const preservedFile = join(externalDirectory, "keep.txt");
  testDirectories.add(externalDirectory);
  writeFileSync(preservedFile, "preserve me", "utf8");
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    [RUN_DIRECTORY_ENV]: externalDirectory,
  };
  delete environment[OWNERSHIP_TOKEN_ENV];

  const configured = initializeRunDirectory(environment);
  testDirectories.add(configured.e2eRunDirectory);

  expect(configured.e2eRunDirectory).not.toBe(externalDirectory);
  expect(readFileSync(preservedFile, "utf8")).toBe("preserve me");
});

it("reuses a token-owned directory across config reloads and then cleans it", async () => {
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const environment: NodeJS.ProcessEnv = { ...process.env };
  delete environment[RUN_DIRECTORY_ENV];
  delete environment[OWNERSHIP_TOKEN_ENV];
  const firstLoad = initializeRunDirectory(environment);
  const runDirectory = firstLoad.e2eRunDirectory;
  const ownershipToken = firstLoad.ownershipToken;
  expect(ownershipToken).toMatch(/^[a-f0-9]{64}$/);
  testDirectories.add(runDirectory);

  const sentinelPath = join(runDirectory, OWNERSHIP_SENTINEL);
  const sentinel = lstatSync(sentinelPath);
  expect(sentinel.isFile()).toBe(true);
  expect(sentinel.isSymbolicLink()).toBe(false);
  expect(readFileSync(sentinelPath, "utf8")).toBe(ownershipToken);

  const reloaded = initializeRunDirectory(environment);
  expect(reloaded).toEqual(firstLoad);
  expect(environment[RUN_DIRECTORY_ENV]).toBe(runDirectory);
  expect(environment[OWNERSHIP_TOKEN_ENV]).toBe(ownershipToken);

  const reporter = new RunDirectoryCleanupReporter({
    e2eRunDirectory: runDirectory,
    ownershipToken,
  });
  const result = await reporter.onEnd({ status: "passed" } as FullResult);

  expect(result).toBeUndefined();
  expect(existsSync(runDirectory)).toBe(false);
  testDirectories.delete(runDirectory);
});
