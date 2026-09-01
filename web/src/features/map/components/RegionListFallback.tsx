"use client";

import { useEffect, useState } from "react";
import type { RegionDefinition } from "../types";

type RegionListFallbackProps = {
  regions: readonly RegionDefinition[];
};

export function RegionListFallback({ regions }: RegionListFallbackProps) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (window.matchMedia?.("(max-width: 640px)").matches) setOpen(false);
  }, []);

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
