const { test, expect, _electron: electron } = require("@playwright/test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

async function launchApp() {
  fs.rmSync(path.join(os.homedir(), ".configurable-dashboard-gui", "layout-store.json"), { force: true });
  const app = await electron.launch({ args: [path.join(__dirname, "..")] });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector(".dashboard-layout-grid");
  return { app, page };
}

async function openTools(page, selector) {
  const item = page.locator(selector).first();
  await item.evaluate((node) => {
    const isWidget = node.classList.contains("widget-card");
    node.classList.add(isWidget ? "widget-tools-open" : "db-panel-tools-open");
    document.body.classList.add("layout-tools-active");
  });
  await expect(item.locator(".panel-tool-drawer")).toBeVisible();
  return item;
}

async function addTextWidget(page) {
  await page.locator(".panel-add-button").click({ force: true });
  const menu = page.locator(".panel-add-menu");
  await expect(menu).toHaveClass(/open/);
  const content = menu.locator('.object-add-category[data-object-menu-category="content"]');
  await content.evaluate((node) => {
    node.classList.add("is-open");
    node.querySelector(".object-add-category-trigger")?.setAttribute("aria-expanded", "true");
  });
  await content.locator('.widget-add-action[data-widget-kind="text"]').click({ force: true });
  const widget = page.locator('.widget-layout > .widget-card[data-custom-widget="true"]').last();
  await expect(widget).toBeVisible();
  return widget;
}

test("electron GUI boots without server APIs and preserves core customization", async () => {
  const { app, page } = await launchApp();
  const failed = [];
  page.on("request", (request) => {
    const url = request.url();
    if (/\/api\/dashboard|\/settings|\/dashboard$/.test(url)) failed.push(url);
  });
  page.on("pageerror", (error) => failed.push(error.message));

  await expect(page.locator(".engineer-mode-button")).toHaveCount(0);
  await expect(page.locator(".workspace-assistant-rail")).toHaveCount(0);
  await expect(page.locator(".workspace-anchor-layer")).toHaveCount(0);
  await expect(page.locator(".background-photo-option")).toHaveCount(27);

  await page.locator(".background-tone-trigger").click({ force: true });
  await page.locator('.background-photo-option[data-background-tone="photo-earth"]').evaluate((node) => node.click());
  await expect(page.locator("html")).toHaveAttribute("data-background", "photo-earth");

  const panel = await openTools(page, '.panel-layout > .db-panel[data-panel-key="builder-content"]');
  await panel.locator(".panel-color-toggle").click({ force: true });
  await expect(page.locator(".panel-color-menu-open")).toHaveCount(1);

  await panel.locator(".panel-title-handle").click({ force: true });
  const input = page.locator(".panel-title-input, .panel-title-editor, input").first();
  if (await input.count()) {
    await input.fill("Renamed Content");
    await input.press("Enter");
  }

  await panel.locator(".panel-pin-toggle").click({ force: true });
  await expect(panel.locator(".panel-pin-toggle")).toHaveAttribute("aria-pressed", "true");

  const widget = await addTextWidget(page);
  await openTools(page, '.widget-layout > .widget-card[data-custom-widget="true"]');
  await expect(widget.locator(".panel-move-handle")).toBeVisible();

  await page.locator(".layout-save-button").click();
  await page.reload();
  await page.waitForSelector(".dashboard-layout-grid");
  await expect(page.locator("html")).toHaveAttribute("data-background", "photo-earth");
  expect(failed).toEqual([]);
  await app.close();
});

test("electron GUI keeps drag and resize handlers wired", async () => {
  const { app, page } = await launchApp();
  const panel = await openTools(page, '.panel-layout > .db-panel[data-panel-key="builder-notes"]');
  const before = await panel.evaluate((node) => ({
    col: node.dataset.gridCol || node.dataset.defaultGridCol,
    row: node.dataset.gridRow || node.dataset.defaultGridRow,
    span: node.dataset.currentSpan || node.dataset.defaultSpan,
  }));

  const resize = panel.locator(".panel-resize-handle");
  const resizeBox = await resize.boundingBox();
  expect(resizeBox).toBeTruthy();
  await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizeBox.x - 220, resizeBox.y + 140, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(250);

  const afterResize = await panel.evaluate((node) => node.dataset.currentSpan || node.dataset.defaultSpan);
  expect(afterResize).not.toBe(before.span);

  await page.reload();
  await page.waitForSelector(".dashboard-layout-grid");
  const movePanel = await openTools(page, '.panel-layout > .db-panel[data-panel-key="builder-notes"]');
  const moveBefore = await movePanel.evaluate((node) => ({
    col: node.dataset.gridCol || node.dataset.defaultGridCol,
    row: node.dataset.gridRow || node.dataset.defaultGridRow,
  }));
  const move = movePanel.locator(".panel-move-handle");
  const box = await move.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 320, box.y + 220, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(250);

  const afterMove = await movePanel.evaluate((node) => ({
    col: node.dataset.gridCol || node.dataset.defaultGridCol,
    row: node.dataset.gridRow || node.dataset.defaultGridRow,
  }));
  expect(afterMove).not.toEqual(moveBefore);

  await app.close();
});
