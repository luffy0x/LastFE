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

export function normalizeTag(tag: string): string {
  return tag.normalize().trim().toLowerCase();
}

export function escapeLikeLiteral(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function buildSearchPredicate(search: string): {
  sql: string;
  params: string[];
} {
  const pattern = `%${escapeLikeLiteral(normalizeTag(search))}%`;
  const tags = `EXISTS (
    SELECT 1 FROM content_tags search_ct
    JOIN tags search_t ON search_t.id = search_ct.tag_id
    WHERE search_ct.content_id = c.id AND search_t.normalized LIKE ? ESCAPE '\\'
  )`;
  const matches = (...fields: string[]) =>
    `(${[
      ...fields.map(
        (field) => `LOWER(COALESCE(${field}, '')) LIKE ? ESCAPE '\\'`,
      ),
      tags,
    ].join(" OR ")})`;

  const regions = [
    ["interview", matches("c.title", "json_extract(c.metadata_json, '$.companyDepartment')", "json_extract(c.metadata_json, '$.position')", "c.markdown")],
    ["resources", matches("c.title", "c.summary")],
    ["fundamentals", matches("c.title", "json_extract(c.metadata_json, '$.category')", "c.markdown")],
    ["projects", matches("c.title", "json_extract(c.metadata_json, '$.techStack')", "c.markdown")],
    ["algorithms", matches("c.title", "json_extract(c.metadata_json, '$.source')", "json_extract(c.metadata_json, '$.difficulty')", "c.markdown")],
  ] as const;

  const params: string[] = [];
  const sql = regions
    .map(([region, clause]) => {
      const placeholders = (clause.match(/\?/g) ?? []).length;
      params.push(region, ...Array.from({ length: placeholders }, () => pattern));
      return `(c.region_slug = ? AND ${clause})`;
    })
    .join(" OR ");

  return { sql: `(${sql})`, params };
}
