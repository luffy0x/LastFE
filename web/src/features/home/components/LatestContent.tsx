import { ContentAccordion } from "@/features/content/components/ContentAccordion";
import type { ContentSummary } from "@/features/content/types";

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

  return <ContentAccordion items={items} defaultOpenIds={[items[0].id]} idPrefix="latest" />;
}
