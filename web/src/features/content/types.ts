export type ContentStatus = "published" | "withdrawn";

export type ContentSummary = {
  id: string;
  regionSlug: string;
  title: string;
  summary: string | null;
  nickname: string | null;
  tags: readonly string[];
  publishedAt: string;
  metadata: Readonly<Record<string, string>>;
};

export type ContentRecord = ContentSummary & {
  markdown: string | null;
  externalUrl: string | null;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
};

export type ContentQuery = {
  regionSlug?: string;
  search?: string;
  tags?: readonly string[];
  filters?: Readonly<Record<string, string>>;
  page: number;
  pageSize: 20;
};

export type Page<T> = {
  items: readonly T[];
  page: number;
  total: number;
  pageSize: number;
};

export type PublishedStats = {
  totalPublished: number;
  recentPublished: number;
};
