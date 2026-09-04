import { describe, expect, it, vi } from "vitest";
import {
  createSupabaseContentRepository,
  type SupabaseContentClient,
} from "./supabase-repository";

function query<T>(result: { data: T; error: null; count?: number }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (
      onfulfilled?: (value: typeof result) => unknown,
      onrejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onfulfilled, onrejected),
  };

  return builder;
}

const row = {
  id: "content-1",
  region_slug: "interview",
  status: "published",
  title: "系统设计复盘",
  summary: "缓存与一致性",
  nickname: "匿名",
  markdown: "## 复盘",
  external_url: null,
  metadata_json: { companyDepartment: "基础架构" },
  created_at: "2026-09-01T00:00:00.000Z",
  published_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  content_tags: [{ tags: { label: "后端", normalized: "后端" } }],
};

describe("createSupabaseContentRepository", () => {
  it("maps published rows into the stable content contract", async () => {
    const listQuery = query({ data: [row], error: null, count: 1 });
    const client = {
      from: vi.fn(() => listQuery),
    } as unknown as SupabaseContentClient;
    const repository = createSupabaseContentRepository(client);

    const page = await repository.list({
      regionSlug: "interview",
      page: 1,
      pageSize: 20,
    });

    expect(page).toEqual({
      items: [
        expect.objectContaining({
          id: "content-1",
          regionSlug: "interview",
          tags: ["后端"],
          metadata: { companyDepartment: "基础架构" },
        }),
      ],
      page: 1,
      total: 1,
      pageSize: 20,
    });
    expect(listQuery.eq).toHaveBeenCalledWith("status", "published");
    expect(listQuery.eq).toHaveBeenCalledWith("region_slug", "interview");
  });

  it("returns null for a missing content record", async () => {
    const getQuery = query({ data: null, error: null });
    const client = {
      from: vi.fn(() => getQuery),
    } as unknown as SupabaseContentClient;
    const repository = createSupabaseContentRepository(client);

    await expect(repository.get("missing")).resolves.toBeNull();
    expect(getQuery.eq).toHaveBeenCalledWith("status", "published");
    expect(getQuery.eq).toHaveBeenCalledWith("id", "missing");
  });

  it("returns published totals and recent totals from count queries", async () => {
    const totalQuery = query({ data: null, error: null, count: 7 });
    const recentQuery = query({ data: null, error: null, count: 2 });
    const client = {
      from: vi
        .fn()
        .mockReturnValueOnce(totalQuery)
        .mockReturnValueOnce(recentQuery),
    } as unknown as SupabaseContentClient;
    const repository = createSupabaseContentRepository(client);

    await expect(
      repository.stats(new Date("2026-09-03T00:00:00.000Z")),
    ).resolves.toEqual({ totalPublished: 7, recentPublished: 2 });
    expect(totalQuery.eq).toHaveBeenCalledWith("status", "published");
    expect(recentQuery.gte).toHaveBeenCalledWith(
      "published_at",
      "2026-08-27T00:00:00.000Z",
    );
  });
});
