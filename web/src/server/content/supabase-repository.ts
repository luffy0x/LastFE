import type {
  ContentQuery,
  ContentRecord,
  ContentSummary,
  Page,
  PublishedStats,
} from "@/features/content/types";
import type { ContentRepository } from "@/features/content/repository";
import { buildContentSearchFilter } from "./search";

type QueryResponse<T> = {
  data: T;
  error: { message: string } | null;
  count?: number | null;
};

type QueryBuilder = {
  select(columns: string, options?: { count?: "exact"; head?: boolean }): QueryBuilder;
  eq(column: string, value: string): QueryBuilder;
  gte(column: string, value: string): QueryBuilder;
  in(column: string, values: readonly string[]): QueryBuilder;
  or(filters: string): QueryBuilder;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder;
  range(from: number, to: number): QueryBuilder;
  maybeSingle<T>(): Promise<QueryResponse<T | null>>;
  then<TResult1 = QueryResponse<unknown>, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse<unknown>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
};

export type SupabaseContentClient = {
  from(table: string): unknown;
};

type TypedSupabaseContentClient = {
  from(table: string): {
    select(
      columns: string,
      options?: { count?: "exact"; head?: boolean },
    ): QueryBuilder;
  };
};

type ContentTagRow = { tags?: { label?: string } | null };

type RawContentRow = {
  id: string;
  region_slug: string;
  status: "published" | "withdrawn";
  title: string;
  summary: string | null;
  nickname: string | null;
  markdown: string | null;
  external_url: string | null;
  metadata_json: unknown;
  created_at: string;
  published_at: string | null;
  updated_at: string;
  content_tags?: ContentTagRow[] | null;
};

const CONTENT_SELECT =
  "id,region_slug,status,title,summary,nickname,markdown,external_url,metadata_json,created_at,published_at,updated_at,content_tags(tags(label))";

function metadataFrom(value: unknown): Readonly<Record<string, string>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, item]) => key.length > 0 && typeof item === "string",
    ),
  );
}

function tagsFrom(row: RawContentRow): readonly string[] {
  return (row.content_tags ?? [])
    .map((relation) => relation.tags?.label)
    .filter((label): label is string => Boolean(label));
}

function toSummary(row: RawContentRow): ContentSummary {
  if (!row.published_at) {
    throw new Error(`Published content ${row.id} is missing published_at`);
  }

  return {
    id: row.id,
    regionSlug: row.region_slug,
    title: row.title,
    summary: row.summary,
    nickname: row.nickname,
    tags: tagsFrom(row),
    publishedAt: row.published_at,
    metadata: metadataFrom(row.metadata_json),
  };
}

function toRecord(row: RawContentRow): ContentRecord {
  return {
    ...toSummary(row),
    markdown: row.markdown,
    externalUrl: row.external_url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function throwQueryError(error: { message: string } | null): void {
  if (error) throw new Error(`Supabase content query failed: ${error.message}`);
}

export function createSupabaseContentRepository(
  client: SupabaseContentClient,
): ContentRepository {
  const queryClient = client as unknown as TypedSupabaseContentClient;

  return {
    async list(query: ContentQuery): Promise<Page<ContentSummary>> {
      let builder = queryClient
        .from("content")
        .select(CONTENT_SELECT, { count: "exact" })
        .eq("status", "published");

      if (query.regionSlug) builder = builder.eq("region_slug", query.regionSlug);

      if (query.tags?.length) {
        builder = builder.in("content_tags.tags.normalized", query.tags);
      }

      const searchFilter = query.search
        ? buildContentSearchFilter(query.search)
        : null;
      if (searchFilter) builder = builder.or(searchFilter);

      const result = await builder
        .order("published_at", { ascending: false })
        .order("id", { ascending: true })
        .range((query.page - 1) * query.pageSize, query.page * query.pageSize - 1);
      throwQueryError(result.error);

      return {
        items: ((result.data ?? []) as RawContentRow[]).map(toSummary),
        page: query.page,
        total: result.count ?? 0,
        pageSize: query.pageSize,
      };
    },

    async get(id: string): Promise<ContentRecord | null> {
      const result = await queryClient
        .from("content")
        .select(CONTENT_SELECT)
        .eq("status", "published")
        .eq("id", id)
        .maybeSingle<RawContentRow>();
      throwQueryError(result.error);

      return result.data ? toRecord(result.data) : null;
    },

    async stats(now = new Date()): Promise<PublishedStats> {
      const totalQuery = await queryClient
        .from("content")
        .select("id", { count: "exact", head: true })
        .eq("status", "published");
      throwQueryError(totalQuery.error);

      const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const recentQuery = await queryClient
        .from("content")
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
        .gte("published_at", cutoff.toISOString());
      throwQueryError(recentQuery.error);

      return {
        totalPublished: totalQuery.count ?? 0,
        recentPublished: recentQuery.count ?? 0,
      };
    },
  };
}
