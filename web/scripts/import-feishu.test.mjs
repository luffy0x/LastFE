import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { buildContentRow, extractSummary, loadExportDocuments } from './import-feishu.mjs';

describe('Feishu import helpers', () => {
  it('builds a stable published content row from exported files', () => {
    const row = buildContentRow({
      metadata: {
        title: '🍟-百度一面',
        object_token: 'doc-token-123',
        url: 'https://feishu.cn/wiki/node-token',
      },
      markdown: '# 🍟-百度一面\n\n自我介绍\n\n## React\n\n请讲讲 React。',
      now: '2026-09-03T10:00:00.000Z',
    });

    expect(row).toEqual({
      id: 'feishu-doc-token-123',
      region_slug: 'interview',
      status: 'published',
      title: '🍟-百度一面',
      summary: '自我介绍',
      nickname: null,
      markdown: '# 🍟-百度一面\n\n自我介绍\n\n## React\n\n请讲讲 React。',
      external_url: 'https://feishu.cn/wiki/node-token',
      metadata_json: {
        source: 'feishu',
        objectToken: 'doc-token-123',
      },
      published_at: '2026-09-03T10:00:00.000Z',
      updated_at: '2026-09-03T10:00:00.000Z',
    });
  });

  it('extracts the first meaningful paragraph as summary', () => {
    expect(extractSummary('# 标题\n\n\n第一段内容\n\n## 小节')).toBe('第一段内容');
    expect(extractSummary('# 标题\n\n')).toBeNull();
  });

  it('loads only exported markdown documents with metadata', async () => {
    const documents = await loadExportDocuments(path.resolve(process.cwd(), '..', 'data', 'feishu-export'));
    expect(documents.length).toBeGreaterThanOrEqual(21);
    expect(documents.some(({ metadata }) => metadata.title === '🍟-百度一面')).toBe(true);
  });
});
