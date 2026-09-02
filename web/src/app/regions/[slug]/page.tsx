import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getContentRepository } from "@/features/content/repository";
import { TerritoryPanel } from "@/features/content/components/TerritoryPanel";
import {
  cameraStateForTarget,
  cameraTransform,
} from "@/features/map/camera-state";
import { ExplorerMarker } from "@/features/map/components/ExplorerMarker";
import { REGIONS } from "@/features/map/regions";
import type { RegionDefinition } from "@/features/map/types";
import { parsePage } from "@/server/content/search";

export function generateStaticParams() {
  return REGIONS.filter(({ enabled }) => enabled).map(({ slug }) => ({ slug }));
}

function TerritoryBackdrop({ region }: { region: RegionDefinition }) {
  const transform = cameraTransform(cameraStateForTarget(region.camera));

  return (
    <svg
      className="territory-backdrop"
      viewBox="0 0 1000 600"
      preserveAspectRatio="xMidYMid slice"
      aria-label={`${region.label}地图背景`}
    >
      <defs>
        <pattern id="panel-grid" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M50 0H0V50" className="map-grid-line" />
        </pattern>
      </defs>
      <rect width="1000" height="600" className="map-field" />
      <rect width="1000" height="600" fill="url(#panel-grid)" />
      <g data-testid="territory-camera-layer" transform={transform}>
        {REGIONS.map((candidate) => (
          <path
            key={candidate.slug}
            d={candidate.svgPath}
            className="territory-backdrop__region"
            data-active={candidate.slug === region.slug ? "true" : "false"}
          />
        ))}
        <ExplorerMarker
          point={region.anchor}
          regionLabel={region.label}
          targetLocked
        />
      </g>
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
      <TerritoryBackdrop region={region} />
      <TerritoryPanel region={region} page={page} query={query} />
    </main>
  );
}
