import { ContentCard, contentCardTint } from "@/components/ContentCard";
import { getCategory } from "@/features/content/categories";
import type { ContentSummary } from "@/features/content/types";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type LatestContentProps = {
  items: readonly ContentSummary[];
};

export function LatestContent({ items }: LatestContentProps) {
  if (items.length === 0) {
    return (
      <div className="category-empty">
        <p>还没有公开内容，欢迎成为第一位投稿者。</p>
      </div>
    );
  }

  return (
    <div className="content-grid">
      {items.map((item, index) => {
        const category = getCategory(item.regionSlug);
        return (
          <ContentCard
            key={item.id}
            href={`/content/${item.id}`}
            title={item.title}
            eyebrow={`${category?.label ?? item.regionSlug} · ${dateFormatter.format(new Date(item.publishedAt))}`}
            description={item.summary ?? undefined}
            tint={contentCardTint(index)}
          />
        );
      })}
    </div>
  );
}
