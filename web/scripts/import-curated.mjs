import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const DEFAULT_CURATED_DIR = path.resolve(process.cwd(), "..", "..", "整理后的八股资料");
const MAX_MARKDOWN_LENGTH = 50 * 1024;
const DIFFICULTY_MAP = new Map([
  ["简单", "easy"],
  ["中等", "medium"],
  ["困难", "hard"],
]);

async function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  try {
    const content = await fs.readFile(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

export function extractSummary(markdown) {
  let inCodeBlock = false;
  for (const line of String(markdown ?? "").split(/\r?\n/)) {
    const value = line.trim();
    if (value.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (
      inCodeBlock
      || !value
      || value.startsWith("#")
      || value.startsWith(">")
      || value.startsWith("![")
      || value.startsWith("-")
      || /^\d+\.\s/.test(value)
      || /^\[.*\]$/.test(value)
    ) {
      continue;
    }
    return value.slice(0, 240);
  }
  return null;
}

function assertManifestEntry(entry, markdown) {
  if (!entry?.id || !entry?.title || !Array.isArray(entry.tags)) {
    throw new Error("清单条目缺少 ID、标题或标签");
  }
  if (!['fundamentals', 'algorithms'].includes(entry.region)) {
    throw new Error(`不支持的资料分区：${entry.region}`);
  }
  if (entry.tags.length === 0 || entry.tags.length > 5) {
    throw new Error(`资料标签数量无效：${entry.id}`);
  }
  if (entry.title.length > 120 || markdown.length > MAX_MARKDOWN_LENGTH) {
    throw new Error(`资料超出公开内容长度限制：${entry.id}`);
  }
}

export function toPublishedMarkdown(entry, markdown) {
  const reviewHeader = [
    `# ${entry.title}`,
    "",
    `> 分类：${entry.category}`,
    `> 标签：${entry.tags.join("、")}`,
    ...(entry.difficulty ? [`> 难度：${entry.difficulty}`] : []),
    `> 整理状态：${entry.status}`,
    "",
  ].join("\n");

  if (!markdown.startsWith(reviewHeader)) {
    throw new Error(`资料审核头与清单不一致：${entry.id}`);
  }
  return markdown.slice(reviewHeader.length);
}

function assertNoMalformedEmphasis(markdown, id) {
  let fenceMarker = null;

  for (const line of markdown.split(/\r?\n/)) {
    const fence = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      const marker = fence[1][0];
      fenceMarker = fenceMarker === marker ? null : fenceMarker ?? marker;
      continue;
    }
    if (fenceMarker) continue;

    const withoutInlineCode = line.replace(/`[^`]*`/g, "inline-code");
    if (/^\s*\*{4,}\s*$/.test(withoutInlineCode)) continue;
    if (/\*{4,}/.test(withoutInlineCode)) {
      throw new Error(`资料包含异常加粗标记：${id}`);
    }
  }
}

export function buildCuratedRow({ entry, markdown, timestamp = new Date().toISOString() }) {
  assertManifestEntry(entry, markdown);

  const metadataJson =
    entry.region === "fundamentals"
      ? { category: entry.category }
      : (() => {
          const difficulty = DIFFICULTY_MAP.get(entry.difficulty);
          if (!difficulty) throw new Error("算法资料缺少有效难度");
          return { category: entry.category, source: "整理资料", difficulty };
        })();
  const publishedMarkdown = toPublishedMarkdown(entry, markdown);
  assertNoMalformedEmphasis(publishedMarkdown, entry.id);

  return {
    id: `curated-bagu-${entry.id}`,
    region_slug: entry.region,
    status: "published",
    title: entry.title,
    summary: extractSummary(publishedMarkdown),
    nickname: null,
    markdown: publishedMarkdown,
    external_url: null,
    metadata_json: metadataJson,
    published_at: timestamp,
    updated_at: timestamp,
    tags: entry.tags.map((tag) => tag.trim()),
  };
}

export async function loadCuratedRows(curatedDir = DEFAULT_CURATED_DIR, timestamp) {
  const manifestPath = path.join(curatedDir, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  if (!Array.isArray(manifest.entries)) throw new Error("资料清单缺少 entries 数组");

  return Promise.all(
    manifest.entries.map(async (entry) => {
      const markdown = await fs.readFile(path.join(curatedDir, entry.file), "utf8");
      return buildCuratedRow({ entry, markdown, timestamp });
    }),
  );
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

async function storeTags(client, rows) {
  let relations = 0;
  for (const row of rows) {
    for (const label of row.tags) {
      const normalized = label.toLocaleLowerCase();
      const { data: tag, error: tagError } = await client
        .from("tags")
        .upsert({ label, normalized }, { onConflict: "normalized" })
        .select("id")
        .single();
      if (tagError || !tag?.id) {
        throw new Error(`标签写入失败：${tagError?.message ?? label}`);
      }

      const { error: relationError } = await client
        .from("content_tags")
        .upsert({ content_id: row.id, tag_id: tag.id }, { onConflict: "content_id,tag_id" });
      if (relationError) throw new Error(`内容标签关联失败：${relationError.message}`);
      relations += 1;
    }
  }
  return relations;
}

export async function importCurated({ curatedDir = DEFAULT_CURATED_DIR, apply = false, timestamp } = {}) {
  const rows = await loadCuratedRows(curatedDir, timestamp);
  if (!apply) return { count: rows.length, inserted: 0, skipped: 0, tagRelations: 0 };

  const client = getSupabaseClient();
  const ids = rows.map(({ id }) => id);
  const { data: existingRows, error: existingError } = await client
    .from("content")
    .select("id")
    .in("id", ids);
  if (existingError) throw new Error(`Supabase 预检失败：${existingError.message}`);

  const existingIds = new Set((existingRows ?? []).map(({ id }) => id));
  const newRows = rows.filter(({ id }) => !existingIds.has(id));
  const existingCuratedRows = rows.filter(({ id }) => existingIds.has(id));
  if (newRows.length) {
    const contentRows = newRows.map((row) => {
      const contentRow = { ...row };
      delete contentRow.tags;
      return contentRow;
    });
    const { error: insertError } = await client.from("content").insert(contentRows);
    if (insertError) throw new Error(`Supabase 内容写入失败：${insertError.message}`);
  }

  for (const row of existingCuratedRows) {
    const { error } = await client
      .from("content")
      .update({
        summary: row.summary,
        markdown: row.markdown,
        metadata_json: row.metadata_json,
        updated_at: row.updated_at,
      })
      .eq("id", row.id);
    if (error) throw new Error(`Supabase 整理正文更新失败：${error.message}`);
  }

  const tagRelations = await storeTags(client, rows);
  return {
    count: rows.length,
    inserted: newRows.length,
    skipped: rows.length - newRows.length,
    updated: existingCuratedRows.length,
    tagRelations,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadLocalEnv()
    .then(async () => {
      const apply = process.argv.includes("--apply");
      const curatedDir = process.env.CURATED_BAGU_DIR || DEFAULT_CURATED_DIR;
      const result = await importCurated({ curatedDir, apply });
      if (apply) {
        console.log(`导入完成：新增 ${result.inserted} 条，更新 ${result.updated} 条，写入 ${result.tagRelations} 条标签关联。`);
      } else {
        console.log(`预览：共 ${result.count} 条资料。加 --apply 才会写入 Supabase。`);
      }
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
