import { expect, test } from "@playwright/test";

test("moves the explorer and enters the selected territory", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "进入算法区" }).click();

  await expect(page).toHaveURL(/\/regions\/algorithms$/);
  await expect(page.getByRole("heading", { name: "算法区" })).toBeVisible();
});

test("replaces an in-flight destination without opening the old territory", async ({
  page,
}) => {
  const navigatedUrls: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigatedUrls.push(frame.url());
  });
  await page.goto("/");

  await page.getByRole("button", { name: "进入学习资料区" }).click();
  const replacement = page.getByRole("button", { name: "进入项目区" });
  await replacement.focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/regions\/projects$/);
  expect(navigatedUrls).not.toContain(
    "http://127.0.0.1:3000/regions/resources",
  );
});

test("reduced motion enters without a travel delay", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await page.getByRole("button", { name: "进入八股区" }).click();

  await expect(page).toHaveURL(/\/regions\/fundamentals$/);
});

test("keyboard Enter selects and enters a territory", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const territory = page.getByRole("button", { name: "进入面经区" });
  await territory.focus();

  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/regions\/interview$/);
});

test("territory list provides equivalent mobile navigation", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  await page.getByText("打开领地列表").click();
  await page.getByRole("link", { name: /项目区$/ }).click();

  await expect(page).toHaveURL(/\/regions\/projects$/);
});

test("pinch changes the camera and reset returns to global view", async ({ page }) => {
  await page.goto("/");
  const camera = page.getByTestId("camera-layer");
  const client = await page.context().newCDPSession(page);

  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: 400, y: 300, id: 1 },
      { x: 600, y: 300, id: 2 },
    ],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: 350, y: 300, id: 1 },
      { x: 650, y: 300, id: 2 },
    ],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });

  await expect(camera).not.toHaveAttribute("transform", "translate(0 0) scale(1)");
  await page.getByRole("button", { name: "复位地图" }).click();
  await expect(camera).toHaveAttribute("transform", "translate(0 0) scale(1)");
});

test("browser Back restores the last explorer destination", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入算法区" }).click();
  await expect(page).toHaveURL(/\/regions\/algorithms$/);

  await page.goBack();

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("img", { name: "探索者当前位置：算法区" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "进入算法区" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("failed destination preparation can be retried", async ({ page }) => {
  const availability = "**/api/regions/interview/availability";
  await page.route(availability, (route) => route.abort("failed"));
  await page.goto("/");

  await page.getByRole("button", { name: "进入面经区" }).click();
  await expect(page.getByText("目标离线：面经区")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);

  await page.unroute(availability);
  await page.getByRole("button", { name: "重试同步" }).click();

  await expect(page).toHaveURL(/\/regions\/interview$/);
});

test("return link restores the territory and focus on the map", async ({ page }) => {
  await page.goto("/regions/projects");

  await page.getByRole("link", { name: "返回战略地图" }).click();

  await expect(page).toHaveURL(/\/?region=projects$/);
  const territory = page.getByRole("button", { name: "进入项目区" });
  await expect(territory).toHaveAttribute("aria-pressed", "true");
  await expect(territory).toBeFocused();
});

test("keeps every territory label inside the tablet viewport", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/");

  const labels = page.locator(".region-label");
  await expect(labels).toHaveCount(5);
  for (let index = 0; index < 5; index += 1) {
    await expect(labels.nth(index)).toBeVisible();
  }

  const labelBounds = await labels.evaluateAll((elements) =>
    elements.map((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        label: element.textContent,
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
      };
    }),
  );

  for (const bounds of labelBounds) {
    expect.soft(bounds.left, `${bounds.label} left edge`).toBeGreaterThanOrEqual(0);
    expect.soft(bounds.top, `${bounds.label} top edge`).toBeGreaterThanOrEqual(0);
    expect.soft(bounds.right, `${bounds.label} right edge`).toBeLessThanOrEqual(768);
    expect.soft(bounds.bottom, `${bounds.label} bottom edge`).toBeLessThanOrEqual(900);
  }
});

const viewports = [
  { width: 375, height: 812 },
  { width: 768, height: 900 },
  { width: 1024, height: 900 },
  { width: 1440, height: 900 },
] as const;

for (const viewport of viewports) {
  test(`map remains stable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("main", { name: "求职战略地图" })).toBeVisible();

    const camera = page.getByTestId("camera-layer");
    await page.getByRole("button", { name: "放大地图" }).click();
    await expect(camera).not.toHaveAttribute("transform", "translate(0 0) scale(1)");
    await page.getByRole("button", { name: "复位地图" }).click();
    await expect(camera).toHaveAttribute("transform", "translate(0 0) scale(1)");
    await page.mouse.move(1, 1);

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
    await expect(page).toHaveScreenshot(`map-${viewport.width}.png`, {
      animations: "disabled",
      fullPage: true,
    });

    const searchTrigger = page.getByRole("button", { name: "打开全局搜索" });
    await searchTrigger.click();
    const dialog = page.getByRole("dialog", { name: "全局情报检索" });
    await expect(dialog).toBeVisible();
    await expect(
      page.getByRole("searchbox", { name: "搜索全部公开情报" }),
    ).toBeFocused();
    const dialogFitsViewport = await dialog.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return (
        bounds.left >= 0 &&
        bounds.top >= 0 &&
        bounds.right <= window.innerWidth &&
        bounds.bottom <= window.innerHeight
      );
    });
    expect(dialogFitsViewport).toBe(true);
    await page.keyboard.press("Escape");
    await expect(searchTrigger).toBeFocused();
  });
}
