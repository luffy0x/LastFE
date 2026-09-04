import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_EXPORT_DIR = path.resolve(process.cwd(), '..', 'data', 'feishu-export');

async function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  try {
    const content = await fs.readFile(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function asPath(value) {
  return value instanceof URL ? fileURLToPath(value) : value;
}

export function extractSummary(markdown) {
  const lines = String(markdown ?? '').split(/\r?\n/);
  const line = lines.find((item) => {
    const value = item.trim();
    return value && !value.startsWith('#') && !value.startsWith('![') && !value.startsWith('[暂不支持的飞书块类型:');
  });
  return line?.trim().slice(0, 240) || null;
}

export function buildContentRow({ metadata, markdown, now = new Date().toISOString() }) {
  const objectToken = metadata.object_token || metadata.objectToken;
  const fallbackToken = metadata.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'untitled';
  return {
    id: `feishu-${objectToken || fallbackToken}`,
    region_slug: 'interview',
    status: 'published',
    title: metadata.title,
    summary: extractSummary(markdown),
    nickname: null,
    markdown,
    external_url: metadata.url || null,
    metadata_json: {
      source: 'feishu',
      ...(objectToken ? { objectToken } : {}),
    },
    published_at: now,
    updated_at: now,
  };
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function metadataFor(documentDir, markdownFile) {
  const metadataPath = path.join(documentDir, 'metadata.json');
  try {
    return await readJson(metadataPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { title: path.basename(markdownFile, path.extname(markdownFile)) };
  }
}

export async function loadExportDocuments(exportDir = DEFAULT_EXPORT_DIR) {
  const root = asPath(exportDir);
  const documentsRoot = path.join(root, 'documents');
  const entries = await fs.readdir(documentsRoot, { withFileTypes: true });
  const documents = [];
  for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const documentDir = path.join(documentsRoot, entry.name);
    const files = await fs.readdir(documentDir);
    const markdownFile = files.find((file) => file.toLowerCase().endsWith('.md'));
    if (!markdownFile) continue;
    documents.push({
      directory: documentDir,
      metadata: await metadataFor(documentDir, markdownFile),
      markdown: await fs.readFile(path.join(documentDir, markdownFile), 'utf8'),
    });
  }
  return documents;
}

export async function syncManifest(exportDir = DEFAULT_EXPORT_DIR) {
  const root = asPath(exportDir);
  const manifestPath = path.join(root, 'manifest.json');
  const manifest = await readJson(manifestPath);
  const documents = await loadExportDocuments(root);
  const previous = new Map((manifest.documents ?? []).map((item) => [item.title, item]));
  const nextDocuments = [];
  for (const document of documents) {
    const title = document.metadata.title;
    const old = previous.get(title);
    const relativeDirectory = path.relative(root, document.directory);
    const files = await fs.readdir(document.directory, { recursive: true });
    const imageCount = files.filter((file) => /\.(png|jpe?g|gif|webp|svg)$/i.test(file)).length;
    let blockCount = old?.block_count ?? 0;
    try {
      const blocks = await readJson(path.join(document.directory, 'raw-blocks.json'));
      blockCount = Array.isArray(blocks) ? blocks.length : blockCount;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    nextDocuments.push({
      ...(old ?? {}),
      title,
      directory: relativeDirectory,
      block_count: blockCount,
      image_count: imageCount,
    });
  }
  manifest.documents = nextDocuments;
  manifest.failures = [];
  manifest.summary = {
    ...(manifest.summary ?? {}),
    document_count: nextDocuments.length,
    image_count: nextDocuments.reduce((sum, item) => sum + item.image_count, 0),
    failure_count: 0,
  };
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

async function importToSupabase(rows) {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.from('content').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`Supabase 导入失败: ${error.message}`);
}

export async function importExport({ exportDir = DEFAULT_EXPORT_DIR, apply = false, now } = {}) {
  const documents = await loadExportDocuments(exportDir);
  const rows = documents.map((document) => buildContentRow({ metadata: document.metadata, markdown: document.markdown, now }));
  if (apply) await importToSupabase(rows);
  return { count: rows.length, rows };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadLocalEnv()
    .then(async () => {
      const apply = process.argv.includes('--apply');
      const exportDir = process.env.FEISHU_EXPORT_DIR || DEFAULT_EXPORT_DIR;
      const manifest = await syncManifest(exportDir);
      const result = await importExport({ exportDir, apply });
      console.log(`清单已同步：${manifest.summary.document_count} 篇文档，${manifest.summary.image_count} 张图片。`);
      console.log(`${apply ? '已导入' : '预览'}：${result.count} 条 content 记录。${apply ? '' : ' 加 --apply 才会写入 Supabase。'}`);
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
