import { randomUUID } from "node:crypto";

import { getInternalAppOrigin, getServerConfig } from "@/server/config";
import {
  createReconciliationCursorStore,
  openDatabase,
} from "@/server/db/client";
import { migrate } from "@/server/db/migrate";
import { GitHubSubmissionQueue } from "@/server/github/submission-queue";
import { reconcileFromCursor } from "@/server/github/reconcile";
import { createReconciliationWebhookTransport } from "@/server/github/reconciliation-webhook-transport";
import { log } from "@/server/logging";

async function main(): Promise<void> {
  const requestId = randomUUID();
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
        log("error", "github.reconciliation.issue_failed", {
          requestId,
          issueNumber,
          errorCategory: category,
        });
      },
    });

    log("info", "github.reconciliation.completed", { requestId, ...report });
    if (report.failed > 0) process.exitCode = 1;
  } catch {
    log("error", "github.reconciliation.failed", {
      requestId,
      errorCategory: "reconciliation",
    });
    process.exitCode = 1;
  } finally {
    database.close();
  }
}

void main();
