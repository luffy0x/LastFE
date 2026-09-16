import { createHash } from "node:crypto";
import { normalizeTag } from "@/features/content/submission-schemas";
import type { SupabaseContentClient } from "@/server/content/supabase-repository";
import { parseSubmissionIssueBody } from "./issue-codec";

export type GitHubIssueSnapshot = {
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: readonly string[];
};

type SyncGitHubIssueOptions = {
  client: SupabaseContentClient;
  deliveryId: string;
  eventName: string;
  repository: string;
  issue: GitHubIssueSnapshot;
  now?: Date;
};

export type SyncGitHubIssueResult =
  | { status: "duplicate" }
  | { status: "ignored" }
  | { status: "rejected" }
  | { status: "published"; contentId: string }
  | { status: "withdrawn"; contentId: string };

type SupabaseWriteClient = {
  from(table: string): {
    select(columns: string, options?: Record<string, unknown>): unknown;
    insert(values: unknown): unknown;
    upsert(values: unknown, options?: Record<string, unknown>): unknown;
    update(values: unknown): { eq(column: string, value: unknown): unknown };
    delete(): { eq(column: string, value: unknown): unknown };
  };
};

function asWriter(client: SupabaseContentClient): SupabaseWriteClient {
  return client as unknown as SupabaseWriteClient;
}

async function maybeSingle<T>(query: unknown): Promise<{ data: T | null; error: null | { message: string } }> {
  const result = await (query as {
    maybeSingle(): Promise<{ data: T | null; error: null | { message: string } }>;
  }).maybeSingle();
  return result;
}

async function recordDelivery(
  client: SupabaseWriteClient,
  options: SyncGitHubIssueOptions,
  status: string,
): Promise<void> {
  const result = (await client.from("moderation_events").insert({
    delivery_id: options.deliveryId,
    github_repository: normalizeGitHubRepository(options.repository),
    github_issue_number: options.issue.number,
    event_name: `${options.eventName}:${status}`,
  })) as { error?: null | { message: string } };

  if (result?.error) {
    throw new Error(`Supabase moderation event write failed: ${result.error.message}`);
  }
}

export function normalizeGitHubRepository(repository: string): string {
  return repository.trim().toLocaleLowerCase();
}

function newContentId(repository: string, issueNumber: number): string {
  const repositoryKey = createHash("sha256")
    .update(normalizeGitHubRepository(repository))
    .digest("hex")
    .slice(0, 12);
  return `github-repo-${repositoryKey}-issue-${issueNumber}`;
}

async function storeContentTags(
  client: SupabaseWriteClient,
  contentId: string,
  tags: readonly string[],
): Promise<void> {
  await client.from("content_tags").delete().eq("content_id", contentId);

  for (const tag of tags) {
    const label = tag.trim();
    const normalized = normalizeTag(label);
    const tagWrite = client
      .from("tags")
      .upsert({ label, normalized }, { onConflict: "normalized" }) as {
      select(columns: string): unknown;
    };
    const tagResult = await maybeSingle<{ id: number }>(tagWrite.select("id"));
    if (tagResult.error) {
      throw new Error(`Supabase tag upsert failed: ${tagResult.error.message}`);
    }
    if (!tagResult.data?.id) {
      throw new Error("Supabase tag upsert did not return an id");
    }

    const relationResult = (await client.from("content_tags").upsert(
      { content_id: contentId, tag_id: tagResult.data.id },
      { onConflict: "content_id,tag_id" },
    )) as { error?: null | { message: string } };
    if (relationResult?.error) {
      throw new Error(
        `Supabase content tag upsert failed: ${relationResult.error.message}`,
      );
    }
  }
}

function hasLabel(issue: GitHubIssueSnapshot, label: string): boolean {
  return issue.labels.some(
    (candidate) => candidate.trim().toLocaleLowerCase() === label,
  );
}

function summaryFrom(markdown: string | null, fallback: string | null): string | null {
  if (fallback) return fallback;
  if (!markdown) return null;

  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

async function assertNoPriorDelivery(
  client: SupabaseWriteClient,
  deliveryId: string,
): Promise<boolean> {
  const query = (client.from("moderation_events").select("delivery_id") as {
    eq(column: string, value: unknown): unknown;
  }).eq("delivery_id", deliveryId);
  const result = await maybeSingle<{ delivery_id: string }>(query);
  if (result.error) {
    throw new Error(`Supabase moderation event lookup failed: ${result.error.message}`);
  }

  return Boolean(result.data);
}

async function existingContent(
  client: SupabaseWriteClient,
  repository: string,
  issueNumber: number,
): Promise<{ id: string; published_at: string } | null> {
  const query = client.from("content").select("id,published_at") as {
    eq(column: string, value: unknown): {
      eq(column: string, value: unknown): unknown;
    };
  };
  const result = await maybeSingle<{ id: string; published_at: string }>(
    query
      .eq("github_repository", normalizeGitHubRepository(repository))
      .eq("github_issue_number", issueNumber),
  );
  if (result.error) {
    throw new Error(`Supabase content lookup failed: ${result.error.message}`);
  }

  return result.data;
}

export async function syncGitHubIssue(
  options: SyncGitHubIssueOptions,
): Promise<SyncGitHubIssueResult> {
  const client = asWriter(options.client);
  const repository = normalizeGitHubRepository(options.repository);
  const generatedContentId = newContentId(repository, options.issue.number);

  if (await assertNoPriorDelivery(client, options.deliveryId)) {
    return { status: "duplicate" };
  }

  if (!hasLabel(options.issue, "submission")) {
    await recordDelivery(client, options, "ignored");
    return { status: "ignored" };
  }

  if (hasLabel(options.issue, "unpublish")) {
    const withdrawal = client
      .from("content")
      .update({ status: "withdrawn", updated_at: (options.now ?? new Date()).toISOString() }) as {
      eq(column: string, value: unknown): {
        eq(column: string, value: unknown): unknown;
      };
    };
    const result = (await withdrawal
      .eq("github_repository", repository)
      .eq("github_issue_number", options.issue.number)) as {
      error?: null | { message: string };
    };
    if (result?.error) {
      throw new Error(`Supabase content withdrawal failed: ${result.error.message}`);
    }
    await recordDelivery(client, options, "withdrawn");
    return { status: "withdrawn", contentId: generatedContentId };
  }

  if (!hasLabel(options.issue, "approved")) {
    if (options.issue.state === "closed") {
      await recordDelivery(client, options, "rejected");
      return { status: "rejected" };
    }
    await recordDelivery(client, options, "ignored");
    return { status: "ignored" };
  }

  const submission = parseSubmissionIssueBody(options.issue.body ?? "");
  const timestamp = (options.now ?? new Date()).toISOString();
  // 首次发布才写 published_at；重新同步（如 reconcile）必须保留原始发布日期
  const existing = await existingContent(client, repository, options.issue.number);
  const contentId = existing?.id ?? generatedContentId;
  const publishedAt = existing?.published_at ?? timestamp;
  const upsertResult = (await client.from("content").upsert(
    {
      id: contentId,
      github_repository: repository,
      github_issue_number: options.issue.number,
      region_slug: submission.regionSlug,
      status: "published",
      title: submission.title,
      summary: summaryFrom(submission.markdown, submission.summary),
      nickname: submission.nickname,
      markdown: submission.markdown,
      external_url: submission.externalUrl,
      metadata_json: submission.metadata,
      published_at: publishedAt,
      updated_at: timestamp,
    },
    { onConflict: "github_repository,github_issue_number" },
  )) as { error?: null | { message: string } };
  if (upsertResult?.error) {
    throw new Error(`Supabase content upsert failed: ${upsertResult.error.message}`);
  }

  await storeContentTags(client, contentId, submission.tags);
  await recordDelivery(client, options, "published");
  return { status: "published", contentId };
}
