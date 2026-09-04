import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("moves the explorer and enters the selected territory", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "进入算法区" }).click();

  await expect(page).toHaveURL(/\/regions\/algorithms$/);
  await expect(page.getByRole("heading", { name: "算法区" })).toBeVisible();
});

test("replaces an in-flight destination without opening the old territory", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "进入学习资料区" }).click();
  await page.getByRole("button", { name: "进入项目区" }).click();

  await expect(page).toHaveURL(/\/regions\/projects$/);
  await expect(page).not.toHaveURL(/\/regions\/resources$/);
});

test("reduced motion enters without a travel delay", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await page.getByRole("button", { name: "进入八股区" }).click();

  await expect(page).toHaveURL(/\/regions\/fundamentals$/);
});

test("keyboard Enter selects and enters a territory", async ({ page }) => {
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
  const surface = page.getByRole("application", { name: "战略地图画布" });
  const camera = page.getByTestId("camera-layer");

  await surface.dispatchEvent("pointerdown", {
    pointerId: 1,
    pointerType: "touch",
    clientX: 400,
    clientY: 300,
  });
  await surface.dispatchEvent("pointerdown", {
    pointerId: 2,
    pointerType: "touch",
    clientX: 600,
    clientY: 300,
  });
  await surface.dispatchEvent("pointermove", {
    pointerId: 2,
    pointerType: "touch",
    clientX: 700,
    clientY: 300,
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
    await page.waitForLoadState("networkidle");

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
    await expect(page).toHaveScreenshot(`map-${viewport.width}.png`, {
      animations: "disabled",
      fullPage: true,
    });
  });
}
