import type {
  ContentQuery,
  ContentRecord,
  ContentSummary,
  Page,
  PublishedStats,
} from "../../features/content/types";
import type { ContentRepository } from "../../features/content/repository";
import { REGIONS } from "../../features/map/regions";
import type { SqliteDatabase } from "../db/client";
import { compareReviewEventIds } from "../moderation-ordering";
import {
  buildSearchPredicate,
  escapeLikeLiteral,
  normalizeTag,
  PAGE_SIZE,
} from "./search";

type PublishedContent = ContentRecord & { githubIssueNumber: number };

export type ModerationOrdering = {
  updatedAt: string;
  snapshotIdentity: string;
  authoritative: boolean;
  reviewSequence: { createdAt: string; eventId: string } | null;
};

export type ContentSyncCommand =
  | {
      deliveryId: string;
      action: "publish";
      record: PublishedContent;
      ordering: ModerationOrdering;
    }
  | {
      deliveryId: string;
      action: "withdraw" | "reject" | "ignore";
      issueNumber: number;
      ordering: ModerationOrdering;
    };

export interface ContentModerationStore {
  apply(command: ContentSyncCommand): Promise<"applied" | "duplicate" | "stale">;
}

type ContentRow = {
  id: string;
  github_issue_number: number;
  region_slug: string;
  status: "published" | "withdrawn";
  title: string;
  summary: string | null;
  nickname: string | null;
  markdown: string | null;
  external_url: string | null;
  metadata_json: string;
  created_at: string;
  published_at: string;
  updated_at: string;
};

function parseMetadata(metadataJson: string): Readonly<Record<string, string>> {
  let value: unknown;
  try {
    value = JSON.parse(metadataJson);
  } catch {
    throw new Error("Invalid content metadata");
  }
  if (
    value === null ||
    Array.isArray(value) ||
    typeof value !== "object" ||
    Object.values(value).some((item) => typeof item !== "string")
  ) {
    throw new Error("Invalid content metadata");
  }
  return value as Readonly<Record<string, string>>;
}

function toRecord(
  database: SqliteDatabase,
  row: ContentRow,
): ContentRecord {
  const tags = database
    .prepare(
      `SELECT t.label
       FROM content_tags ct
       JOIN tags t ON t.id = ct.tag_id
       WHERE ct.content_id = ?
       ORDER BY t.id ASC`,
    )
    .all(row.id) as Array<{ label: string }>;
  return {
    id: row.id,
    regionSlug: row.region_slug,
    title: row.title,
    summary: row.summary,
    nickname: row.nickname,
    tags: tags.map(({ label }) => label),
    publishedAt: row.published_at,
    metadata: parseMetadata(row.metadata_json),
    markdown: row.markdown,
    externalUrl: row.external_url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSummary(database: SqliteDatabase, row: ContentRow): ContentSummary {
  const record = toRecord(database, row);
  return {
    id: record.id,
    regionSlug: record.regionSlug,
    title: record.title,
    summary: record.summary,
    nickname: record.nickname,
    tags: record.tags,
    publishedAt: record.publishedAt,
    metadata: record.metadata,
  };
}

function queryPage(query: ContentQuery): number {
  return Number.isSafeInteger(query.page) && query.page > 0 ? query.page : 1;
}

function compareReviewSequences(
  left: NonNullable<ModerationOrdering["reviewSequence"]>,
  right: NonNullable<ModerationOrdering["reviewSequence"]>,
): number {
  const leftTimestamp = Date.parse(left.createdAt);
  const rightTimestamp = Date.parse(right.createdAt);
  if (leftTimestamp !== rightTimestamp) {
    return leftTimestamp < rightTimestamp ? -1 : 1;
  }
  return compareReviewEventIds(left.eventId, right.eventId);
}

export function createSqliteContentStores(database: SqliteDatabase): {
  repository: ContentRepository;
  moderation: ContentModerationStore;
} {
  const repository: ContentRepository = {
    async list(query) {
      const where = ["c.status = 'published'"];
      const params: Array<string | number> = [];
      if (query.regionSlug) {
        where.push("c.region_slug = ?");
        params.push(query.regionSlug);
      }
      if (query.search?.trim()) {
        const predicate = buildSearchPredicate(query.search);
        where.push(predicate.sql);
        params.push(...predicate.params);
      }
      if (query.tags?.length) {
        const normalizedTags = [...new Set(query.tags.map(normalizeTag).filter(Boolean))];
        if (normalizedTags.length > 0) {
          where.push(`(
            SELECT COUNT(DISTINCT filtered_t.normalized)
            FROM content_tags filtered_ct
            JOIN tags filtered_t ON filtered_t.id = filtered_ct.tag_id
            WHERE filtered_ct.content_id = c.id
              AND filtered_t.normalized IN (${normalizedTags.map(() => "?").join(", ")})
          ) = ?`);
          params.push(...normalizedTags, normalizedTags.length);
        }
      }
      for (const [key, value] of Object.entries(query.filters ?? {})) {
        const region = REGIONS.find(({ slug }) => slug === query.regionSlug);
        const isMetadataFilter =
          key !== "tags" &&
          region?.filterKeys.some((filterKey) => filterKey === key);
        if (!isMetadataFilter) {
          throw new Error(`Unsupported content filter: ${key}`);
        }
        const normalized = normalizeTag(value);
        if (!normalized) continue;
        where.push(
          "LOWER(COALESCE(json_extract(c.metadata_json, ?), '')) LIKE ? ESCAPE '\\'",
        );
        params.push(`$.${key}`, `%${escapeLikeLiteral(normalized)}%`);
      }
      const predicate = where.join(" AND ");
      const count = database
        .prepare(`SELECT COUNT(*) AS total FROM contents c WHERE ${predicate}`)
        .get(...params) as { total: number };
      const page = queryPage(query);
      const rows = database
        .prepare(
          `SELECT c.* FROM contents c
           WHERE ${predicate}
           ORDER BY c.published_at DESC, c.id ASC
           LIMIT ? OFFSET ?`,
        )
        .all(...params, PAGE_SIZE, (page - 1) * PAGE_SIZE) as ContentRow[];

      return {
        items: rows.map((row) => toSummary(database, row)),
        page,
        total: count.total,
        pageSize: PAGE_SIZE,
      } satisfies Page<ContentSummary>;
    },

    async get(id) {
      const row = database
        .prepare("SELECT * FROM contents WHERE id = ? AND status = 'published'")
        .get(id) as ContentRow | undefined;
      return row ? toRecord(database, row) : null;
    },

    async stats(now = new Date()) {
      const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const result = database
        .prepare(
          `SELECT COUNT(*) AS totalPublished,
                  SUM(CASE WHEN published_at >= ? THEN 1 ELSE 0 END) AS recentPublished
           FROM contents WHERE status = 'published'`,
        )
        .get(cutoff) as { totalPublished: number; recentPublished: number | null };
      return {
        totalPublished: result.totalPublished,
        recentPublished: result.recentPublished ?? 0,
      } satisfies PublishedStats;
    },
  };

  const apply = database.transaction((command: ContentSyncCommand) => {
    const issueNumber =
      command.action === "publish"
        ? command.record.githubIssueNumber
        : command.issueNumber;
    const decision =
      command.action === "publish"
        ? "published"
        : command.action === "withdraw"
          ? "withdrawn"
          : command.action === "reject"
            ? "rejected"
            : "ignored";
    const incomingTimestamp = Date.parse(command.ordering.updatedAt);
    const reviewSequence = command.ordering.reviewSequence;
    if (
      !Number.isFinite(incomingTimestamp) ||
      !command.ordering.snapshotIdentity.trim() ||
      (reviewSequence !== null &&
        (!Number.isFinite(Date.parse(reviewSequence.createdAt)) ||
          !reviewSequence.eventId.trim()))
    ) {
      throw new Error("Invalid moderation ordering key");
    }

    const current = database
      .prepare(
        `SELECT updated_at, snapshot_identity,
                review_event_created_at, review_event_id, authoritative
         FROM moderation_issue_states
         WHERE github_issue_number = ?`,
      )
      .get(issueNumber) as
      | {
          updated_at: string;
          snapshot_identity: string;
          review_event_created_at: string | null;
          review_event_id: string | null;
          authoritative: 0 | 1;
        }
      | undefined;
    const delivery = database
      .prepare("INSERT OR IGNORE INTO webhook_deliveries (delivery_id, processed_at) VALUES (?, ?)")
      .run(command.deliveryId, new Date().toISOString());
    if (delivery.changes === 0) {
      const stillCurrent =
        current &&
        incomingTimestamp === Date.parse(current.updated_at) &&
        command.ordering.snapshotIdentity === current.snapshot_identity;
      return stillCurrent ? ("duplicate" as const) : ("stale" as const);
    }
    if (current) {
      const currentTimestamp = Date.parse(current.updated_at);
      const isOlder = incomingTimestamp < currentTimestamp;
      const currentReviewSequence =
        current.review_event_created_at !== null &&
        current.review_event_id !== null
          ? {
              createdAt: current.review_event_created_at,
              eventId: current.review_event_id,
            }
          : null;
      const isUnresolvedTie = incomingTimestamp === currentTimestamp && (
        !command.ordering.authoritative ||
        (current.authoritative === 1 &&
          (reviewSequence === null ||
            (currentReviewSequence !== null &&
              compareReviewSequences(reviewSequence, currentReviewSequence) <= 0)))
      );
      if (isOlder || isUnresolvedTie) return "stale" as const;
    }

    database
      .prepare(
        `INSERT INTO moderation_issue_states (
           github_issue_number, decision, updated_at, snapshot_identity,
           review_event_created_at, review_event_id, authoritative
         ) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(github_issue_number) DO UPDATE SET
           decision = excluded.decision,
           updated_at = excluded.updated_at,
           snapshot_identity = excluded.snapshot_identity,
           review_event_created_at = excluded.review_event_created_at,
           review_event_id = excluded.review_event_id,
           authoritative = excluded.authoritative`,
      )
      .run(
        issueNumber,
        decision,
        command.ordering.updatedAt,
        command.ordering.snapshotIdentity,
        reviewSequence?.createdAt ?? null,
        reviewSequence?.eventId ?? null,
        command.ordering.authoritative ? 1 : 0,
      );

    if (command.action !== "publish") {
      if (command.action === "withdraw" || command.action === "reject") {
        database
          .prepare(
            `UPDATE contents
             SET status = 'withdrawn', updated_at = ?
             WHERE github_issue_number = ?`,
          )
          .run(command.ordering.updatedAt, command.issueNumber);
      }
      return "applied" as const;
    }

    const content = command.record;
    const transition = database
      .prepare(
        `INSERT INTO contents (
          id, github_issue_number, region_slug, status, title, summary, nickname,
          markdown, external_url, metadata_json, created_at, published_at, updated_at
        ) VALUES (?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(github_issue_number) DO UPDATE SET
          region_slug = excluded.region_slug,
          status = 'published',
          title = excluded.title,
          summary = excluded.summary,
          nickname = excluded.nickname,
          markdown = excluded.markdown,
          external_url = excluded.external_url,
          metadata_json = excluded.metadata_json,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at`,
      )
      .run(
        content.id,
        content.githubIssueNumber,
        content.regionSlug,
        content.title,
        content.summary,
        content.nickname,
        content.markdown,
        content.externalUrl,
        JSON.stringify(content.metadata),
        content.createdAt,
        content.publishedAt,
        content.updatedAt,
      );
    if (transition.changes === 0) return "applied" as const;

    const stored = database
      .prepare("SELECT id FROM contents WHERE github_issue_number = ?")
      .get(content.githubIssueNumber) as { id: string };
    database.prepare("DELETE FROM content_tags WHERE content_id = ?").run(stored.id);
    const acceptedTags = new Set<string>();
    for (const label of content.tags) {
      const normalized = normalizeTag(label);
      if (!normalized || acceptedTags.has(normalized)) continue;
      acceptedTags.add(normalized);
      database
        .prepare("INSERT INTO tags (normalized, label) VALUES (?, ?) ON CONFLICT(normalized) DO NOTHING")
        .run(normalized, label.normalize().trim());
      const tag = database
        .prepare("SELECT id FROM tags WHERE normalized = ?")
        .get(normalized) as { id: number };
      database
        .prepare("INSERT INTO content_tags (content_id, tag_id) VALUES (?, ?)")
        .run(stored.id, tag.id);
    }
    return "applied" as const;
  });

  return {
    repository,
    moderation: { async apply(command) { return apply(command); } },
  };
}
