import { fixtureContentRepository } from "./fixture-repository";
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
  return fixtureContentRepository;
}
