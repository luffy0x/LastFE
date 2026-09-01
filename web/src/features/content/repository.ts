import "server-only";

import { getSqlitePath } from "@/server/config";
import { createSqliteContentStores } from "@/server/content/sqlite-repository";
import { openDatabase } from "@/server/db/client";
import { migrate } from "@/server/db/migrate";
import type {
  ContentQuery,
  ContentRecord,
  ContentSummary,
  Page,
  PublishedStats,
} from "./types";

export interface ContentRepository {
  list(query: ContentQuery): Promise<Page<ContentSummary>>;
  get(id: string): Promise<ContentRecord | null>;
  stats(now?: Date): Promise<PublishedStats>;
}

const globalRepository = globalThis as typeof globalThis & {
  __knowledgeFrontierContentRepository?: ContentRepository;
};

export function getContentRepository(): ContentRepository {
  if (!globalRepository.__knowledgeFrontierContentRepository) {
    const database = openDatabase(getSqlitePath());
    migrate(database);
    globalRepository.__knowledgeFrontierContentRepository =
      createSqliteContentStores(database).repository;
  }
  return globalRepository.__knowledgeFrontierContentRepository;
}
