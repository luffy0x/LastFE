"use client";

import { useRef } from "react";
import Link from "next/link";
import type { RegionDefinition } from "@/features/map/types";
import { useMobileSheetFocus } from "../hooks/use-mobile-sheet-focus";
import type { ContentSummary, Page } from "../types";

type TerritoryPanelProps = {
  region: RegionDefinition;
  page: Page<ContentSummary>;
};

const FIELD_LABELS: Readonly<Record<string, string>> = {
  companyDepartment: "公司/部门",
  position: "岗位",
  tags: "标签",
  category: "知识分类",
  techStack: "技术栈",
  source: "来源",
  difficulty: "难度",
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
});

export function TerritoryPanel({ region, page }: TerritoryPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useMobileSheetFocus(panelRef, headingRef);

  return (
    <section
      ref={panelRef}
      className="territory-panel"
      aria-labelledby="territory-heading"
    >
      <div className="territory-panel__topline">
        <Link
          className="territory-panel__return"
          href={`/?region=${region.slug}`}
        >
          返回战略地图
        </Link>
        <span>{String(page.total).padStart(2, "0")} 份已公开档案</span>
      </div>

      <header className="territory-panel__header">
        <span>SECTOR / {region.slug.toUpperCase()}</span>
        <h1 ref={headingRef} id="territory-heading" tabIndex={-1}>
          {region.label}
        </h1>
        <p>{region.description}</p>
      </header>

      <div className="territory-filters" aria-label="可用筛选维度">
        {region.filterKeys.map((key) => (
          <span key={key}>{FIELD_LABELS[key] ?? key}</span>
        ))}
      </div>

      <div className="territory-feed">
        {page.items.length === 0 ? (
          <p className="territory-empty">该领地还没有公开档案。</p>
        ) : (
          page.items.map((item, index) => (
            <article key={item.id} className="intel-row">
              <span className="intel-row__index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="intel-row__body">
                <div className="intel-row__meta">
                  <span>{item.nickname ?? "匿名"}</span>
                  <time dateTime={item.publishedAt}>
                    {dateFormatter.format(new Date(item.publishedAt))}
                  </time>
                </div>
                <h2>
                  <Link href={`/content/${item.id}`}>{item.title}</Link>
                </h2>
                {item.summary ? <p>{item.summary}</p> : null}
                <ul aria-label={`${item.title}标签`}>
                  {item.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              </div>
              <span className="intel-row__arrow" aria-hidden="true">
                ↗
              </span>
            </article>
          ))
        )}
      </div>

      <footer className="territory-panel__footer">
        <span>公开投稿需经站点维护者审批</span>
        <Link className="territory-panel__submit" href={`/submit/${region.slug}`}>
          向该领地投稿
        </Link>
      </footer>
    </section>
  );
}
