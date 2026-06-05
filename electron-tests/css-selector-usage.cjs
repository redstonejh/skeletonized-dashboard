const { _electron: electron } = require("@playwright/test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.join(__dirname, "..");
const output = process.argv[2] || path.join(root, "artifacts", "css-selector-usage.json");

const cutTerms = [
  "engineer",
  "anchor",
  "dataflow",
  "wire",
  "context",
  "inspector",
  "activity",
  "search",
];

async function launchApp() {
  fs.rmSync(path.join(os.homedir(), ".configurable-dashboard-gui", "layout-store.json"), { force: true });
  const app = await electron.launch({ args: [root] });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector(".dashboard-layout-grid");
  return { app, page };
}

async function clickIfVisible(page, selector) {
  const locator = page.locator(selector).first();
  if (await locator.count()) await locator.click({ force: true }).catch(() => {});
}

async function exerciseRuntimeStates(page) {
  await page.evaluate(() => {
    document.querySelector(".panel-layout > .db-panel")?.classList.add("active", "group-selected", "db-panel-tools-open");
    document.querySelector(".widget-layout > .widget-card")?.classList.add("active", "group-selected", "widget-tools-open", "surface-response-active");
    document.body.classList.add("layout-tools-active", "group-select-active", "panel-interaction-active", "panel-resize-active");
  });

  const themeButtons = await page.locator("[data-theme], [data-theme-option], .theme-option, .theme-swatch").evaluateAll((nodes) => (
    nodes.map((node, index) => ({
      index,
      theme: node.getAttribute("data-theme") || node.getAttribute("data-theme-option") || node.dataset.theme || "",
    })).filter((entry) => entry.theme)
  )).catch(() => []);
  for (const entry of themeButtons.slice(0, 20)) {
    await page.evaluate(({ theme }) => {
      document.documentElement.dataset.theme = theme;
      document.body.dataset.theme = theme;
    }, entry);
    await page.waitForTimeout(20);
  }

  const backgrounds = await page.locator(".background-photo-option").evaluateAll((nodes) => (
    nodes.map((node) => node.getAttribute("data-background-tone")).filter(Boolean)
  )).catch(() => []);
  for (const background of backgrounds) {
    await page.evaluate((value) => {
      document.documentElement.dataset.background = value;
      document.body.classList.toggle("has-photo-background", value.startsWith("photo-"));
    }, background);
    await page.waitForTimeout(20);
  }

  await clickIfVisible(page, ".panel-add-button");
  await page.evaluate(() => {
    document.querySelectorAll(".object-add-category").forEach((node) => {
      node.classList.add("is-open");
      node.querySelector(".object-add-category-trigger")?.setAttribute("aria-expanded", "true");
    });
  }).catch(() => {});
  const widgetKinds = await page.locator("[data-widget-kind]").evaluateAll((nodes) => (
    [...new Set(nodes.map((node) => node.getAttribute("data-widget-kind")).filter(Boolean))]
  )).catch(() => []);
  for (const kind of widgetKinds) {
    await page.locator(`[data-widget-kind="${kind}"]`).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(25);
    await clickIfVisible(page, ".panel-add-button");
  }

  await page.evaluate(() => {
    document.querySelectorAll(".panel-layout > .db-panel, .widget-layout > .widget-card").forEach((node) => {
      node.classList.add("active", "group-selected", "surface-response-active");
      node.classList.toggle("db-panel-pinned", true);
      node.classList.toggle("db-panel-custom-color", true);
      node.dataset.panelColor = node.dataset.panelColor || "#2563eb";
      node.dataset.panelTitle = node.dataset.panelTitle || "Runtime state";
    });
    document.querySelector(".panel-layout > .db-panel")?.classList.add("db-panel-collapsed");
    document.body.classList.add("layout-tools-active", "group-select-active");
  });
}

function splitSelectorList(selectorText) {
  const parts = [];
  let current = "";
  let depth = 0;
  for (const char of selectorText) {
    if (char === "(" || char === "[") depth += 1;
    if (char === ")" || char === "]") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

async function collectSelectorUsage(page) {
  return page.evaluate((terms) => {
    const splitSelectorList = (selectorText) => {
      const parts = [];
      let current = "";
      let depth = 0;
      for (const char of selectorText) {
        if (char === "(" || char === "[") depth += 1;
        if (char === ")" || char === "]") depth = Math.max(0, depth - 1);
        if (char === "," && depth === 0) {
          if (current.trim()) parts.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      if (current.trim()) parts.push(current.trim());
      return parts;
    };
    const queryableSelector = (selector) => selector
      .replace(/::[a-zA-Z-]+/g, "")
      .replace(/:(hover|active|focus|focus-visible|focus-within|target|visited|link)\b/g, "")
      .trim();
    const termPattern = new RegExp(terms.join("|"), "i");
    const records = [];
    const visitRules = (rules, href = "") => {
      for (const rule of rules) {
        if (rule.type === CSSRule.IMPORT_RULE && rule.styleSheet) {
          try {
            visitRules([...rule.styleSheet.cssRules], rule.styleSheet.href || href);
          } catch {}
          continue;
        }
        if (rule.type === CSSRule.STYLE_RULE && rule.selectorText && termPattern.test(rule.selectorText)) {
          const selectors = splitSelectorList(rule.selectorText);
          const matches = selectors.map((selector) => {
            const query = queryableSelector(selector);
            let count = 0;
            let error = "";
            try {
              count = query ? document.querySelectorAll(query).length : 0;
            } catch (err) {
              error = String(err?.message || err);
            }
            return { selector, query, count, error };
          });
          records.push({
            href,
            selectorText: rule.selectorText,
            cssText: rule.cssText,
            matched: matches.some((entry) => entry.count > 0),
            matches,
          });
          continue;
        }
        if (rule.cssRules) {
          try {
            visitRules([...rule.cssRules], href);
          } catch {}
          continue;
        }
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        visitRules([...sheet.cssRules], sheet.href || "");
      } catch {
        continue;
      }
    }
    return {
      capturedAt: new Date().toISOString(),
      cutTerms: terms,
      htmlClass: document.documentElement.className,
      bodyClass: document.body.className,
      records,
    };
  }, cutTerms);
}

(async () => {
  const { app, page } = await launchApp();
  try {
    await exerciseRuntimeStates(page);
    const usage = await collectSelectorUsage(page);
    usage.summary = {
      totalCutTermRules: usage.records.length,
      matched: usage.records.filter((record) => record.matched).length,
      unmatched: usage.records.filter((record) => !record.matched).length,
    };
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(usage, null, 2), "utf8");
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
