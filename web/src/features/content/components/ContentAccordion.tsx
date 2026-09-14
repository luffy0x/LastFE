"use client";

import { useState } from "react";
import Link from "next/link";

import { getCategory } from "../categories";
import type { ContentSummary } from "../types";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
});

type ContentAccordionProps = {
  items: readonly ContentSummary[];
  defaultOpenIds?: readonly string[];
  idPrefix?: string;
};

export type ContentGroup = {
  id: string;
  title: string;
  items: readonly ContentSummary[];
};

type TopicAccordionProps = {
  groups: readonly ContentGroup[];
  groupLabel: string;
  idPrefix: string;
};

export function ContentAccordion({
  items,
  defaultOpenIds = [],
  idPrefix = "content-accordion",
}: ContentAccordionProps) {
  const [openIds, setOpenIds] = useState(() => new Set(defaultOpenIds));

  function toggleItem(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <ul className="accordion-list">
      {items.map((item, index) => {
        const open = openIds.has(item.id);
        const category = getCategory(item.regionSlug);
        const tint = ["blue", "violet", "graphite"][index % 3];
        const triggerId = `${idPrefix}-trigger-${item.id}`;
        const panelId = `${idPrefix}-panel-${item.id}`;

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
                onClick={() => toggleItem(item.id)}
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
                  <Link className="accordion-item__link" href={`/content/${item.id}`}>
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

export function TopicAccordion({
  groups,
  groupLabel,
  idPrefix,
}: TopicAccordionProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

  function toggleItem(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <ul className="accordion-list">
      {groups.map((group, index) => {
        const open = openIds.has(group.id);
        const tint = ["blue", "violet", "graphite"][index % 3];
        const triggerId = `${idPrefix}-trigger-${group.id}`;
        const panelId = `${idPrefix}-panel-${group.id}`;

        return (
          <li
            key={group.id}
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
                onClick={() => toggleItem(group.id)}
              >
                <span className="accordion-item__date">{group.items.length} 篇</span>
                <span className="accordion-item__category">{groupLabel}</span>
                <span className="accordion-item__title">{group.title}</span>
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
                  <ul className="accordion-item__subnav" aria-label={`${group.title}资料`}>
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <Link href={`/content/${item.id}`}>
                          <span>{item.title}</span>
                          <span aria-hidden="true">›</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
