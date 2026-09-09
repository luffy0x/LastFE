import type { ContentSummary } from "@/features/content/types";

import { ContentCard } from "./ContentCard";

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
    <div className="content-card-list">
      {items.map((item) => (
        <ContentCard key={item.id} item={item} showCategory />
      ))}
    </div>
  );
}
