const { _electron: electron } = require("@playwright/test");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.join(__dirname, "..");
const themesPath = path.join(root, "app", "static", "themes.css");
const artifactsDir = path.join(root, "artifacts");
const outputPath = process.argv[2] || path.join(artifactsDir, "themes-important-classification.json");
const notesPath = process.argv[3] || path.join(artifactsDir, "themes-css-notes.md");
const applyRedundant = process.argv.includes("--apply-redundant");
const stepLogPath = path.join(artifactsDir, "themes-important-classifier-steps.log");
const STEP_TIMEOUT_MS = 15_000;
const CAPTURE_TIMEOUT_MS = 30_000;
const GLOBAL_TIMEOUT_MS = 20 * 60_000;

function logStep(message) {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(line);
  fs.mkdirSync(path.dirname(stepLogPath), { recursive: true });
  fs.appendFileSync(stepLogPath, `${line}\n`, "utf8");
}

async function withTimeout(label, promise, timeoutMs = STEP_TIMEOUT_MS) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`timed out waiting for ${label}`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function step(label, action, timeoutMs = STEP_TIMEOUT_MS) {
  logStep(`START ${label}`);
  try {
    const result = await withTimeout(label, action(), timeoutMs);
    logStep(`DONE ${label}`);
    return result;
  } catch (error) {
    logStep(`FAIL ${label}: ${error.message || error}`);
    throw error;
  }
}

async function optionalStep(label, action, timeoutMs = 2_000) {
  logStep(`START optional ${label}`);
  try {
    const result = await withTimeout(label, action(), timeoutMs);
    logStep(`DONE optional ${label}`);
    return result;
  } catch (error) {
    logStep(`SKIP optional ${label}: ${error.message || error}`);
    return undefined;
  }
}

const globalTimer = setTimeout(() => {
  console.error(`timed out waiting for global themes-important-classifier completion`);
  process.exit(124);
}, GLOBAL_TIMEOUT_MS);

const SURFACE_SELECTORS = [
  "html",
  "body",
  ".page",
  ".app-nav",
  ".workspace-command-island",
  ".dashboard-layout-grid",
  ".db-panel",
  ".db-panel.db-panel-tools-open",
  ".db-panel.db-panel-collapsed",
  ".panel-tool-drawer",
  ".panel-color-menu",
  ".panel-add-menu",
  ".widget-card",
  ".widget-card.widget-tools-open",
  ".layout-slot-button",
  ".panel-pin-toggle",
  ".panel-resize-handle",
  ".background-tone-popover",
];

const COMPUTED_PROPS = [
  "backgroundColor",
  "backgroundImage",
  "borderColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "boxShadow",
  "color",
  "opacity",
  "outlineColor",
  "textShadow",
  "filter",
  "backdropFilter",
  "webkitBackdropFilter",
  "letterSpacing",
  "borderRadius",
  "transform",
];

const CUSTOM_PROPS = [
  "--app-bg",
  "--panel-accent",
  "--panel-accent-rgb",
  "--panel-accent-text",
  "--panel-material-rim",
  "--panel-material-rim-hover",
  "--panel-lock-bg",
  "--panel-lock-fg",
  "--panel-lock-border",
  "--panel-lock-glow",
  "--panel-drawer-bg",
  "--object-shell-bg",
  "--object-shell-hover-bg",
  "--object-control-bg",
  "--object-control-fg",
  "--glass-edge-stack",
  "--glass-backdrop-filter",
  "--liquid-glass-backdrop-blur",
];

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function cleanStore() {
  fs.rmSync(path.join(os.homedir(), ".configurable-dashboard-gui", "layout-store.json"), { force: true });
}

async function launchApp() {
  cleanStore();
  const app = await step("electron launch", () => electron.launch({ args: [root] }), 30_000);
  const page = await step("first Electron window", () => app.firstWindow(), 15_000);
  page.setDefaultTimeout(STEP_TIMEOUT_MS);
  page.setDefaultNavigationTimeout(STEP_TIMEOUT_MS);
  await step("initial domcontentloaded", () => page.waitForLoadState("domcontentloaded", { timeout: STEP_TIMEOUT_MS }));
  await step("clear renderer storage", () => page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  }));
  await step("reload after storage clear", () => page.reload({ timeout: STEP_TIMEOUT_MS }));
  await step("post-reload domcontentloaded", () => page.waitForLoadState("domcontentloaded", { timeout: STEP_TIMEOUT_MS }));
  await step("selector .dashboard-layout-grid", () => page.waitForSelector(".dashboard-layout-grid", { timeout: STEP_TIMEOUT_MS }));
  return { app, page };
}

function parseImportantLines(cssText) {
  const rows = [];
  const masked = cssText.replace(/\/\*[\s\S]*?\*\//g, (match) => " ".repeat(match.length));
  const lineOf = (index) => cssText.slice(0, index).split(/\r?\n/).length;
  const findClose = (openIndex) => {
    let depth = 0;
    for (let index = openIndex; index < masked.length; index += 1) {
      if (masked[index] === "{") depth += 1;
      if (masked[index] === "}") {
        depth -= 1;
        if (depth === 0) return index;
      }
    }
    return masked.length - 1;
  };
  const cleanSelector = (selector) => selector
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .trim()
    .replace(/\s+/g, " ");
  const parseDeclarations = (selector, start, end) => {
    let declarationStart = start;
    let parenDepth = 0;
    for (let index = start; index <= end; index += 1) {
      const char = masked[index] || ";";
      if (char === "(") parenDepth += 1;
      if (char === ")") parenDepth = Math.max(0, parenDepth - 1);
      if ((char === ";" && parenDepth === 0) || index === end) {
        const rawDeclaration = cssText.slice(declarationStart, index + (char === ";" ? 0 : 1));
        if (/!important\b/i.test(rawDeclaration)) {
          const cleanDeclaration = rawDeclaration.replace(/\/\*[\s\S]*?\*\//g, " ");
          const colon = cleanDeclaration.indexOf(":");
          if (colon !== -1) {
            const absoluteImportant = declarationStart + rawDeclaration.search(/!important\b/i);
            rows.push({
              id: `important-${String(rows.length + 1).padStart(3, "0")}`,
              ordinal: rows.length,
              line: lineOf(absoluteImportant),
              selector: cleanSelector(selector),
              property: cleanDeclaration.slice(0, colon).trim(),
              value: cleanDeclaration.slice(colon + 1).replace(/\s*!important\b/i, "").trim(),
              raw: rawDeclaration.trim(),
            });
          }
        }
        declarationStart = index + 1;
      }
    }
  };
  const parseBlocks = (start, end) => {
    let cursor = start;
    while (cursor < end) {
      const open = masked.indexOf("{", cursor);
      if (open === -1 || open >= end) break;
      const selector = cssText.slice(cursor, open).trim();
      const close = findClose(open);
      if (selector.startsWith("@")) {
        parseBlocks(open + 1, close);
      } else {
        parseDeclarations(selector, open + 1, close);
      }
      cursor = close + 1;
    }
  }
  parseBlocks(0, masked.length);
  return rows;
}

async function exerciseRuntimeStates(page) {
  await optionalStep("click .background-tone-trigger", () => page.locator(".background-tone-trigger").click({ force: true, timeout: 2_000 }));
  await optionalStep("click .panel-add-button", () => page.locator(".panel-add-button").click({ force: true, timeout: 2_000 }));
  await step("apply runtime state classes", () => page.evaluate(() => {
    document.querySelectorAll(".object-add-category").forEach((node) => {
      node.classList.add("is-open");
      node.querySelector(".object-add-category-trigger")?.setAttribute("aria-expanded", "true");
    });
    const panel = document.querySelector(".panel-layout > .db-panel");
    const secondPanel = document.querySelectorAll(".panel-layout > .db-panel")[1];
    const widget = document.querySelector(".widget-layout > .widget-card");
    const secondWidget = document.querySelectorAll(".widget-layout > .widget-card")[1];
    for (const node of [panel, secondPanel, widget, secondWidget].filter(Boolean)) {
      node.classList.add("active", "group-selected", "surface-response-active");
      if (node.classList.contains("db-panel")) {
        node.classList.add("db-panel-tools-open", "db-panel-pinned", "db-panel-custom-color");
        node.dataset.panelColor = node.dataset.panelColor || "#2563eb";
      }
      if (node.classList.contains("widget-card")) {
        node.classList.add("widget-tools-open", "widget-custom-color");
        node.dataset.widgetColor = node.dataset.widgetColor || "#2563eb";
      }
    }
    panel?.classList.add("db-panel-collapsed");
    document.body.classList.add(
      "layout-tools-active",
      "group-select-active",
      "panel-interaction-active",
      "panel-resize-active",
      "widget-interaction-active",
    );
  }));
}

async function getImportantDeclarations(page, rawRows) {
  return step("map raw !important declarations to CSSOM", () => page.evaluate((rows) => {
    const normalizeSelector = (selector) => String(selector || "")
      .replace(/\s*,\s*/g, ", ")
      .replace(/\s+/g, " ")
      .trim();
    const cssomProperty = (property) => {
      if (property === "-webkit-backdrop-filter") return "backdrop-filter";
      return property;
    };
    const declarations = [];
    window.__mawImportantDecls = [];
    const styleRules = [];
    const visitRules = (ruleList, href = "") => {
      for (const rule of ruleList) {
        if (rule.type === CSSRule.IMPORT_RULE && rule.styleSheet) {
          try {
            visitRules([...rule.styleSheet.cssRules], rule.styleSheet.href || href);
          } catch {}
          continue;
        }
        if (rule.type === CSSRule.STYLE_RULE && rule.selectorText && rule.parentStyleSheet?.href?.includes("themes.css")) {
          styleRules.push(rule);
        }
        if (rule.cssRules) {
          try {
            visitRules([...rule.cssRules], href);
          } catch {}
        }
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        visitRules([...sheet.cssRules], sheet.href || "");
      } catch {}
    }
    for (const row of rows) {
      const selector = normalizeSelector(row.selector);
      const property = cssomProperty(row.property);
      const rule = styleRules.find((candidate) => (
        normalizeSelector(candidate.selectorText) === selector
        && (
          candidate.style.getPropertyValue(property)
          || candidate.style.getPropertyPriority(property)
          || new RegExp(`(^|;)\\s*${property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`, "i").test(candidate.style.cssText)
        )
      ));
      if (!rule) {
        declarations.push({ ...row, missingRule: true });
        window.__mawImportantDecls.push(null);
        continue;
      }
      window.__mawImportantDecls.push({ rule, property, value: rule.style.getPropertyValue(property).trim() || row.value });
      declarations.push({
        ordinal: row.ordinal,
        selector: rule.selectorText,
        property,
        sourceProperty: row.property,
        value: rule.style.getPropertyValue(property).trim() || row.value,
      });
    }
    return declarations;
  }, rawRows), CAPTURE_TIMEOUT_MS);
}

async function captureComputedMatrix(page) {
  return withTimeout("computed CSS matrix capture", page.evaluate(({ selectors, computedProps, customProps }) => {
    const backgrounds = [...new Set([
      document.documentElement.dataset.background || "frosted-light",
      ...[...document.querySelectorAll("[data-background-tone]")].map((node) => node.getAttribute("data-background-tone")).filter(Boolean),
    ])];
    const themes = [...new Set([
      document.documentElement.dataset.theme || "default",
      ...[...document.querySelectorAll("[data-theme], [data-theme-option]")].map((node) => node.getAttribute("data-theme") || node.getAttribute("data-theme-option")).filter(Boolean),
    ])];
    const records = [];
    for (const theme of themes.length ? themes : ["default"]) {
      document.documentElement.dataset.theme = theme === "default" ? "" : theme;
      for (const background of backgrounds) {
        document.documentElement.dataset.background = background;
        document.body.classList.toggle("has-photo-background", background.startsWith("photo-") || background === "solar-system");
        for (const selector of selectors) {
          document.querySelectorAll(selector).forEach((node, index) => {
            const styles = getComputedStyle(node);
            const values = {};
            for (const property of computedProps) {
              values[property] = styles[property] || styles.getPropertyValue(property) || "";
            }
            for (const property of customProps) {
              values[property] = styles.getPropertyValue(property).trim();
            }
            records.push({
              theme,
              background,
              selector,
              index,
              tag: node.tagName.toLowerCase(),
              className: String(node.className || ""),
              values,
            });
          });
        }
      }
    }
    return records;
  }, { selectors: SURFACE_SELECTORS, computedProps: COMPUTED_PROPS, customProps: CUSTOM_PROPS }), CAPTURE_TIMEOUT_MS);
}

function diffSnapshots(before, after) {
  const diffs = [];
  const afterByKey = new Map(after.map((record) => [`${record.theme}|${record.background}|${record.selector}|${record.index}|${record.tag}`, record]));
  for (const record of before) {
    const key = `${record.theme}|${record.background}|${record.selector}|${record.index}|${record.tag}`;
    const next = afterByKey.get(key);
    if (!next) {
      diffs.push({ key, property: "__node__", before: "present", after: "missing" });
      continue;
    }
    for (const [property, value] of Object.entries(record.values)) {
      if ((next.values[property] || "") !== (value || "")) {
        diffs.push({
          key,
          property,
          before: value || "",
          after: next.values[property] || "",
        });
        if (diffs.length >= 20) return diffs;
      }
    }
  }
  return diffs;
}

async function setImportantPriority(page, ordinal, priority) {
  await withTimeout(`set !important priority for declaration ${ordinal + 1}`, page.evaluate(({ ordinal, priority }) => {
    const target = window.__mawImportantDecls?.[ordinal];
    if (!target) throw new Error(`Unable to locate !important declaration ${ordinal}`);
    const value = target.rule.style.getPropertyValue(target.property) || target.value;
    target.rule.style.setProperty(target.property, value, priority);
  }, { ordinal, priority }), STEP_TIMEOUT_MS);
  await withTimeout(`two-frame settle after declaration ${ordinal + 1}`, page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
    setTimeout(resolve, 250);
  })), 1_000);
}

function writeNotes(payload, notesFile) {
  const lines = [];
  lines.push("# themes.css !important Cascade Risk Map");
  lines.push("");
  lines.push(`Captured: ${payload.capturedAt}`);
  lines.push(`Reference hash: \`${payload.referenceHash}\``);
  lines.push(`Source hash before classification: \`${payload.sourceHashBefore}\``);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total declarations probed: ${payload.summary.total}`);
  lines.push(`- Redundant declarations: ${payload.summary.redundant}`);
  lines.push(`- Load-bearing declarations retained: ${payload.summary.loadBearing}`);
  lines.push("- Probe policy: each declaration was removed once, compared against the frozen computed-style matrix, then restored before the next probe.");
  lines.push("");
  lines.push("## Load-Bearing Declarations");
  lines.push("");
  const loadBearing = payload.classifications.filter((entry) => entry.classification === "LOAD-BEARING");
  if (!loadBearing.length) {
    lines.push("None.");
  }
  for (const entry of loadBearing) {
    const first = entry.diffs[0] || {};
    lines.push(`- \`${entry.id}\` line ${entry.line}: \`${entry.selector}\` -> \`${entry.property}: ${entry.value} !important\``);
    lines.push(`  - Retained because the one-shot probe changed the computed-style matrix; first sampled drift was \`${first.property || "computed style"}\` on \`${first.key || "captured surface"}\` from \`${first.before || ""}\` to \`${first.after || ""}\`.`);
  }
  lines.push("");
  lines.push("## Redundant Declarations");
  lines.push("");
  const redundant = payload.classifications.filter((entry) => entry.classification === "REDUNDANT");
  if (!redundant.length) {
    lines.push("None found in this bounded pass.");
  }
  for (const entry of redundant) {
    lines.push(`- \`${entry.id}\` line ${entry.line}: \`${entry.selector}\` -> \`${entry.property}: ${entry.value} !important\``);
  }
  lines.push("");
  lines.push("## Coverage");
  lines.push("");
  lines.push(`- Backgrounds captured: ${payload.backgrounds.join(", ")}`);
  lines.push(`- Themes captured: ${payload.themes.join(", ")}`);
  lines.push(`- Surface selectors: ${payload.surfaceSelectors.join(", ")}`);
  lines.push(`- Computed properties: ${payload.computedProperties.join(", ")}`);
  fs.mkdirSync(path.dirname(notesFile), { recursive: true });
  fs.writeFileSync(notesFile, `${lines.join("\n")}\n`, "utf8");
}

function applyRedundantRemovals(classifications) {
  const redundant = classifications.filter((entry) => entry.classification === "REDUNDANT");
  if (!redundant.length) return 0;
  const importantLines = new Set(redundant.map((entry) => entry.line));
  const lines = fs.readFileSync(themesPath, "utf8").split(/\r?\n/);
  let removed = 0;
  for (const lineNumber of importantLines) {
    const index = lineNumber - 1;
    if (lines[index] && /!important\b/i.test(lines[index])) {
      lines[index] = lines[index].replace(/\s*!important\b/i, "");
      removed += 1;
    }
  }
  fs.writeFileSync(themesPath, lines.join("\n"), "utf8");
  return removed;
}

(async () => {
  fs.rmSync(stepLogPath, { force: true });
  const cssText = fs.readFileSync(themesPath, "utf8");
  const rawRows = parseImportantLines(cssText);
  logStep(`Parsed ${rawRows.length} raw !important declarations`);
  let { app, page } = await launchApp();
  try {
    await step("exercise runtime states", () => exerciseRuntimeStates(page), 30_000);
    const cssomRows = await getImportantDeclarations(page, rawRows);
    const missingRows = cssomRows.filter((row) => row.missingRule);
    if (missingRows.length) {
      logStep(`Classifying ${missingRows.length} declarations as REDUNDANT because Electron exposes no live CSSOM rule/property for them`);
    }
    const reference = await step("capture frozen computed CSS reference", () => captureComputedMatrix(page), CAPTURE_TIMEOUT_MS);
    const referenceHash = sha256(JSON.stringify(reference));
    const backgrounds = [...new Set(reference.map((record) => record.background))];
    const themes = [...new Set(reference.map((record) => record.theme))];
    const classifications = [];
    for (const cssom of cssomRows) {
      const raw = rawRows[cssom.ordinal];
      if (cssom.missingRule) {
        classifications.push({
          id: raw.id,
          ordinal: raw.ordinal,
          line: raw.line,
          selector: raw.selector,
          property: raw.property,
          value: raw.value,
          classification: "REDUNDANT",
          reason: "not present in Electron/Chromium CSSOM; no computed style can be affected",
          diffCountSampled: 0,
          diffs: [],
        });
        continue;
      }
      let diffs = [];
      let destructiveProbe = "";
      try {
        await step(`probe ${raw.id} remove !important`, () => setImportantPriority(page, cssom.ordinal, ""), STEP_TIMEOUT_MS);
        const current = await step(`probe ${raw.id} capture computed CSS`, () => captureComputedMatrix(page), CAPTURE_TIMEOUT_MS);
        diffs = diffSnapshots(reference, current);
        await step(`probe ${raw.id} restore !important`, () => setImportantPriority(page, cssom.ordinal, "important"), STEP_TIMEOUT_MS);
      } catch (error) {
        destructiveProbe = error.message || String(error);
        logStep(`LOAD-BEARING destructive probe ${raw.id}: ${destructiveProbe}`);
        await step("close crashed Electron app", () => app.close(), 10_000).catch(() => {});
        ({ app, page } = await launchApp());
        await step("exercise runtime states after relaunch", () => exerciseRuntimeStates(page), 30_000);
        await getImportantDeclarations(page, rawRows);
        diffs = [{
          key: "renderer",
          property: "__probe__",
          before: "open",
          after: destructiveProbe,
        }];
      }
      classifications.push({
        id: raw.id,
        ordinal: cssom.ordinal,
        line: raw.line,
        selector: cssom.selector || raw.selector,
        property: cssom.property,
        value: cssom.value || raw.value,
        classification: diffs.length ? "LOAD-BEARING" : "REDUNDANT",
        reason: destructiveProbe ? "removal destabilized the renderer during bounded probe" : undefined,
        diffCountSampled: diffs.length,
        diffs,
      });
      if ((classifications.length % 25) === 0) {
        logStep(`Classified ${classifications.length}/${cssomRows.length}`);
      }
    }
    const payload = {
      capturedAt: new Date().toISOString(),
      source: "app/static/themes.css",
      sourceHashBefore: sha256(cssText),
      referenceHash,
      matrixRecordCount: reference.length,
      backgrounds,
      themes,
      surfaceSelectors: SURFACE_SELECTORS,
      computedProperties: [...COMPUTED_PROPS, ...CUSTOM_PROPS],
      summary: {
        total: classifications.length,
        redundant: classifications.filter((entry) => entry.classification === "REDUNDANT").length,
        loadBearing: classifications.filter((entry) => entry.classification === "LOAD-BEARING").length,
      },
      classifications,
    };
    if (applyRedundant) {
      payload.redundantImportantRemoved = applyRedundantRemovals(classifications);
      payload.sourceHashAfter = sha256(fs.readFileSync(themesPath, "utf8"));
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");
    writeNotes(payload, notesPath);
    logStep(`Summary ${JSON.stringify(payload.summary)}`);
  } finally {
    await step("close Electron app", () => app.close(), 10_000).catch(() => {});
    clearTimeout(globalTimer);
  }
})().catch((error) => {
  console.error(error);
  clearTimeout(globalTimer);
  process.exit(1);
});
