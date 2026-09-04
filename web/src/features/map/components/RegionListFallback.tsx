import type { RegionDefinition } from "../types";

type RegionListFallbackProps = {
  regions: readonly RegionDefinition[];
};

function RegionLinks({ regions }: RegionListFallbackProps) {
  return (
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
  );
}

export function RegionListFallback({ regions }: RegionListFallbackProps) {
  return (
    <>
      <div className="region-list region-list--desktop">
        <RegionLinks regions={regions} />
      </div>
      <details className="region-list region-list--mobile">
        <summary>
          <span className="region-list__closed-label">打开领地列表</span>
          <span className="region-list__open-label">收起领地列表</span>
        </summary>
        <RegionLinks regions={regions} />
      </details>
    </>
  );
}
