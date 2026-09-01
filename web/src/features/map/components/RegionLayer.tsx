import type { KeyboardEvent } from "react";
import type { RegionDefinition } from "../types";

type RegionLayerProps = {
  region: RegionDefinition;
  selected: boolean;
  onSelect: (slug: string) => void;
};

export function RegionLayer({ region, selected, onSelect }: RegionLayerProps) {
  const selectRegion = () => onSelect(region.slug);
  const handleKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectRegion();
    }
  };

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`进入${region.label}`}
      aria-pressed={selected}
      data-region={region.slug}
      data-selected={selected ? "true" : "false"}
      className="region-control"
      onClick={selectRegion}
      onKeyDown={handleKeyDown}
    >
      <path d={region.svgPath} className="region-fill" />
      <path d={region.svgPath} className="region-hatch" aria-hidden="true" />
      <rect
        x={region.anchor.x - 4}
        y={region.anchor.y - 29}
        width="8"
        height="8"
        className="region-beacon"
        aria-hidden="true"
      />
      <text
        x={region.anchor.x}
        y={region.anchor.y + 15}
        textAnchor="middle"
        className="region-label"
      >
        {region.label}
      </text>
      <text
        x={region.anchor.x}
        y={region.anchor.y + 38}
        textAnchor="middle"
        className="region-coordinate"
      >
        {region.anchor.x.toString().padStart(3, "0")} : {region.anchor.y}
      </text>
    </g>
  );
}
