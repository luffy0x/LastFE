import { expect, test } from "@playwright/test";

test("home leads to a category via the header and via category cards", async ({
  page,
}) => {
  await page.goto("/");

  const headerNav = page.getByRole("navigation", { name: "主导航" });
  await headerNav.getByRole("link", { name: "算法手撕" }).click();
  await expect(page).toHaveURL(/\/regions\/algorithms$/);
  await expect(
    page.getByRole("heading", { name: "算法手撕", level: 1 }),
  ).toBeVisible();

  await page.goto("/");
  await page
    .locator(".category-grid")
    .getByRole("link", { name: /面经记录/ })
    .click();
  await expect(page).toHaveURL(/\/regions\/interview$/);
  await expect(
    page.getByRole("heading", { name: "面经记录", level: 1 }),
  ).toBeVisible();
});

test("home search finds content and opens the detail page", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("button", { name: "打开全局搜索" })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "全局搜索" });
  await expect(dialog).toBeVisible();

  await page
    .getByRole("searchbox", { name: "搜索关键词" })
    .fill("字节跳动");
  const result = dialog.getByRole("link", {
    name: /字节跳动\/基础架构 · 后端开发/,
  });
  await expect(result).toBeVisible();
  await result.click();

  await expect(page).toHaveURL(/\/content\/interview-byte-infra$/);
  await expect(
    page.getByRole("heading", {
      name: "字节跳动/基础架构 · 后端开发",
      level: 1,
    }),
  ).toBeVisible();
});

test("home submit entry leads through the directory to a category form", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("link", { name: "分享你的内容" })
    .click();
  await expect(page).toHaveURL(/\/submit$/);

  await page.getByRole("link", { name: "投稿项目推荐" }).click();
  await expect(page).toHaveURL(/\/submit\/projects$/);
  await expect(
    page.getByRole("heading", { name: "向项目推荐投稿", level: 1 }),
  ).toBeVisible();
});

test("theme toggle switches the html class and persists across reload", async ({
  page,
}) => {
  await page.goto("/");
  const html = page.locator("html");

  await page.getByRole("button", { name: /切换到深色主题/ }).click();
  await expect(html).toHaveClass(/dark/);

  await page.reload();
  await expect(html).toHaveClass(/dark/);

  await page.getByRole("button", { name: /切换到浅色主题/ }).click();
  await expect(html).not.toHaveClass(/dark/);
});

test("mobile home exposes category navigation through the menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  await page.getByRole("button", { name: "打开导航菜单" }).click();
  const mobileNav = page.getByRole("navigation", { name: "移动端分类导航" });
  await mobileNav.getByRole("link", { name: "学习资料" }).click();

  await expect(page).toHaveURL(/\/regions\/resources$/);
  await expect(
    page.getByRole("heading", { name: "学习资料", level: 1 }),
  ).toBeVisible();
});
