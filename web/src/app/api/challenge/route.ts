import {
  createAltchaChallengeService,
  type ChallengeService,
} from "@/server/security/challenge";
import { getServerConfig } from "@/server/config";

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
  try {
    const config = getServerConfig();
    const service = createAltchaChallengeService(
      config.altchaHmacKey,
      config.altchaMaxNumber,
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
