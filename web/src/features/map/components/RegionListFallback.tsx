"use client";

import { useState, useSyncExternalStore } from "react";
import type { RegionDefinition } from "../types";

type RegionListFallbackProps = {
  regions: readonly RegionDefinition[];
};

const mobileQuery = "(max-width: 640px)";

function subscribeToMobile(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getMobileSnapshot() {
  return typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia(mobileQuery).matches
    : false;
}

export function RegionListFallback({ regions }: RegionListFallbackProps) {
  const isMobile = useSyncExternalStore(
    subscribeToMobile,
    getMobileSnapshot,
    () => false,
  );
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? !isMobile;

  return (
    <details
      className="region-list"
      open={open}
      onToggle={(event) => setUserOpen(event.currentTarget.open)}
    >
      <summary>{open ? "收起领地列表" : "打开领地列表"}</summary>
      <nav aria-label="领地列表">
        {regions
          .filter(({ enabled }) => enabled)
          .map((region, index) => (
            <a key={region.slug} href={region.href}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {region.label}
            </a>
          ))}
      </nav>
    </details>
  );
}
