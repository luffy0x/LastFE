import type { ContentRepository } from "@/features/content/repository";
import { getContentRepository } from "@/features/content/repository";
import { searchAll } from "@/server/content/search";

const SEARCH_CACHE_CONTROL = "public, max-age=0, s-maxage=60, must-revalidate";

const invalidResponse = () =>
  Response.json(
    { ok: false, code: "INVALID", message: "搜索参数无效。" },
    { status: 400, headers: { "cache-control": "no-store" } },
  );

const unavailableResponse = () =>
  Response.json(
    { ok: false, code: "UPSTREAM", message: "搜索服务暂时不可用。" },
    {
      status: 503,
      headers: { "cache-control": "no-store", "retry-after": "60" },
    },
  );

export function createSearchHandler(
  repository: ContentRepository,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const parameters = new URL(request.url).searchParams;
    if (
      [...parameters.keys()].some((key) => key !== "q") ||
      parameters.getAll("q").length > 1
    ) {
      return invalidResponse();
    }

    try {
      const groups = await searchAll(repository, parameters.get("q") ?? "");
      return Response.json(
        { groups },
        { headers: { "cache-control": SEARCH_CACHE_CONTROL } },
      );
    } catch {
      return unavailableResponse();
    }
  };
}

export async function GET(request: Request): Promise<Response> {
  try {
    return await createSearchHandler(getContentRepository())(request);
  } catch {
    return unavailableResponse();
  }
}
