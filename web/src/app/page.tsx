import { getContentRepository } from "@/features/content/repository";
import { MapExperience } from "@/features/map/components/MapExperience";
import { REGIONS } from "@/features/map/regions";

type HomePageProps = {
  searchParams: Promise<{ region?: string | string[] }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const query = await searchParams;
  const requestedSlug =
    typeof query.region === "string" ? query.region : undefined;
  const initialRegionSlug = REGIONS.find(
    ({ enabled, slug }) => enabled && slug === requestedSlug,
  )?.slug;
  const stats = await getContentRepository().stats();

  return (
    <main
      id="main-content"
      aria-label="求职战略地图"
      className="min-h-dvh overflow-hidden bg-background text-foreground"
    >
      <MapExperience stats={stats} initialRegionSlug={initialRegionSlug} />
    </main>
  );
}
