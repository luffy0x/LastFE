import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import type { FullResult, Reporter } from "@playwright/test/reporter";

import { hasRunDirectoryOwnership } from "./run-directory-ownership";

export default class RunDirectoryCleanupReporter implements Reporter {
  private readonly runDirectory: string;
  private readonly ownershipToken: string;

  constructor(options: {
    e2eRunDirectory: string;
    ownershipToken: string;
  }) {
    this.runDirectory = resolve(options.e2eRunDirectory);
    this.ownershipToken = options.ownershipToken;
  }

  printsToStdio(): boolean {
    return false;
  }

  async onEnd(
    result: FullResult,
  ): Promise<{ status?: FullResult["status"] } | undefined> {
    if (
      !hasRunDirectoryOwnership(this.runDirectory, this.ownershipToken)
    ) {
      process.exitCode = 1;
      process.stderr.write(
        `[e2e-cleanup] refused unexpected directory: ${this.runDirectory}\n`,
      );
      return { status: "failed" };
    }

    try {
      rmSync(this.runDirectory, {
        recursive: true,
        maxRetries: 10,
        retryDelay: 100,
      });
      if (existsSync(this.runDirectory)) {
        throw new Error("run directory still exists");
      }
      process.stdout.write(
        `[e2e-cleanup] verified removal: ${this.runDirectory}\n`,
      );
    } catch {
      process.exitCode = 1;
      process.stderr.write(
        `[e2e-cleanup] failed to remove: ${this.runDirectory}\n`,
      );
      return { status: "failed" };
    }

    return result.status === "passed" ? undefined : { status: result.status };
  }
}
