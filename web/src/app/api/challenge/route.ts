import {
  createAltchaChallengeService,
  type ChallengeService,
} from "@/server/security/challenge";

export const dynamic = "force-dynamic";

export function createChallengeHandler(
  service: ChallengeService,
): () => Promise<Response> {
  return async () => {
    try {
      return Response.json(await service.create(), {
        headers: { "cache-control": "no-store" },
      });
    } catch {
      return Response.json(
        {
          ok: false,
          code: "UPSTREAM",
          message: "验证服务暂时不可用，请稍后重试。",
        },
        {
          status: 503,
          headers: {
            "cache-control": "no-store",
            "retry-after": "60",
          },
        },
      );
    }
  };
}

export async function GET(): Promise<Response> {
  const rawMaxNumber = process.env.ALTCHA_MAX_NUMBER;
  const maxNumber = rawMaxNumber ? Number(rawMaxNumber) : undefined;

  try {
    const service = createAltchaChallengeService(
      process.env.ALTCHA_HMAC_KEY ?? "",
      maxNumber,
    );
    return createChallengeHandler(service)();
  } catch {
    return Response.json(
      {
        ok: false,
        code: "UPSTREAM",
        message: "验证服务暂时不可用，请稍后重试。",
      },
      {
        status: 503,
        headers: { "cache-control": "no-store", "retry-after": "60" },
      },
    );
  }
}
