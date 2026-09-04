import Image from "next/image";
import { GlobalSearch } from "@/features/search/components/GlobalSearch";

type PublishedStats = {
  totalPublished: number;
  recentPublished: number;
};

type MapHudProps = {
  stats: PublishedStats;
  status: string;
  onZoomIn(): void;
  onZoomOut(): void;
  onReset(): void;
  failed: boolean;
  onRetry(): void;
};

export function MapHud({
  stats,
  status,
  onZoomIn,
  onZoomOut,
  onReset,
  failed,
  onRetry,
}: MapHudProps) {
  return (
    <>
      <header className="map-brand" aria-label="Knowledge Frontier">
        <div className="map-brand__identity">
          <Image
            className="map-brand__logo"
            src="/lastfe-logo.svg"
            alt="LastFE 项目 Logo"
            width={48}
            height={48}
            priority
            unoptimized
          />
          <div className="map-brand__copy">
            <span className="map-brand__eyebrow">KNOWLEDGE // FRONTIER</span>
            <h1>知识边境</h1>
            <p>求职战略情报图</p>
          </div>
        </div>
      </header>

      <section className="map-telemetry" aria-label="地图情报统计">
        <div>
          <span>已公开档案</span>
          <output aria-label="已公开档案数量">{stats.totalPublished}</output>
        </div>
        <div>
          <span>近七日新增</span>
          <output aria-label="近七日新增数量">{stats.recentPublished}</output>
        </div>
      </section>

      <div className="map-search">
        <GlobalSearch />
      </div>

      <div className="map-controls" aria-label="地图镜头控制">
        <button
          type="button"
          aria-label="放大地图"
          className="min-h-11 min-w-11"
          onClick={onZoomIn}
        >
          <span aria-hidden="true">＋</span>
        </button>
        <button
          type="button"
          aria-label="缩小地图"
          className="min-h-11 min-w-11"
          onClick={onZoomOut}
        >
          <span aria-hidden="true">−</span>
        </button>
        <button
          type="button"
          aria-label="复位地图"
          className="min-h-11 min-w-11"
          onClick={onReset}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M5 8V4m0 0h4M5 4l3 3a7 7 0 1 1-2 8" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>

      <aside className="map-status" aria-label="探索者状态">
        <span className="map-status__signal" aria-hidden="true" />
        <div>
          <span>OPERATOR 01</span>
          <strong>{status}</strong>
          {failed ? (
            <button type="button" onClick={onRetry}>
              重试同步
            </button>
          ) : null}
        </div>
      </aside>

      <p className="map-instructions">
        点击领地或使用 Tab + Enter 选择目的地
      </p>
    </>
  );
}
