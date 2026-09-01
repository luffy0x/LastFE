import { existsSync, rmSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";

import type { FullResult, Reporter } from "@playwright/test/reporter";

const RUN_DIRECTORY_PREFIX = "knowledge-frontier-playwright-";

export default class RunDirectoryCleanupReporter implements Reporter {
  private readonly runDirectory: string;

  constructor(options: { e2eRunDirectory: string }) {
    this.runDirectory = resolve(options.e2eRunDirectory);
  }

  printsToStdio(): boolean {
    return false;
  }

  async onEnd(
    result: FullResult,
  ): Promise<{ status?: FullResult["status"] } | undefined> {
    const ownsRunDirectory =
      dirname(this.runDirectory) === resolve(tmpdir()) &&
      basename(this.runDirectory).startsWith(RUN_DIRECTORY_PREFIX);

    if (!ownsRunDirectory) {
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
