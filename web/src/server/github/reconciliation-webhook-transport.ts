import "server-only";

import { createHmac } from "node:crypto";

import type { GitHubIssueSnapshot, SyncResult } from "./sync-issue";

type WebhookFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

type ReconciliationWebhookTransportDependencies = {
  appOrigin: string;
  webhookSecret: string;
  fetch: WebhookFetch;
};

type WebhookResponse = { ok: true; result: SyncResult };

export class ReconciliationWebhookError extends Error {
  constructor() {
    super("Reconciliation webhook delivery failed (WEBHOOK)");
    this.name = "ReconciliationWebhookError";
  }
}

function bodyFor(issue: GitHubIssueSnapshot): string {
  return JSON.stringify({
    issue: {
      number: issue.number,
      title: issue.title,
      body: issue.body,
      labels: issue.labels,
      state: issue.state,
      created_at: issue.createdAt,
      updated_at: issue.updatedAt,
    },
  });
}

function isWebhookResponse(value: unknown): value is WebhookResponse {
  return (
    !!value &&
    typeof value === "object" &&
    "ok" in value &&
    value.ok === true &&
    "result" in value &&
    (value.result === "published" ||
      value.result === "withdrawn" ||
      value.result === "rejected" ||
      value.result === "ignored" ||
      value.result === "duplicate")
  );
}

export function createReconciliationWebhookTransport(
  dependencies: ReconciliationWebhookTransportDependencies,
): { syncIssue(issue: GitHubIssueSnapshot, deliveryId: string): Promise<SyncResult> } {
  return {
    async syncIssue(issue, deliveryId) {
      const body = bodyFor(issue);
      const signature = `sha256=${createHmac("sha256", dependencies.webhookSecret)
        .update(body)
        .digest("hex")}`;

      let response: Response;
      try {
        response = await dependencies.fetch(
          `${dependencies.appOrigin}/api/github/webhook`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-github-event": "issues",
              "x-github-delivery": deliveryId,
              "x-hub-signature-256": signature,
            },
            body,
          },
        );
      } catch {
        throw new ReconciliationWebhookError();
      }
      if (!response.ok) throw new ReconciliationWebhookError();

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new ReconciliationWebhookError();
      }
      if (!isWebhookResponse(payload)) throw new ReconciliationWebhookError();
      return payload.result;
    },
  };
}
