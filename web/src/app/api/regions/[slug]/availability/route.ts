import { REGIONS } from "@/features/map/regions";
import type { RegionAvailability } from "@/features/map/prepare-region";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/regions/[slug]/availability">,
) {
  const { slug } = await context.params;
  const region = REGIONS.find(
    (candidate) => candidate.slug === slug && candidate.enabled,
  );

  if (!region) {
    return Response.json(
      { ok: false, code: "REGION_NOT_FOUND" },
      { status: 404 },
    );
  }

  return Response.json({ ok: true, slug } satisfies RegionAvailability);
}
