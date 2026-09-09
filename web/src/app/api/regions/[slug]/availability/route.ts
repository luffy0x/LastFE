import { CATEGORIES } from "@/features/content/categories";

export type RegionAvailability = { ok: true; slug: string };

export async function GET(
  _request: Request,
  context: RouteContext<"/api/regions/[slug]/availability">,
) {
  const { slug } = await context.params;
  const category = CATEGORIES.find(
    (candidate) => candidate.slug === slug && candidate.enabled,
  );

  if (!category) {
    return Response.json(
      { ok: false, code: "REGION_NOT_FOUND" },
      { status: 404 },
    );
  }

  return Response.json({ ok: true, slug } satisfies RegionAvailability);
}
