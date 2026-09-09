import Link from "next/link";

import { getCategory } from "@/features/content/categories";
import type { ContentSummary } from "@/features/content/types";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type ContentCardProps = {
  item: ContentSummary;
  showCategory?: boolean;
};

export function ContentCard({ item, showCategory = false }: ContentCardProps) {
  const category = getCategory(item.regionSlug);

  return (
    <article className="content-card">
      <div className="content-card__meta">
        {showCategory ? (
          <span className="content-card__category">
            {category?.label ?? item.regionSlug}
          </span>
        ) : null}
        <span>{item.nickname ?? "匿名"}</span>
        <time dateTime={item.publishedAt}>
          {dateFormatter.format(new Date(item.publishedAt))}
        </time>
      </div>
      <h3>
        <Link href={`/content/${item.id}`}>{item.title}</Link>
      </h3>
      {item.summary ? <p>{item.summary}</p> : null}
      {item.tags.length > 0 ? (
        <ul className="tag-list" aria-label={`${item.title}标签`}>
          {item.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
