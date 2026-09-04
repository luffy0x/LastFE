import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const FAKE_GITHUB_ORIGIN = "http://127.0.0.1:4010";

type FakeIssue = {
  number: number;
  title: string;
  body: string;
  labels: Array<{ name: string }>;
  state: "open" | "closed";
  created_at: string;
  updated_at: string;
};

type SubmissionCase = {
  slug: "interview" | "resources" | "fundamentals" | "projects" | "algorithms";
  title: string;
  fill(page: Page): Promise<void>;
};

async function latestIssue(request: APIRequestContext): Promise<FakeIssue> {
  const response = await request.get(`${FAKE_GITHUB_ORIGIN}/__test/issues/latest`);
  expect(response.ok()).toBe(true);
  return (await response.json()) as FakeIssue;
}

async function issueCount(request: APIRequestContext): Promise<number> {
  const response = await request.get(`${FAKE_GITHUB_ORIGIN}/__test/issues/count`);
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { count: number };
  return body.count;
}

const submissionCases: readonly SubmissionCase[] = [
  {
    slug: "interview",
    title: "星河科技/平台 · 后端开发",
    async fill(page) {
      await page.getByLabel("公司 / 部门").fill("星河科技/平台");
      await page.getByLabel("岗位").fill("后端开发");
      await page.getByLabel("标签").fill("一面, 检索主链");
      await page
        .getByLabel("面经内容")
        .fill("## 面试记录\n\nRedis 追问\n\n<script>alert('blocked')</script>");
    },
  },
  {
    slug: "resources",
    title: "Rust 官方学习路线",
    async fill(page) {
      await page.getByLabel("标题").fill("Rust 官方学习路线");
      await page.getByLabel("URL").fill("https://example.com/rust");
      await page.getByLabel("摘要").fill("从所有权到异步编程的学习资料");
      await page.getByLabel("标签").fill("Rust, 官方文档");
    },
  },
  {
    slug: "fundamentals",
    title: "Redis 持久化验证",
    async fill(page) {
      await page.getByLabel("标题").fill("Redis 持久化验证");
      await page.getByLabel("分类").fill("数据库与缓存");
      await page.getByLabel("标签").fill("Redis, 检索主链");
      await page.getByLabel("内容").fill("## 核心区别\n\nRDB 与 AOF 的恢复取舍。");
    },
  },
  {
    slug: "projects",
    title: "实时协作白板",
    async fill(page) {
      await page.getByLabel("标题").fill("实时协作白板");
      await page.getByLabel("技术栈").fill("React, Yjs");
      await page.getByLabel("仓库 URL").fill("https://example.com/repository");
      await page.getByLabel("演示 URL").fill("https://example.com/demo");
      await page.getByLabel("标签").fill("协作, WebSocket");
      await page.getByLabel("项目说明").fill("## 架构\n\n使用 CRDT 合并离线变更。");
    },
  },
  {
    slug: "algorithms",
    title: "二分答案训练",
    async fill(page) {
      await page.getByLabel("标题").fill("二分答案训练");
      await page.getByLabel("来源").fill("LeetCode");
      await page.getByLabel("难度").selectOption("medium");
      await page.getByLabel("题目 URL").fill("https://example.com/problem");
      await page.getByLabel("标签").fill("二分, 单调性");
      await page.getByLabel("题解").fill("## 判定函数\n\n先证明答案空间具有单调性。");
    },
  },
];

test.describe.serial("anonymous submission flow", () => {
  test.beforeEach(async ({ request }) => {
    const response = await request.post(`${FAKE_GITHUB_ORIGIN}/__test/reset`);
    expect(response.ok()).toBe(true);
  });

  test("all five territory submissions enter the private GitHub review queue", async ({
    page,
    request,
  }) => {
    for (const submission of submissionCases) {
      const issuesBefore = await issueCount(request);
      await page.goto(`/submit/${submission.slug}`);
      await page.getByLabel("标题").fill(submission.title);
      await submission.fill(page);
      await page.getByRole("button", { name: "提交审核" }).click();

      await expect(page).toHaveURL(/\/submitted$/);
      await expect(page.getByText("local-e2e-private-repository")).toHaveCount(0);
      await expect.poll(() => issueCount(request)).toBe(issuesBefore + 1);

      const queued = await latestIssue(request);
      expect(queued.title).toContain(submission.title);
      expect(queued.state).toBe("open");
      expect(queued.labels.map(({ name }) => name)).toEqual([
        "submission",
        "pending",
        `region:${submission.slug}`,
      ]);

      await page.goto(`/regions/${submission.slug}?q=${encodeURIComponent(submission.title)}`);
      await expect(page.getByText(submission.title)).toHaveCount(0);
    }
  });

  test("global search, territory filters, safe Markdown, and external links use public records", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    const searchTrigger = page.getByRole("button", { name: "打开全局搜索" });
    const dialog = page.getByRole("dialog", { name: "全局情报检索" });
    await searchTrigger.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(searchTrigger).toBeFocused();
    await page.keyboard.press("Control+k");
    await expect(dialog).toBeVisible();
    const search = await request.get("/api/search?q=Redis");
    expect(search.ok()).toBe(true);
    await expect(search.json()).resolves.toMatchObject({
      groups: expect.arrayContaining([
        expect.objectContaining({ regionSlug: "interview" }),
        expect.objectContaining({ regionSlug: "fundamentals" }),
      ]),
    });
    await page.keyboard.press("Escape");
    await expect(searchTrigger).toBeFocused();

    await page.goto("/regions/interview?q=Redis&companyDepartment=字节跳动&tags=后端");
    await expect(
      page.getByRole("link", { name: "字节跳动/基础架构 · 后端开发" }),
    ).toBeVisible();
    await page.goto("/regions/interview?q=没有匹配项");
    await expect(page.getByText("没有符合当前条件的公开档案。")).toBeVisible();
    await expect(page.getByRole("link", { name: "清除搜索与筛选" })).toBeVisible();

    await page.goto("/content/interview-byte-infra");
    await expect(page.getByRole("heading", { name: "面试路线" })).toBeVisible();
    await expect(page.locator(".dossier__body script")).toHaveCount(0);
    await page.goto("/content/resource-react-typescript");
    const external = page.getByRole("link", {
      name: "站外链接（本站不托管或检查文件）",
    });
    await expect(external).toHaveAttribute("href", "https://react.dev/learn/typescript");
    await expect(external).toHaveAttribute("target", "_blank");
    await expect(external).toHaveAttribute("rel", "nofollow noopener noreferrer");
  });

  test("an upstream failure keeps entered form values", async ({ page, request }) => {
    const failure = await request.post(`${FAKE_GITHUB_ORIGIN}/__test/fail-next`);
    expect(failure.ok()).toBe(true);
    await page.goto("/submit/fundamentals");
    await page.getByLabel("标题").fill("失败后保留的标题");
    await page.getByLabel("分类").fill("可靠性");
    await page.getByLabel("标签").fill("故障恢复");
    await page.getByLabel("内容").fill("失败后仍应保留的正文");

    await page.getByRole("button", { name: "提交审核" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "审核队列暂时不可用" }),
    ).toContainText("审核队列暂时不可用");
    await expect(page.getByLabel("标题")).toHaveValue("失败后保留的标题");
    await expect(page.getByLabel("内容")).toHaveValue("失败后仍应保留的正文");
  });
});
