import type { ContentRepository } from "@/features/content/repository";
import type { ContentSummary } from "@/features/content/types";
import { REGIONS } from "@/features/map/regions";

export const PAGE_SIZE = 20;

export type SearchGroup = {
  regionSlug: string;
  items: readonly ContentSummary[];
};

export function parsePage(value: string | undefined): number {
  if (!value) return 1;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1;
}

export async function searchAll(
  repository: ContentRepository,
  query: string,
): Promise<readonly SearchGroup[]> {
  const search = query.trim();
  const pages = await Promise.all(
    REGIONS.filter(({ enabled }) => enabled).map(async ({ slug }) => ({
      regionSlug: slug,
      page: await repository.list({
        regionSlug: slug,
        search,
        page: 1,
        pageSize: PAGE_SIZE,
      }),
    })),
  );

  return pages
    .filter(({ page }) => page.items.length > 0)
    .map(({ regionSlug, page }) => ({ regionSlug, items: page.items }));
}

export function escapeSearchTerm(value: string): string {
  return value.trim().replace(/\\/g, "\\\\").replace(/[%_,()]/g, "\\$&");
}

export function buildContentSearchFilter(search: string): string | null {
  const term = escapeSearchTerm(search);
  if (!term) return null;

  const pattern = `*${term}*`;
  return [
    `title.ilike.${pattern}`,
    `summary.ilike.${pattern}`,
    `markdown.ilike.${pattern}`,
    `metadata_json->>companyDepartment.ilike.${pattern}`,
    `metadata_json->>position.ilike.${pattern}`,
    `metadata_json->>category.ilike.${pattern}`,
    `metadata_json->>techStack.ilike.${pattern}`,
    `metadata_json->>source.ilike.${pattern}`,
    `metadata_json->>difficulty.ilike.${pattern}`,
  ].join(",");
}
