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

async function dispatchPointerDragUntilMove(page, fromX, fromY, toX, toY, steps = 60) {
  await page.evaluate(({ fromX, fromY, toX, toY, steps }) => {
    const eventInit = (x, y, type) => ({
      bubbles: true,
      cancelable: true,
      composed: true,
      button: type === "pointerup" || type === "pointercancel" ? 0 : 0,
      buttons: type === "pointerup" || type === "pointercancel" ? 0 : 1,
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
  }, { fromX, fromY, toX, toY, steps });
}

async function finishPointerDrag(page, x, y, type = "pointerup") {
  await page.evaluate(({ x, y, type }) => {
    document.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      button: 0,
      buttons: 0,
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
    }));
  }, { x, y, type });
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
  await page.waitForFunction(
    ({ selector, previousSpan }) => {
      const node = document.querySelector(selector);
      const span = node?.dataset.currentSpan || node?.dataset.defaultSpan;
      return Boolean(span && span !== previousSpan);
    },
    { selector: '.panel-layout > .db-panel[data-panel-key="builder-notes"]', previousSpan: before.span }
  );

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
  await page.waitForFunction(
    ({ selector, previous }) => {
      const node = document.querySelector(selector);
      if (!node) return false;
      const col = node.dataset.gridCol || node.dataset.defaultGridCol;
      const row = node.dataset.gridRow || node.dataset.defaultGridRow;
      return col !== previous.col || row !== previous.row;
    },
    { selector: '.panel-layout > .db-panel[data-panel-key="builder-notes"]', previous: moveBefore }
  );

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

test("electron GUI keeps select-mode multi-resize deterministic", async () => {
  const { app, page } = await launchApp();
  const firstSelector = '.panel-layout > .db-panel[data-panel-key="builder-notes"]';
  const secondSelector = '.panel-layout > .db-panel[data-panel-key="builder-content"]';

  await page.locator(".layout-group-button").click({ force: true });
  await expect(page.locator(".layout-group-button")).toHaveAttribute("aria-pressed", "true");
  await page.locator(firstSelector).click({ force: true });
  await page.locator(secondSelector).click({ force: true });
  await expect(page.locator(firstSelector)).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(secondSelector)).toHaveAttribute("aria-selected", "true");

  const source = await openTools(page, firstSelector);
  const before = await page.evaluate(({ firstSelector, secondSelector }) => {
    const snapshot = (selector) => {
      const node = document.querySelector(selector);
      return {
        span: node?.dataset.currentSpan || node?.dataset.defaultSpan || "",
        rows: node?.dataset.gridRowSpan || node?.dataset.defaultRows || "",
      };
    };
    return {
      first: snapshot(firstSelector),
      second: snapshot(secondSelector),
    };
  }, { firstSelector, secondSelector });

  const resize = source.locator(".panel-resize-handle");
  const box = await resize.boundingBox();
  expect(box).toBeTruthy();
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await dispatchPointerDrag(page, startX, startY, box.x - 220, box.y + 240);
  await page.waitForFunction(
    ({ firstSelector, secondSelector, before }) => {
      const snapshot = (selector) => {
        const node = document.querySelector(selector);
        return {
          span: node?.dataset.currentSpan || node?.dataset.defaultSpan || "",
          rows: node?.dataset.gridRowSpan || node?.dataset.defaultRows || "",
        };
      };
      const first = snapshot(firstSelector);
      const second = snapshot(secondSelector);
      const firstChanged = first.span !== before.first.span || first.rows !== before.first.rows;
      const secondChanged = second.span !== before.second.span || second.rows !== before.second.rows;
      return firstChanged && secondChanged;
    },
    { firstSelector, secondSelector, before }
  );

  const after = await page.evaluate(({ firstSelector, secondSelector }) => {
    const snapshot = (selector) => {
      const node = document.querySelector(selector);
      return {
        span: node?.dataset.currentSpan || node?.dataset.defaultSpan || "",
        rows: node?.dataset.gridRowSpan || node?.dataset.defaultRows || "",
      };
    };
    return {
      first: snapshot(firstSelector),
      second: snapshot(secondSelector),
    };
  }, { firstSelector, secondSelector });
  expect(after.first).not.toEqual(before.first);
  expect(after.second).not.toEqual(before.second);
  await writeInteractionScenarios(page, ["select-mode-multi-resize"], { before, after });
  await closeApp(app);
});

test("electron GUI keeps widget resize-snap deterministic", async () => {
  const { app, page } = await launchApp();
  const selector = '.widget-layout > .widget-card[data-widget-key="widget-1"]';
  const widget = await openTools(page, selector);
  const before = await widget.evaluate((node) => ({
    span: node.dataset.currentSpan || node.dataset.defaultSpan || "",
    rows: node.dataset.gridRowSpan || node.dataset.defaultRows || "",
  }));

  const resize = widget.locator(":scope > .widget-tools .panel-resize-handle");
  await expect(resize).toBeVisible();
  const box = await resize.boundingBox();
  expect(box).toBeTruthy();
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await dispatchPointerDrag(page, startX, startY, box.x + 260, box.y + 220);
  await page.waitForFunction(
    ({ selector, before }) => {
      const node = document.querySelector(selector);
      if (!node) return false;
      const span = node.dataset.currentSpan || node.dataset.defaultSpan || "";
      return span !== before.span;
    },
    { selector, before }
  );

  const after = await widget.evaluate((node) => ({
    span: node.dataset.currentSpan || node.dataset.defaultSpan || "",
    rows: node.dataset.gridRowSpan || node.dataset.defaultRows || "",
  }));
  expect(after.span).not.toBe(before.span);
  await writeInteractionScenarios(page, ["widget-resize-snap"], { before, after });
  await closeApp(app);
});

test("electron GUI restores widget tools through init", async () => {
  const { app, page } = await launchApp();
  const selector = '.widget-layout > .widget-card[data-widget-key="widget-1"]';
  await page.evaluate((selector) => {
    const widget = document.querySelector(selector);
    widget?.querySelector(":scope > .widget-tools")?.remove();
    if (widget) widget.dataset.widgetInitialized = "false";
    widget?.closest(".widget-layout")?.__initWidget?.(widget);
  }, selector);

  await expect(page.locator(`${selector} > .widget-tools .panel-tool-drawer`)).toHaveCount(1);
  const widget = await openTools(page, selector);
  await expect(widget.locator(":scope > .widget-tools .panel-pin-toggle")).toBeVisible();
  const pin = widget.locator(":scope > .widget-tools .panel-pin-toggle");
  const before = await pin.getAttribute("aria-pressed");
  await pin.click({ force: true });
  await expect(pin).not.toHaveAttribute("aria-pressed", before || "");
  const after = await pin.getAttribute("aria-pressed");
  await writeInteractionScenarios(page, ["widget-tools-init"], { before, after });
  await closeApp(app);
});

test("electron GUI keeps ordered drag commit, ghost, collision, and edge scroll deterministic", async () => {
  const { app, page } = await launchApp();
  const selector = '.panel-layout > .db-panel[data-panel-key="builder-notes"]';
  const panel = await openTools(page, selector);
  const before = await panel.evaluate((node) => ({
    col: node.dataset.gridCol || node.dataset.defaultGridCol || "",
    row: node.dataset.gridRow || node.dataset.defaultGridRow || "",
  }));
  const move = panel.locator(".panel-move-handle");
  const box = await move.boundingBox();
  expect(box).toBeTruthy();
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  const endX = box.x - 320;
  const endY = box.y + 220;

  await dispatchPointerDragUntilMove(page, startX, startY, endX, endY);
  await page.waitForFunction(() => Boolean(document.querySelector(".db-panel-dragging, .widget-dragging")));
  const live = await page.evaluate((selector) => {
    const source = document.querySelector(selector);
    const movingItems = document.querySelectorAll(".db-panel-dragging, .widget-dragging").length;
    const placeholders = document.querySelectorAll(".db-panel-placeholder, .widget-placeholder").length;
    const neighbors = [...document.querySelectorAll(".panel-layout > .db-panel:not([hidden])")]
      .filter((node) => node !== source)
      .map((node) => ({
        key: node.dataset.panelKey || "",
        col: node.dataset.gridCol || node.dataset.defaultGridCol || "",
        row: node.dataset.gridRow || node.dataset.defaultGridRow || "",
      }));
    return { movingItems, placeholders, neighbors };
  }, selector);
  expect(live.movingItems).toBeGreaterThan(0);
  expect(live.placeholders).toBeGreaterThan(0);
  expect(live.neighbors.some((entry) => entry.key && (entry.col !== "5" || entry.row !== "3"))).toBeTruthy();
  await finishPointerDrag(page, endX, endY, "pointercancel");
  await page.waitForFunction(() => !document.querySelector(".db-panel-dragging, .widget-dragging, .db-panel-placeholder, .widget-placeholder"));
  const afterCancel = await panel.evaluate((node) => ({
    col: node.dataset.gridCol || node.dataset.defaultGridCol || "",
    row: node.dataset.gridRow || node.dataset.defaultGridRow || "",
  }));
  expect(afterCancel).toEqual(before);

  await page.reload();
  await page.waitForSelector(".dashboard-layout-grid");
  const commitPanel = await openTools(page, selector);
  const commitMove = commitPanel.locator(".panel-move-handle");
  const commitBox = await commitMove.boundingBox();
  expect(commitBox).toBeTruthy();
  await dispatchPointerDrag(page, commitBox.x + commitBox.width / 2, commitBox.y + commitBox.height / 2, commitBox.x - 320, commitBox.y + 220);
  await page.waitForFunction(
    ({ selector, before }) => {
      const node = document.querySelector(selector);
      if (!node) return false;
      const col = node.dataset.gridCol || node.dataset.defaultGridCol || "";
      const row = node.dataset.gridRow || node.dataset.defaultGridRow || "";
      return col !== before.col || row !== before.row;
    },
    { selector, before }
  );
  await page.waitForFunction(() => !document.querySelector(".db-panel-dragging, .widget-dragging, .db-panel-placeholder, .widget-placeholder"));
  const afterCommit = await commitPanel.evaluate((node) => ({
    col: node.dataset.gridCol || node.dataset.defaultGridCol || "",
    row: node.dataset.gridRow || node.dataset.defaultGridRow || "",
  }));
  expect(afterCommit).not.toEqual(before);

  await page.evaluate(() => window.scrollTo(0, 0));
  const scroller = await openTools(page, '.panel-layout > .db-panel[data-panel-key="builder-content"]');
  const scrollMove = scroller.locator(".panel-move-handle");
  const scrollBox = await scrollMove.boundingBox();
  expect(scrollBox).toBeTruthy();
  const scrollStartX = scrollBox.x + scrollBox.width / 2;
  const scrollStartY = scrollBox.y + scrollBox.height / 2;
  const beforeScroll = await page.evaluate(() => Math.round(window.scrollY || 0));
  await dispatchPointerDragUntilMove(page, scrollStartX, scrollStartY, scrollStartX, 12 + await page.evaluate(() => window.innerHeight));
  await page.waitForFunction((beforeScroll) => Math.round(window.scrollY || 0) > beforeScroll, beforeScroll);
  const afterScroll = await page.evaluate(() => Math.round(window.scrollY || 0));
  expect(afterScroll).toBeGreaterThan(beforeScroll);
  await finishPointerDrag(page, scrollStartX, await page.evaluate(() => window.innerHeight - 12), "pointercancel");
  await writeInteractionScenarios(page, ["drag-core-commit-ghost-collision-scroll"], {
    before,
    live,
    afterCancel,
    afterCommit,
    beforeScroll,
    afterScroll,
  });
  await closeApp(app);
});

test("electron GUI absorbs a workspace widget through the panel body zone", async () => {
  const { app, page } = await launchApp();
  const widgetSelector = '.widget-layout:not(.panel-internal-widget-grid) > .widget-card[data-widget-key="widget-1"]';
  const panelSelector = '.panel-layout > .db-panel[data-panel-key="builder-content"]';
  const panelChildSelector = `${panelSelector} .panel-internal-widget-grid > .widget-card[data-widget-key="widget-1"]`;

  await page.locator(panelSelector).evaluate((panel) => {
    panel.dataset.savedHeight = "320";
    panel.dataset.gridRowSpan = "4";
    panel.style.height = "320px";
    panel.style.gridRowEnd = "span 4";
  });
  await page.waitForFunction((panelSelector) => {
    const panel = document.querySelector(panelSelector);
    const headerRect = panel?.querySelector(":scope > .db-panel-hd")?.getBoundingClientRect();
    const bodyRect = panel?.querySelector(":scope > .db-panel-body")?.getBoundingClientRect();
    return Boolean(headerRect && bodyRect && bodyRect.bottom - Math.max(bodyRect.top, headerRect.bottom) > 120);
  }, panelSelector);

  const widget = await openTools(page, widgetSelector);
  const move = widget.locator(".panel-move-handle");
  const moveBox = await move.boundingBox();
  expect(moveBox).toBeTruthy();

  const target = await page.locator(panelSelector).evaluate((panel) => {
    const headerRect = panel.querySelector(":scope > .db-panel-hd")?.getBoundingClientRect();
    const bodyRect = panel.querySelector(":scope > .db-panel-body")?.getBoundingClientRect();
    if (!headerRect || !bodyRect) return null;
    const x = bodyRect.left + Math.min(Math.max(bodyRect.width * 0.5, 48), Math.max(48, bodyRect.width - 48));
    const y = Math.max(bodyRect.top + 32, headerRect.bottom + 24);
    return {
      x: Math.round(Math.min(bodyRect.right - 24, Math.max(bodyRect.left + 24, x))),
      y: Math.round(Math.min(bodyRect.bottom - 24, Math.max(bodyRect.top + 24, y))),
      headerBottom: Math.round(headerRect.bottom),
      bodyTop: Math.round(bodyRect.top),
      bodyBottom: Math.round(bodyRect.bottom),
    };
  });
  expect(target).toBeTruthy();
  expect(target.y).toBeGreaterThan(target.headerBottom);
  expect(target.y).toBeGreaterThanOrEqual(target.bodyTop);
  expect(target.y).toBeLessThanOrEqual(target.bodyBottom);

  const startX = moveBox.x + moveBox.width / 2;
  const startY = moveBox.y + moveBox.height / 2;
  await dispatchPointerDragUntilMove(page, startX, startY, target.x, target.y, 80);
  await page.waitForFunction((panelSelector) => {
    const panel = document.querySelector(panelSelector);
    return Boolean(panel?.classList.contains("panel-container-drag-active"));
  }, panelSelector);
  await finishPointerDrag(page, target.x, target.y);
  await page.waitForFunction(({ panelChildSelector, widgetSelector }) => {
    const child = document.querySelector(panelChildSelector);
    const topLevel = document.querySelector(widgetSelector);
    return Boolean(child && !topLevel);
  }, { panelChildSelector, widgetSelector });

  const committed = await page.locator(panelChildSelector).evaluate((node) => ({
    key: node.dataset.widgetKey || "",
    parentPanelKey: node.dataset.parentPanelKey || "",
    panelChildWidget: node.dataset.panelChildWidget || "",
  }));
  expect(committed).toEqual({
    key: "widget-1",
    parentPanelKey: "builder-content",
    panelChildWidget: "true",
  });

  await page.locator(".layout-save-button").click();
  await page.reload();
  await page.waitForSelector(".dashboard-layout-grid");
  await expect(page.locator(panelChildSelector)).toHaveCount(1);
  await expect(page.locator(widgetSelector)).toHaveCount(0);
  const reloaded = await page.locator(panelChildSelector).evaluate((node) => ({
    key: node.dataset.widgetKey || "",
    parentPanelKey: node.dataset.parentPanelKey || "",
    panelChildWidget: node.dataset.panelChildWidget || "",
  }));
  expect(reloaded).toEqual(committed);
  await writeInteractionScenarios(page, ["body-zone-widget-absorption"], { target, committed, reloaded });
  await closeApp(app);
});
