"use client";

import { useState } from "react";
import Link from "next/link";

import { getCategory } from "@/features/content/categories";
import type { ContentSummary } from "@/features/content/types";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
});

type LatestContentProps = {
  items: readonly ContentSummary[];
};

export function LatestContent({ items }: LatestContentProps) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  if (items.length === 0) {
    return (
      <div className="category-empty">
        <p>还没有公开内容，欢迎成为第一位投稿者。</p>
      </div>
    );
  }

  return (
    <ul className="accordion-list">
      {items.map((item, index) => {
        const open = item.id === openId;
        const category = getCategory(item.regionSlug);
        const tint = ["blue", "violet", "graphite"][index % 3];
        const triggerId = `latest-trigger-${item.id}`;
        const panelId = `latest-panel-${item.id}`;

        return (
          <li
            key={item.id}
            className={`accordion-item accordion-item--${tint}`}
            data-open={open}
          >
            <h3 className="accordion-item__heading">
              <button
                type="button"
                id={triggerId}
                className="accordion-item__trigger"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenId(open ? null : item.id)}
              >
                <time className="accordion-item__date" dateTime={item.publishedAt}>
                  {dateFormatter.format(new Date(item.publishedAt))}
                </time>
                <span className="accordion-item__category">
                  {category?.label ?? item.regionSlug}
                </span>
                <span className="accordion-item__title">{item.title}</span>
                <svg
                  className="accordion-item__chevron"
                  viewBox="0 0 16 16"
                  width="16"
                  height="16"
                  aria-hidden="true"
                >
                  <path
                    d="M3.5 6l4.5 4.5L12.5 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </h3>
            <div
              id={panelId}
              className="accordion-item__panel"
              role="region"
              aria-labelledby={triggerId}
            >
              <div className="accordion-item__panel-inner">
                <div className="accordion-item__panel-content">
                  {item.summary ? <p>{item.summary}</p> : null}
                  {item.nickname ? (
                    <p className="accordion-item__author">
                      投稿人：{item.nickname}
                    </p>
                  ) : null}
                  {item.tags.length > 0 ? (
                    <ul className="tag-list" aria-label={`${item.title}标签`}>
                      {item.tags.map((tag) => (
                        <li key={tag}>{tag}</li>
                      ))}
                    </ul>
                  ) : null}
                  <Link
                    className="accordion-item__link"
                    href={`/content/${item.id}`}
                  >
                    阅读全文
                    <span aria-hidden="true">›</span>
                  </Link>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
