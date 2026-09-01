import { parseSubmission } from "@/features/submissions/schemas";
import type {
  Submission,
  SubmissionResponse,
} from "@/features/submissions/types";
import { openDatabase } from "@/server/db/client";
import { migrate } from "@/server/db/migrate";
import {
  AbuseStoreError,
  createSqliteAbuseStore,
  type AbuseStore,
} from "@/server/security/abuse-store";
import {
  createAltchaChallengeService,
  type ChallengeService,
} from "@/server/security/challenge";
import {
  createSourceHasher,
  fingerprintSubmission,
} from "@/server/security/rate-limit";
import type { SubmissionQueue } from "@/server/submissions/queue";

export type { AbuseStore } from "@/server/security/abuse-store";
export type { ChallengeService } from "@/server/security/challenge";
export type { SubmissionQueue } from "@/server/submissions/queue";
export type { SubmissionResponse } from "@/features/submissions/types";

export type SubmissionRouteDependencies = {
  challenge: ChallengeService;
  abuse: AbuseStore;
  queue: SubmissionQueue;
  hashSource(ip: string): string;
  now(): Date;
};

const json = (
  body: SubmissionResponse,
  status: number,
  headers?: HeadersInit,
) => Response.json(body, { status, headers });

const MAX_BODY_BYTES = 64 * 1024;

const invalidResponse = () =>
  json(
    {
      ok: false,
      code: "INVALID",
      message: "投稿内容无效，请检查后重试。",
    },
    400,
  );

const upstreamResponse = (message = "提交服务暂时不可用，请稍后重试。") =>
  json(
    { ok: false, code: "UPSTREAM", message },
    503,
    { "retry-after": "60" },
  );

async function readJsonBody(request: Request): Promise<unknown> {
  if (!request.body) throw new Error("Missing request body");

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
        throw new Error("Request body too large");
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

export function createSubmissionHandler(
  dependencies: SubmissionRouteDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return invalidResponse();
    }

    let input: Record<string, unknown>;
    try {
      const parsed = await readJsonBody(request);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
        return invalidResponse();
      }
      input = parsed as Record<string, unknown>;
    } catch {
      return invalidResponse();
    }
    if (input.website !== undefined && input.website !== "") {
      return invalidResponse();
    }
    let submission: Submission;
    try {
      submission = parseSubmission(String(input.regionSlug ?? ""), input);
    } catch {
      return invalidResponse();
    }
    let verified: boolean;
    try {
      verified = await dependencies.challenge.verify(input.altcha);
    } catch {
      return upstreamResponse();
    }

    if (!verified) {
      return json(
        {
          ok: false,
          code: "CHALLENGE",
          message: "验证未通过，请刷新验证后重试。",
        },
        422,
      );
    }

    const source = request.headers.get("x-real-ip");
    if (!source) return invalidResponse();

    const now = dependencies.now();
    let reservation: { reservationId: string };
    try {
      reservation = await dependencies.abuse.reserve({
        sourceHash: dependencies.hashSource(source),
        fingerprint: fingerprintSubmission(submission),
        now,
      });
    } catch (error) {
      if (error instanceof AbuseStoreError && error.code === "DUPLICATE") {
        return json(
          {
            ok: false,
            code: "DUPLICATE",
            message: "该内容近期已提交，请等待审核或修改内容后再试。",
          },
          409,
        );
      }
      if (error instanceof AbuseStoreError && error.code === "RATE_LIMIT") {
        return json(
          {
            ok: false,
            code: "RATE_LIMIT",
            message: "提交过于频繁，请稍后再试。",
          },
          429,
          { "retry-after": "3600" },
        );
      }
      return upstreamResponse();
    }

    let issueNumber: number;
    try {
      ({ issueNumber } = await dependencies.queue.enqueue(submission));
    } catch {
      try {
        await dependencies.abuse.release(reservation.reservationId);
      } catch {
        // The short reservation lease is the final recovery boundary.
      }
      return upstreamResponse();
    }

    try {
      await dependencies.abuse.recordSuccess(reservation.reservationId, now);
    } catch {
      return upstreamResponse("提交状态暂时无法确认，请稍后重试。");
    }
    return json({ ok: true, issueNumber }, 201);
  };
}

type SubmissionHandler = ReturnType<typeof createSubmissionHandler>;
let productionHandlerPromise: Promise<SubmissionHandler> | undefined;

async function createProductionHandler(): Promise<SubmissionHandler> {
  const sqlitePath = process.env.SQLITE_PATH;
  const altchaHmacKey = process.env.ALTCHA_HMAC_KEY;
  const rateLimitHmacKey = process.env.RATE_LIMIT_HMAC_KEY;
  if (!sqlitePath || !altchaHmacKey || !rateLimitHmacKey) {
    throw new Error("Submission runtime configuration is incomplete");
  }

  const configuredMaxNumber = process.env.ALTCHA_MAX_NUMBER;
  const maxNumber = configuredMaxNumber
    ? Number(configuredMaxNumber)
    : undefined;
  const database = openDatabase(sqlitePath);
  migrate(database);
  const { createSubmissionQueue } = await import(
    "@/server/submissions/queue"
  );

  return createSubmissionHandler({
    challenge: createAltchaChallengeService(altchaHmacKey, maxNumber),
    abuse: createSqliteAbuseStore(database),
    queue: createSubmissionQueue(),
    hashSource: createSourceHasher(rateLimitHmacKey),
    now: () => new Date(),
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    productionHandlerPromise ??= createProductionHandler();
    const handler = await productionHandlerPromise;
    return handler(request);
  } catch {
    return upstreamResponse();
  }
}
