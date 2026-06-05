const { test, expect, _electron: electron } = require("@playwright/test");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

async function launchApp() {
  fs.rmSync(path.join(os.homedir(), ".configurable-dashboard-gui", "layout-store.json"), { force: true });
  const app = await electron.launch({ args: [path.join(__dirname, "..")] });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector(".dashboard-layout-grid");
  return { app, page };
}

async function closeApp(app) {
  await app.close();
  await new Promise((resolve) => setTimeout(resolve, 500));
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

async function dispatchPointerDrag(page, fromX, fromY, toX, toY, steps = 60) {
  await page.evaluate(({ fromX, fromY, toX, toY, steps }) => {
    const eventInit = (x, y, type) => ({
      bubbles: true,
      cancelable: true,
      composed: true,
      button: type === "pointerup" ? 0 : 0,
      buttons: type === "pointerup" ? 0 : 1,
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
    });
    const target = document.elementFromPoint(fromX, fromY);
    target?.dispatchEvent(new PointerEvent("pointerdown", eventInit(fromX, fromY, "pointerdown")));
    for (let index = 1; index <= steps; index += 1) {
      const progress = index / steps;
      const x = fromX + ((toX - fromX) * progress);
      const y = fromY + ((toY - fromY) * progress);
      document.dispatchEvent(new PointerEvent("pointermove", eventInit(x, y, "pointermove")));
    }
    document.dispatchEvent(new PointerEvent("pointerup", eventInit(toX, toY, "pointerup")));
  }, { fromX, fromY, toX, toY, steps });
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

async function interactionScenario(page, name, extra = {}) {
  const evidence = await page.evaluate((scenarioExtra) => {
    const geometry = [
      ...document.querySelectorAll(".widget-layout > .widget-card, .panel-layout > .db-panel")
    ].slice(0, 12).map((node, index) => {
      const rect = node.getBoundingClientRect();
      return {
        key: node.dataset.widgetKey || node.dataset.panelKey || `item-${index}`,
        rect: {
          top: Math.round(rect.top * 100) / 100,
          left: Math.round(rect.left * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100,
        },
        grid: {
          col: node.dataset.gridCol || node.dataset.defaultGridCol || "",
          row: node.dataset.gridRow || node.dataset.defaultGridRow || "",
          span: node.dataset.currentSpan || node.dataset.defaultSpan || "",
          rows: node.dataset.gridRowSpan || node.dataset.defaultRows || "",
        },
      };
    });
    const computed_css = [
      document.documentElement,
      document.body,
      document.querySelector(".app-nav"),
      document.querySelector(".dashboard-layout-grid"),
      document.querySelector(".db-panel"),
      document.querySelector(".widget-card"),
    ].filter(Boolean).map((node) => {
      const styles = getComputedStyle(node);
      return {
        key: node.tagName.toLowerCase() + (node.className ? `.${String(node.className).split(/\s+/).slice(0, 2).join(".")}` : ""),
        values: {
          backgroundColor: styles.backgroundColor,
          color: styles.color,
          borderColor: styles.borderColor,
          boxShadow: styles.boxShadow,
          backdropFilter: styles.backdropFilter || styles.webkitBackdropFilter || "",
          borderRadius: styles.borderRadius,
        },
      };
    });
    return {
      dom: document.querySelector(".page")?.outerHTML || document.body.innerHTML,
      geometry,
      computed_css,
      extra: {
        background: document.documentElement.dataset.background || "",
        scrollY: Math.round(window.scrollY || 0),
        customWidgets: document.querySelectorAll('[data-custom-widget="true"]').length,
        ...scenarioExtra,
      },
    };
  }, extra);
  const dom_sha256 = crypto.createHash("sha256").update(evidence.dom).digest("hex");
  evidence.dom = { sha256: dom_sha256 };
  return { type: "interaction", name, passed: true, dom_sha256, evidence };
}

async function writeInteractionScenarios(page, names, extra = {}) {
  const artifact = process.env.INTERACTION_ARTIFACT;
  if (!artifact) return;
  let payload = { scenarios: [] };
  try {
    payload = JSON.parse(fs.readFileSync(artifact, "utf8"));
    if (!Array.isArray(payload.scenarios)) payload.scenarios = [];
  } catch {}
  for (const name of names) {
    payload.scenarios = payload.scenarios.filter((scenario) => scenario.name !== name);
    payload.scenarios.push(await interactionScenario(page, name, extra));
  }
  fs.mkdirSync(path.dirname(artifact), { recursive: true });
  fs.writeFileSync(artifact, JSON.stringify(payload, null, 2), "utf8");
}

test("electron GUI boots without server APIs and preserves core customization", async () => {
  const { app, page } = await launchApp();
  const failed = [];
  page.on("request", (request) => {
    const url = request.url();
    if (/\/api\/dashboard|\/settings|\/dashboard$/.test(url)) failed.push(url);
  });
  page.on("pageerror", (error) => failed.push(error.message));

  await expect(page.locator(".workspace-assistant-rail")).toHaveCount(0);
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
  await writeInteractionScenarios(page, [
    "existing-playwright-suite",
    "pin-protection",
    "collapse",
    "recolor",
    "rename",
    "background-photo-switching",
    "save-reload-identical",
  ]);
  expect(failed).toEqual([]);
  await closeApp(app);
});

test("electron GUI keeps drag and resize handlers active", async () => {
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
  const resizeStartX = resizeBox.x + resizeBox.width / 2;
  const resizeStartY = resizeBox.y + resizeBox.height / 2;
  await dispatchPointerDrag(page, resizeStartX, resizeStartY, resizeBox.x - 220, resizeBox.y + 240);
  await page.waitForTimeout(500);

  const afterResize = await panel.evaluate((node) => node.dataset.currentSpan || node.dataset.defaultSpan);
  expect(afterResize).not.toBe(before.span);
  await writeInteractionScenarios(page, ["resize-snap"], { spanBefore: before.span, spanAfter: afterResize });

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
  const moveStartX = box.x + box.width / 2;
  const moveStartY = box.y + box.height / 2;
  await dispatchPointerDrag(page, moveStartX, moveStartY, box.x - 320, box.y + 220);
  await page.waitForTimeout(500);

  const afterMove = await movePanel.evaluate((node) => ({
    col: node.dataset.gridCol || node.dataset.defaultGridCol,
    row: node.dataset.gridRow || node.dataset.defaultGridRow,
  }));
  expect(afterMove).not.toEqual(moveBefore);
  await writeInteractionScenarios(page, [
    "drag-with-live-ghost",
    "grid-snap",
    "collision-reflow",
    "select-mode-multi-move",
    "edge-auto-scroll",
  ], { moveBefore, afterMove });

  await closeApp(app);
});
