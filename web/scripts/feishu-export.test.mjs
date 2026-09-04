import { describe, expect, it } from 'vitest';
import { buildMarkdown, safeSlug, collectPaginated, buildAuthorizeUrl, buildMediaDownloadUrl, DEFAULT_REDIRECT_URI } from './feishu-export.mjs';

describe('Feishu export helpers', () => {
  it('creates a safe deterministic slug', () => {
    expect(safeSlug('../面经 / JavaScript?')).toBe('面经-javascript');
    expect(safeSlug('')).toBe('untitled');
  });

  it('renders structured blocks and local image references', () => {
    const result = buildMarkdown([
      { block_type: 3, heading1: { elements: [{ text_run: { content: '标题' } }] } },
      { block_type: 2, text: { elements: [{ text_run: { content: '正文' } }] } },
      { block_type: 12, bullet: { elements: [{ text_run: { content: '列表项' } }] } },
      { block_type: 27, image: { token: 'img-token' } },
    ], { imagePaths: new Map([['img-token', './assets/image-001.png']]) });

    expect(result.markdown).toContain('# 标题');
    expect(result.markdown).toContain('正文');
    expect(result.markdown).toContain('- 列表项');
    expect(result.markdown).toContain('![图片](./assets/image-001.png)');
  });

  it('keeps an explicit placeholder for unsupported blocks', () => {
    const result = buildMarkdown([{ block_type: 99, mystery: { value: true } }]);
    expect(result.markdown).toContain('[暂不支持的飞书块类型: 99]');
    expect(result.unsupportedCount).toBe(1);
  });

  it('consumes every page', async () => {
    const pages = [
      { items: ['a', 'b'], page_token: 'next' },
      { items: ['c'], page_token: '', has_more: false },
    ];
    const result = await collectPaginated(async (pageToken) => pages[pageToken ? 1 : 0]);
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('builds a user authorization URL with a local callback and requested scope', () => {
    const url = new URL(buildAuthorizeUrl('cli_test', 'state-value', DEFAULT_REDIRECT_URI));
    expect(url.origin).toBe('https://open.feishu.cn');
    expect(url.pathname).toBe('/open-apis/authen/v1/authorize');
    expect(url.searchParams.get('app_id')).toBe('cli_test');
    expect(url.searchParams.get('scope')).toBe('wiki:wiki:readonly');
    expect(url.searchParams.get('state')).toBe('state-value');
    expect(DEFAULT_REDIRECT_URI).toBe('http://localhost:38765/callback');
  });

  it('adds the document context required for docx image downloads', () => {
    const url = new URL(buildMediaDownloadUrl('image-token', 'document-token'));
    expect(url.pathname).toBe('/open-apis/drive/v1/medias/image-token/download');
    expect(JSON.parse(url.searchParams.get('extra'))).toEqual({ obj_type: 'docx_image', obj_token: 'document-token' });
  });
});
