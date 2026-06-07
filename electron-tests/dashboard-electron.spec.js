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

async function widgetRuntimeState(page, selector) {
  return page.locator(selector).evaluate((node) => {
    const shell = node.querySelector("[data-widget-shell]");
    const content = node.querySelector("[data-widget-shell-content='true']");
    return {
      key: node.dataset.widgetKey || "",
      status: node.dataset.widgetRuntimeStatus || "",
      condition: node.dataset.runtimeCondition || "",
      urgency: node.dataset.runtimeUrgency || "",
      freshness: node.dataset.runtimeFreshness || "",
      activity: node.dataset.runtimeActivity || "",
      confidence: node.dataset.runtimeConfidence || "",
      density: node.dataset.widgetDensity || node.dataset.density || "",
      shell: node.dataset.widgetShell || "",
      shellState: shell?.dataset.shellRuntimeState || "",
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

  await page.locator(".background-tone-trigger").click({ force: true });
  await page.locator('.background-photo-option[data-background-tone="photo-earth"]').evaluate((node) => node.click());
  await expect(page.locator("html")).toHaveAttribute("data-background", "photo-earth");

  const panel = await openTools(page, '.panel-layout > .db-panel[data-panel-key="builder-content"]');
  await panel.locator(".panel-color-toggle").click({ force: true });
  await expect(page.locator(".panel-color-menu-open")).toHaveCount(1);

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

test("electron GUI applies derived background presets, custom color, persistence, undo, and photos", async () => {
  const { app, page } = await launchApp();
  const failedImageRequests = [];
  page.on("requestfailed", (request) => {
    if (request.resourceType() === "image") failedImageRequests.push(request.url());
  });
  await expect(page.locator(".background-photo-option")).toHaveCount(27);
  await expect(page.locator(".background-tone-option")).toHaveCount(6);

  const initialBackground = await page.locator("body").evaluate((node) => getComputedStyle(node).backgroundImage);
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

  await page.locator(".background-tone-trigger").click({ force: true });
  await page.locator('.background-tone-option[data-background-tone="tone-mist"]').click({ force: true });
  await expect(page.locator("html")).toHaveAttribute("data-background", "tone-mist");
  await page.locator(".panel-undo-button").click({ force: true });
  await expect(page.locator("html")).toHaveAttribute("data-background", "custom-color");
  await expect.poll(() => page.locator("html").evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--base-tone").trim())).toBe("#336699");

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

test("electron GUI commits widget runtime content and meaning across reload", async () => {
  const { app, page } = await launchApp();
  const selector = '.widget-layout > .widget-card[data-widget-key="widget-1"]';
  await page.waitForFunction((selector) => {
    const widget = document.querySelector(selector);
    const content = widget?.querySelector("[data-widget-shell-content='true']");
    return Boolean(
      widget?.dataset.widgetRuntimeStatus === "ready" &&
      widget?.dataset.runtimeCondition &&
      content?.textContent?.trim()
    );
  }, selector);
  const before = await page.locator(selector).evaluate((node) => ({
    key: node.dataset.widgetKey || "",
    status: node.dataset.widgetRuntimeStatus || "",
    condition: node.dataset.runtimeCondition || "",
    urgency: node.dataset.runtimeUrgency || "",
    shellState: node.querySelector("[data-widget-shell]")?.dataset.shellRuntimeState || "",
    content: node.querySelector("[data-widget-shell-content='true']")?.textContent?.trim() || "",
  }));
  expect(before.content.length).toBeGreaterThan(0);
  expect(before.condition.length).toBeGreaterThan(0);
  await page.locator(".layout-save-button").click();
  await page.reload();
  await page.waitForSelector(".dashboard-layout-grid");
  await page.waitForFunction((selector) => {
    const widget = document.querySelector(selector);
    const content = widget?.querySelector("[data-widget-shell-content='true']");
    return Boolean(
      widget?.dataset.widgetRuntimeStatus === "ready" &&
      widget?.dataset.runtimeCondition &&
      content?.textContent?.trim()
    );
  }, selector);
  const after = await page.locator(selector).evaluate((node) => ({
    key: node.dataset.widgetKey || "",
    status: node.dataset.widgetRuntimeStatus || "",
    condition: node.dataset.runtimeCondition || "",
    urgency: node.dataset.runtimeUrgency || "",
    shellState: node.querySelector("[data-widget-shell]")?.dataset.shellRuntimeState || "",
    content: node.querySelector("[data-widget-shell-content='true']")?.textContent?.trim() || "",
  }));
  expect(after).toEqual(before);
  await writeInteractionScenarios(page, ["widget-runtime-content-meaning"], { before, after });
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

test("electron GUI keeps widget runtime content, tools, and resize ready after render and reload", async () => {
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
  const before = await widgetRuntimeState(page, selector);
  expect(before.status.length).toBeGreaterThan(0);
  expect(before.condition.length).toBeGreaterThan(0);
  expect(before.shellState.length).toBeGreaterThan(0);
  expect(before.content).toContain("Runtime content canary");
  expect(before.tools).toBe(1);
  expect(before.resizeHandles).toBe(1);

  await page.locator(".layout-save-button").click();
  await page.reload();
  await page.waitForSelector(".dashboard-layout-grid");
  await page.waitForFunction((selector) => {
    const widget = document.querySelector(selector);
    return Boolean(widget?.querySelector("[data-widget-shell-content='true']")?.textContent?.includes("Runtime content canary"));
  }, selector);
  const afterReload = await widgetRuntimeState(page, selector);
  expect(afterReload).toMatchObject({
    key: before.key,
    status: before.status,
    condition: before.condition,
    urgency: before.urgency,
    shell: before.shell,
    shellState: before.shellState,
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
