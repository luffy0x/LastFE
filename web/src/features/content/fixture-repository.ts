import type { ContentRecord } from "./types";
import type { ContentRepository } from "./repository";

const RECENT_DATE = "2026-08-30T10:00:00.000Z";
const ARCHIVE_DATE = "2026-08-12T10:00:00.000Z";

export const FIXTURE_CONTENT: readonly ContentRecord[] = [
  {
    id: "interview-byte-infra",
    regionSlug: "interview",
    title: "字节跳动/基础架构 · 后端开发",
    summary: "三轮技术面，重点覆盖高并发设计、缓存一致性与项目取舍。",
    nickname: "林舟",
    tags: ["后端", "三轮技术面", "基础架构"],
    publishedAt: RECENT_DATE,
    metadata: {
      companyDepartment: "字节跳动/基础架构",
      position: "后端开发",
    },
    markdown:
      "## 面试路线\n\n一面从项目中的缓存策略开始追问，随后讨论 Redis 热点键和数据库降级。\n\n## 复盘\n\n回答系统设计题时，先明确流量规模与一致性目标，再画数据流。",
    externalUrl: null,
    status: "published",
    createdAt: "2026-08-29T08:00:00.000Z",
    updatedAt: RECENT_DATE,
  },
  {
    id: "interview-tencent-cloud",
    regionSlug: "interview",
    title: "腾讯/云架构 · 后端开发",
    summary: "围绕网络协议、容器调度和故障排查展开的技术面记录。",
    nickname: "程远",
    tags: ["云计算", "网络", "容器"],
    publishedAt: ARCHIVE_DATE,
    metadata: {
      companyDepartment: "腾讯/云架构",
      position: "后端开发",
    },
    markdown:
      "## 高频问题\n\nTCP 重传、连接池耗尽的定位顺序，以及一次线上故障如何缩小排查范围。",
    externalUrl: null,
    status: "published",
    createdAt: "2026-08-11T08:00:00.000Z",
    updatedAt: ARCHIVE_DATE,
  },
  {
    id: "resource-react-typescript",
    regionSlug: "resources",
    title: "React TypeScript 学习路线",
    summary: "从组件建模、状态边界到类型收窄的渐进式学习路径。",
    nickname: "周宁",
    tags: ["React", "TypeScript", "前端"],
    publishedAt: RECENT_DATE,
    metadata: { format: "官方文档", language: "中文/英文" },
    markdown: null,
    externalUrl: "https://react.dev/learn/typescript",
    status: "published",
    createdAt: "2026-08-28T09:00:00.000Z",
    updatedAt: RECENT_DATE,
  },
  {
    id: "resource-operating-systems",
    regionSlug: "resources",
    title: "操作系统公开课",
    summary: "围绕进程、虚拟内存、并发和文件系统建立完整知识框架。",
    nickname: "顾言",
    tags: ["操作系统", "公开课", "基础"],
    publishedAt: ARCHIVE_DATE,
    metadata: { format: "课程与讲义", language: "英文" },
    markdown: null,
    externalUrl: "https://pages.cs.wisc.edu/~remzi/OSTEP/",
    status: "published",
    createdAt: "2026-08-10T09:00:00.000Z",
    updatedAt: ARCHIVE_DATE,
  },
  {
    id: "fundamental-redis-persistence",
    regionSlug: "fundamentals",
    title: "Redis 持久化",
    summary: "RDB、AOF 与混合持久化的触发条件、恢复流程和取舍。",
    nickname: "沈知行",
    tags: ["Redis", "缓存", "存储"],
    publishedAt: RECENT_DATE,
    metadata: { category: "数据库与缓存" },
    markdown:
      "## 核心区别\n\nRDB 偏向紧凑快照，AOF 记录写命令。选择时需要同时考虑恢复速度与可接受的数据丢失窗口。",
    externalUrl: null,
    status: "published",
    createdAt: "2026-08-30T07:00:00.000Z",
    updatedAt: RECENT_DATE,
  },
  {
    id: "fundamental-http-cache",
    regionSlug: "fundamentals",
    title: "HTTP 缓存机制",
    summary: "强缓存、协商缓存和 CDN 场景下的验证链路。",
    nickname: "许澄",
    tags: ["HTTP", "浏览器", "网络"],
    publishedAt: ARCHIVE_DATE,
    metadata: { category: "计算机网络" },
    markdown:
      "## 判断顺序\n\n先检查 Cache-Control，再根据 ETag 或 Last-Modified 发起条件请求。",
    externalUrl: null,
    status: "published",
    createdAt: "2026-08-09T07:00:00.000Z",
    updatedAt: ARCHIVE_DATE,
  },
  {
    id: "project-collaborative-editor",
    regionSlug: "projects",
    title: "实时协作编辑器",
    summary: "基于 CRDT 的多人编辑器，重点讨论冲突合并与离线恢复。",
    nickname: "闻嘉",
    tags: ["CRDT", "WebSocket", "React"],
    publishedAt: RECENT_DATE,
    metadata: { techStack: "React / TypeScript / Yjs" },
    markdown:
      "## 关键取舍\n\n文档同步使用 CRDT，光标状态走临时感知通道，避免把高频状态写入持久文档。",
    externalUrl: "https://github.com/yjs/yjs",
    status: "published",
    createdAt: "2026-08-27T11:00:00.000Z",
    updatedAt: RECENT_DATE,
  },
  {
    id: "project-campus-market",
    regionSlug: "projects",
    title: "校园二手交易平台",
    summary: "从商品检索、会话撮合到交易状态机的完整项目复盘。",
    nickname: "唐屿",
    tags: ["Next.js", "PostgreSQL", "搜索"],
    publishedAt: ARCHIVE_DATE,
    metadata: { techStack: "Next.js / PostgreSQL / Redis" },
    markdown:
      "## 设计重点\n\n交易状态采用显式状态机，所有状态变更保留审计记录。",
    externalUrl: null,
    status: "published",
    createdAt: "2026-08-08T11:00:00.000Z",
    updatedAt: ARCHIVE_DATE,
  },
  {
    id: "algorithm-dynamic-programming",
    regionSlug: "algorithms",
    title: "动态规划训练路线",
    summary: "从状态定义到区间、树形与状态压缩动态规划的训练顺序。",
    nickname: "叶川",
    tags: ["动态规划", "训练路线", "中等"],
    publishedAt: RECENT_DATE,
    metadata: { source: "LeetCode", difficulty: "中等" },
    markdown:
      "## 训练方法\n\n先写出状态含义和转移来源，再决定遍历顺序。不要从模板反推状态。",
    externalUrl: "https://leetcode.cn/tag/dynamic-programming/",
    status: "published",
    createdAt: "2026-08-26T12:00:00.000Z",
    updatedAt: RECENT_DATE,
  },
  {
    id: "algorithm-binary-answer",
    regionSlug: "algorithms",
    title: "二分答案题解",
    summary: "识别单调性、设计判定函数并处理左右边界。",
    nickname: "孟乔",
    tags: ["二分", "题解", "中等"],
    publishedAt: ARCHIVE_DATE,
    metadata: { source: "洛谷", difficulty: "中等" },
    markdown:
      "## 判断信号\n\n当答案空间有序且某个候选值可由线性或更低复杂度验证时，可以考虑二分答案。",
    externalUrl: "https://www.luogu.com.cn/",
    status: "published",
    createdAt: "2026-08-07T12:00:00.000Z",
    updatedAt: ARCHIVE_DATE,
  },
];

export const fixtureContentRepository: ContentRepository = {
  async list(query) {
    const normalizedSearch = query.search?.trim().toLocaleLowerCase();
    const filtered = FIXTURE_CONTENT.filter((record) => {
      if (record.status !== "published") return false;
      if (query.regionSlug && record.regionSlug !== query.regionSlug) return false;
      if (query.tags?.length && !query.tags.every((tag) => record.tags.includes(tag))) {
        return false;
      }
      if (!normalizedSearch) return true;

      const searchable = [
        record.title,
        record.summary ?? "",
        record.markdown ?? "",
        ...record.tags,
        ...Object.values(record.metadata),
      ]
        .join(" ")
        .toLocaleLowerCase();
      return searchable.includes(normalizedSearch);
    });
    const start = (query.page - 1) * query.pageSize;

    return {
      items: filtered.slice(start, start + query.pageSize),
      page: query.page,
      total: filtered.length,
      pageSize: query.pageSize,
    };
  },

  async get(id) {
    return FIXTURE_CONTENT.find((record) => record.id === id) ?? null;
  },

  async stats(now = new Date()) {
    const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const published = FIXTURE_CONTENT.filter(
      (record) => record.status === "published",
    );

    return {
      totalPublished: published.length,
      recentPublished: published.filter(
        (record) => new Date(record.publishedAt).getTime() >= cutoff,
      ).length,
    };
  },
};
