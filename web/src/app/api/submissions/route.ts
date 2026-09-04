import { buildSubmissionIssue } from "@/server/github/issue-codec";
import {
  parseSubmissionInput,
  type SubmissionInput,
} from "@/features/content/submission-schemas";
import { getSupabaseAdmin } from "@/server/supabase/admin";
import { requireServerEnv } from "@/server/supabase/env";
import {
  AbuseStoreError,
  createSupabaseAbuseStore,
  type AbuseStore,
  type SupabaseAbuseClient,
} from "@/server/security/supabase-abuse-store";
import {
  createSourceHasher,
  fingerprintSubmission,
} from "@/server/security/rate-limit";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 64 * 1024;

function githubApiBaseUrl(): string {
  return process.env.GITHUB_API_BASE_URL?.replace(/\/$/, "") ?? "https://api.github.com";
}

function jsonError(message: string, status: number, code: string): Response {
  return Response.json({ ok: false, code, message }, { status });
}

async function readJsonBody(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new Error("Request body is too large");
  }

  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
    throw new Error("Request body is too large");
  }

  return JSON.parse(body);
}

function sourceFromHeaders(headers: Headers): string | null {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedFor) return forwardedFor;

  return process.env.NODE_ENV === "production" ? null : "local-development";
}

export type SubmissionHandlerDependencies = {
  abuse: AbuseStore;
  enqueue(submission: SubmissionInput): Promise<Response>;
  hashSource(source: string): string;
  now(): Date;
};

function duplicateResponse(): Response {
  return jsonError(
    "该内容近期已提交，请等待审核或修改内容后再试。",
    409,
    "DUPLICATE",
  );
}

function rateLimitResponse(): Response {
  return Response.json(
    { ok: false, code: "RATE_LIMIT", message: "提交过于频繁，请稍后再试。" },
    { status: 429, headers: { "retry-after": "3600" } },
  );
}

export function createSubmissionHandler(dependencies: SubmissionHandlerDependencies) {
  return async function POST(request: Request) {
    let payload: unknown;
    try {
      payload = await readJsonBody(request);
    } catch {
      return jsonError("请求体必须是 JSON", 400, "INVALID_JSON");
    }

    if (
      payload &&
      typeof payload === "object" &&
      "website" in payload &&
      typeof (payload as { website?: unknown }).website === "string" &&
      (payload as { website: string }).website.trim()
    ) {
      return jsonError("投稿内容不符合要求", 400, "INVALID_SUBMISSION");
    }

    let submission: SubmissionInput;
    try {
      submission = parseSubmissionInput(payload);
    } catch {
      return jsonError("投稿内容不符合要求", 400, "INVALID_SUBMISSION");
    }

    const source = sourceFromHeaders(request.headers);
    if (!source) return jsonError("投稿来源无效", 400, "INVALID_SOURCE");

    let reservation: { reservationId: string };
    try {
      reservation = await dependencies.abuse.reserve({
        sourceHash: dependencies.hashSource(source),
        fingerprint: fingerprintSubmission(submission),
        now: dependencies.now(),
      });
    } catch (error) {
      if (error instanceof AbuseStoreError && error.code === "DUPLICATE") {
        return duplicateResponse();
      }
      if (error instanceof AbuseStoreError && error.code === "RATE_LIMIT") {
        return rateLimitResponse();
      }
      return jsonError("提交服务暂时不可用，请稍后重试", 503, "UPSTREAM");
    }

    let response: Response;
    try {
      response = await dependencies.enqueue(submission);
    } catch {
      await dependencies.abuse.release(reservation.reservationId).catch(() => undefined);
      return jsonError("审核队列暂时不可用，请稍后重试", 502, "GITHUB_UNAVAILABLE");
    }

    if (!response.ok) {
      await dependencies.abuse.release(reservation.reservationId).catch(() => undefined);
      return jsonError("审核队列暂时不可用，请稍后重试", 502, "GITHUB_UNAVAILABLE");
    }

    try {
      await dependencies.abuse.recordSuccess(reservation.reservationId, dependencies.now());
    } catch {
      return jsonError("提交状态暂时无法确认，请稍后重试", 503, "UPSTREAM");
    }

    return Response.json({ ok: true }, { status: 201 });
  };
}

let productionHandler: ReturnType<typeof createSubmissionHandler> | null = null;

const fixtureAbuseStore: AbuseStore = {
  async reserve() {
    return { reservationId: "fixture-reservation" };
  },
  async recordSuccess() {},
  async release() {},
};

function getProductionHandler(): ReturnType<typeof createSubmissionHandler> {
  const useSupabase = process.env.CONTENT_REPOSITORY === "supabase";

  productionHandler ??= createSubmissionHandler({
    abuse: useSupabase
      ? createSupabaseAbuseStore(getSupabaseAdmin() as unknown as SupabaseAbuseClient)
      : fixtureAbuseStore,
    enqueue(submission) {
      const issue = buildSubmissionIssue(submission);
      const repository = requireServerEnv("GITHUB_REPOSITORY");
      const token = requireServerEnv("GITHUB_TOKEN");
      return fetch(`${githubApiBaseUrl()}/repos/${repository}/issues`, {
        method: "POST",
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-github-api-version": "2022-11-28",
        },
        body: JSON.stringify(issue),
      });
    },
    hashSource: useSupabase
      ? createSourceHasher(requireServerEnv("RATE_LIMIT_HMAC_KEY"))
      : () => "fixture-source",
    now: () => new Date(),
  });

  return productionHandler;
}

export async function POST(request: Request): Promise<Response> {
  try {
    return await getProductionHandler()(request);
  } catch {
    return jsonError("提交服务暂时不可用，请稍后重试", 503, "UPSTREAM");
  }
}
