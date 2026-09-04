import { getContentRepository } from "@/features/content/repository";
import { REGIONS } from "@/features/map/regions";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const region = url.searchParams.get("region") ?? undefined;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const tags = url.searchParams.getAll("tag").filter(Boolean);

  if (region && !REGIONS.some(({ enabled, slug }) => enabled && slug === region)) {
    return Response.json(
      { ok: false, code: "REGION_NOT_FOUND", message: "未知领地" },
      { status: 404 },
    );
  }

  const results = await getContentRepository().list({
    regionSlug: region,
    search: url.searchParams.get("q") ?? undefined,
    tags,
    page,
    pageSize: 20,
  });

  return Response.json({ ok: true, page: results });
}
