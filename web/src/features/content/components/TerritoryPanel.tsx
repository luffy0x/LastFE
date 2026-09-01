"use client";

import { useRef } from "react";
import Link from "next/link";
import type { RegionDefinition } from "@/features/map/types";
import { useMobileSheetFocus } from "../hooks/use-mobile-sheet-focus";
import type { ContentSummary, Page } from "../types";

type TerritoryPanelProps = {
  region: RegionDefinition;
  page: Page<ContentSummary>;
  query?: Readonly<Record<string, string>>;
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

export function TerritoryPanel({ region, page, query = {} }: TerritoryPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useMobileSheetFocus(panelRef, headingRef);
  const hasActiveQuery = Object.keys(query).length > 0;
  const pageCount = Math.max(1, Math.ceil(page.total / page.pageSize));
  const pageHref = (pageNumber: number) => {
    const parameters = new URLSearchParams(query);
    if (pageNumber > 1) parameters.set("page", String(pageNumber));
    const search = parameters.toString();
    return `/regions/${region.slug}${search ? `?${search}` : ""}`;
  };

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

      <form className="territory-filters" role="search" method="get">
        <label>
          <span>领地搜索</span>
          <input
            type="search"
            name="q"
            defaultValue={query.q ?? ""}
            placeholder="搜索公开情报"
          />
        </label>
        {region.filterKeys.map((key) => {
          const field = region.submissionFields.find(({ name }) => name === key);
          return (
            <label key={key}>
              <span>{FIELD_LABELS[key] ?? key}</span>
              {field?.kind === "select" ? (
                <select name={key} defaultValue={query[key] ?? ""}>
                  <option value="">全部</option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  name={key}
                  defaultValue={query[key] ?? ""}
                />
              )}
            </label>
          );
        })}
        <button type="submit">应用筛选</button>
      </form>

      <div className="territory-feed">
        {page.items.length === 0 ? (
          <div className="territory-empty">
            <p>
              {hasActiveQuery || page.page > 1
                ? "没有符合当前条件的公开档案。"
                : "该领地还没有公开档案。"}
            </p>
            {hasActiveQuery || page.page > 1 ? (
              <Link href={`/regions/${region.slug}`}>清除搜索与筛选</Link>
            ) : null}
          </div>
        ) : (
          page.items.map((item, index) => (
            <article key={item.id} className="intel-row">
              <span className="intel-row__index">
                {String((page.page - 1) * page.pageSize + index + 1).padStart(
                  2,
                  "0",
                )}
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

      {pageCount > 1 ? (
        <nav className="territory-pagination" aria-label="内容分页">
          {page.page > 1 ? (
            <Link rel="prev" href={pageHref(page.page - 1)}>
              上一页
            </Link>
          ) : (
            <span />
          )}
          <span>
            第 {page.page} / {pageCount} 页
          </span>
          {page.page < pageCount ? (
            <Link rel="next" href={pageHref(page.page + 1)}>
              下一页
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}

      <footer className="territory-panel__footer">
        <span>公开投稿需经站点维护者审批</span>
        <Link href={`/submit/${region.slug}`}>向{region.label}投稿</Link>
      </footer>
    </section>
  );
}
