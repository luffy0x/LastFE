import { fixtureContentRepository } from "./fixture-repository";
import { getSupabaseAdmin } from "@/server/supabase/admin";
import { createSupabaseContentRepository } from "@/server/content/supabase-repository";
import type {
  ContentQuery,
  ContentRecord,
  ContentSummary,
  Page,
  PublishedStats,
} from "./types";

export type ContentRepository = {
  list(query: ContentQuery): Promise<Page<ContentSummary>>;
  get(id: string): Promise<ContentRecord | null>;
  stats(now?: Date): Promise<PublishedStats>;
};

export function getContentRepository(): ContentRepository {
  if (process.env.CONTENT_REPOSITORY === "supabase") {
    return createSupabaseContentRepository(getSupabaseAdmin());
  }

  return fixtureContentRepository;
}
