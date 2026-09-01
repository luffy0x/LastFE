"use client";

import { useState, useSyncExternalStore } from "react";
import type { RegionDefinition } from "../types";

type RegionListFallbackProps = {
  regions: readonly RegionDefinition[];
};

const mobileQuery = "(max-width: 640px)";

function subscribeToViewport(onChange: () => void) {
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

function RegionListDisclosure({
  regions,
  initiallyOpen,
}: RegionListFallbackProps & { initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);

  return (
    <details
      className="region-list"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
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

export function RegionListFallback({ regions }: RegionListFallbackProps) {
  const mobile = useSyncExternalStore(
    subscribeToViewport,
    getMobileSnapshot,
    () => false,
  );

  return (
    <RegionListDisclosure
      key={mobile ? "mobile" : "desktop"}
      regions={regions}
      initiallyOpen={!mobile}
    />
  );
}
