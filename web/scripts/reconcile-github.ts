import { getInternalAppOrigin, getServerConfig } from "@/server/config";
import {
  createReconciliationCursorStore,
  openDatabase,
} from "@/server/db/client";
import { migrate } from "@/server/db/migrate";
import { GitHubSubmissionQueue } from "@/server/github/submission-queue";
import { reconcileFromCursor } from "@/server/github/reconcile";
import { createReconciliationWebhookTransport } from "@/server/github/reconciliation-webhook-transport";

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const config = getServerConfig();
  const database = openDatabase(config.sqlitePath);

  try {
    migrate(database);
    const github = new GitHubSubmissionQueue();
    const webhook = createReconciliationWebhookTransport({
      appOrigin: getInternalAppOrigin(),
      webhookSecret: config.githubWebhookSecret,
      fetch: globalThis.fetch,
    });
    const report = await reconcileFromCursor({
      cursorStore: createReconciliationCursorStore(database),
      startedAt,
      listIssues: (page) => github.listSubmissionIssues(page),
      enrichIssue: (issue) => github.enrichReview(issue),
      syncIssue: webhook.syncIssue,
      onFailure: ({ issueNumber, category }) => {
        console.error(
          `GitHub reconciliation issue #${issueNumber} failed (${category}).`,
        );
      },
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
