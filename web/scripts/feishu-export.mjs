import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const API_BASE = 'https://open.feishu.cn';
const DEFAULT_OUTPUT = path.resolve(process.cwd(), '..', 'data', 'feishu-export');
export const DEFAULT_REDIRECT_URI = 'http://localhost:38765/callback';

export function buildMediaDownloadUrl(fileToken, documentToken) {
  const url = new URL(`${API_BASE}/open-apis/drive/v1/medias/${encodeURIComponent(fileToken)}/download`);
  url.searchParams.set('extra', JSON.stringify({ obj_type: 'docx_image', obj_token: documentToken }));
  return url.toString();
}

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

export function safeSlug(value) {
  const slug = String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\.\.+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .toLowerCase();
  return slug || 'untitled';
}

export async function collectPaginated(fetchPage) {
  const items = [];
  let pageToken = '';
  do {
    const page = await fetchPage(pageToken);
    items.push(...(page.items ?? []));
    pageToken = page.page_token || '';
  } while (pageToken);
  return items;
}

export function buildAuthorizeUrl(appId, state, redirectUri) {
  const url = new URL(`${API_BASE}/open-apis/authen/v1/authorize`);
  url.searchParams.set('app_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'wiki:wiki:readonly');
  url.searchParams.set('state', state);
  return url.toString();
}

function inlineText(elements = []) {
  return elements.map((element) => {
    if (element.text_run) {
      const run = element.text_run;
      let text = run.content ?? '';
      if (run.text_element_style?.link?.url) text = `[${text}](${run.text_element_style.link.url})`;
      if (run.text_element_style?.bold) text = `**${text}**`;
      if (run.text_element_style?.italic) text = `*${text}*`;
      if (run.text_element_style?.strikethrough) text = `~~${text}~~`;
      return text;
    }
    if (element.mention_doc) return `[${element.mention_doc.title ?? '文档'}](${element.mention_doc.url ?? '#'})`;
    if (element.mention_user) return `@${element.mention_user.user_name ?? element.mention_user.user_id ?? '用户'}`;
    if (element.equation) return `$${element.equation.content ?? ''}$`;
    return element.content ?? '';
  }).join('');
}

function blockText(block) {
  const data = Object.values(block).find((value) => value && typeof value === 'object' && Array.isArray(value.elements));
  return inlineText(data?.elements);
}

function blockChildren(block, byId) {
  if (Array.isArray(block.children)) {
    return block.children.map((child) => typeof child === 'string' ? byId.get(child) : child).filter(Boolean);
  }
  return [];
}

export function buildMarkdown(blocks, { imagePaths = new Map() } = {}) {
  let unsupportedCount = 0;
  const lines = [];
  const byId = new Map(blocks.map((block) => [block.block_id, block]));
  const render = (block, depth = 0) => {
    const type = Number(block.block_type);
    const text = blockText(block);
    if (type >= 3 && type <= 11) lines.push(`${'#'.repeat(type - 2)} ${text}`);
    else if (type === 2) lines.push(text);
    else if (type === 12) lines.push(`${'  '.repeat(depth)}- ${text}`);
    else if (type === 13) lines.push(`${'  '.repeat(depth)}1. ${text}`);
    else if (type === 14) lines.push(`\`\`\`\n${text}\n\`\`\``);
    else if (type === 15) lines.push(`> ${text}`);
    else if (type === 17) lines.push(`- [${block.todo?.style?.done ? 'x' : ' '}] ${text}`);
    else if (type === 18) lines.push('---');
    else if (type === 27) {
      const token = block.image?.token ?? block.image?.file_token ?? block.image?.source_file_token;
      lines.push(`![图片](${imagePaths.get(token) ?? `./assets/missing-${token ?? 'unknown'}`})`);
    } else if (type === 31) {
      const cells = blockChildren(block, byId);
      if (cells.length) {
        const rows = block.table?.property?.row_size ?? 1;
        const cols = block.table?.property?.column_size ?? Math.max(1, cells.length);
        for (let row = 0; row < rows; row += 1) {
          const values = cells.slice(row * cols, (row + 1) * cols).map(blockText);
          lines.push(`| ${values.join(' | ')} |`);
          if (row === 0) lines.push(`| ${values.map(() => '---').join(' | ')} |`);
        }
      } else lines.push('[表格为空]');
    } else if (type !== 1 && type !== 0) {
      unsupportedCount += 1;
      lines.push(`[暂不支持的飞书块类型: ${type || 'unknown'}]`);
    }
    for (const child of blockChildren(block, byId)) render(child, depth + 1);
  };
  const childIds = new Set(blocks.flatMap((block) => (block.children ?? []).filter((child) => typeof child === 'string')));
  for (const block of blocks) if (!childIds.has(block.block_id)) render(block);
  return { markdown: `${lines.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()}\n`, unsupportedCount };
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

function createClient(appId, appSecret, userAccessToken, fetchImpl = fetch) {
  let token;
  const request = async (method, endpoint, query = {}, body) => {
    const url = new URL(`${API_BASE}${endpoint}`);
    for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== '') url.searchParams.set(key, value);
    const response = await fetchImpl(url, {
      method,
      headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok || data.code) throw new Error(`飞书 API ${endpoint} 失败: ${data.msg ?? response.status}`);
    return data.data ?? data;
  };
  async function getToken() {
    if (userAccessToken) return userAccessToken;
    if (token) return token;
    const response = await fetchImpl(`${API_BASE}/open-apis/auth/v3/tenant_access_token/internal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ app_id: appId, app_secret: appSecret }) });
    const data = await response.json();
    if (!response.ok || data.code) throw new Error(`飞书鉴权失败: ${data.msg ?? response.status}`);
    token = data.tenant_access_token;
    return token;
  }
  return { request, getToken };
}

function openBrowser(url) {
  execFile('cmd.exe', ['/c', 'start', '', url], () => {});
}

async function getUserAccessToken(appId, appSecret) {
  const port = 38765;
  const redirectUri = process.env.FEISHU_REDIRECT_URI || DEFAULT_REDIRECT_URI;
  const state = randomBytes(18).toString('hex');
  const authorizeUrl = buildAuthorizeUrl(appId, state, redirectUri);
  const callback = new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const requestUrl = new URL(request.url, redirectUri);
      if (requestUrl.pathname !== '/callback') {
        response.writeHead(404).end();
        return;
      }
      if (requestUrl.searchParams.get('state') !== state) {
        response.writeHead(400).end('state 校验失败');
        server.close();
        reject(new Error('飞书 OAuth state 校验失败'));
        return;
      }
      const error = requestUrl.searchParams.get('error');
      const code = requestUrl.searchParams.get('code');
      response.writeHead(error || !code ? 400 : 200, { 'Content-Type': 'text/plain; charset=utf-8' }).end(error ? `授权失败：${error}` : '授权成功，可以关闭此页面。');
      server.close();
      if (error) reject(new Error(`飞书 OAuth 授权失败: ${error}`));
      else resolve(code);
    });
    server.once('error', reject);
    server.listen(port, '127.0.0.1');
  });
  console.log('正在打开飞书授权页，请使用有知识库权限的账号完成授权…');
  console.log(authorizeUrl);
  openBrowser(authorizeUrl);
  const code = await callback;
  const response = await fetch(`${API_BASE}/open-apis/authen/v1/access_token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grant_type: 'authorization_code', code, app_id: appId, app_secret: appSecret }) });
  const data = await response.json();
  if (!response.ok || data.code) throw new Error(`飞书用户授权换取令牌失败: ${data.msg ?? response.status}`);
  return data.data?.access_token ?? data.access_token;
}

async function downloadAsset(client, token, documentToken, outputPath) {
  const response = await fetch(buildMediaDownloadUrl(token, documentToken), { headers: { Authorization: `Bearer ${await client.getToken()}` } });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`图片下载失败 ${token}: ${response.status} ${detail.slice(0, 500)}`);
  }
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
}

async function exportAll({ outputDir = DEFAULT_OUTPUT } = {}) {
  const appId = requiredEnv('FEISHU_APP_ID');
  const appSecret = requiredEnv('FEISHU_APP_SECRET');
  const spaceId = requiredEnv('FEISHU_SPACE_ID');
  const userAccessToken = process.env.FEISHU_USER_ACCESS_TOKEN || await getUserAccessToken(appId, appSecret);
  const client = createClient(appId, appSecret, userAccessToken);
  await fs.mkdir(outputDir, { recursive: true });
  const nodes = [];
  async function visit(parentNodeToken = '') {
    const children = await collectPaginated((pageToken) => client.request('GET', `/open-apis/wiki/v2/spaces/${spaceId}/nodes`, { page_size: '50', page_token: pageToken, parent_node_token: parentNodeToken }));
    for (const node of children) {
      nodes.push(node);
      if (node.has_child) await visit(node.node_token);
    }
  }
  await visit();
  const manifest = { exported_at: new Date().toISOString(), space_id: spaceId, source_url: `https://${process.env.FEISHU_DOMAIN ?? 'open.feishu.cn'}/wiki/space/${spaceId}`, documents: [], failures: [] };
  let imageCount = 0;
  let unsupportedCount = 0;
  for (const node of nodes) {
    if (!node.obj_token || !['docx', 'doc'].includes(node.obj_type)) continue;
    const slug = `${safeSlug(node.title)}-${safeSlug(node.node_token).slice(0, 12)}`;
    const documentDir = path.join(outputDir, 'documents', slug);
    const assetDir = path.join(documentDir, 'assets');
    try {
      await fs.mkdir(assetDir, { recursive: true });
      const blocks = await collectPaginated((pageToken) => client.request('GET', `/open-apis/docx/v1/documents/${node.obj_token}/blocks`, { document_revision_id: '-1', page_size: '500', page_token: pageToken }));
      await fs.writeFile(path.join(documentDir, 'raw-blocks.json'), `${JSON.stringify(blocks, null, 2)}\n`, 'utf8');
      const imagePaths = new Map();
      const images = blocks.filter((block) => Number(block.block_type) === 27);
      for (let index = 0; index < images.length; index += 1) {
        const image = images[index];
        const token = image.image?.token ?? image.image?.file_token ?? image.image?.source_file_token;
        if (!token) continue;
        const extension = (image.image?.mime_type?.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'png';
        const filename = `image-${String(index + 1).padStart(3, '0')}.${extension}`;
        await downloadAsset(client, token, node.obj_token, path.join(assetDir, filename));
        imagePaths.set(token, `./assets/${filename}`);
        imageCount += 1;
      }
      const built = buildMarkdown(blocks, { imagePaths });
      unsupportedCount += built.unsupportedCount;
      await fs.writeFile(path.join(documentDir, 'document.md'), `# ${node.title}\n\n${built.markdown}`, 'utf8');
      await fs.writeFile(path.join(documentDir, 'metadata.json'), `${JSON.stringify({ title: node.title, wiki_token: node.node_token, object_token: node.obj_token, object_type: node.obj_type, parent_node_token: node.parent_node_token, updated_at: node.updated_at, url: `https://${process.env.FEISHU_DOMAIN ?? 'open.feishu.cn'}/wiki/${node.node_token}` }, null, 2)}\n`, 'utf8');
      manifest.documents.push({ title: node.title, directory: path.relative(outputDir, documentDir), block_count: blocks.length, image_count: images.length });
      console.log(`已导出: ${node.title}`);
    } catch (error) {
      manifest.failures.push({ title: node.title, node_token: node.node_token, error: error.message });
      console.error(`导出失败: ${node.title} - ${error.message}`);
    }
  }
  manifest.summary = { node_count: nodes.length, document_count: manifest.documents.length, image_count: imageCount, unsupported_block_count: unsupportedCount, failure_count: manifest.failures.length };
  await fs.writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`完成：${manifest.summary.document_count} 篇文档，${imageCount} 张图片，${unsupportedCount} 个未支持块，${manifest.failures.length} 个失败项。`);
  if (manifest.failures.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadLocalEnv().then(() => exportAll()).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
