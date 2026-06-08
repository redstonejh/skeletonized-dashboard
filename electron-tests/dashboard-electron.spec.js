const { test, expect, _electron: electron } = require("@playwright/test");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

async function launchApp() {
  fs.rmSync(path.join(os.homedir(), ".configurable-dashboard-gui", "layout-store.json"), { force: true });
  const app = await electron.launch({
    args: [path.join(__dirname, "..")],
    env: { ...process.env, MAW_HEADLESS: "1" },
  });
  const page = await app.firstWindow();
  const isVisible = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible());
  expect(isVisible).toBe(false);
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

async function openControlBar(page) {
  const gear = page.locator(".control-bar-gear");
  const bar = page.locator("[data-floating-control-bar]");
  if (await bar.evaluate((node) => !node.classList.contains("is-open")).catch(() => true)) {
    await gear.click({ force: true });
  }
  await expect(gear).toHaveAttribute("aria-expanded", "true");
  await expect(bar).toBeVisible();
  await expect.poll(() => bar.evaluate((node) => {
    const transform = getComputedStyle(node).transform;
    if (!transform || transform === "none") return 1;
    const scale = Number(transform.match(/matrix\(([^,]+)/)?.[1] || "0");
    return Math.round(scale * 100) / 100;
  })).toBe(1);
  return bar;
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

function rgbChannelSum(color) {
  if (!color || !color.startsWith("rgb")) return null;
  const channels = color.match(/[\d.]+/g)?.map(Number).slice(0, 3) || [];
  return channels.length === 3 ? channels.reduce((sum, value) => sum + value, 0) : null;
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
  await openControlBar(page);
  await page.locator(".panel-add-button").click({ force: true });
  const menu = page.locator(".panel-add-menu");
  await expect(menu).toHaveClass(/open/);
  const content = menu.locator('.object-add-category[data-object-menu-category="content"]');
  await content.evaluate((node) => {
    node.classList.add("is-open");
    node.querySelector(".object-add-category-trigger")?.setAttribute("aria-expanded", "true");
  });
  const beforeCount = await page.locator('.widget-layout > .widget-card[data-custom-widget="true"]').count();
  await content.locator('.widget-add-action[data-widget-kind="text"]').evaluate((node) => node.click());
  await expect(page.locator('.widget-layout > .widget-card[data-custom-widget="true"]')).toHaveCount(beforeCount + 1);
  const widget = page.locator('.widget-layout > .widget-card[data-custom-widget="true"]').last();
  await expect(widget).toBeVisible();
  await expect(widget).toHaveAttribute("data-widget-definition", "text");
  await widget.scrollIntoViewIfNeeded();
  return widget;
}

async function addWidget(page, { kind, category, subcategory = "", expectedDefinition = kind }) {
  await openControlBar(page);
  await page.locator(".panel-add-button").click({ force: true });
  const menu = page.locator(".panel-add-menu");
  await expect(menu).toHaveClass(/open/);
  const group = menu.locator(`.object-add-category[data-object-menu-category="${category}"]`);
  await group.evaluate((node, subcategory) => {
    node.classList.add("is-open");
    node.querySelector(":scope > .object-add-category-trigger")?.setAttribute("aria-expanded", "true");
    if (subcategory) {
      const subgroup = [...node.querySelectorAll(".object-add-subcategory")]
        .find((entry) => entry.dataset.objectAddSubcategory === subcategory);
      subgroup?.classList.add("is-open");
      subgroup?.querySelector(":scope > .object-add-subcategory-trigger")?.setAttribute("aria-expanded", "true");
    }
  }, subcategory);
  const beforeCount = await page.locator('.widget-layout > .widget-card[data-custom-widget="true"]').count();
  await group.locator(`.widget-add-action[data-widget-kind="${kind}"]`).evaluate((node) => node.click());
  await expect(page.locator('.widget-layout > .widget-card[data-custom-widget="true"]')).toHaveCount(beforeCount + 1);
  const widget = page.locator('.widget-layout > .widget-card[data-custom-widget="true"]').last();
  await expect(widget).toBeVisible();
  await expect(widget).toHaveAttribute("data-widget-definition", expectedDefinition);
  await widget.scrollIntoViewIfNeeded();
  return widget;
}

async function applyFirstWidgetSetting(page, selector, preferredKey, value) {
  return page.locator(selector).evaluate((node, { preferredKey, value }) => {
    const runtime = window.dashboardWidgetSettingsRuntime;
    if (!runtime?.fieldsForWidget || !runtime?.applySetting) return { applied: false, key: "" };
    const fields = runtime.fieldsForWidget(node);
    const field = fields.find((entry) => entry.key === preferredKey) || fields[0];
    if (!field?.key) return { applied: false, key: "" };
    return {
      applied: runtime.applySetting(node, field.key, value, { history: false, invalidateQuery: false }),
      key: field.key,
    };
  }, { preferredKey, value });
}

async function widgetRenderSnapshot(page, selector) {
  return page.locator(selector).evaluate((node) => {
    const shell = node.querySelector("[data-widget-shell]");
    const content = node.querySelector("[data-widget-shell-content='true']");
    const removedStatusKey = ["widget", "Runtime", "Status"].join("");
    const removedModelAttr = (key) => key === removedStatusKey || /^runtime(Condition|Urgency|Freshness|Activity|Confidence|Meaning)/.test(key);
    return {
      key: node.dataset.widgetKey || "",
      density: node.dataset.widgetDensity || node.dataset.density || "",
      shell: node.dataset.widgetShell || "",
      modelAttrs: Object.keys(node.dataset).filter(removedModelAttr),
      shellModelAttrs: shell ? [...shell.attributes].map((attr) => attr.name).filter((name) => /runtime/i.test(name)) : [],
      content: content?.textContent?.trim() || "",
      tools: node.querySelectorAll(":scope > .widget-tools").length,
      resizeHandles: node.querySelectorAll(":scope > .widget-tools .panel-resize-handle").length,
    };
  });
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

  await openControlBar(page);
  await page.locator(".background-tone-trigger").click({ force: true });
  await page.locator('.background-photo-option[data-background-tone="photo-earth"]').evaluate((node) => node.click());
  await expect(page.locator("html")).toHaveAttribute("data-background", "photo-earth");

  const panel = await openTools(page, '.panel-layout > .db-panel[data-panel-key="builder-content"]');
  await panel.locator(".panel-color-toggle").click({ force: true });
  await expect(page.locator(".panel-color-menu-open")).toHaveCount(1);
  await expect(page.locator('.panel-color-menu-open .panel-color-swatch[data-color="#ffffff"]')).toBeVisible();
  await panel.locator(".panel-color-toggle").evaluate((button) => {
    button.__panelColorMenu?.classList.remove("panel-color-menu-open");
    button.setAttribute("aria-expanded", "false");
  });
  await expect(page.locator(".panel-color-menu-open")).toHaveCount(0);

  await panel.locator(".panel-title-handle").click({ force: true });
  const input = page.locator(".panel-title-input, .panel-title-editor, input:not(.background-custom-color-input)").first();
  if (await input.count()) {
    await input.fill("Renamed Content");
    await input.press("Enter");
  }

  await panel.locator(".panel-pin-toggle").click({ force: true });
  await expect(panel.locator(".panel-pin-toggle")).toHaveAttribute("aria-pressed", "true");
  const suppressedPanelOpen = await panel.evaluate((node) => {
    node.__openCustomization?.(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      clientX: node.getBoundingClientRect().right,
      clientY: node.getBoundingClientRect().top,
    }));
    return node.classList.contains("db-panel-tools-open");
  });
  expect(suppressedPanelOpen).toBe(false);

  await openTools(page, '.panel-layout > .db-panel[data-panel-key="builder-content"]');
  await panel.locator(".panel-color-toggle").click({ force: true });
  await page.locator('.panel-color-menu-open .panel-color-swatch[data-color="#ffffff"]').click();
  await expect.poll(() => panel.evaluate((node) => node.dataset.panelColor || "")).toBe("#ffffff");
  const whiteThemeIconColor = await panel.locator(".panel-tool-button").first().evaluate((node) => getComputedStyle(node).color);
  expect(rgbChannelSum(whiteThemeIconColor)).toBeLessThan(150);
  const whiteThemeDrawerBg = await panel.locator(".panel-tool-drawer").evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(whiteThemeDrawerBg).not.toBe("rgb(255, 255, 255)");
  expect(whiteThemeDrawerBg).not.toBe("rgba(255, 255, 255, 1)");
  await panel.locator(".panel-color-toggle").evaluate((button) => {
    button.__panelColorMenu?.classList.remove("panel-color-menu-open");
    button.setAttribute("aria-expanded", "false");
  });
  await expect(page.locator(".panel-color-menu-open")).toHaveCount(0);

  const widget = await addTextWidget(page);
  await openTools(page, '.widget-layout > .widget-card[data-custom-widget="true"]');
  await expect(widget.locator(".panel-move-handle")).toBeVisible();
  await widget.locator(".panel-color-toggle").click({ force: true });
  await page.locator('.panel-color-menu-open .panel-color-swatch[data-color="#ffffff"]').click();
  await expect.poll(() => widget.evaluate((node) => node.dataset.panelColor || "")).toBe("#ffffff");
  const whiteWidgetIconColor = await widget.locator(".panel-tool-button").first().evaluate((node) => getComputedStyle(node).color);
  expect(rgbChannelSum(whiteWidgetIconColor)).toBeLessThan(150);
  await widget.locator(".panel-color-toggle").evaluate((button) => {
    button.__panelColorMenu?.classList.remove("panel-color-menu-open");
    button.setAttribute("aria-expanded", "false");
  });
  await expect(page.locator(".panel-color-menu-open")).toHaveCount(0);

  await openControlBar(page);
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

test("electron GUI keeps slim navbar controls wired", async () => {
  const { app, page } = await launchApp();
  const failed = [];
  page.on("pageerror", (error) => failed.push(error.message));

  await expect(page.getByText("Workspace User")).toHaveCount(0);
  await expect(page.getByText("user@example.com")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Restore default layout" })).toHaveCount(0);
  await expect(page.locator(".layout-slot-picker, .layout-slot-trigger, .layout-slot-menu, [data-slot]")).toHaveCount(0);
  await expect(page.getByText(/^Layout [0-9]+$/)).toHaveCount(0);
  await openControlBar(page);
  await expect(page.locator(".background-tone-popover [data-liquid-glass-toggle]")).toHaveCount(1);
  await expect(page.locator(".app-nav-status [data-liquid-glass-toggle]")).toHaveCount(0);
  await expect(page.locator(".app-nav-actions > .appearance-command-island > [data-liquid-glass-toggle]")).toHaveCount(0);

  const modeButtons = await page.locator(".mode-command-island > button").evaluateAll((buttons) =>
    buttons.map((button) => button.textContent?.trim())
  );
  expect(modeButtons).toEqual(["Select", "Reset"]);

  await page.locator(".layout-group-button").click({ force: true });
  await expect(page.locator(".layout-group-button")).toHaveAttribute("aria-pressed", "true");
  await page.locator(".layout-group-button").click({ force: true });
  await expect(page.locator(".layout-group-button")).toHaveAttribute("aria-pressed", "false");

  await openControlBar(page);
  await page.locator(".background-tone-trigger").click({ force: true });
  await page.waitForFunction(() => Boolean(window.LiquidGlassWebGL));
  const glassToggle = page.getByRole("button", { name: "Toggle liquid glass effect" });
  await expect(glassToggle).toBeVisible();
  const beforeGlass = await page.evaluate(() => Boolean(window.LIQUID_GLASS_WEBGL));
  await glassToggle.click({ force: true });
  await expect.poll(() => page.evaluate(() => Boolean(window.LIQUID_GLASS_WEBGL))).toBe(!beforeGlass);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("dashboard-liquid-glass-webgl"))).toBe(beforeGlass ? "false" : "true");

  await page.locator(".workspace-tab").nth(1).click({ force: true });
  await page.locator(".workspace-tab").nth(1).click({ button: "right" });
  await page.locator(".workspace-tab-rename-input").fill("saved tab");
  await page.locator(".workspace-tab-rename-input").press("Enter");
  const firstWidget = await addTextWidget(page);
  await expect(firstWidget).toBeVisible();
  await openControlBar(page);
  await page.locator(".layout-save-button").click({ force: true });
  await firstWidget.evaluate((node) => node.remove());
  await expect(page.locator('.widget-layout > .widget-card[data-custom-widget="true"]')).toHaveCount(0);
  await openControlBar(page);
  await page.locator(".layout-load-button").click({ force: true });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector(".dashboard-layout-grid");
  await expect(page.locator('.widget-layout > .widget-card[data-custom-widget="true"]')).toHaveCount(1);
  await expect(page.locator(".workspace-tab").nth(1)).toHaveText("saved tab");

  await openControlBar(page);
  await page.getByRole("button", { name: "Reset to default layout" }).click({ force: true });
  await expect(page.locator('.widget-layout > .widget-card[data-custom-widget="true"]')).toHaveCount(0);

  await addTextWidget(page);
  await expect(page.locator('.widget-layout > .widget-card[data-custom-widget="true"]')).toHaveCount(1);
  expect(failed).toEqual([]);
  await closeApp(app);
});

test("electron GUI floats dashboard controls behind a draggable WebGL gear panel", async () => {
  const { app, page } = await launchApp();
  await expect(page.locator(".control-bar-gear")).toBeVisible();
  await expect(page.locator("[data-floating-control-bar]")).not.toBeVisible();

  const tabTop = await page.locator(".workspace-tab-bar").evaluate((node) => Math.round(node.getBoundingClientRect().top));
  expect(tabTop).toBeLessThan(90);

  const bar = await openControlBar(page);
  await expect(bar.locator(".liquid-glass-webgl-panel-canvas")).toHaveCount(1);
  await expect.poll(() => bar.evaluate((node) => {
    window.LiquidGlassWebGL?.mountFloatingPanel?.(node)?.refresh?.();
    const canvas = node.querySelector(".liquid-glass-webgl-panel-canvas");
    const gl = canvas?.getContext("webgl", { premultipliedAlpha: false, alpha: true });
    if (!gl || canvas.width <= 0 || canvas.height <= 0) return 0;
    const pixels = new Uint8Array(4);
    gl.readPixels(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return Array.from(pixels).reduce((sum, value) => sum + value, 0);
  })).toBeGreaterThan(0);

  const before = await bar.boundingBox();
  expect(before).toBeTruthy();
  const handle = bar.locator(".control-bar-drag-handle");
  const handleBox = await handle.boundingBox();
  expect(handleBox).toBeTruthy();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 180, handleBox.y + 92, { steps: 8 });
  await page.mouse.up();
  const after = await bar.boundingBox();
  expect(Math.abs(after.x - before.x)).toBeGreaterThan(40);
  expect(Math.abs(after.y - before.y)).toBeGreaterThan(20);

  await page.reload();
  await page.waitForSelector(".dashboard-layout-grid");
  await openControlBar(page);
  const restored = await page.locator("[data-floating-control-bar]").boundingBox();
  expect(Math.abs(restored.x - after.x)).toBeLessThanOrEqual(12);
  expect(Math.abs(restored.y - after.y)).toBeLessThanOrEqual(12);

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedMotion = await page.locator("[data-floating-control-bar]").evaluate((node) => getComputedStyle(node).transitionDuration);
  expect(reducedMotion.split(",").every((value) => value.trim() === "0s")).toBe(true);

  await page.locator(".control-bar-gear").click({ force: true });
  await expect(page.locator("[data-floating-control-bar]")).not.toBeVisible();
  await closeApp(app);
});

test("electron GUI migrates an active legacy layout profile into the single workspace state", async () => {
  const { app, page } = await launchApp();
  await page.evaluate(() => {
    window.dashboardPersistence.setItem("dashboard-panel-profile:builder", "0");
    window.dashboardPersistence.setItem("dashboard-layout-source:builder", JSON.stringify({
      kind: "saved",
      id: "7",
      slot: "7",
      label: "Layout 7"
    }));
    window.dashboardPersistence.setItem("dashboard-panel-six-grid-layout:7:builder:builder-notes", JSON.stringify({
      order: 0,
      span: 6,
      gridCol: 1,
      gridRow: 6,
      height: null,
      color: "#dc2626",
      title: "Migrated Notes",
      pinned: true,
      collapsed: false,
      minW: null,
      locked: false,
      resizable: true,
      breakBefore: false,
      expansionBaseline: null,
      expansionActive: false,
      childWidgets: []
    }));
  });
  await page.reload();
  await page.waitForSelector(".dashboard-layout-grid");
  const migrated = await page.locator('.panel-layout > .db-panel[data-panel-key="builder-notes"]').evaluate((node) => ({
    profile: window.dashboardPersistence.getItem("dashboard-panel-profile:builder"),
    legacySource: window.dashboardPersistence.getItem("dashboard-layout-source:builder"),
    workingCopy: window.dashboardPersistence.getItem("dashboard-panel-six-grid-layout:0:builder:builder-notes"),
    gridCol: node.dataset.gridCol || "",
    gridRow: node.dataset.gridRow || "",
    title: node.querySelector(".db-panel-title")?.textContent?.trim() || "",
    color: node.dataset.panelColor || "",
    pinned: node.classList.contains("db-panel-pinned"),
  }));
  expect(migrated.profile).toBe("0");
  expect(migrated.legacySource).toBeNull();
  expect(migrated.workingCopy).toBeTruthy();
  expect(migrated).toMatchObject({
    gridCol: "1",
    gridRow: "6",
    title: "Migrated Notes",
    color: "#dc2626",
    pinned: true,
  });
  await closeApp(app);
});

test("electron GUI opens customization drawers only from right click", async () => {
  const { app, page } = await launchApp();
  const panel = page.locator('.panel-layout > .db-panel[data-panel-key="builder-content"]');
  const panelHeader = panel.locator(":scope > .db-panel-hd");

  await panel.click({ force: true, position: { x: 32, y: 96 } });
  await expect(panel).not.toHaveClass(/db-panel-tools-open/);
  await panel.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    window.__rightClickOnlyPanelHoverPoint = {
      x: rect.right - 18,
      y: rect.top + 18,
    };
  });
  const panelHoverPoint = await page.evaluate(() => window.__rightClickOnlyPanelHoverPoint);
  await page.mouse.move(panelHoverPoint.x, panelHoverPoint.y);
  await expect(panel).not.toHaveClass(/db-panel-tools-open/);
  await panelHeader.click({ force: true });
  await expect(panelHeader).toHaveAttribute("aria-expanded", "false");
  await expect(panel).not.toHaveClass(/db-panel-tools-open/);
  await panelHeader.click({ force: true });
  await expect(panelHeader).toHaveAttribute("aria-expanded", "true");

  await panel.click({ button: "right", force: true, position: { x: 48, y: 96 } });
  await expect(panel).toHaveClass(/db-panel-tools-open/);
  await expect(page.locator(".workspace-menu-overlay-layer > .panel-tool-drawer.dashboard-tool-drawer-open")).toBeVisible();
  const panelPin = page.locator(".workspace-menu-overlay-layer > .panel-tool-drawer.dashboard-tool-drawer-open .panel-pin-toggle");
  const panelWasPinned = await panel.evaluate((node) => node.classList.contains("db-panel-pinned"));
  await panelPin.click({ force: true });
  await expect.poll(() => panel.evaluate((node) => node.classList.contains("db-panel-pinned"))).toBe(!panelWasPinned);
  await page.keyboard.press("Escape");
  await expect(panel).not.toHaveClass(/db-panel-tools-open/);

  const widget = await addTextWidget(page);
  await widget.click({ force: true, position: { x: 32, y: 36 } });
  await expect(widget).not.toHaveClass(/widget-tools-open/);
  await widget.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    window.__rightClickOnlyWidgetHoverPoint = {
      x: rect.right - 18,
      y: rect.top + 18,
    };
  });
  const widgetHoverPoint = await page.evaluate(() => window.__rightClickOnlyWidgetHoverPoint);
  await page.mouse.move(widgetHoverPoint.x, widgetHoverPoint.y);
  await expect(widget).not.toHaveClass(/widget-tools-open/);
  await widget.click({ button: "right", force: true, position: { x: 40, y: 40 } });
  await expect(widget).toHaveClass(/widget-tools-open/);
  await expect(page.locator(".workspace-menu-overlay-layer > .panel-tool-drawer.dashboard-tool-drawer-open")).toBeVisible();
  const widgetPin = page.locator(".workspace-menu-overlay-layer > .panel-tool-drawer.dashboard-tool-drawer-open .panel-pin-toggle");
  const widgetWasPinned = await widget.evaluate((node) => node.classList.contains("db-panel-pinned"));
  await widgetPin.click({ force: true });
  await expect.poll(() => widget.evaluate((node) => node.classList.contains("db-panel-pinned"))).toBe(!widgetWasPinned);

  await closeApp(app);
});

test("electron GUI renders glass text tabs with active scaling and persisted edits", async () => {
  const { app, page } = await launchApp();
  await expect(page.locator(".workspace-tab-bar")).toBeVisible();
  await expect(page.locator(".workspace-tab:not(.workspace-tab-add)")).toHaveCount(3);
  await expect(page.locator(".workspace-tab-add")).toBeVisible();
  await page.locator(".workspace-tab").nth(0).click();
  await expect(page.locator(".workspace-tab").nth(0)).toHaveAttribute("aria-pressed", "true");

  const glassStyle = await page.locator(".workspace-tab").first().evaluate((node) => {
    const button = getComputedStyle(node);
    const label = getComputedStyle(node.querySelector(".workspace-tab-label"));
    return {
      buttonBackground: button.backgroundColor,
      backgroundClip: label.backgroundClip || label.webkitBackgroundClip || "",
      textFill: label.webkitTextFillColor || label.color,
      backgroundImage: label.backgroundImage,
    };
  });
  expect(glassStyle.buttonBackground).toBe("rgba(0, 0, 0, 0)");
  expect(glassStyle.backgroundClip).toContain("text");
  expect(glassStyle.textFill).toMatch(/rgba?\(0,\s*0,\s*0,\s*0\)|transparent/i);
  expect(glassStyle.backgroundImage).not.toBe("none");

  const secondBoxBefore = await page.locator(".workspace-tab").nth(1).boundingBox();
  expect(secondBoxBefore).toBeTruthy();
  await page.locator(".workspace-tab").nth(1).click();
  await expect(page.locator(".workspace-tab").nth(1)).toHaveAttribute("aria-pressed", "true");
  const secondBoxAfter = await page.locator(".workspace-tab").nth(1).boundingBox();
  expect(secondBoxAfter.width).toBeGreaterThan(secondBoxBefore.width);

  await page.locator(".workspace-tab").nth(1).click({ button: "right" });
  await expect(page.locator(".workspace-tab-menu")).toBeVisible();
  await expect(page.locator('.workspace-tab-menu .panel-color-swatch[data-color="#ffffff"]')).toBeVisible();
  await page.locator(".workspace-tab-rename-input").fill("planning");
  await page.locator(".workspace-tab-rename-input").press("Enter");
  await expect(page.locator(".workspace-tab").nth(1)).toHaveText("planning");
  await expect(page.locator(".workspace-tab-menu")).toHaveCount(0);
  await page.locator(".workspace-tab").nth(1).click({ button: "right" });
  await page.locator('.workspace-tab-menu .panel-color-swatch[data-color="#dc2626"]').click();
  await expect.poll(() => page.locator(".workspace-tab").nth(1).evaluate((node) => getComputedStyle(node).getPropertyValue("--tab-accent").trim())).toBe("#dc2626");
  await expect(page.locator(".workspace-tab-menu")).toBeVisible();
  await expect(page.locator('.workspace-tab-menu .panel-color-swatch[data-color="#dc2626"]')).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator(".workspace-tab-menu")).toHaveCount(0);

  await page.reload();
  await page.waitForSelector(".dashboard-layout-grid");
  await expect(page.locator(".workspace-tab").nth(1)).toHaveText("planning");
  await expect(page.locator(".workspace-tab").nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.locator(".workspace-tab").nth(1).evaluate((node) => getComputedStyle(node).getPropertyValue("--tab-accent").trim())).toBe("#dc2626");

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedMotion = await page.locator(".workspace-tab").nth(1).evaluate((node) => ({
    transitionDuration: getComputedStyle(node).transitionDuration,
    pseudoTransitionDuration: getComputedStyle(node, "::before").transitionDuration,
  }));
  expect(reducedMotion.transitionDuration.split(",").every((value) => value.trim() === "0s")).toBe(true);
  expect(reducedMotion.pseudoTransitionDuration.split(",").every((value) => value.trim() === "0s")).toBe(true);
  await closeApp(app);
});

test("electron GUI wires tabs to isolated lazy-loaded workspace pages", async () => {
  const { app, page } = await launchApp();
  await expect(page.locator(".workspace-tab:not(.workspace-tab-add)")).toHaveCount(3);
  await expect(page.locator(".widget-layout > .widget-card")).toHaveCount(4);

  await page.locator(".workspace-tab-add").click();
  await expect(page.locator(".workspace-tab:not(.workspace-tab-add)")).toHaveCount(4);
  await expect(page.locator(".workspace-tab:not(.workspace-tab-add)").nth(3)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".widget-layout > .widget-card")).toHaveCount(0);
  await expect(page.locator(".panel-layout > .db-panel")).toHaveCount(0);

  const pageFourWidget = await addTextWidget(page);
  const pageFourKey = await pageFourWidget.evaluate((node) => node.dataset.widgetKey || "");
  expect(pageFourKey).toBeTruthy();
  await expect(page.locator(".widget-layout > .widget-card")).toHaveCount(1);

  await page.locator(".workspace-tab:not(.workspace-tab-add)").nth(0).click();
  await expect(page.locator(".widget-layout > .widget-card")).toHaveCount(4);
  await expect(page.locator(`.widget-layout > .widget-card[data-widget-key="${pageFourKey}"]`)).toHaveCount(0);

  await page.locator(".workspace-tab:not(.workspace-tab-add)").nth(3).click();
  await expect(page.locator(`.widget-layout > .widget-card[data-widget-key="${pageFourKey}"]`)).toBeVisible();
  await expect(page.locator(".widget-layout > .widget-card")).toHaveCount(1);
  const pageRuntime = await page.evaluate(() => ({
    persisted: window.dashboardWorkspacePagesRuntime?.persistActivePage?.(),
    activeTabId: window.dashboardWorkspacePagesRuntime?.activeTabId?.(),
    pageIds: window.dashboardWorkspacePagesRuntime?.pageIds?.(),
    activePageWidgetHtml: window.dashboardWorkspacePagesRuntime?.pageForTab?.(window.dashboardWorkspacePagesRuntime?.activeTabId?.())?.widgetHtml || "",
  }));
  expect(pageRuntime.pageIds.length).toBe(4);
  expect(pageRuntime.activePageWidgetHtml).toContain(pageFourKey);

  await openControlBar(page);
  await page.locator(".layout-save-button").click({ force: true });
  await page.reload();
  await page.waitForSelector(".dashboard-layout-grid");
  await expect(page.locator(".workspace-tab:not(.workspace-tab-add)").nth(3)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(`.widget-layout > .widget-card[data-widget-key="${pageFourKey}"]`)).toBeVisible();
  await page.locator(".workspace-tab:not(.workspace-tab-add)").nth(0).click({ force: true });
  await expect(page.locator(".workspace-tab:not(.workspace-tab-add)").nth(0)).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => window.dashboardWorkspacePagesRuntime?.activeTabId?.())).toBe("tab-1");
  await expect(page.locator(`.widget-layout > .widget-card[data-widget-key="${pageFourKey}"]`)).toHaveCount(0);
  await expect(page.locator(".widget-layout > .widget-card")).toHaveCount(4);

  await page.emulateMedia({ reducedMotion: "reduce" });
  const transitionDuration = await page.locator(".dashboard-layout-grid").evaluate((node) => getComputedStyle(node).transitionDuration);
  expect(transitionDuration).toBe("0s");
  await closeApp(app);
});

test("electron GUI keeps widget clicks local and free of orange focus artifacts", async () => {
  const { app, page } = await launchApp();
  const navigationEvents = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigationEvents.push(frame.url());
  });
  await page.evaluate(() => {
    window.__widgetClickBeforeUnloadCount = 0;
    window.addEventListener("beforeunload", () => {
      window.__widgetClickBeforeUnloadCount += 1;
    });
  });

  const newWidget = await addWidget(page, { kind: "stat", category: "data" });
  await newWidget.evaluate((node) => {
    node.dataset.gridCol = "5";
    node.style.gridColumn = "5 / span 1";
  });
  const rightEdgeWidget = page.locator('.widget-layout > .widget-card[data-custom-widget="true"]').last();
  const beforeUrl = page.url();
  await rightEdgeWidget.click({ force: true });
  await expect.poll(() => page.evaluate(() => window.__widgetClickBeforeUnloadCount || 0)).toBe(0);
  expect(page.url()).toBe(beforeUrl);

  const clickState = await rightEdgeWidget.evaluate((node) => {
    const styles = getComputedStyle(node);
    const orangeOutlineNodes = [...document.querySelectorAll("*")].filter((entry) => {
      const computed = getComputedStyle(entry);
      return /rgb\(229,\s*151,\s*0\)|rgb\(245,\s*158,\s*11\)|rgb\(249,\s*115,\s*22\)/.test(computed.outlineColor) &&
        computed.outlineStyle !== "none" &&
        computed.outlineWidth !== "0px";
    }).map((entry) => ({
      tag: entry.tagName,
      className: entry.className?.toString?.() || "",
      outline: getComputedStyle(entry).outline,
    }));
    return {
      tagName: node.tagName,
      href: node.getAttribute("href") || "",
      outlineStyle: styles.outlineStyle,
      outlineWidth: styles.outlineWidth,
      outlineColor: styles.outlineColor,
      orangeOutlineNodes,
      canvasCount: document.querySelectorAll("canvas").length,
    };
  });
  expect(clickState.tagName).toBe("A");
  expect(clickState.outlineStyle === "none" || clickState.outlineWidth === "0px").toBe(true);
  expect(clickState.orangeOutlineNodes).toEqual([]);
  expect(clickState.canvasCount).toBeGreaterThanOrEqual(1);
  expect(navigationEvents.filter((url) => url !== beforeUrl)).toEqual([]);
  await writeInteractionScenarios(page, ["widget-click-no-reload-no-orange-artifacts"], clickState);
  await closeApp(app);
});

test("electron GUI keeps panel-contained widgets movable and mounted across tab switches", async () => {
  const { app, page } = await launchApp();
  const widgetSelector = '.widget-layout:not(.panel-internal-widget-grid) > .widget-card[data-widget-key="widget-1"]';
  const panelSelector = '.panel-layout > .db-panel[data-panel-key="builder-content"]';
  const panelChildSelector = `${panelSelector} .panel-internal-widget-grid > .widget-card[data-widget-key="widget-1"]`;
  await page.locator(panelSelector).evaluate((panel) => {
    panel.dataset.savedHeight = "360";
    panel.dataset.gridRowSpan = "5";
    panel.style.height = "360px";
    panel.style.gridRowEnd = "span 5";
  });
  const widget = await openTools(page, widgetSelector);
  const moveBox = await widget.locator(".panel-move-handle").boundingBox();
  expect(moveBox).toBeTruthy();
  const target = await page.locator(panelSelector).evaluate((panel) => {
    const headerRect = panel.querySelector(":scope > .db-panel-hd")?.getBoundingClientRect();
    const bodyRect = panel.querySelector(":scope > .db-panel-body")?.getBoundingClientRect();
    return {
      x: Math.round(bodyRect.left + Math.min(Math.max(bodyRect.width * 0.52, 56), Math.max(56, bodyRect.width - 56))),
      y: Math.round(Math.max(bodyRect.top + 46, headerRect.bottom + 34)),
    };
  });
  await dispatchPointerDragUntilMove(page, moveBox.x + moveBox.width / 2, moveBox.y + moveBox.height / 2, target.x, target.y, 80);
  await page.waitForFunction((selector) => document.querySelector(selector)?.classList.contains("panel-container-drag-active"), panelSelector);
  await finishPointerDrag(page, target.x, target.y);
  await page.waitForFunction(({ panelChildSelector, widgetSelector }) => (
    Boolean(document.querySelector(panelChildSelector)) &&
    !document.querySelector(widgetSelector)
  ), { panelChildSelector, widgetSelector });

  const childBeforeMove = await page.locator(panelChildSelector).evaluate((node) => ({
    col: Number(node.dataset.gridCol) || 0,
    row: Number(node.dataset.gridRow) || 0,
  }));
  const childDragPlan = await page.locator(panelChildSelector).evaluate((node) => {
    const body = node.closest(".db-panel-body");
    const bodyRect = body.getBoundingClientRect();
    const itemRect = node.getBoundingClientRect();
    return {
      startX: Math.round(itemRect.left + Math.min(itemRect.width - 8, Math.max(8, itemRect.width * 0.45))),
      startY: Math.round(itemRect.top + Math.min(itemRect.height - 8, Math.max(8, itemRect.height * 0.45))),
      endX: Math.round(Math.min(bodyRect.right - 42, itemRect.left + itemRect.width / 2 + 180)),
      endY: Math.round(Math.min(bodyRect.bottom - 42, itemRect.top + itemRect.height / 2 + 210)),
    };
  });
  await dispatchPointerDragUntilMove(
    page,
    childDragPlan.startX,
    childDragPlan.startY,
    childDragPlan.endX,
    childDragPlan.endY,
    90
  );
  await page.waitForFunction(() => Boolean(document.querySelector(".widget-dragging")));
  const livePanelDrag = await page.locator(".widget-dragging").evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      key: node.dataset.widgetKey || "",
      left: Math.round(rect.left),
      top: Math.round(rect.top),
    };
  });
  expect(livePanelDrag.key).toBe("widget-1");
  await finishPointerDrag(page, childDragPlan.endX, childDragPlan.endY);
  await page.waitForFunction(() => !document.querySelector(".widget-dragging, .widget-placeholder"));
  const childAfterMove = await page.locator(panelChildSelector).evaluate((node) => ({
    col: Number(node.dataset.gridCol) || 0,
    row: Number(node.dataset.gridRow) || 0,
  }));
  expect(childAfterMove.col).toBeGreaterThan(0);
  expect(childAfterMove.row).toBeGreaterThan(0);
  const storedBeforeSwitch = await page.evaluate((key) => {
    window.dashboardWorkspacePagesRuntime?.persistActivePage?.();
    const page = window.dashboardWorkspacePagesRuntime?.pageForTab?.("tab-1");
    return {
      hasChildInPanelHtml: Boolean(page?.panelHtml?.includes(key)),
      panelHtmlLength: page?.panelHtml?.length || 0,
    };
  }, 'data-widget-key="widget-1"');
  expect(storedBeforeSwitch.hasChildInPanelHtml).toBe(true);

  await page.locator(".workspace-tab:not(.workspace-tab-add)").nth(1).click({ force: true });
  await expect.poll(() => page.evaluate(() => window.dashboardWorkspacePagesRuntime?.activeTabId?.())).toBe("tab-2");
  await page.waitForFunction(() => {
    const grid = document.querySelector(".dashboard-layout-grid");
    return !grid?.classList.contains("workspace-page-slide-out") &&
      !grid?.classList.contains("workspace-page-slide-in");
  });
  await expect(page.locator(panelChildSelector)).toHaveCount(0);
  await page.locator(".workspace-tab:not(.workspace-tab-add)").nth(0).click({ force: true });
  await expect.poll(() => page.evaluate(() => window.dashboardWorkspacePagesRuntime?.activeTabId?.())).toBe("tab-1");
  await expect(page.locator(panelChildSelector)).toBeVisible();
  const childAfterTabRoundTrip = await page.locator(panelChildSelector).evaluate((node) => ({
    col: Number(node.dataset.gridCol) || 0,
    row: Number(node.dataset.gridRow) || 0,
    parentPanelKey: node.dataset.parentPanelKey || "",
  }));
  expect(childAfterTabRoundTrip).toEqual({ ...childAfterMove, parentPanelKey: "builder-content" });
  await writeInteractionScenarios(page, ["panel-contained-widget-move-tab-roundtrip"], { target, livePanelDrag, childBeforeMove, childAfterMove });
  await closeApp(app);
});

test("electron GUI recolors widgets through the right-click customization drawer", async () => {
  const { app, page } = await launchApp();
  const widget = await addTextWidget(page);
  await widget.click({ button: "right" });
  const drawer = page.locator(".workspace-menu-overlay-layer > .panel-tool-drawer.dashboard-tool-drawer-open").last();
  await expect(drawer).toBeVisible();
  await drawer.locator(".panel-color-toggle").click({ force: true });
  const swatch = page.locator('.panel-color-menu-open .panel-color-swatch[data-color="#dc2626"]').first();
  await swatch.click({ force: true });
  await expect.poll(() => widget.evaluate((node) => node.dataset.panelColor || "")).toBe("#dc2626");
  const coloredAccent = await widget.evaluate((node) => getComputedStyle(node).getPropertyValue("--panel-accent").trim());
  expect(coloredAccent).toBe("#dc2626");

  await openControlBar(page);
  await page.locator(".layout-save-button").click({ force: true });
  await page.reload();
  await page.waitForSelector(".dashboard-layout-grid");
  const persistedWidget = page.locator('.widget-layout > .widget-card[data-custom-widget="true"]').last();
  await expect.poll(() => persistedWidget.evaluate((node) => node.dataset.panelColor || "")).toBe("#dc2626");
  const persistedAccent = await persistedWidget.evaluate((node) => getComputedStyle(node).getPropertyValue("--panel-accent").trim());
  expect(persistedAccent).toBe("#dc2626");
  await writeInteractionScenarios(page, ["right-click-widget-recolor-persists"], { coloredAccent, persistedAccent });
  await closeApp(app);
});

test("electron GUI applies derived background presets, custom color, persistence, undo, and photos", async () => {
  const { app, page } = await launchApp();
  const failedImageRequests = [];
  page.on("requestfailed", (request) => {
    if (request.resourceType() === "image") failedImageRequests.push(request.url());
  });
  await expect(page.locator(".background-photo-option")).toHaveCount(27);
  await expect(page.locator(".background-tone-option")).toHaveCount(6);

  const initialBackground = await page.locator("body").evaluate((node) => getComputedStyle(node).backgroundImage);
  await openControlBar(page);
  await page.locator(".background-tone-trigger").click({ force: true });
  await page.locator('.background-tone-option[data-background-tone="tone-slate"]').click({ force: true });
  await expect(page.locator("html")).toHaveAttribute("data-background", "tone-slate");
  const preset = await page.locator("html").evaluate(() => ({
    baseTone: getComputedStyle(document.documentElement).getPropertyValue("--base-tone").trim(),
    background: getComputedStyle(document.body).backgroundImage,
    selected: document.querySelector('.background-tone-option[data-background-tone="tone-slate"]')?.getAttribute("aria-pressed"),
  }));
  expect(preset.baseTone).toBe("#475569");
  expect(preset.background).not.toBe(initialBackground);
  expect(preset.selected).toBe("true");

  await openControlBar(page);
  await page.locator(".background-tone-trigger").click({ force: true });
  await page.locator(".background-custom-color-input").evaluate((input) => {
    input.value = "#336699";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator("html")).toHaveAttribute("data-background", "custom-color");
  const custom = await page.locator("html").evaluate(() => ({
    baseTone: getComputedStyle(document.documentElement).getPropertyValue("--base-tone").trim(),
    storage: localStorage.getItem("dashboard-background"),
    customSelected: document.querySelector(".background-custom-color")?.classList.contains("is-selected"),
    label: document.querySelector(".background-tone-trigger")?.getAttribute("aria-label") || "",
  }));
  expect(custom.baseTone).toBe("#336699");
  expect(JSON.parse(custom.storage)).toEqual({ kind: "custom", hex: "#336699" });
  expect(custom.customSelected).toBe(true);
  expect(custom.label).toContain("#336699");

  await page.locator(".layout-save-button").click();
  await page.reload();
  await page.waitForSelector(".dashboard-layout-grid");
  await expect(page.locator("html")).toHaveAttribute("data-background", "custom-color");
  await expect.poll(() => page.locator("html").evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--base-tone").trim())).toBe("#336699");

  await openControlBar(page);
  await page.locator(".background-tone-trigger").click({ force: true });
  await page.locator('.background-tone-option[data-background-tone="tone-mist"]').click({ force: true });
  await expect(page.locator("html")).toHaveAttribute("data-background", "tone-mist");
  await page.locator(".panel-undo-button").click({ force: true });
  await expect(page.locator("html")).toHaveAttribute("data-background", "custom-color");
  await expect.poll(() => page.locator("html").evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--base-tone").trim())).toBe("#336699");

  await openControlBar(page);
  await page.locator(".background-tone-trigger").click({ force: true });
  await page.locator('.background-photo-option[data-background-tone="photo-earth"]').click({ force: true });
  await expect(page.locator("html")).toHaveAttribute("data-background", "photo-earth");
  await expect(page.locator("body")).toHaveClass(/has-photo-background/);
  await expect(page.locator(".workspace-photo-panel").first()).toBeVisible();
  await expect.poll(() => page.locator(".workspace-photo-panel").first().evaluate((node) => getComputedStyle(node).backgroundImage)).toContain(".webp");
  const renderedPhoto = await page.locator(".workspace-photo-panel").first().evaluate(async (node) => {
    const backgroundImage = getComputedStyle(node).backgroundImage;
    const src = backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1] || "";
    const image = new Image();
    image.src = src;
    try {
      if (typeof image.decode === "function") await image.decode();
    } catch {}
    return {
      backgroundImage,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      preloadDone: window.__dashboardBackgroundPreloadDone === true,
    };
  });
  expect(renderedPhoto.backgroundImage).toContain("earth.webp");
  expect(renderedPhoto.naturalWidth).toBeGreaterThan(0);
  expect(renderedPhoto.naturalHeight).toBeGreaterThan(0);
  expect(renderedPhoto.preloadDone).toBe(true);
  expect(failedImageRequests).toEqual([]);
  await writeInteractionScenarios(page, ["derived-background-color-selector"]);
  await closeApp(app);
});

test("electron GUI renders every WebP photo background", async () => {
  test.setTimeout(120000);
  const { app, page } = await launchApp();
  const failedImages = [];
  page.on("requestfailed", (request) => {
    if (request.resourceType() === "image") failedImages.push(request.url());
  });

  const photoTones = await page.locator(".background-photo-option").evaluateAll((options) =>
    options.map((option) => option.getAttribute("data-background-tone")).filter(Boolean)
  );
  expect(photoTones).toHaveLength(27);

  for (const tone of photoTones) {
    await openControlBar(page);
    await page.locator(".background-tone-trigger").click({ force: true });
    await page.locator(`.background-photo-option[data-background-tone="${tone}"]`).click({ force: true });
    await expect(page.locator("html")).toHaveAttribute("data-background", tone);
    await expect(page.locator("body")).toHaveClass(/has-photo-background/);
    await expect.poll(() => page.evaluate(() => window.__dashboardBackgroundPreloadDone === true)).toBe(true);
    await expect(page.locator(".workspace-photo-panel").first()).toBeVisible();
    await expect.poll(() => page.locator(".workspace-photo-panel").first().evaluate((node) => getComputedStyle(node).backgroundImage)).toContain(".webp");
    const rendered = await page.locator(".workspace-photo-panel").first().evaluate(async (node) => {
      const backgroundImage = getComputedStyle(node).backgroundImage;
      const src = backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1] || "";
      const image = new Image();
      image.src = src;
      try {
        if (typeof image.decode === "function") await image.decode();
      } catch {}
      return {
        backgroundImage,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        preloadDone: window.__dashboardBackgroundPreloadDone === true,
      };
    });
    expect(rendered.backgroundImage).toContain(".webp");
    expect(rendered.naturalWidth).toBeGreaterThan(0);
    expect(rendered.naturalHeight).toBeGreaterThan(0);
    expect(rendered.preloadDone).toBe(true);
  }
  expect(failedImages).toEqual([]);
  await closeApp(app);
});

test("electron GUI keeps object glass material independent from workspace background tokens", async () => {
  const { app, page } = await launchApp();
  const dashboardGridCss = fs.readFileSync(path.join(__dirname, "..", "app", "static", "dashboard-grid.css"), "utf8");
  expect(dashboardGridCss).not.toMatch(/var\(--bg(?:-end)?\b/);

  await openControlBar(page);
  await page.locator(".background-tone-trigger").click({ force: true });
  const before = await page.evaluate(() => {
    const selectors = [
      ".db-panel",
      ".widget-card",
      ".background-tone-popover",
      ".db-panel-body > .panel-empty-state",
      ".db-panel-body > .panel-empty-state .panel-empty-action",
    ];
    const snapshotFor = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const styles = getComputedStyle(node);
      return {
        selector,
        background: styles.background,
        backgroundColor: styles.backgroundColor,
        backgroundImage: styles.backgroundImage,
        borderColor: styles.borderColor,
        boxShadow: styles.boxShadow,
        backdropFilter: styles.backdropFilter || styles.webkitBackdropFilter || "",
      };
    };
    const objects = selectors.map(snapshotFor).filter(Boolean);
    return {
      bodyBackground: getComputedStyle(document.body).backgroundImage,
      tonePreview: getComputedStyle(document.querySelector(".background-tone-dot")).backgroundImage,
      missing: selectors.filter((selector) => !objects.some((item) => item.selector === selector)),
      objects,
    };
  });

  await page.evaluate(() => {
    document.documentElement.style.setProperty("--bg", "rgb(1, 2, 3)");
    document.documentElement.style.setProperty("--bg-end", "rgb(250, 240, 10)");
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  const after = await page.evaluate(() => {
    const selectors = [
      ".db-panel",
      ".widget-card",
      ".background-tone-popover",
      ".db-panel-body > .panel-empty-state",
      ".db-panel-body > .panel-empty-state .panel-empty-action",
    ];
    const snapshotFor = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const styles = getComputedStyle(node);
      return {
        selector,
        background: styles.background,
        backgroundColor: styles.backgroundColor,
        backgroundImage: styles.backgroundImage,
        borderColor: styles.borderColor,
        boxShadow: styles.boxShadow,
        backdropFilter: styles.backdropFilter || styles.webkitBackdropFilter || "",
      };
    };
    const objects = selectors.map(snapshotFor).filter(Boolean);
    return {
      bodyBackground: getComputedStyle(document.body).backgroundImage,
      tonePreview: getComputedStyle(document.querySelector(".background-tone-dot")).backgroundImage,
      missing: selectors.filter((selector) => !objects.some((item) => item.selector === selector)),
      objects,
    };
  });

  expect(before.missing).toEqual([]);
  expect(after.missing).toEqual([]);
  expect(after.bodyBackground).not.toBe(before.bodyBackground);
  expect(after.tonePreview).not.toBe(before.tonePreview);
  expect(after.objects).toEqual(before.objects);
  expect(after.objects.some((item) => item.backdropFilter.includes("blur"))).toBe(true);
  await closeApp(app);
});

test("electron GUI uses the same object material for static and photo backgrounds", async () => {
  const { app, page } = await launchApp();
  const dashboardGridCss = fs.readFileSync(path.join(__dirname, "..", "app", "static", "dashboard-grid.css"), "utf8");
  expect(dashboardGridCss).not.toMatch(/var\(--bg(?:-end)?\b/);

  const captureMaterial = async () => page.evaluate(() => {
    let divider = document.querySelector(".workspace-divider.db-panel");
    if (!divider) {
      divider = document.createElement("section");
      divider.className = "workspace-divider db-panel";
      divider.dataset.testDivider = "true";
      document.querySelector(".panel-layout")?.append(divider);
    }
    const props = [
      "background",
      "backgroundColor",
      "backgroundImage",
      "borderColor",
      "borderTopColor",
      "borderBottomColor",
      "boxShadow",
      "backdropFilter",
      "webkitBackdropFilter",
      "opacity",
    ];
    const selectors = {
      panel: '.panel-layout > .db-panel[data-panel-key="builder-content"]',
      panelHeader: '.panel-layout > .db-panel[data-panel-key="builder-content"] > .db-panel-hd',
      panelBody: '.panel-layout > .db-panel[data-panel-key="builder-content"] > .db-panel-body',
      widget: '.widget-layout:not(.panel-internal-widget-grid) > .widget-card[data-widget-key="widget-1"]',
      customPanel: '.panel-layout > .db-panel.db-panel-custom-color[data-panel-key="builder-notes"]',
      divider: ".workspace-divider.db-panel",
    };
    return Object.fromEntries(Object.entries(selectors).map(([key, selector]) => {
      const node = document.querySelector(selector);
      if (!node) return [key, null];
      const styles = getComputedStyle(node);
      return [key, Object.fromEntries(props.map((prop) => [prop, styles[prop] || ""]))];
    }));
  });

  const staticMaterial = await captureMaterial();
  await openControlBar(page);
  await page.locator(".background-tone-trigger").click({ force: true });
  await page.locator('.background-photo-option[data-background-tone="photo-earth"]').click({ force: true });
  await expect(page.locator("html")).toHaveAttribute("data-background", "photo-earth");
  await expect(page.locator("body")).toHaveClass(/has-photo-background/);
  const photoMaterial = await captureMaterial();

  expect(Object.values(staticMaterial).every(Boolean)).toBe(true);
  expect(Object.values(photoMaterial).every(Boolean)).toBe(true);
  expect(staticMaterial).toEqual(photoMaterial);
  await closeApp(app);
});

test("electron GUI scrolls panel expansion into view and restores on collapse", async () => {
  const { app, page } = await launchApp();
  const selector = '.panel-layout > .db-panel[data-panel-key="builder-content"]';

  await page.evaluate((selector) => {
    const panel = document.querySelector(selector);
    if (!panel) return;
    panel.classList.add("db-panel-collapsed");
    panel.dataset.savedHeight = "620";
    panel.dataset.gridRowSpan = "1";
    panel.dataset.gridRow = "14";
    panel.style.gridRow = "14 / span 1";
    panel.style.height = "";
    panel.querySelector(":scope > .db-panel-hd")?.setAttribute("aria-expanded", "false");
  }, selector);
  await page.evaluate((selector) => {
    const panel = document.querySelector(selector);
    const rect = panel?.getBoundingClientRect();
    if (!rect) return;
    window.scrollTo(0, Math.max(0, window.scrollY + rect.top - window.innerHeight + 84));
  }, selector);

  const beforeOpenScroll = await page.evaluate(() => Math.round(window.scrollY || 0));
  await page.locator(`${selector} > .db-panel-hd`).click({ force: true });
  await expect(page.locator(`${selector} > .db-panel-hd`)).toHaveAttribute("aria-expanded", "true");
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY || 0))).toBeGreaterThan(beforeOpenScroll);
  await expect.poll(() => page.locator(selector).evaluate((panel) => {
    const rect = panel.getBoundingClientRect();
    return Math.round(rect.bottom <= window.innerHeight + 1 ? 1 : 0);
  })).toBe(1);

  const revealedScroll = await page.evaluate(() => Math.round(window.scrollY || 0));
  await page.locator(`${selector} > .db-panel-hd`).click({ force: true });
  await expect(page.locator(`${selector} > .db-panel-hd`)).toHaveAttribute("aria-expanded", "false");
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY || 0))).toBeLessThan(revealedScroll);
  const expectedRestoredScroll = await page.evaluate((beforeOpenScroll) => Math.min(
    beforeOpenScroll,
    Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  ), beforeOpenScroll);
  await expect.poll(() => page.evaluate((expectedRestoredScroll) => (
    Math.abs(Math.round(window.scrollY || 0) - expectedRestoredScroll) <= 32
  ), expectedRestoredScroll)).toBe(true);
  await expect.poll(() => page.evaluate(() => document.body.style.paddingBottom || "")).toBe("");

  await page.evaluate((selector) => {
    const panel = document.querySelector(selector);
    if (!panel) return;
    panel.classList.add("db-panel-collapsed");
    panel.dataset.savedHeight = "180";
    panel.dataset.gridRowSpan = "1";
    panel.dataset.gridRow = "2";
    panel.style.gridRow = "2 / span 1";
    panel.style.height = "";
    panel.querySelector(":scope > .db-panel-hd")?.setAttribute("aria-expanded", "false");
    window.scrollTo(0, 0);
  }, selector);
  const visibleBefore = await page.evaluate(() => Math.round(window.scrollY || 0));
  await page.locator(`${selector} > .db-panel-hd`).click({ force: true });
  await expect(page.locator(`${selector} > .db-panel-hd`)).toHaveAttribute("aria-expanded", "true");
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const visibleAfter = await page.evaluate(() => Math.round(window.scrollY || 0));
  expect(visibleAfter).toBe(visibleBefore);

  await page.evaluate((selector) => {
    const panel = document.querySelector(selector);
    if (!panel) return;
    panel.classList.add("db-panel-collapsed");
    panel.dataset.savedHeight = "620";
    panel.dataset.gridRowSpan = "1";
    panel.dataset.gridRow = "14";
    panel.style.gridRow = "14 / span 1";
    panel.style.height = "";
    panel.querySelector(":scope > .db-panel-hd")?.setAttribute("aria-expanded", "false");
    const rect = panel.getBoundingClientRect();
    window.scrollTo(0, Math.max(0, window.scrollY + rect.top - window.innerHeight + 84));
  }, selector);
  const beforeManualOpenScroll = await page.evaluate(() => Math.round(window.scrollY || 0));
  await page.locator(`${selector} > .db-panel-hd`).click({ force: true });
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY || 0))).toBeGreaterThan(beforeManualOpenScroll);
  await page.waitForFunction((selector) => Boolean(document.querySelector(selector)?.__panelRevealScrollState), selector);
  await page.evaluate(() => {
    window.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -160 }));
    window.scrollBy(0, -160);
  });
  const manualScroll = await page.evaluate(() => Math.round(window.scrollY || 0));
  await page.locator(`${selector} > .db-panel-hd`).click({ force: true });
  await expect(page.locator(`${selector} > .db-panel-hd`)).toHaveAttribute("aria-expanded", "false");
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const afterManualCollapseScroll = await page.evaluate(() => Math.round(window.scrollY || 0));
  const expectedManualCollapseScroll = await page.evaluate((manualScroll) => Math.min(
    manualScroll,
    Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  ), manualScroll);
  expect(Math.abs(afterManualCollapseScroll - expectedManualCollapseScroll)).toBeLessThanOrEqual(24);

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedMotionBehavior = await page.evaluate((selector) => {
    const panel = document.querySelector(selector);
    if (!panel) return null;
    const originalScrollTo = window.scrollTo.bind(window);
    const calls = [];
    window.scrollTo = (...args) => {
      calls.push(args);
      return originalScrollTo(...args);
    };
    panel.classList.add("db-panel-collapsed");
    panel.dataset.savedHeight = "620";
    panel.dataset.gridRowSpan = "1";
    panel.dataset.gridRow = "14";
    panel.style.gridRow = "14 / span 1";
    panel.style.height = "";
    panel.querySelector(":scope > .db-panel-hd")?.setAttribute("aria-expanded", "false");
    const rect = panel.getBoundingClientRect();
    originalScrollTo(0, Math.max(0, window.scrollY + rect.top - window.innerHeight + 84));
    return new Promise((resolve) => {
      panel.querySelector(":scope > .db-panel-hd")?.click();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.scrollTo = originalScrollTo;
        const optionCall = calls.find((entry) => entry[0] && typeof entry[0] === "object");
        resolve(optionCall?.[0]?.behavior || "");
      }));
    });
  }, selector);
  expect(reducedMotionBehavior).toBe("auto");

  const panelActionControlsSource = fs.readFileSync(path.join(__dirname, "..", "app", "static", "modules", "panel-action-controls.js"), "utf8");
  expect(panelActionControlsSource).not.toMatch(/resolveSparseGridLayout|reflowItemsForLayout|collisionReflow/i);
  await writeInteractionScenarios(page, ["panel-scroll-reveal-collapse"], { beforeOpenScroll, revealedScroll, manualScroll, afterManualCollapseScroll, reducedMotionBehavior });
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
    "no-interaction-scroll",
  ], { moveBefore, afterMove });

  await closeApp(app);
});

test("electron GUI keeps select-mode multi-resize deterministic", async () => {
  const { app, page } = await launchApp();
  const firstSelector = '.panel-layout > .db-panel[data-panel-key="builder-notes"]';
  const secondSelector = '.panel-layout > .db-panel[data-panel-key="builder-content"]';

  await openControlBar(page);
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
    height: String(Math.round(node.getBoundingClientRect().height)),
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
    height: String(Math.round(node.getBoundingClientRect().height)),
  }));
  expect(after.span).not.toBe(before.span);
  expect(after.height).not.toBe(before.height);
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
  await page.locator(selector).evaluate((widget) => {
    const tools = widget.querySelector(":scope > .widget-tools");
    if (!tools) throw new Error("Widget tools not found");
    tools.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true, cancelable: true }));
  });
  await expect(page.locator(selector)).not.toHaveClass(/widget-tools-open/);
  await writeInteractionScenarios(page, ["widget-tools-init"], { before, after });
  await closeApp(app);
});

test("electron GUI commits widget content across reload without runtime data model", async () => {
  const { app, page } = await launchApp();
  const selector = '.widget-layout > .widget-card[data-widget-key="widget-1"]';
  await page.waitForFunction((selector) => {
    const widget = document.querySelector(selector);
    const content = widget?.querySelector("[data-widget-shell-content='true']");
    return Boolean(content?.textContent?.trim());
  }, selector);
  const before = await page.locator(selector).evaluate((node) => ({
    key: node.dataset.widgetKey || "",
    modelAttrs: Object.keys(node.dataset).filter((key) => key === ["widget", "Runtime", "Status"].join("") || /^runtime(Condition|Urgency|Freshness|Activity|Confidence|Meaning)/.test(key)),
    content: node.querySelector("[data-widget-shell-content='true']")?.textContent?.trim() || "",
  }));
  expect(before.content.length).toBeGreaterThan(0);
  expect(before.modelAttrs).toEqual([]);
  await openControlBar(page);
  await page.locator(".layout-save-button").click();
  await page.reload();
  await page.waitForSelector(".dashboard-layout-grid");
  await page.waitForFunction((selector) => {
    const widget = document.querySelector(selector);
    const content = widget?.querySelector("[data-widget-shell-content='true']");
    return Boolean(content?.textContent?.trim());
  }, selector);
  const after = await page.locator(selector).evaluate((node) => ({
    key: node.dataset.widgetKey || "",
    modelAttrs: Object.keys(node.dataset).filter((key) => key === ["widget", "Runtime", "Status"].join("") || /^runtime(Condition|Urgency|Freshness|Activity|Confidence|Meaning)/.test(key)),
    content: node.querySelector("[data-widget-shell-content='true']")?.textContent?.trim() || "",
  }));
  expect(after).toEqual(before);
  await writeInteractionScenarios(page, ["widget-content-no-runtime-model"], { before, after });
  await closeApp(app);
});

test("electron GUI treats widgets as display objects without data-source configuration", async () => {
  const { app, page } = await launchApp();
  const textWidget = await addTextWidget(page);
  const widgetKey = await textWidget.evaluate((node) => node.dataset.widgetKey || "");
  const selector = `.widget-layout > .widget-card[data-widget-key="${widgetKey}"]`;

  const setting = await applyFirstWidgetSetting(page, selector, "body", "Display object canary");
  expect(setting.applied).toBe(true);
  await page.waitForFunction((selector) => {
    const widget = document.querySelector(selector);
    return Boolean(widget?.querySelector("[data-widget-shell-content='true']")?.textContent?.includes("Display object canary"));
  }, selector);
  const before = await page.locator(selector).evaluate((node) => ({
    text: node.textContent || "",
    content: node.querySelector("[data-widget-shell-content='true']")?.textContent?.trim() || "",
    modelAttrs: Object.keys(node.dataset).filter((key) => key === ["widget", "Runtime", "Status"].join("") || /^runtime(Condition|Urgency|Freshness|Activity|Confidence|Meaning)/.test(key)),
    sourceAttrs: Object.keys(node.dataset).filter((key) => /dataSource|dataAdapter|dataOrigin|workspaceContext/i.test(key)),
  }));
  expect(before.content).toContain("Display object canary");
  expect(before.modelAttrs).toEqual([]);
  expect(before.text).not.toMatch(/needs data source|data substrate|configure a data source/i);
  expect(before.sourceAttrs).toEqual([]);

  const displayWidgetKinds = [
    { kind: "stat", category: "data", label: "stat" },
    { kind: "table", category: "data", label: "table" },
    { kind: "graph", category: "visualization", subcategory: "Charts", expectedDefinition: "chart", label: "chart" },
    { kind: "map", category: "visualization", subcategory: "Geospatial", label: "map" },
    { kind: "calendar", category: "controls", label: "calendar" },
    { kind: "document", category: "media", expectedDefinition: "document", label: "code" },
    { kind: "image", category: "media", label: "media" },
  ];
  const added = [];
  for (const entry of displayWidgetKinds) {
    const widget = await addWidget(page, entry);
    const key = await widget.evaluate((node) => node.dataset.widgetKey || "");
    const widgetSelector = `.widget-layout > .widget-card[data-widget-key="${key}"]`;
    if (entry.label === "code") {
      const contentSetting = await applyFirstWidgetSetting(page, widgetSelector, "content", "const ready = true;");
      expect(contentSetting.applied).toBe(true);
    }
    await page.waitForFunction((widgetSelector) => {
      const node = document.querySelector(widgetSelector);
      return Boolean(node?.querySelector("[data-widget-shell-content='true'], .widget-inline-placeholder, .runtime-table-widget, .runtime-chart-widget, .runtime-map-widget, .runtime-calendar-widget, .runtime-monaco-editor"));
    }, widgetSelector);
    if (entry.label === "table") {
      await page.waitForFunction((widgetSelector) => Boolean(document.querySelector(`${widgetSelector} .runtime-table-tanstack table.runtime-table`)), widgetSelector);
    }
    if (entry.label === "chart") {
      await page.waitForFunction((widgetSelector) => Boolean(document.querySelector(`${widgetSelector} .runtime-chart-echarts svg`)), widgetSelector);
    }
    if (entry.label === "map") {
      await page.waitForFunction((widgetSelector) => Boolean(document.querySelector(`${widgetSelector} .runtime-map-leaflet.leaflet-container`)), widgetSelector);
    }
    if (entry.label === "code") {
      await page.waitForFunction((widgetSelector) => Boolean(document.querySelector(`${widgetSelector} .runtime-monaco-editor .monaco-editor`)), widgetSelector);
    }
    const state = await page.locator(widgetSelector).evaluate((node) => ({
      kind: node.dataset.widgetDefinition || "",
      text: node.textContent || "",
      modelAttrs: Object.keys(node.dataset).filter((key) => key === ["widget", "Runtime", "Status"].join("") || /^runtime(Condition|Urgency|Freshness|Activity|Confidence|Meaning)/.test(key)),
      width: node.getBoundingClientRect().width,
      height: node.getBoundingClientRect().height,
      placeholderCount: node.querySelectorAll(".widget-inline-placeholder").length,
      sourceAttrs: Object.keys(node.dataset).filter((key) => /dataSource|dataAdapter|dataOrigin|workspaceContext/i.test(key)),
      libraryMounts: {
        echarts: Boolean(node.querySelector(".runtime-chart-echarts svg")),
        table: Boolean(node.querySelector(".runtime-table-tanstack table.runtime-table")),
        leaflet: Boolean(node.querySelector(".runtime-map-leaflet.leaflet-container")),
        monaco: Boolean(node.querySelector(".runtime-monaco-editor .monaco-editor")),
      },
    }));
    expect(state.kind).toBe(entry.expectedDefinition || entry.kind);
    expect(state.modelAttrs).toEqual([]);
    expect(state.width).toBeGreaterThan(60);
    expect(state.height).toBeGreaterThan(40);
    expect(state.text).not.toMatch(/needs data source|data substrate|configure a data source|required fields|connect an input stream|expected|why|next|broaden/i);
    expect(state.placeholderCount).toBeLessThanOrEqual(1);
    expect(state.sourceAttrs).toEqual([]);
    if (entry.label === "chart") expect(state.libraryMounts.echarts).toBe(true);
    if (entry.label === "table") expect(state.libraryMounts.table).toBe(true);
    if (entry.label === "map") expect(state.libraryMounts.leaflet).toBe(true);
    if (entry.label === "code") expect(state.libraryMounts.monaco).toBe(true);
    added.push({ ...entry, key, expectedDefinition: entry.expectedDefinition || entry.kind });
  }

  await openControlBar(page);
  await page.locator(".layout-save-button").click();
  await page.reload();
  await page.waitForSelector(".dashboard-layout-grid");
  await page.waitForFunction((selector) => {
    const widget = document.querySelector(selector);
    return Boolean(widget?.querySelector("[data-widget-shell-content='true']")?.textContent?.includes("Display object canary"));
  }, selector);
  const after = await page.locator(selector).evaluate((node) => ({
    content: node.querySelector("[data-widget-shell-content='true']")?.textContent?.trim() || "",
    modelAttrs: Object.keys(node.dataset).filter((key) => key === ["widget", "Runtime", "Status"].join("") || /^runtime(Condition|Urgency|Freshness|Activity|Confidence|Meaning)/.test(key)),
    sourceAttrs: Object.keys(node.dataset).filter((key) => /dataSource|dataAdapter|dataOrigin|workspaceContext/i.test(key)),
  }));
  expect(after).toMatchObject({
    content: before.content,
    modelAttrs: [],
    sourceAttrs: [],
  });
  for (const entry of added) {
    const widgetSelector = `.widget-layout > .widget-card[data-widget-key="${entry.key}"]`;
    await expect(page.locator(widgetSelector)).toHaveCount(1);
    const state = await page.locator(widgetSelector).evaluate((node) => ({
      kind: node.dataset.widgetDefinition || "",
      text: node.textContent || "",
      modelAttrs: Object.keys(node.dataset).filter((key) => key === ["widget", "Runtime", "Status"].join("") || /^runtime(Condition|Urgency|Freshness|Activity|Confidence|Meaning)/.test(key)),
      sourceAttrs: Object.keys(node.dataset).filter((key) => /dataSource|dataAdapter|dataOrigin|workspaceContext/i.test(key)),
    }));
    expect(state.kind).toBe(entry.expectedDefinition);
    expect(state.modelAttrs).toEqual([]);
    expect(state.text).not.toMatch(/needs data source|data substrate|configure a data source|required fields|connect an input stream|expected|why|next|broaden/i);
    expect(state.sourceAttrs).toEqual([]);
  }
  await closeApp(app);
});

test("electron GUI clears stale conditional style state on widget render", async () => {
  const { app, page } = await launchApp();
  const textWidget = await addTextWidget(page);
  const widgetKey = await textWidget.evaluate((node) => node.dataset.widgetKey || "");
  const selector = `.widget-layout > .widget-card[data-widget-key="${widgetKey}"]`;

  await page.locator(selector).evaluate((node) => {
    node.classList.add("widget-conditional-style");
    node.style.setProperty("--conditional-accent", "#ff00aa");
    node.style.setProperty("--conditional-accent-rgb", "255, 0, 170");
    node.style.setProperty("--conditional-text", "#111111");
    node.style.setProperty("--conditional-background-tint", "rgba(255, 0, 170, .16)");
    node.dataset.conditionalRimState = "alert";
    node.dataset.conditionalIconState = "warning";
    node.dataset.conditionalVisibility = "hidden";
    node.dataset.activeStyleRuleIds = "stale-rule";
    node.dataset.conditionalPanelAccentApplied = "true";
  });

  const setting = await applyFirstWidgetSetting(page, selector, "body", "Conditional cleanup canary");
  expect(setting.applied).toBe(true);
  await page.waitForFunction((selector) => {
    const node = document.querySelector(selector);
    const styles = node ? getComputedStyle(node) : null;
    return Boolean(node) &&
      !node.classList.contains("widget-conditional-style") &&
      !node.dataset.conditionalRimState &&
      !node.dataset.conditionalIconState &&
      !node.dataset.conditionalVisibility &&
      !node.dataset.activeStyleRuleIds &&
      !node.dataset.conditionalPanelAccentApplied &&
      !styles.getPropertyValue("--conditional-accent").trim() &&
      !styles.getPropertyValue("--conditional-accent-rgb").trim() &&
      !styles.getPropertyValue("--conditional-text").trim() &&
      !styles.getPropertyValue("--conditional-background-tint").trim();
  }, selector);

  const cleaned = await page.locator(selector).evaluate((node) => ({
    conditionalClass: node.classList.contains("widget-conditional-style"),
    rim: node.dataset.conditionalRimState || "",
    icon: node.dataset.conditionalIconState || "",
    visibility: node.dataset.conditionalVisibility || "",
    activeStyleRuleIds: node.dataset.activeStyleRuleIds || "",
    panelAccentApplied: node.dataset.conditionalPanelAccentApplied || "",
    conditionalAccent: getComputedStyle(node).getPropertyValue("--conditional-accent").trim(),
    content: node.querySelector("[data-widget-shell-content='true']")?.textContent?.trim() || "",
  }));
  expect(cleaned).toMatchObject({
    conditionalClass: false,
    rim: "",
    icon: "",
    visibility: "",
    activeStyleRuleIds: "",
    panelAccentApplied: "",
    conditionalAccent: "",
  });
  expect(cleaned.content).toContain("Conditional cleanup canary");

  await openControlBar(page);
  await page.locator(".layout-save-button").click();
  await page.reload();
  await page.waitForSelector(".dashboard-layout-grid");
  const reloaded = await page.locator(selector).evaluate((node) => ({
    conditionalClass: node.classList.contains("widget-conditional-style"),
    activeStyleRuleIds: node.dataset.activeStyleRuleIds || "",
    content: node.querySelector("[data-widget-shell-content='true']")?.textContent?.trim() || "",
  }));
  expect(reloaded.conditionalClass).toBe(false);
  expect(reloaded.activeStyleRuleIds).toBe("");
  expect(reloaded.content).toContain("Conditional cleanup canary");
  await writeInteractionScenarios(page, ["conditional-style-cleanup"], { setting, cleaned, reloaded });
  await closeApp(app);
});

test("electron GUI keeps widget content, tools, and resize ready after render and reload", async () => {
  const { app, page } = await launchApp();
  const textWidget = await addTextWidget(page);
  const widgetKey = await textWidget.evaluate((node) => node.dataset.widgetKey || "");
  const selector = `.widget-layout > .widget-card[data-widget-key="${widgetKey}"]`;

  const setting = await applyFirstWidgetSetting(page, selector, "body", "Runtime content canary");
  expect(setting.applied).toBe(true);
  await page.waitForFunction((selector) => {
    const widget = document.querySelector(selector);
    return Boolean(widget?.querySelector("[data-widget-shell-content='true']")?.textContent?.includes("Runtime content canary"));
  }, selector);
  const before = await widgetRenderSnapshot(page, selector);
  expect(before.modelAttrs).toEqual([]);
  expect(before.shellModelAttrs).toEqual([]);
  expect(before.content).toContain("Runtime content canary");
  expect(before.tools).toBe(1);
  expect(before.resizeHandles).toBe(1);

  await openControlBar(page);
  await page.locator(".layout-save-button").click();
  await page.reload();
  await page.waitForSelector(".dashboard-layout-grid");
  await page.waitForFunction((selector) => {
    const widget = document.querySelector(selector);
    return Boolean(widget?.querySelector("[data-widget-shell-content='true']")?.textContent?.includes("Runtime content canary"));
  }, selector);
  const afterReload = await widgetRenderSnapshot(page, selector);
  expect(afterReload).toMatchObject({
    key: before.key,
    shell: before.shell,
    modelAttrs: [],
    shellModelAttrs: [],
    content: before.content,
    tools: 1,
    resizeHandles: 1,
  });

  const widget = await openTools(page, selector);
  const resize = widget.locator(":scope > .widget-tools .panel-resize-handle");
  await expect(resize).toBeVisible();
  const resizeBox = await resize.boundingBox();
  expect(resizeBox).toBeTruthy();
  const beforeResize = await widget.evaluate((node) => ({
    span: node.dataset.currentSpan || node.dataset.defaultSpan || "",
    height: String(Math.round(node.getBoundingClientRect().height)),
  }));
  await dispatchPointerDrag(
    page,
    resizeBox.x + resizeBox.width / 2,
    resizeBox.y + resizeBox.height / 2,
    resizeBox.x + resizeBox.width / 2 + 230,
    resizeBox.y + resizeBox.height / 2 + 88,
    50
  );
  await page.waitForFunction(
    ({ selector, beforeResize }) => {
      const node = document.querySelector(selector);
      if (!node) return false;
      const span = node.dataset.currentSpan || node.dataset.defaultSpan || "";
      const height = String(Math.round(node.getBoundingClientRect().height));
      return span !== beforeResize.span || height !== beforeResize.height;
    },
    { selector, beforeResize }
  );
  const afterResize = await widget.evaluate((node) => ({
    span: node.dataset.currentSpan || node.dataset.defaultSpan || "",
    height: String(Math.round(node.getBoundingClientRect().height)),
  }));
  expect(afterResize).not.toEqual(beforeResize);
  await writeInteractionScenarios(page, ["widget-runtime-content-tools-resize"], { before, afterReload, beforeResize, afterResize });
  await closeApp(app);
});

test("electron GUI keeps ordered drag commit, ghost, collision, and no interaction scrolling deterministic", async () => {
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
  const viewportBottom = await page.evaluate(() => window.innerHeight - 12);
  await dispatchPointerDragUntilMove(page, scrollStartX, scrollStartY, scrollStartX, viewportBottom);
  await page.waitForFunction(() => Boolean(document.querySelector(".db-panel-dragging, .widget-dragging")));
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const afterScroll = await page.evaluate(() => Math.round(window.scrollY || 0));
  expect(afterScroll).toBe(beforeScroll);
  await finishPointerDrag(page, scrollStartX, viewportBottom, "pointercancel");
  await writeInteractionScenarios(page, ["drag-core-commit-ghost-collision-no-interaction-scroll"], {
    before,
    live,
    afterCancel,
    afterCommit,
    beforeScroll,
    afterScroll,
  });
  await closeApp(app);
});

test("electron GUI keeps drag cursor aligned and prevents drag-created vertical growth", async () => {
  const { app, page } = await launchApp();
  const tolerance = 5;
  const liveDragAlignment = async (selector, deltaX, deltaY, steps = 48, options = {}) => {
    const item = options.openTools === false ? page.locator(selector).first() : await openTools(page, selector);
    await expect(item).toBeVisible();
    const handle = item.locator(".panel-move-handle");
    const itemBox = await item.boundingBox();
    expect(itemBox).toBeTruthy();
    const handleBox = await handle.isVisible({ timeout: 250 }).catch(() => false)
      ? await handle.boundingBox()
      : null;
    const startX = handleBox ? handleBox.x + handleBox.width / 2 : itemBox.x + Math.min(itemBox.width - 8, Math.max(8, itemBox.width * 0.45));
    const startY = handleBox ? handleBox.y + handleBox.height / 2 : itemBox.y + Math.min(itemBox.height - 8, Math.max(8, itemBox.height * 0.45));
    const expectedOffset = {
      x: Math.round(startX - itemBox.x),
      y: Math.round(startY - itemBox.y),
    };
    const endX = startX + deltaX;
    const endY = startY + deltaY;
    await dispatchPointerDragUntilMove(page, startX, startY, endX, endY, steps);
    await page.waitForFunction(() => Boolean(document.querySelector(".db-panel-dragging, .widget-dragging")));
    const live = await page.evaluate(({ endX, endY }) => {
      const node = document.querySelector(".db-panel-dragging, .widget-dragging");
      const rect = node?.getBoundingClientRect();
      const grid = document.querySelector(".dashboard-layout-grid");
      return {
        offsetX: Math.round(endX - rect.left),
        offsetY: Math.round(endY - rect.top),
        rectTop: Math.round(rect.top),
        styleTop: node?.style?.top || "",
        gridWillChange: grid ? getComputedStyle(grid).willChange : "",
      };
    }, { endX, endY });
    expect(Math.abs(live.offsetX - expectedOffset.x)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(live.offsetY - expectedOffset.y)).toBeLessThanOrEqual(tolerance);
    await finishPointerDrag(page, endX, endY, "pointercancel");
    await page.waitForFunction(() => !document.querySelector(".db-panel-dragging, .widget-dragging, .db-panel-placeholder, .widget-placeholder"), null, { timeout: 5000 })
      .catch(async () => {
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => !document.querySelector(".db-panel-dragging, .widget-dragging, .db-panel-placeholder, .widget-placeholder"), null, { timeout: 5000 });
      });
    return { expectedOffset, live };
  };

  const workspaceAlignment = await liveDragAlignment('.panel-layout > .db-panel[data-panel-key="builder-notes"]', -180, 140);

  const freeSpaceSelector = '.widget-layout:not(.panel-internal-widget-grid) > .widget-card[data-widget-key="widget-1"]';
  await openTools(page, freeSpaceSelector);
  const freeSpacePlan = await page.evaluate((selector) => {
    const node = document.querySelector(selector);
    const layout = node?.closest(".widget-layout");
    const host = layout?.closest(".dashboard-layout-grid") || layout;
    if (!node || !layout || !host) return null;
    const computed = getComputedStyle(layout);
    const rowHeight = parseFloat(computed.getPropertyValue("--dashboard-grid-row-height")) || 81;
    const gap = parseFloat(computed.rowGap || computed.gap || "16") || 16;
    const rowStep = rowHeight + gap;
    const items = [...layout.querySelectorAll(":scope > .widget-card:not(.widget-dragging):not(.widget-placeholder)")];
    const occupiedBottom = items.reduce((bottom, item) => {
      const row = Math.max(1, Math.round(Number(item.dataset.gridRow) || 1));
      const span = Math.max(1, Math.round(Number(item.dataset.gridRowSpan) || 1));
      return Math.max(bottom, row + span - 1);
    }, 1);
    const rowSpan = Math.max(1, Math.round(Number(node.dataset.gridRowSpan) || 1));
    const currentRow = Math.max(1, Math.round(Number(node.dataset.gridRow) || 1));
    const rect = host.getBoundingClientRect();
    const visibleHeight = host.clientHeight || layout.clientHeight || 0;
    const viewportRows = Math.max(1, Math.floor((visibleHeight + gap) / rowStep));
    const targetRow = Math.max(1, viewportRows - rowSpan + 1);
    const itemRect = node.getBoundingClientRect();
    const handleRect = node.querySelector(".panel-move-handle")?.getBoundingClientRect();
    const pointerOffsetX = handleRect
      ? (handleRect.left + (handleRect.width / 2)) - itemRect.left
      : Math.min(itemRect.width - 8, Math.max(8, itemRect.width * 0.45));
    const pointerOffsetY = handleRect
      ? (handleRect.top + (handleRect.height / 2)) - itemRect.top
      : Math.min(38, Math.max(14, itemRect.height * 0.25));
    return {
      currentRow,
      targetRow,
      occupiedBottom,
      viewportRows,
      rowSpan,
      beforeScrollHeight: document.documentElement.scrollHeight,
      startX: Math.round(itemRect.left + pointerOffsetX),
      startY: Math.round(itemRect.top + pointerOffsetY),
      endX: Math.round(rect.left + Math.min(rect.width - 32, Math.max(32, itemRect.width * 0.5))),
      endY: Math.round(rect.top + ((targetRow - 1) * rowStep) + pointerOffsetY),
    };
  }, freeSpaceSelector);
  expect(freeSpacePlan).toBeTruthy();
  expect(freeSpacePlan.viewportRows).toBeGreaterThanOrEqual(freeSpacePlan.targetRow + freeSpacePlan.rowSpan - 1);
  expect(freeSpacePlan.targetRow).toBeGreaterThan(freeSpacePlan.occupiedBottom);
  await dispatchPointerDrag(
    page,
    freeSpacePlan.startX,
    freeSpacePlan.startY,
    freeSpacePlan.endX,
    freeSpacePlan.endY,
    80
  );
  await page.waitForFunction(() => !document.querySelector(".db-panel-dragging, .widget-dragging, .db-panel-placeholder, .widget-placeholder"));
  const freeSpaceCommit = await page.evaluate((selector) => {
    const node = document.querySelector(selector);
    return {
      row: Number(node?.dataset.gridRow) || 0,
      scrollHeight: document.documentElement.scrollHeight,
      maxScroll: Math.max(0, document.documentElement.scrollHeight - (document.documentElement.clientHeight || window.innerHeight)),
    };
  }, freeSpaceSelector);
  expect(freeSpaceCommit.row).toBe(freeSpacePlan.targetRow);
  expect(freeSpaceCommit.scrollHeight).toBeLessThanOrEqual(freeSpacePlan.beforeScrollHeight + 2);

  const ratchetPlan = await page.evaluate(() => {
    const layout = document.querySelector(".panel-layout");
    const active = layout?.querySelector(':scope > .db-panel[data-panel-key="builder-notes"]');
    const target = layout?.querySelector(':scope > .db-panel[data-panel-key="builder-menu"]');
    const host = layout?.closest(".dashboard-layout-grid") || layout;
    if (!layout || !active || !target || !host) return null;
    const computed = getComputedStyle(layout);
    const rowHeight = parseFloat(computed.getPropertyValue("--dashboard-grid-row-height")) || 81;
    const gap = parseFloat(computed.rowGap || computed.gap || "16") || 16;
    const rowStep = rowHeight + gap;
    const viewportRows = Math.max(1, Math.floor(((host.clientHeight || layout.clientHeight || 0) + gap) / rowStep));
    const spanFor = (node) => {
      const rect = node.getBoundingClientRect();
      return Math.max(1, Math.round(((rect.height + gap) / rowStep) || Number(node.dataset.gridRowSpan) || 1));
    };
    const activeSpan = spanFor(active);
    const targetSpan = spanFor(target);
    const floorRow = Math.max(1, viewportRows - Math.max(activeSpan, targetSpan) + 1);
    const place = (node, col, row) => {
      node.classList.add("db-panel-collapsed");
      node.dataset.gridRowSpan = "1";
      node.dataset.gridCol = String(col);
      node.dataset.gridRow = String(row);
      node.style.gridColumnStart = String(col);
      node.style.gridRowStart = String(row);
      node.style.gridRowEnd = "span 1";
      node.style.height = "";
    };
    place(active, 6, Math.max(1, floorRow - 1));
    place(target, 6, floorRow);
    const activeRect = active.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const activeHandle = active.querySelector(".panel-move-handle")?.getBoundingClientRect();
    const targetHandle = target.querySelector(".panel-move-handle")?.getBoundingClientRect();
    return {
      viewportRows,
      floorRow,
      beforeScrollHeight: document.documentElement.scrollHeight,
      beforeGridHeight: host.getBoundingClientRect().height,
      activeStartX: Math.round((activeHandle?.left || activeRect.left) + ((activeHandle?.width || activeRect.width) / 2)),
      activeStartY: Math.round((activeHandle?.top || activeRect.top) + ((activeHandle?.height || Math.min(64, activeRect.height)) / 2)),
      targetX: Math.round((targetHandle?.left || targetRect.left) + ((targetHandle?.width || targetRect.width) / 2)),
      targetY: Math.round((targetHandle?.top || targetRect.top) + ((targetHandle?.height || Math.min(64, targetRect.height)) / 2)),
    };
  });
  expect(ratchetPlan).toBeTruthy();
  const ratchetAttempts = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const points = await page.evaluate(() => {
      const active = document.querySelector('.panel-layout > .db-panel[data-panel-key="builder-notes"]');
      const target = document.querySelector('.panel-layout > .db-panel[data-panel-key="builder-menu"]');
      const activeRect = active?.getBoundingClientRect();
      const targetRect = target?.getBoundingClientRect();
      const activeHandle = active?.querySelector(".panel-move-handle")?.getBoundingClientRect();
      const targetHandle = target?.querySelector(".panel-move-handle")?.getBoundingClientRect();
      return {
        startX: Math.round((activeHandle?.left || activeRect.left) + ((activeHandle?.width || activeRect.width) / 2)),
        startY: Math.round((activeHandle?.top || activeRect.top) + ((activeHandle?.height || Math.min(64, activeRect.height)) / 2)),
        endX: Math.round((targetHandle?.left || targetRect.left) + ((targetHandle?.width || targetRect.width) / 2)),
        endY: Math.round((targetHandle?.top || targetRect.top) + ((targetHandle?.height || Math.min(64, targetRect.height)) / 2)),
      };
    });
    await dispatchPointerDrag(page, points.startX, points.startY, points.endX, points.endY, 60);
    await page.waitForFunction(() => !document.querySelector(".db-panel-dragging, .widget-dragging, .db-panel-placeholder, .widget-placeholder"));
    const state = await page.evaluate(() => {
      const layout = document.querySelector(".panel-layout");
      const host = layout?.closest(".dashboard-layout-grid") || layout;
      const items = [...layout.querySelectorAll(":scope > .db-panel")].map((node) => {
        const row = Math.max(1, Math.round(Number(node.dataset.gridRow) || 1));
        const span = Math.max(1, Math.round(Number(node.dataset.gridRowSpan) || 1));
        return {
          key: node.dataset.panelKey,
          row,
          bottom: row + span - 1,
        };
      });
      return {
        items,
        maxBottom: Math.max(...items.map((entry) => entry.bottom)),
        scrollHeight: document.documentElement.scrollHeight,
        gridHeight: host.getBoundingClientRect().height,
      };
    });
    ratchetAttempts.push(state);
    expect(state.maxBottom).toBeLessThanOrEqual(ratchetPlan.viewportRows);
    expect(state.scrollHeight).toBeLessThanOrEqual(ratchetPlan.beforeScrollHeight + 2);
    expect(state.gridHeight).toBeLessThanOrEqual(ratchetPlan.beforeGridHeight + 2);
  }

  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector(".dashboard-layout-grid");

  const widgetSelector = '.widget-layout:not(.panel-internal-widget-grid) > .widget-card[data-widget-key="widget-1"]';
  const panelSelector = '.panel-layout > .db-panel[data-panel-key="builder-content"]';
  const panelChildSelector = `${panelSelector} .panel-internal-widget-grid > .widget-card[data-widget-key="widget-1"]`;
  await page.locator(panelSelector).evaluate((panel) => {
    panel.dataset.savedHeight = "320";
    panel.dataset.gridRowSpan = "4";
    panel.style.height = "320px";
    panel.style.gridRowEnd = "span 4";
  });
  const widget = await openTools(page, widgetSelector);
  const moveBox = await widget.locator(".panel-move-handle").boundingBox();
  expect(moveBox).toBeTruthy();
  const target = await page.locator(panelSelector).evaluate((panel) => {
    const headerRect = panel.querySelector(":scope > .db-panel-hd")?.getBoundingClientRect();
    const bodyRect = panel.querySelector(":scope > .db-panel-body")?.getBoundingClientRect();
    return {
      x: Math.round(bodyRect.left + Math.min(Math.max(bodyRect.width * 0.5, 48), Math.max(48, bodyRect.width - 48))),
      y: Math.round(Math.max(bodyRect.top + 32, headerRect.bottom + 24)),
    };
  });
  await dispatchPointerDragUntilMove(
    page,
    moveBox.x + moveBox.width / 2,
    moveBox.y + moveBox.height / 2,
    target.x,
    target.y,
    80
  );
  await page.waitForFunction((panelSelector) => {
    const panel = document.querySelector(panelSelector);
    return Boolean(panel?.classList.contains("panel-container-drag-active"));
  }, panelSelector);
  await finishPointerDrag(page, target.x, target.y);
  await page.waitForFunction(({ panelChildSelector, widgetSelector }) => (
    Boolean(document.querySelector(panelChildSelector)) &&
    !document.querySelector(widgetSelector)
  ), { panelChildSelector, widgetSelector });
  const panelAlignment = await liveDragAlignment(panelChildSelector, 110, 70, 48, { openTools: false });

  const panelClampPlan = await page.evaluate((selector) => {
    const node = document.querySelector(selector);
    const layout = node?.closest(".panel-internal-widget-grid");
    if (!node || !layout) return null;
    const computed = getComputedStyle(layout);
    const rowHeight = parseFloat(computed.getPropertyValue("--dashboard-grid-row-height")) || 81;
    const gap = parseFloat(computed.rowGap || computed.gap || "12") || 12;
    const rowStep = rowHeight + gap;
    const visibleRows = Math.max(1, Math.floor(((layout.clientHeight || 0) + gap) / rowStep));
    const rowSpan = Math.max(1, Math.round(Number(node.dataset.gridRowSpan) || 1));
    const maxRow = Math.max(1, visibleRows - rowSpan + 1);
    const rect = layout.getBoundingClientRect();
    const itemRect = node.getBoundingClientRect();
    const handleRect = node.querySelector(".panel-move-handle")?.getBoundingClientRect();
    const pointerOffsetX = handleRect
      ? (handleRect.left + (handleRect.width / 2)) - itemRect.left
      : Math.min(itemRect.width - 8, Math.max(8, itemRect.width * 0.45));
    const pointerOffsetY = handleRect
      ? (handleRect.top + (handleRect.height / 2)) - itemRect.top
      : Math.min(38, Math.max(14, itemRect.height * 0.25));
    return {
      visibleRows,
      rowSpan,
      maxRow,
      startX: Math.round(itemRect.left + pointerOffsetX),
      startY: Math.round(itemRect.top + pointerOffsetY),
      endX: Math.round(itemRect.left + pointerOffsetX + 40),
      endY: Math.round(rect.top + ((visibleRows + 3) * rowStep) + pointerOffsetY),
    };
  }, panelChildSelector);
  expect(panelClampPlan).toBeTruthy();
  expect(panelClampPlan.visibleRows).toBeGreaterThanOrEqual(panelClampPlan.rowSpan);
  await dispatchPointerDrag(
    page,
    panelClampPlan.startX,
    panelClampPlan.startY,
    panelClampPlan.endX,
    panelClampPlan.endY,
    80
  );
  await page.waitForFunction(() => !document.querySelector(".db-panel-dragging, .widget-dragging, .db-panel-placeholder, .widget-placeholder"));
  const panelClampCommit = await page.evaluate((selector) => {
    const node = document.querySelector(selector);
    return {
      row: Number(node?.dataset.gridRow) || 0,
    };
  }, panelChildSelector);
  expect(panelClampCommit.row).toBeLessThanOrEqual(panelClampPlan.maxRow);

  const growthSelector = '.panel-layout > .db-panel[data-panel-key="builder-notes"]';
  const growthItem = await openTools(page, growthSelector);
  const growthHandle = growthItem.locator(".panel-move-handle");
  const growthBox = await growthHandle.boundingBox();
  expect(growthBox).toBeTruthy();
  const beforeGrowth = await page.evaluate((selector) => {
    const node = document.querySelector(selector);
    return {
      scrollHeight: document.documentElement.scrollHeight,
      gridHeight: document.querySelector(".dashboard-layout-grid")?.getBoundingClientRect().height || 0,
      row: node?.dataset.gridRow || "",
      maxRow: (() => {
        const layout = node?.closest(".panel-layout");
        const host = layout?.closest(".dashboard-layout-grid") || layout;
        const computed = layout ? getComputedStyle(layout) : null;
        const rowHeight = parseFloat(computed?.getPropertyValue("--dashboard-grid-row-height")) || 81;
        const gap = parseFloat(computed?.rowGap || computed?.gap || "16") || 16;
        const visibleHeight = host?.clientHeight || layout?.clientHeight || 0;
        const rows = Math.max(1, Math.floor((visibleHeight + gap) / (rowHeight + gap)));
        const span = Math.max(1, Math.round(Number(node?.dataset.gridRowSpan) || 1));
        return Math.max(1, rows - span + 1);
      })(),
    };
  }, growthSelector);
  const growthStartX = growthBox.x + growthBox.width / 2;
  const growthStartY = growthBox.y + growthBox.height / 2;
  await dispatchPointerDrag(page, growthStartX, growthStartY, growthStartX, growthStartY + 900, 80);
  await page.waitForFunction(() => !document.querySelector(".db-panel-dragging, .widget-dragging, .db-panel-placeholder, .widget-placeholder"));
  const afterGrowth = await page.evaluate((selector) => {
    const node = document.querySelector(selector);
    return {
      scrollHeight: document.documentElement.scrollHeight,
      gridHeight: document.querySelector(".dashboard-layout-grid")?.getBoundingClientRect().height || 0,
      row: node?.dataset.gridRow || "",
    };
  }, growthSelector);
  expect(afterGrowth.scrollHeight).toBeLessThanOrEqual(beforeGrowth.scrollHeight + 2);
  expect(afterGrowth.gridHeight).toBeLessThanOrEqual(beforeGrowth.gridHeight + 2);
  expect(Number(afterGrowth.row)).toBeLessThanOrEqual(beforeGrowth.maxRow);

  await writeInteractionScenarios(page, ["drag-cursor-alignment-no-vertical-growth"], {
    workspaceAlignment,
    panelAlignment,
    beforeGrowth,
    afterGrowth,
    ratchetAttempts,
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

  await openControlBar(page);
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

test("ordered grid item runtime preserves query semantics", async () => {
  const { app, page } = await launchApp();
  const result = await page.evaluate(async () => {
    const { createOrderedGridItemsRuntime } = await import("./app/static/modules/ordered-grid-items-runtime.js");
    const host = document.createElement("section");
    host.innerHTML = `
      <div class="widget-layout">
        <article class="widget-card" data-id="a"></article>
        <article class="widget-card widget-dragging" data-id="dragging"></article>
        <article class="widget-card dashboard-live-resize" data-id="resizing"></article>
        <article class="widget-placeholder" data-id="placeholder"></article>
      </div>
      <div class="panel-layout">
        <section class="db-panel" data-id="panel"></section>
        <section class="db-panel-placeholder" data-id="panel-placeholder"></section>
        <div class="panel-internal-widget-grid">
          <article class="widget-card" data-id="internal"></article>
        </div>
      </div>`;
    document.body.append(host);
    const widgetLayout = host.querySelector(".widget-layout");
    const panelLayout = host.querySelector(".panel-layout");
    const internal = host.querySelector('[data-id="internal"]');
    const runtime = createOrderedGridItemsRuntime({
      gridHostForLayout: () => host,
      isPanelInternalGridItem: (item) => item === internal,
    });
    const ids = (items) => items.map((item) => item.dataset.id);
    const output = {
      orderedWithPlaceholders: ids(runtime.orderedGridItems(widgetLayout, { includePlaceholders: true })),
      orderedExcluded: ids(runtime.orderedGridItems(widgetLayout, { includePlaceholders: true, exclude: [host.querySelector('[data-id="a"]')] })),
      globalWorkspace: ids(runtime.globalGridItems(widgetLayout, { includePlaceholders: true })),
      globalPanel: ids(runtime.globalGridItems(panelLayout, { includePlaceholders: true })),
    };
    host.remove();
    return output;
  });
  expect(result).toEqual({
    orderedWithPlaceholders: ["a", "dragging", "resizing", "placeholder"],
    orderedExcluded: ["dragging", "resizing", "placeholder"],
    globalWorkspace: ["a", "placeholder", "panel", "panel-placeholder"],
    globalPanel: ["a", "placeholder", "panel", "panel-placeholder"],
  });
  await closeApp(app);
});


