import { expect, test, type Locator } from "@playwright/test";

type Rect = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

async function rect(locator: Locator): Promise<Rect> {
  return locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      bottom: bounds.bottom,
      height: bounds.height,
      left: bounds.left,
      right: bounds.right,
      top: bounds.top,
      width: bounds.width,
    };
  });
}

async function expectNoHorizontalScroll(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("global search remains usable on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const trigger = page
    .getByRole("button", { name: "打开全局搜索" })
    .first();
  const triggerBounds = await rect(trigger);
  expect(triggerBounds.width).toBeGreaterThanOrEqual(280);
  expect(triggerBounds.height).toBeGreaterThanOrEqual(44);

  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "全局搜索" });
  const close = page.getByRole("button", { name: "关闭全局搜索" });
  const searchbox = page.getByRole("searchbox", { name: "搜索关键词" });
  const dialogBounds = await rect(dialog);
  const closeBounds = await rect(close);
  const searchboxBounds = await rect(searchbox);

  expect(dialogBounds.left).toBeGreaterThanOrEqual(0);
  expect(dialogBounds.right).toBeLessThanOrEqual(375);
  expect(dialogBounds.bottom).toBeLessThanOrEqual(812);
  expect(closeBounds.width).toBeGreaterThanOrEqual(44);
  expect(closeBounds.height).toBeGreaterThanOrEqual(44);
  expect(searchboxBounds.height).toBeGreaterThanOrEqual(44);
  expect(
    Number.parseFloat(
      await searchbox.evaluate(
        (element) => getComputedStyle(element).fontSize,
      ),
    ),
  ).toBeGreaterThanOrEqual(16);
});

test("submission directory and completion pages retain their layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/submit");

  const directoryLink = page
    .locator(".submission-directory__item")
    .first()
    .getByRole("link");
  expect((await rect(directoryLink)).height).toBeGreaterThanOrEqual(44);
  await expectNoHorizontalScroll(page);

  await page.goto("/submitted");
  const completion = page.locator(".submission-complete");
  expect(
    await completion.evaluate((element) => getComputedStyle(element).display),
  ).toBe("grid");
  for (const link of await page
    .locator(".submission-complete__actions a")
    .all()) {
    expect((await rect(link)).height).toBeGreaterThanOrEqual(44);
  }
  await expectNoHorizontalScroll(page);
});

test("category filters and submission form controls are touch safe", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/regions/algorithms");

  const filterControls = page.locator(
    ".category-filters input, .category-filters select, .category-filters button",
  );
  await expect(filterControls).not.toHaveCount(0);
  for (const control of await filterControls.all()) {
    expect((await rect(control)).height).toBeGreaterThanOrEqual(44);
    expect(
      Number.parseFloat(
        await control.evaluate((element) => getComputedStyle(element).fontSize),
      ),
    ).toBeGreaterThanOrEqual(16);
  }

  await page.goto("/submit/algorithms");
  const select = page.locator(".submission-form select");
  await expect(select).toBeVisible();
  expect((await rect(select)).height).toBeGreaterThanOrEqual(44);
  expect(
    Number.parseFloat(
      await select.evaluate((element) => getComputedStyle(element).fontSize),
    ),
  ).toBeGreaterThanOrEqual(16);
});

test("header stays on top and pages fit the viewport at all breakpoints", async ({
  page,
}) => {
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/regions/interview", "/content/interview-byte-infra"]) {
      await page.goto(path);
      await expectNoHorizontalScroll(page);

      const header = page.locator(".site-header");
      await expect(header).toBeVisible();
      const headerBounds = await rect(header);
      expect(headerBounds.top).toBe(0);
      expect(headerBounds.width).toBeLessThanOrEqual(width);

      const main = page.getByRole("main");
      await expect(main).toBeVisible();
      const mainBounds = await rect(main);
      expect(mainBounds.top).toBeGreaterThanOrEqual(headerBounds.bottom - 1);
    }
  }
});

test("mobile menu is keyboard reachable and closes with Escape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const trigger = page.getByRole("button", { name: "打开导航菜单" });
  await trigger.focus();
  await page.keyboard.press("Enter");

  const mobileNav = page.getByRole("navigation", { name: "移动端分类导航" });
  await expect(mobileNav).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(mobileNav).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "打开导航菜单" }),
  ).toBeFocused();
});
