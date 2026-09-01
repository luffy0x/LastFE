import { revalidatePath } from "next/cache";

import { getServerConfig } from "@/server/config";
import { createSqliteContentStores } from "@/server/content/sqlite-repository";
import { initializeDatabase } from "@/server/db/migrate";
import { GitHubSubmissionQueue } from "@/server/github/submission-queue";
import {
  syncIssue,
  type GitHubIssueSnapshot,
  type GitHubReviewEvidence,
  type SyncResult,
} from "@/server/github/sync-issue";
import { verifyGitHubSignature } from "@/server/github/verify-webhook";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256 * 1024;

export type WebhookRouteDependencies = {
  webhookSecret: string;
  synchronize(
    issue: GitHubIssueSnapshot,
    deliveryId: string,
  ): Promise<SyncResult>;
};

class BodyTooLargeError extends Error {}

const json = (body: unknown, status: number, headers?: HeadersInit) =>
  Response.json(body, {
    status,
    headers: { "cache-control": "no-store", ...headers },
  });

const invalidResponse = () =>
  json({ ok: false, code: "INVALID", message: "Webhook request rejected." }, 400);

async function readRawBody(request: Request): Promise<Uint8Array> {
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (total + value.byteLength > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new BodyTooLargeError();
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function labelsFrom(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const labels: string[] = [];
  for (const label of value) {
    if (typeof label === "string" && label.length > 0) {
      labels.push(label);
      continue;
    }
    if (
      label &&
      typeof label === "object" &&
      "name" in label &&
      typeof label.name === "string" &&
      label.name.length > 0
    ) {
      labels.push(label.name);
      continue;
    }
    return null;
  }
  return labels;
}

function normalizeWebhookReview(
  payload: Record<string, unknown>,
): GitHubReviewEvidence | null {
  const action = payload.action;
  if (typeof action !== "string" || !action.trim()) return null;

  if (action === "reconciled") {
    const reconciliation = payload.reconciliation;
    if (
      !reconciliation ||
      Array.isArray(reconciliation) ||
      typeof reconciliation !== "object"
    ) {
      return null;
    }
    const latest = (reconciliation as Record<string, unknown>)
      .latest_relevant_event;
    if (latest === null) {
      return { source: "reconciliation", latestRelevantEvent: null };
    }
    if (!latest || Array.isArray(latest) || typeof latest !== "object") {
      return null;
    }
    const value = latest as Record<string, unknown>;
    if (
      typeof value.id !== "string" ||
      !value.id ||
      (value.action !== "labeled" && value.action !== "unlabeled") ||
      (value.label !== "approved" && value.label !== "unpublish") ||
      typeof value.created_at !== "string" ||
      !Number.isFinite(Date.parse(value.created_at))
    ) {
      return null;
    }
    return {
      source: "reconciliation",
      latestRelevantEvent: {
        id: value.id,
        action: value.action,
        label: value.label,
        createdAt: value.created_at,
      },
    };
  }

  let changedLabel: string | null = null;
  if (action === "labeled" || action === "unlabeled") {
    const label = payload.label;
    if (
      !label ||
      Array.isArray(label) ||
      typeof label !== "object" ||
      !("name" in label) ||
      typeof label.name !== "string" ||
      !label.name
    ) {
      return null;
    }
    changedLabel = label.name;
  }

  return { source: "webhook", action, changedLabel };
}

function normalizeIssue(payload: unknown): GitHubIssueSnapshot | null {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") return null;
  const payloadRecord = payload as Record<string, unknown>;
  const issue = payloadRecord.issue;
  if (!issue || Array.isArray(issue) || typeof issue !== "object") return null;

  const value = issue as Record<string, unknown>;
  const labels = labelsFrom(value.labels);
  const review = normalizeWebhookReview(payloadRecord);
  if (
    !Number.isSafeInteger(value.number) ||
    (value.number as number) < 1 ||
    typeof value.title !== "string" ||
    typeof value.body !== "string" ||
    !labels ||
    !review ||
    (value.state !== "open" && value.state !== "closed") ||
    typeof value.created_at !== "string" ||
    !Number.isFinite(Date.parse(value.created_at)) ||
    typeof value.updated_at !== "string" ||
    !Number.isFinite(Date.parse(value.updated_at))
  ) {
    return null;
  }

  return {
    number: value.number as number,
    title: value.title,
    body: value.body,
    labels,
    state: value.state,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
    review,
  };
}

export function createWebhookHandler(
  dependencies: WebhookRouteDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return json(
        { ok: false, code: "BODY_TOO_LARGE", message: "Webhook request rejected." },
        413,
      );
    }

    let rawBody: Uint8Array;
    try {
      rawBody = await readRawBody(request);
    } catch (error) {
      if (error instanceof BodyTooLargeError) {
        return json(
          { ok: false, code: "BODY_TOO_LARGE", message: "Webhook request rejected." },
          413,
        );
      }
      return invalidResponse();
    }

    if (
      !verifyGitHubSignature(
        rawBody,
        request.headers.get("x-hub-signature-256"),
        dependencies.webhookSecret,
      )
    ) {
      return json(
        { ok: false, code: "SIGNATURE", message: "Webhook request rejected." },
        401,
      );
    }

    const eventName = request.headers.get("x-github-event");
    const deliveryId = request.headers.get("x-github-delivery")?.trim();
    if (eventName !== "issues" || !deliveryId) return invalidResponse();

    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody));
    } catch {
      return invalidResponse();
    }
    const issue = normalizeIssue(payload);
    if (!issue) return invalidResponse();

    try {
      const result = await dependencies.synchronize(issue, deliveryId);
      return json({ ok: true, result }, 200);
    } catch {
      return json(
        { ok: false, code: "SYNC", message: "Webhook synchronization failed." },
        503,
        { "retry-after": "60" },
      );
    }
  };
}

type WebhookHandler = ReturnType<typeof createWebhookHandler>;

async function createProductionHandler(): Promise<WebhookHandler> {
  const config = getServerConfig();
  return initializeDatabase(config.sqlitePath, (database) => {
    const { moderation } = createSqliteContentStores(database);
    const github = new GitHubSubmissionQueue();

    return createWebhookHandler({
      webhookSecret: config.githubWebhookSecret,
      synchronize: (issue, deliveryId) =>
        syncIssue(issue, deliveryId, {
          moderation,
          ensureReviewState: (issueNumber, decision) =>
            github.ensureReviewState(issueNumber, decision),
          invalidate: async (paths) => {
            for (const path of paths) revalidatePath(path);
          },
        }),
    });
  });
}

export function createWebhookRoute(
  loadHandler: () => Promise<WebhookHandler>,
): (request: Request) => Promise<Response> {
  let handler: WebhookHandler | undefined;
  let loading: Promise<WebhookHandler> | undefined;

  return async (request) => {
    try {
      if (!handler) {
        loading ??= loadHandler();
        try {
          handler = await loading;
        } finally {
          loading = undefined;
        }
      }
      return handler(request);
    } catch {
      return json(
        { ok: false, code: "SYNC", message: "Webhook synchronization failed." },
        503,
        { "retry-after": "60" },
      );
    }
  };
}

export const POST = createWebhookRoute(createProductionHandler);
