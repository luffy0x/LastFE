import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getContentRepository } from "@/features/content/repository";
import { TerritoryPanel } from "@/features/content/components/TerritoryPanel";
import { REGIONS } from "@/features/map/regions";
import { parsePage } from "@/server/content/search";

export function generateStaticParams() {
  return REGIONS.filter(({ enabled }) => enabled).map(({ slug }) => ({ slug }));
}

function TerritoryBackdrop({ selectedSlug }: { selectedSlug: string }) {
  return (
    <svg
      className="territory-backdrop"
      viewBox="0 0 1000 600"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <pattern id="panel-grid" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M50 0H0V50" className="map-grid-line" />
        </pattern>
      </defs>
      <rect width="1000" height="600" className="map-field" />
      <rect width="1000" height="600" fill="url(#panel-grid)" />
      {REGIONS.map((region) => (
        <path
          key={region.slug}
          d={region.svgPath}
          className="territory-backdrop__region"
          data-active={region.slug === selectedSlug ? "true" : "false"}
        />
      ))}
    </svg>
  );
}

export default async function TerritoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { slug } = await params;
  const region = REGIONS.find(
    (candidate) => candidate.slug === slug && candidate.enabled,
  );
  if (!region) notFound();

  const rawQuery = await searchParams;
  const firstValue = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : value?.[0];
  const query = Object.fromEntries(
    ["q", ...region.filterKeys]
      .map((key) => [key, firstValue(rawQuery[key])?.trim()] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
  );
  const tags = query.tags
    ?.split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  const filters = Object.fromEntries(
    region.filterKeys
      .filter((key) => key !== "tags" && query[key])
      .map((key) => [key, query[key]]),
  );

  const page = await getContentRepository().list({
    regionSlug: region.slug,
    search: query.q,
    tags,
    filters,
    page: parsePage(firstValue(rawQuery.page)),
    pageSize: 20,
  });

  return (
    <main id="main-content" className="territory-page">
      <TerritoryBackdrop selectedSlug={region.slug} />
      <TerritoryPanel region={region} page={page} query={query} />
    </main>
  );
}
