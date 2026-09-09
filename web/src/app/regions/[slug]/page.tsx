import { notFound } from "next/navigation";
import { connection } from "next/server";

import { CATEGORIES } from "@/features/content/categories";
import { CategoryPage } from "@/features/content/components/CategoryPage";
import { getContentRepository } from "@/features/content/repository";
import { parsePage } from "@/server/content/search";

export function generateStaticParams() {
  return CATEGORIES.filter(({ enabled }) => enabled).map(({ slug }) => ({
    slug,
  }));
}

export default async function RegionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { slug } = await params;
  const category = CATEGORIES.find(
    (candidate) => candidate.slug === slug && candidate.enabled,
  );
  if (!category) notFound();

  const rawQuery = await searchParams;
  const firstValue = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : value?.[0];
  const query = Object.fromEntries(
    ["q", ...category.filterKeys]
      .map((key) => [key, firstValue(rawQuery[key])?.trim()] as const)
      .filter(
        (entry): entry is readonly [string, string] => Boolean(entry[1]),
      ),
  );
  const tags = query.tags
    ?.split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  const filters = Object.fromEntries(
    category.filterKeys
      .filter((key) => key !== "tags" && query[key])
      .map((key) => [key, query[key]]),
  );

  const page = await getContentRepository().list({
    regionSlug: category.slug,
    search: query.q,
    tags,
    filters,
    page: parsePage(firstValue(rawQuery.page)),
    pageSize: 20,
  });

  return (
    <main id="main-content" className="category-page site-container">
      <CategoryPage category={category} page={page} query={query} />
    </main>
  );
}
