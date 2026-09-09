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

function overlaps(first: Rect, second: Rect) {
  return !(
    first.right <= second.left ||
    first.left >= second.right ||
    first.bottom <= second.top ||
    first.top >= second.bottom
  );
}

test("global search remains usable on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const trigger = page.getByRole("button", { name: "打开全局搜索" });
  const triggerBounds = await rect(trigger);
  expect(triggerBounds.width).toBeGreaterThanOrEqual(320);
  expect(triggerBounds.height).toBeGreaterThanOrEqual(44);

  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "全局情报检索" });
  const close = page.getByRole("button", { name: "关闭全局搜索" });
  const searchbox = page.getByRole("searchbox", { name: "搜索全部公开情报" });
  const dialogBounds = await rect(dialog);
  const closeBounds = await rect(close);
  const searchboxBounds = await rect(searchbox);
  const dialogStyle = await dialog.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
    };
  });

  expect(dialogBounds.left).toBeGreaterThanOrEqual(0);
  expect(dialogBounds.right).toBeLessThanOrEqual(375);
  expect(dialogBounds.bottom).toBeLessThanOrEqual(812);
  expect(closeBounds.width).toBeGreaterThanOrEqual(44);
  expect(closeBounds.height).toBeGreaterThanOrEqual(44);
  expect(searchboxBounds.height).toBeGreaterThanOrEqual(44);
  expect(Number.parseFloat(await searchbox.evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  expect(dialogStyle.backgroundColor).not.toBe("rgb(255, 255, 255)");
  expect(dialogStyle.color).not.toBe("rgb(0, 0, 0)");
});

test("submission directory and completion pages retain their layout", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/submit");

  const directoryItem = page.locator(".submission-directory li").first();
  const directoryLink = directoryItem.getByRole("link");
  expect(await directoryItem.evaluate((element) => getComputedStyle(element).display)).toBe("grid");
  expect((await rect(directoryLink)).height).toBeGreaterThanOrEqual(44);
  expect((await rect(page.locator(".submission-page__back a"))).height).toBeGreaterThanOrEqual(44);

  await page.goto("/submitted");
  const completion = page.locator(".submission-complete");
  expect(await completion.evaluate((element) => getComputedStyle(element).display)).toBe("grid");
  for (const link of await page.locator(".submission-complete__actions a").all()) {
    expect((await rect(link)).height).toBeGreaterThanOrEqual(44);
  }
});

test("territory and submission form controls are touch safe", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/regions/algorithms");

  const filterControls = page.locator(".territory-filters input, .territory-filters select, .territory-filters button");
  await expect(filterControls).not.toHaveCount(0);
  for (const control of await filterControls.all()) {
    expect((await rect(control)).height).toBeGreaterThanOrEqual(44);
    expect(Number.parseFloat(await control.evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  }

  await page.goto("/submit/algorithms");
  const select = page.locator(".submission-form select");
  await expect(select).toBeVisible();
  expect((await rect(select)).height).toBeGreaterThanOrEqual(44);
  expect(Number.parseFloat(await select.evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
});

test("short phone HUD regions do not overlap", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 375 });
  await page.goto("/");

  const searchBounds = await rect(page.locator(".map-search"));
  const statusBounds = await rect(page.locator(".map-status"));
  expect(overlaps(searchBounds, statusBounds)).toBe(false);
});

test("tablet map labels and territory panel fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/");

  for (const label of await page.locator(".region-label").all()) {
    const bounds = await rect(label);
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(768);
  }

  await page.goto("/regions/algorithms");
  expect((await rect(page.locator(".territory-panel"))).width).toBeLessThanOrEqual(768 * 0.62);
});
