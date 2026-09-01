import { revalidatePath } from "next/cache";

import { getServerConfig } from "@/server/config";
import { createSqliteContentStores } from "@/server/content/sqlite-repository";
import {
  createReconciliationCursorStore,
  openDatabase,
} from "@/server/db/client";
import { migrate } from "@/server/db/migrate";
import { GitHubSubmissionQueue } from "@/server/github/submission-queue";
import { reconcileFromCursor } from "@/server/github/reconcile";
import { syncIssue } from "@/server/github/sync-issue";

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const config = getServerConfig();
  const database = openDatabase(config.sqlitePath);

  try {
    migrate(database);
    const { moderation } = createSqliteContentStores(database);
    const github = new GitHubSubmissionQueue();
    const report = await reconcileFromCursor({
      cursorStore: createReconciliationCursorStore(database),
      startedAt,
      listIssues: (page, perPage) => {
        if (perPage !== 100) {
          throw new Error("Reconciliation failed (INVALID_PAGE_SIZE)");
        }
        return github.listSubmissionIssues(page);
      },
      syncIssue: (issue, deliveryId) =>
        syncIssue(issue, deliveryId, {
          moderation,
          ensureReviewState: (issueNumber, decision) =>
            github.ensureReviewState(issueNumber, decision),
          invalidate: async (paths) => {
            for (const path of paths) revalidatePath(path);
          },
        }),
    });

    console.info(
      `GitHub reconciliation completed: scanned=${report.scanned} synced=${report.synced} failed=${report.failed}`,
    );
    if (report.failed > 0) process.exitCode = 1;
  } catch {
    console.error("GitHub reconciliation failed.");
    process.exitCode = 1;
  } finally {
    database.close();
  }
}

void main();
