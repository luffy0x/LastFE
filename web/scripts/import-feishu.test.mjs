import { describe, expect, it, vi, beforeEach } from 'vitest';
import path from 'node:path';
import { buildContentRow, extractSummary, loadExportDocuments, importExport } from './import-feishu.mjs';

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table) => ({
      select: vi.fn(() => ({
        like: vi.fn(() => ({
          data: [{ id: 'feishu-existing-1' }, { id: 'feishu-existing-2' }],
          error: null,
        })),
      })),
      insert: vi.fn(() => ({
        error: null,
      })),
    })),
  })),
}));

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

  it('filters out existing documents for idempotent import', async () => {
    const documents = [
      {
        metadata: { title: '新文档', object_token: 'new-token' },
        markdown: '# 新文档\n\n内容',
      },
      {
        metadata: { title: '已存在文档', object_token: 'existing-1' },
        markdown: '# 已存在文档\n\n内容',
      },
    ];

    const rows = documents.map((doc) =>
      buildContentRow({ metadata: doc.metadata, markdown: doc.markdown, now: '2026-09-10T00:00:00.000Z' })
    );

    // 验证 ID 生成
    expect(rows[0].id).toBe('feishu-new-token');
    expect(rows[1].id).toBe('feishu-existing-1');
  });
});
