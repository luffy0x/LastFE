import { randomBytes } from "node:crypto";
import {
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

export const RUN_DIRECTORY_ENV = "KNOWLEDGE_FRONTIER_E2E_RUN_DIRECTORY";
export const OWNERSHIP_TOKEN_ENV =
  "KNOWLEDGE_FRONTIER_E2E_OWNERSHIP_TOKEN";
export const RUN_DIRECTORY_PREFIX = "knowledge-frontier-playwright-";
export const OWNERSHIP_SENTINEL = ".knowledge-frontier-playwright-owner";

export type OwnedRunDirectory = {
  e2eRunDirectory: string;
  ownershipToken: string;
};

function hasExpectedPathShape(runDirectory: string): boolean {
  const resolvedDirectory = resolve(runDirectory);
  return (
    dirname(resolvedDirectory) === resolve(tmpdir()) &&
    basename(resolvedDirectory).startsWith(RUN_DIRECTORY_PREFIX)
  );
}

export function hasRunDirectoryOwnership(
  runDirectory: string | undefined,
  ownershipToken: string | undefined,
): boolean {
  if (
    !runDirectory ||
    !ownershipToken ||
    !/^[a-f0-9]{64}$/.test(ownershipToken) ||
    !hasExpectedPathShape(runDirectory)
  ) {
    return false;
  }

  try {
    const directory = lstatSync(resolve(runDirectory));
    const sentinelPath = join(resolve(runDirectory), OWNERSHIP_SENTINEL);
    const sentinel = lstatSync(sentinelPath);
    return (
      directory.isDirectory() &&
      !directory.isSymbolicLink() &&
      sentinel.isFile() &&
      !sentinel.isSymbolicLink() &&
      sentinel.size === 64 &&
      readFileSync(sentinelPath, "utf8") === ownershipToken
    );
  } catch {
    return false;
  }
}

export function initializeRunDirectory(
  environment: NodeJS.ProcessEnv = process.env,
): OwnedRunDirectory {
  const inheritedRunDirectory = environment[RUN_DIRECTORY_ENV];
  const inheritedOwnershipToken = environment[OWNERSHIP_TOKEN_ENV];
  if (
    hasRunDirectoryOwnership(
      inheritedRunDirectory,
      inheritedOwnershipToken,
    )
  ) {
    return {
      e2eRunDirectory: resolve(inheritedRunDirectory!),
      ownershipToken: inheritedOwnershipToken!,
    };
  }

  const e2eRunDirectory = mkdtempSync(join(tmpdir(), RUN_DIRECTORY_PREFIX));
  const ownershipToken = randomBytes(32).toString("hex");
  try {
    writeFileSync(
      join(e2eRunDirectory, OWNERSHIP_SENTINEL),
      ownershipToken,
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );
  } catch (error) {
    rmSync(e2eRunDirectory, { recursive: true, force: true });
    throw error;
  }

  environment[RUN_DIRECTORY_ENV] = e2eRunDirectory;
  environment[OWNERSHIP_TOKEN_ENV] = ownershipToken;
  return { e2eRunDirectory, ownershipToken };
}
