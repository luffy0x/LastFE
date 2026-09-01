import type { ExplorerMotionAdapter } from "../hooks/use-explorer-navigation";
import type { MotionLeg } from "../route-planner";
import type { Point } from "../types";

type ExplorerMarkerProps = {
  point: Point;
  regionLabel: string;
  targetLocked: boolean;
};

function samePoint(first: Point, second: Point) {
  return Math.abs(first.x - second.x) < 0.01 && Math.abs(first.y - second.y) < 0.01;
}

function sampleLeg(leg: MotionLeg): readonly Point[] {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", leg.path);

  if (typeof path.getTotalLength !== "function") return [leg.toPoint];

  const length = path.getTotalLength();
  const samples = Math.max(2, Math.ceil(length / 12));
  return Array.from({ length: samples + 1 }, (_, index) => {
    const progress = (index / samples) * length;
    const point = path.getPointAtLength(leg.reverse ? length - progress : progress);
    return { x: point.x, y: point.y };
  });
}

export function createExplorerMotionAdapter(): ExplorerMotionAdapter {
  return {
    start(legs, from, durationMs) {
      const points = [from, ...legs.flatMap(sampleLeg)].filter(
        (point, index, all) => index === 0 || !samePoint(point, all[index - 1]),
      );
      const destination = points.at(-1) ?? from;
      const marker = document.querySelector<SVGGElement>(
        "[data-explorer-marker]",
      );

      if (!marker || typeof marker.animate !== "function" || points.length < 2) {
        return {
          finished: Promise.resolve(destination),
          cancel: () => from,
        };
      }

      const animation = marker.animate(
        points.map((point) => ({
          transform: `translate(${point.x}px, ${point.y - 28}px)`,
        })),
        {
          duration: durationMs,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          fill: "forwards",
        },
      );

      let renderedPoint = from;
      const pointAtCurrentTime = () => {
        const currentTime =
          typeof animation.currentTime === "number" ? animation.currentTime : 0;
        const progress = Math.min(1, Math.max(0, currentTime / durationMs));
        const index = Math.min(
          points.length - 1,
          Math.floor(progress * (points.length - 1)),
        );
        return points[index];
      };

      const finished = animation.finished.then(
        () => {
          renderedPoint = destination;
          marker.setAttribute(
            "transform",
            `translate(${destination.x} ${destination.y - 28})`,
          );
          animation.cancel();
          return destination;
        },
        () => renderedPoint,
      );

      return {
        finished,
        cancel: () => {
          renderedPoint = pointAtCurrentTime();
          animation.cancel();
          marker.setAttribute(
            "transform",
            `translate(${renderedPoint.x} ${renderedPoint.y - 28})`,
          );
          return renderedPoint;
        },
      };
    },
  };
}

export function ExplorerMarker({
  point,
  regionLabel,
  targetLocked,
}: ExplorerMarkerProps) {
  return (
    <g
      role="img"
      aria-label={`探索者当前位置：${regionLabel}`}
      data-explorer-marker
      className="explorer-marker"
      data-target-locked={targetLocked ? "true" : "false"}
      transform={`translate(${point.x} ${point.y - 28})`}
    >
      <circle r="16" className="explorer-signal" aria-hidden="true" />
      <g transform="translate(-9 -12)" aria-hidden="true">
        <path d="M4 5V2.8L6.8 0h4.4L14 2.8V5l-2 2H6Z" className="explorer-helmet" />
        <path d="M5 8h8l2 8-3 2H6l-3-2Z" className="explorer-body" />
        <path d="M6 17h3v7H5Zm3 0h3l1 7H9Z" className="explorer-legs" />
        <path d="M4 10 1 16m13-6 3 6" className="explorer-arms" />
      </g>
    </g>
  );
}
