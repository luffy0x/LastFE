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
    github_issue_number: options.issue.number,
    event_name: `${options.eventName}:${status}`,
  })) as { error?: null | { message: string } };

  if (result?.error) {
    throw new Error(`Supabase moderation event write failed: ${result.error.message}`);
  }
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

export async function syncGitHubIssue(
  options: SyncGitHubIssueOptions,
): Promise<SyncGitHubIssueResult> {
  const client = asWriter(options.client);
  const contentId = `github-issue-${options.issue.number}`;

  if (await assertNoPriorDelivery(client, options.deliveryId)) {
    return { status: "duplicate" };
  }

  if (!hasLabel(options.issue, "submission")) {
    await recordDelivery(client, options, "ignored");
    return { status: "ignored" };
  }

  if (hasLabel(options.issue, "unpublish")) {
    const result = (await client
      .from("content")
      .update({ status: "withdrawn", updated_at: (options.now ?? new Date()).toISOString() })
      .eq("github_issue_number", options.issue.number)) as {
      error?: null | { message: string };
    };
    if (result?.error) {
      throw new Error(`Supabase content withdrawal failed: ${result.error.message}`);
    }
    await recordDelivery(client, options, "withdrawn");
    return { status: "withdrawn", contentId };
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
  const upsertResult = (await client.from("content").upsert(
    {
      id: contentId,
      github_issue_number: options.issue.number,
      region_slug: submission.regionSlug,
      status: "published",
      title: submission.title,
      summary: summaryFrom(submission.markdown, submission.summary),
      nickname: submission.nickname,
      markdown: submission.markdown,
      external_url: submission.externalUrl,
      metadata_json: submission.metadata,
      published_at: timestamp,
      updated_at: timestamp,
    },
    { onConflict: "github_issue_number" },
  )) as { error?: null | { message: string } };
  if (upsertResult?.error) {
    throw new Error(`Supabase content upsert failed: ${upsertResult.error.message}`);
  }

  await storeContentTags(client, contentId, submission.tags);
  await recordDelivery(client, options, "published");
  return { status: "published", contentId };
}
