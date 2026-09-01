import { notFound } from "next/navigation";
import { getContentRepository } from "@/features/content/repository";
import { TerritoryPanel } from "@/features/content/components/TerritoryPanel";
import { REGIONS } from "@/features/map/regions";

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
}: PageProps<"/regions/[slug]">) {
  const { slug } = await params;
  const region = REGIONS.find(
    (candidate) => candidate.slug === slug && candidate.enabled,
  );
  if (!region) notFound();

  const page = await getContentRepository().list({
    regionSlug: region.slug,
    page: 1,
    pageSize: 20,
  });

  return (
    <main id="main-content" className="territory-page">
      <TerritoryBackdrop selectedSlug={region.slug} />
      <TerritoryPanel region={region} page={page} />
    </main>
  );
}
