"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { PublishedStats } from "@/features/content/types";
import { request } from "@/utils/request";
import { prepareRegion } from "../prepare-region";
import { REGIONS } from "../regions";
import type { RegionDefinition } from "../types";
import { StrategicMap } from "./StrategicMap";

const noteSelection = () => undefined;

export function MapExperience({
  stats,
  initialRegionSlug,
}: {
  stats: PublishedStats;
  initialRegionSlug?: string;
}) {
  const router = useRouter();
  const prepareDestination = useCallback(
    (region: RegionDefinition) =>
      prepareRegion(region, {
        prefetch: (href) => router.prefetch(href),
        request,
      }),
    [router],
  );
  const navigate = useCallback((href: string) => router.push(href), [router]);

  return (
    <StrategicMap
      regions={REGIONS}
      stats={stats}
      onSelectRegion={noteSelection}
      prepareDestination={prepareDestination}
      navigate={navigate}
      initialRegionSlug={initialRegionSlug}
    />
  );
}
