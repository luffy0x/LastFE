import { randomUUID } from "node:crypto";
import { open, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { getSqlitePath } from "@/server/config";
import { openDatabase } from "@/server/db/client";
import { log, type StructuredLogger } from "@/server/logging";

export const dynamic = "force-dynamic";

export type HealthHandlerDependencies = {
  probeDatabase(): Promise<void>;
  probeDataDirectory(): Promise<void>;
  log: StructuredLogger;
};

export async function probeDatabase(): Promise<void> {
  const database = openDatabase(getSqlitePath());
  let transactionStarted = false;

  try {
    database.prepare("SELECT 1").get();
    database.exec("BEGIN IMMEDIATE");
    transactionStarted = true;
    database.exec("CREATE TEMP TABLE health_probe (value INTEGER)");
    database.exec("DROP TABLE health_probe");
  } finally {
    try {
      if (transactionStarted) database.exec("ROLLBACK");
    } finally {
      database.close();
    }
  }
}

export async function probeDataDirectory(): Promise<void> {
  const sqlitePath = getSqlitePath();
  const probePath = join(
    dirname(sqlitePath),
    `.${basename(sqlitePath)}.health-${randomUUID()}`,
  );
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  let created = false;

  try {
    handle = await open(probePath, "wx");
    created = true;
  } finally {
    try {
      await handle?.close();
    } finally {
      if (created) await unlink(probePath);
    }
  }
}

const unhealthy = () => Response.json({ status: "unhealthy" }, { status: 503 });

export function createHealthHandler(
  dependencies: HealthHandlerDependencies,
): () => Promise<Response> {
  return async () => {
    const requestId = randomUUID();

    try {
      await dependencies.probeDatabase();
    } catch {
      dependencies.log("error", "health.check_failed", {
        requestId,
        errorCategory: "database",
      });
      return unhealthy();
    }

    try {
      await dependencies.probeDataDirectory();
    } catch {
      dependencies.log("error", "health.check_failed", {
        requestId,
        errorCategory: "data_directory",
      });
      return unhealthy();
    }

    return Response.json({ status: "ok" });
  };
}

export const GET = createHealthHandler({
  probeDatabase,
  probeDataDirectory,
  log,
});
