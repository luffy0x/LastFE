import { createHmac } from "node:crypto";

import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const TEST_WEBHOOK_KEY = "local-e2e-only-key";
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

type IssueEvent =
  | { action: "closed" | "reopened" }
  | { action: "labeled" | "unlabeled"; label: { name: string } };

type SubmissionCase = {
  slug: "interview" | "resources" | "fundamentals" | "projects" | "algorithms";
  title: string;
  fill(page: Page): Promise<void>;
};

const approvedIssues = new Map<string, FakeIssue>();

async function completeAltcha(page: Page): Promise<void> {
  const widget = page.getByTestId("altcha-widget");
  await expect(widget).toBeVisible();
  await widget.getByText("我不是机器人", { exact: true }).click();
  await expect(page.getByText("验证完成")).toBeVisible();
}

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

async function mutateIssue(
  request: APIRequestContext,
  issue: FakeIssue,
  update: { labels: string[]; state?: "open" | "closed"; updated_at: string },
): Promise<FakeIssue> {
  const response = await request.patch(
    `${FAKE_GITHUB_ORIGIN}/__test/issues/${issue.number}`,
    { data: update },
  );
  expect(response.ok()).toBe(true);
  return (await response.json()) as FakeIssue;
}

async function deliverIssue(
  request: APIRequestContext,
  issue: FakeIssue,
  deliveryId: string,
  event: IssueEvent,
) {
  const rawBody = JSON.stringify({ ...event, issue });
  const signature = `sha256=${createHmac("sha256", TEST_WEBHOOK_KEY)
    .update(rawBody)
    .digest("hex")}`;
  return request.post("/api/github/webhook", {
    data: rawBody,
    headers: {
      "content-type": "application/json",
      "x-github-delivery": deliveryId,
      "x-github-event": "issues",
      "x-hub-signature-256": signature,
    },
  });
}

async function approveLatestIssue(
  request: APIRequestContext,
  deliveryId: string,
): Promise<FakeIssue> {
  const latest = await latestIssue(request);
  const labels = new Set(latest.labels.map(({ name }) => name));
  labels.add("approved");
  const approved = await mutateIssue(request, latest, {
    labels: [...labels],
    state: "open",
    updated_at: new Date(Date.parse(latest.updated_at) + 1_000).toISOString(),
  });
  const response = await deliverIssue(request, approved, deliveryId, {
    action: "labeled",
    label: { name: "approved" },
  });
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual({
    ok: true,
    result: "published",
  });

  const synchronized = await latestIssue(request);
  expect(synchronized.state).toBe("closed");
  expect(synchronized.labels.map(({ name }) => name)).toEqual(
    expect.arrayContaining(["submission", "approved", "published"]),
  );
  expect(synchronized.labels.map(({ name }) => name)).not.toContain("pending");
  return synchronized;
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

test.describe.serial("anonymous moderation flow", () => {
  test.beforeAll(async ({ request }) => {
    const response = await request.post(`${FAKE_GITHUB_ORIGIN}/__test/reset`);
    expect(response.ok()).toBe(true);
  });

  test("all five territory submissions stay private until signed approval", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    for (const [index, submission] of submissionCases.entries()) {
      await page.goto(`/submit/${submission.slug}`);
      await submission.fill(page);
      await completeAltcha(page);
      await page.getByRole("button", { name: "提交审核" }).click();
      await expect(page).toHaveURL(/\/submitted$/);
      await expect(page.getByText("local-e2e-private-repository")).toHaveCount(0);

      const queued = await latestIssue(request);
      expect(queued.title).toContain(submission.title);
      expect(queued.labels.map(({ name }) => name)).toEqual([
        "submission",
        "pending",
        `region:${submission.slug}`,
      ]);

      await page.goto(`/regions/${submission.slug}?q=${encodeURIComponent(submission.title)}`);
      await expect(page.getByText(submission.title)).toHaveCount(0);

      const approved = await approveLatestIssue(request, `e2e-approve-${index + 1}`);
      approvedIssues.set(submission.slug, approved);
      await page.goto(`/regions/${submission.slug}?q=${encodeURIComponent(submission.title)}`);
      await expect(page.getByRole("link", { name: submission.title })).toBeVisible();
    }
  });

  test("territory routes reject unknown and repeated query parameters", async ({
    request,
  }) => {
    const unknown = await request.get("/regions/interview?q=Redis&debug=1");
    expect(unknown.status()).toBe(400);

    const repeated = await request.get("/regions/interview?q=Redis&q=SQL");
    expect(repeated.status()).toBe(400);
  });

  test("global search, territory filters, safe Markdown, and external links use public records", async ({
    page,
    request,
  }) => {
    const invalid = await request.get("/api/search?q=Redis&debug=1");
    expect(invalid.status()).toBe(400);

    await page.goto("/");
    const searchTrigger = page.getByRole("button", { name: "打开全局搜索" });
    const dialog = page.getByRole("dialog", { name: "全局情报检索" });
    await searchTrigger.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(searchTrigger).toBeFocused();
    await page.keyboard.press("Control+k");
    await expect(dialog).toBeVisible();
    await page.getByRole("searchbox", { name: "搜索全部公开情报" }).fill("检索主链");
    await expect(dialog.getByRole("heading", { name: "面经区" })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "八股区" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "星河科技/平台 · 后端开发" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(searchTrigger).toBeFocused();

    const params = new URLSearchParams({
      q: "Redis",
      companyDepartment: "星河科技",
      position: "后端开发",
      tags: "检索主链",
    });
    await page.goto(`/regions/interview?${params}`);
    await expect(page.getByRole("link", { name: "星河科技/平台 · 后端开发" })).toBeVisible();
    await page.goto("/regions/interview?q=没有匹配项");
    await expect(page.getByText("没有符合当前条件的公开档案。")).toBeVisible();
    await expect(page.getByRole("link", { name: "清除搜索与筛选" })).toBeVisible();

    const interview = approvedIssues.get("interview");
    const resources = approvedIssues.get("resources");
    if (!interview || !resources) throw new Error("approved test records missing");
    await page.goto(`/content/gh-${interview.number}`);
    await expect(page.getByRole("heading", { name: "面试记录" })).toBeVisible();
    await expect(page.locator(".dossier__body script")).toHaveCount(0);
    await page.goto(`/content/gh-${resources.number}`);
    const external = page.getByRole("link", {
      name: "站外链接（本站不托管或检查文件）",
    });
    await expect(external).toHaveAttribute("href", "https://example.com/rust");
    await expect(external).toHaveAttribute("target", "_blank");
    await expect(external).toHaveAttribute("rel", "nofollow noopener noreferrer");
  });

  test("normalized duplicate content is rejected for 24 hours without changing public data", async ({
    page,
    request,
  }) => {
    const issuesBefore = await issueCount(request);
    await page.goto("/");
    const publicCount = await page
      .getByLabel("已公开档案数量")
      .textContent();

    await page.goto("/submit/resources");
    await page.getByLabel("标题").fill("  二十四小时去重资源  ");
    await page.getByLabel("URL").fill("  https://example.com/dedupe  ");
    await page.getByLabel("摘要").fill("  浏览器重复提交验证  ");
    await page.getByLabel("标签").fill("去重, 浏览器");
    await completeAltcha(page);
    await page.getByRole("button", { name: "提交审核" }).click();
    await expect(page).toHaveURL(/\/submitted$/);
    await expect.poll(() => issueCount(request)).toBe(issuesBefore + 1);

    await page.goto("/submit/resources");
    await page.getByLabel("标题").fill("二十四小时去重资源");
    await page.getByLabel("URL").fill("https://example.com/dedupe");
    await page.getByLabel("摘要").fill("浏览器重复提交验证");
    await page.getByLabel("标签").fill("去重, 浏览器");
    await completeAltcha(page);
    await page.getByRole("button", { name: "提交审核" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "相同内容近期已提交" }),
    ).toContainText("请等待审核或修改后重试");
    await expect.poll(() => issueCount(request)).toBe(issuesBefore + 1);
    await page.goto("/");
    await expect(page.getByLabel("已公开档案数量")).toHaveText(publicCount ?? "");
    await page.goto("/regions/resources?q=二十四小时去重资源");
    await expect(page.getByText("二十四小时去重资源")).toHaveCount(0);
  });

  test("closing an unapproved issue rejects it without publishing", async ({
    page,
    request,
  }) => {
    await page.goto("/submit/resources");
    await page.getByLabel("标题").fill("拒绝测试资源");
    await page.getByLabel("URL").fill("https://example.com/rejected");
    await page.getByLabel("标签").fill("拒绝测试");
    await completeAltcha(page);
    await page.getByRole("button", { name: "提交审核" }).click();
    await expect(page).toHaveURL(/\/submitted$/);

    const queued = await latestIssue(request);
    const rejected = await mutateIssue(request, queued, {
      labels: queued.labels.map(({ name }) => name),
      state: "closed",
      updated_at: new Date(Date.parse(queued.updated_at) + 1_000).toISOString(),
    });
    const response = await deliverIssue(request, rejected, "e2e-reject", {
      action: "closed",
    });
    await expect(response.json()).resolves.toEqual({ ok: true, result: "rejected" });

    await page.goto("/regions/resources?q=拒绝测试资源");
    await expect(page.getByText("拒绝测试资源")).toHaveCount(0);
  });

  test("withdrawal, duplicate delivery, and republishing are deterministic", async ({
    page,
    request,
  }) => {
    const original = approvedIssues.get("interview");
    if (!original) throw new Error("approved interview test record missing");

    const withdrawn = await mutateIssue(request, original, {
      labels: ["submission", "region:interview", "approved", "published", "unpublish"],
      state: "closed",
      updated_at: "2026-09-02T01:00:00.000Z",
    });
    const withdrawal = await deliverIssue(request, withdrawn, "e2e-withdraw", {
      action: "labeled",
      label: { name: "unpublish" },
    });
    await expect(withdrawal.json()).resolves.toEqual({ ok: true, result: "withdrawn" });
    const hidden = await page.goto(`/content/gh-${original.number}`);
    expect(hidden?.status()).toBe(404);

    const unlabeled = await mutateIssue(request, withdrawn, {
      labels: ["submission", "region:interview", "approved", "published"],
      state: "closed",
      updated_at: "2026-09-02T02:00:00.000Z",
    });
    const first = await deliverIssue(request, unlabeled, "e2e-republish-unlabeled", {
      action: "unlabeled",
      label: { name: "unpublish" },
    });
    await expect(first.json()).resolves.toEqual({ ok: true, result: "published" });
    const reopened = await mutateIssue(request, unlabeled, {
      labels: ["submission", "region:interview", "approved", "published"],
      state: "open",
      updated_at: "2026-09-02T03:00:00.000Z",
    });
    const reopenedDelivery = await deliverIssue(
      request,
      reopened,
      "e2e-republish-reopened",
      { action: "reopened" },
    );
    await expect(reopenedDelivery.json()).resolves.toEqual({
      ok: true,
      result: "published",
    });
    const duplicate = await deliverIssue(request, reopened, "e2e-republish-reopened", {
      action: "reopened",
    });
    await expect(duplicate.json()).resolves.toEqual({ ok: true, result: "duplicate" });

    await page.goto(`/content/gh-${original.number}`);
    await expect(
      page.getByRole("heading", { name: "星河科技/平台 · 后端开发" }),
    ).toBeVisible();
  });

  test("an upstream failure keeps entered form values", async ({ page, request }) => {
    const failure = await request.post(`${FAKE_GITHUB_ORIGIN}/__test/fail-next`);
    expect(failure.ok()).toBe(true);
    await page.goto("/submit/fundamentals");
    await page.getByLabel("标题").fill("失败后保留的标题");
    await page.getByLabel("分类").fill("可靠性");
    await page.getByLabel("标签").fill("故障恢复");
    await page.getByLabel("内容").fill("失败后仍应保留的正文");
    await completeAltcha(page);

    await page.getByRole("button", { name: "提交审核" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "内容已保留" }),
    ).toContainText("内容已保留");
    await expect(page.getByLabel("标题")).toHaveValue("失败后保留的标题");
    await expect(page.getByLabel("内容")).toHaveValue("失败后仍应保留的正文");
  });
});
