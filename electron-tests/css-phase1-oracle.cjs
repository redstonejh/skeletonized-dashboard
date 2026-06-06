const { _electron: electron } = require("@playwright/test");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.join(__dirname, "..");
const artifactsDir = path.join(root, "artifacts");
const runArtifactsDir = path.join(root, "runs", "2026-06-06_css-phase-1-map-oracle_17eb", "artifacts");
const cssFiles = ["app/static/themes.css", "app/static/dashboard-grid.css"];
const targetCssFiles = ["app/static/tokens.css", ...cssFiles];

const mode = process.argv[2] || "all";

const computedProperties = [
  "display", "visibility", "opacity", "pointerEvents", "position", "zIndex",
  "gridColumnStart", "gridColumnEnd", "gridRowStart", "gridRowEnd",
  "width", "height", "minHeight", "maxHeight", "overflow", "overflowX", "overflowY",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "marginTop", "marginRight", "marginBottom", "marginLeft",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor",
  "borderRadius", "boxSizing", "boxShadow", "backgroundColor", "backgroundImage",
  "color", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "textOverflow",
  "whiteSpace", "cursor", "transform", "backdropFilter", "webkitBackdropFilter", "outlineColor",
  "outlineStyle", "outlineWidth",
];

const customProperties = [
  "--app-bg", "--surface", "--surface-soft", "--surface-raised", "--ink-strong", "--muted",
  "--glass-border", "--glass-surface", "--glass-surface-strong", "--glass-backdrop-filter",
  "--liquid-glass-backdrop-blur", "--panel-accent", "--panel-accent-rgb", "--panel-accent-text",
  "--panel-material-rim", "--panel-lock-bg", "--panel-lock-fg", "--object-shell-bg",
  "--widget-gap", "--panel-gap", "--dashboard-grid-row-height", "--panel-add-menu-max-height",
];

const selectors = [
  "html",
  "body",
  ".page",
  ".app-nav",
  ".workspace-command-island",
  ".dashboard-layout-grid",
  ".widget-layout",
  ".panel-layout",
  ".db-panel",
  ".db-panel-hd",
  ".db-panel-title",
  ".db-panel-count",
  ".db-panel-body",
  ".widget-card",
  ".stat-val",
  ".stat-lbl",
  ".panel-tool-drawer",
  ".panel-tool-button",
  ".panel-pin-toggle",
  ".panel-resize-handle",
  ".panel-move-handle",
  ".panel-add-button",
  ".panel-add-menu",
  ".object-add-category-trigger",
  ".panel-color-menu",
  ".background-tone-popover",
  ".background-tone-option",
  ".layout-slot-button",
  "[data-widget-shell]",
  "[data-widget-shell-content='true']",
  ".widget-runtime-state",
  ".timeframe-filter-btn",
  "input",
  "select",
  "textarea",
  ".widget-card[hidden]",
  ".db-panel[hidden]",
];

const states = [
  { id: "rest", setup: "rest" },
  { id: "menus-open", setup: "menus" },
  { id: "tools-open", setup: "tools" },
  { id: "selected-dragging", setup: "dragging" },
  { id: "collapsed-pinned", setup: "collapsed" },
  { id: "focus-visible", setup: "focus" },
  { id: "webgl-glass", setup: "webgl" },
];

const responsiveViewports = [
  { width: 1280, height: 900, id: "desktop" },
  { width: 980, height: 820, id: "narrow-980" },
  { width: 720, height: 780, id: "mobile-720" },
];

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readText(relativePath, base = root) {
  return fs.readFileSync(path.join(base, relativePath), "utf8");
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, "utf8");
}

function fileHash(relativePath, base = root) {
  return sha256(fs.readFileSync(path.join(base, relativePath)));
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function stripCommentsKeepWidth(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (match) => " ".repeat(match.length));
}

function splitSelectors(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function declarationsFromBody(body) {
  return body.split(";").map((raw) => {
    const text = raw.trim();
    if (!text || text.includes("{") || !text.includes(":")) return null;
    const colon = text.indexOf(":");
    const property = text.slice(0, colon).trim();
    const valueRaw = text.slice(colon + 1).trim();
    if (!property || !valueRaw) return null;
    const important = /!important\b/i.test(valueRaw);
    const value = valueRaw.replace(/\s*!important\b/i, "").trim().replace(/\s+/g, " ");
    return { property, value, important };
  }).filter(Boolean);
}

function parseCssBlocks(relativePath) {
  const text = readText(relativePath);
  const masked = stripCommentsKeepWidth(text);
  const blocks = [];
  const stack = [];
  let cursor = 0;
  for (let index = 0; index < masked.length; index += 1) {
    const char = masked[index];
    if (char !== "{" && char !== "}") continue;
    if (char === "{") {
      const prelude = masked.slice(cursor, index).trim();
      const context = stack.map((entry) => entry.prelude).filter((entry) => entry.startsWith("@"));
      stack.push({ prelude, start: index, context });
      cursor = index + 1;
      continue;
    }
    const open = stack.pop();
    if (!open) {
      cursor = index + 1;
      continue;
    }
    const body = masked.slice(open.start + 1, index);
    const declarations = declarationsFromBody(body);
    if (declarations.length && !open.prelude.startsWith("@")) {
      blocks.push({
        file: relativePath,
        startLine: lineNumberAt(text, open.start),
        endLine: lineNumberAt(text, index),
        selectorText: open.prelude.replace(/\s+/g, " "),
        selectors: splitSelectors(open.prelude.replace(/\s+/g, " ")),
        context: open.context,
        declarations,
      });
    }
    cursor = index + 1;
  }
  return { text, blocks };
}

function categoryForDeclaration(block, declaration) {
  const selector = block.selectorText;
  const property = declaration.property;
  if (selector.includes("::")) return "pseudo-oracle";
  if (property.startsWith("--")) return "computed-oracle";
  if (property.startsWith("animation") || property === "transition" || property.startsWith("transition")) return "animation-oracle";
  if (block.context.some((item) => item.startsWith("@media"))) return "media-oracle";
  if (/display|visibility|opacity|pointer-events|color|background|border|box-shadow|filter|transform|padding|margin|height|width|grid|font|line-height|letter-spacing|z-index|overflow|cursor|outline/.test(property)) {
    return "computed-oracle";
  }
  return "static-only";
}

function selectorBucket(selectorText) {
  if (/data-background|background-tone|photo|solar-system/.test(selectorText)) return "background-tone";
  if (/glass|webgl|backdrop|material/.test(selectorText)) return "glass-material";
  if (/db-panel|panel-/.test(selectorText)) return "panel";
  if (/widget|stat-card|stat-val|stat-lbl/.test(selectorText)) return "widget";
  if (/menu|popover|drawer|nav/.test(selectorText)) return "menu-navigation";
  if (/drag|resize|placeholder|group|selected/.test(selectorText)) return "interaction";
  return "base-control";
}

function hardCodedValue(value) {
  return !value.includes("var(") && /(#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|\b\d+(\.\d+)?px\b)/i.test(value);
}

function buildTangleMap() {
  const parsed = cssFiles.map(parseCssBlocks);
  const classificationPath = path.join(root, "artifacts", "themes-important-classification.json");
  const classification = fs.existsSync(classificationPath) ? JSON.parse(fs.readFileSync(classificationPath, "utf8")) : null;
  const files = {};
  const allDeclarations = [];
  for (const item of parsed) {
    const lineCount = item.text.split(/\r?\n/).length;
    const blocks = item.blocks;
    const declarations = blocks.flatMap((block, blockIndex) => block.declarations.map((declaration, declarationIndex) => ({
      id: `${block.file}:${block.startLine}:${declaration.property}:${declarationIndex}`,
      file: block.file,
      blockIndex,
      declarationIndex,
      line: block.startLine,
      selectorText: block.selectorText,
      selectors: block.selectors,
      context: block.context,
      property: declaration.property,
      value: declaration.value,
      important: declaration.important,
      oracleCategory: categoryForDeclaration(block, declaration),
      bucket: selectorBucket(block.selectorText),
      hardCoded: hardCodedValue(declaration.value),
    })));
    declarations.forEach((entry) => allDeclarations.push(entry));
    const regions = [];
    let start = 1;
    while (start <= lineCount) {
      const end = Math.min(lineCount, start + 199);
      const regionBlocks = blocks.filter((block) => block.startLine >= start && block.startLine <= end);
      regions.push({
        startLine: start,
        endLine: end,
        ruleBlocks: regionBlocks.length,
        declarations: regionBlocks.reduce((count, block) => count + block.declarations.length, 0),
        dominantBuckets: Object.entries(regionBlocks.reduce((acc, block) => {
          const bucket = selectorBucket(block.selectorText);
          acc[bucket] = (acc[bucket] || 0) + 1;
          return acc;
        }, {})).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([bucket]) => bucket),
      });
      start = end + 1;
    }
    files[item.blocks[0]?.file || "unknown"] = {
      lineCount,
      sha256: sha256(item.text),
      ruleBlocks: blocks.length,
      declarations: declarations.length,
      important: declarations.filter((entry) => entry.important).length,
      hardCodedValues: declarations.filter((entry) => entry.hardCoded).length,
      regions,
    };
  }
  const importantByBucket = {};
  const hardCodedByBucket = {};
  for (const declaration of allDeclarations) {
    if (declaration.important) importantByBucket[declaration.bucket] = (importantByBucket[declaration.bucket] || 0) + 1;
    if (declaration.hardCoded) hardCodedByBucket[declaration.bucket] = (hardCodedByBucket[declaration.bucket] || 0) + 1;
  }
  const duplicateKeys = new Map();
  for (const declaration of allDeclarations) {
    const key = `${declaration.property}:${declaration.value}`;
    const current = duplicateKeys.get(key) || [];
    current.push(declaration);
    duplicateKeys.set(key, current);
  }
  const duplicatedPerTone = [...duplicateKeys.entries()]
    .filter(([, entries]) => entries.length >= 8 && entries.some((entry) => entry.bucket === "background-tone"))
    .map(([key, entries]) => ({ key, count: entries.length, sampleSelectors: entries.slice(0, 5).map((entry) => entry.selectorText) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);
  const specificityHotspots = allDeclarations
    .map((entry) => ({
      selector: entry.selectorText,
      line: entry.line,
      file: entry.file,
      score: (entry.selectorText.match(/#/g) || []).length * 100 +
        (entry.selectorText.match(/\.[\w-]+|\[[^\]]+\]|:[^:\s.(#[]+/g) || []).length * 10 +
        (entry.selectorText.match(/(^|[\s>+~])([a-z][\w-]*)/gi) || []).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);
  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    cssImportOrder: readText("app/static/style.css").trim().split(/\r?\n/),
    files,
    totals: {
      ruleBlocks: Object.values(files).reduce((sum, file) => sum + file.ruleBlocks, 0),
      declarations: allDeclarations.length,
      important: allDeclarations.filter((entry) => entry.important).length,
      hardCodedValues: allDeclarations.filter((entry) => entry.hardCoded).length,
      oracleCategories: allDeclarations.reduce((acc, entry) => {
        acc[entry.oracleCategory] = (acc[entry.oracleCategory] || 0) + 1;
        return acc;
      }, {}),
      importantByBucket,
      hardCodedByBucket,
      classifiedImportantSubset: classification?.summary || null,
    },
    duplicatedPerTone,
    specificityHotspots,
    sharedGlassMaterialLocations: allDeclarations
      .filter((entry) => entry.bucket === "glass-material")
      .slice(0, 120)
      .map((entry) => ({ file: entry.file, line: entry.line, selector: entry.selectorText, property: entry.property, value: entry.value, important: entry.important })),
    consolidationCandidates: [
      { rank: 1, slice: "Tokenize hard-coded px/color/shadow values", risk: "low-medium", gate: "computed-style parity for controls, panels, widgets, menus", evidence: hardCodedByBucket },
      { rank: 2, slice: "Collapse duplicated per-background-tone declarations into custom properties", risk: "medium", gate: "all background tones in computed-style oracle", evidence: duplicatedPerTone.slice(0, 8) },
      { rank: 3, slice: "Reduce removable !important declarations from classified subset", risk: "medium-high", gate: "important-classification plus computed-style parity", evidence: classification?.summary || null },
      { rank: 4, slice: "Unify shared glass material rules", risk: "high", gate: "webgl-glass/photo/custom-color matrix parity", evidence: "sharedGlassMaterialLocations" },
      { rank: 5, slice: "Split themes.css into cohesive modules after parity is frozen", risk: "high", gate: "zero computed-style drift and import-order proof", evidence: "cssImportOrder" },
    ],
    declarations: allDeclarations,
  };
  return result;
}

function markdownMap(map) {
  const lines = [];
  lines.push("# CSS Core Map", "");
  lines.push("Generated for CSS phase increment 1. This is a read-only map; no CSS rules were changed.", "");
  lines.push("## Import Order", "");
  map.cssImportOrder.forEach((line) => lines.push(`- \`${line}\``));
  lines.push("", "## File Coverage", "");
  for (const [file, info] of Object.entries(map.files)) {
    lines.push(`### ${file}`, "");
    lines.push(`- Lines: ${info.lineCount}`);
    lines.push(`- Rule blocks: ${info.ruleBlocks}`);
    lines.push(`- Declarations: ${info.declarations}`);
    lines.push(`- Raw !important declarations: ${info.important}`);
    lines.push(`- Hard-coded values: ${info.hardCodedValues}`);
    lines.push(`- SHA256: \`${info.sha256}\``, "");
    lines.push("| Lines | Rule Blocks | Declarations | Dominant Buckets |");
    lines.push("|---:|---:|---:|---|");
    info.regions.forEach((region) => {
      lines.push(`| ${region.startLine}-${region.endLine} | ${region.ruleBlocks} | ${region.declarations} | ${region.dominantBuckets.join(", ") || "none"} |`);
    });
    lines.push("");
  }
  lines.push("## Important Declarations", "");
  lines.push(`- Raw total across mapped CSS: ${map.totals.important}`);
  if (map.totals.classifiedImportantSubset) {
    lines.push(`- Existing themes-important-classification subset: ${map.totals.classifiedImportantSubset.total}`);
    lines.push(`- Classified load-bearing: ${map.totals.classifiedImportantSubset.loadBearing}`);
    lines.push(`- Classified removable/redundant: ${map.totals.classifiedImportantSubset.redundant}`);
  }
  lines.push("- Raw important by bucket:");
  Object.entries(map.totals.importantByBucket).sort((a, b) => b[1] - a[1]).forEach(([bucket, count]) => lines.push(`  - ${bucket}: ${count}`));
  lines.push("", "## Duplicated Per-Background-Tone Blocks", "");
  map.duplicatedPerTone.slice(0, 12).forEach((item, index) => {
    lines.push(`${index + 1}. \`${item.key}\` appears ${item.count} times.`);
  });
  lines.push("", "## Specificity Hotspots", "");
  map.specificityHotspots.slice(0, 15).forEach((item, index) => {
    lines.push(`${index + 1}. ${item.file}:${item.line} score ${item.score} \`${item.selector}\``);
  });
  lines.push("", "## Shared Glass Material Rules", "");
  map.sharedGlassMaterialLocations.slice(0, 20).forEach((item) => {
    lines.push(`- ${item.file}:${item.line} \`${item.selector}\` -> \`${item.property}: ${item.value}${item.important ? " !important" : ""}\``);
  });
  lines.push("", "## Hard-Coded Values That Should Become Tokens", "");
  Object.entries(map.totals.hardCodedByBucket).sort((a, b) => b[1] - a[1]).forEach(([bucket, count]) => lines.push(`- ${bucket}: ${count}`));
  lines.push("", "## Ranked Consolidation Candidates", "");
  map.consolidationCandidates.forEach((item) => {
    lines.push(`${item.rank}. ${item.slice} (${item.risk}); gate: ${item.gate}.`);
  });
  lines.push("");
  return lines.join("\n");
}

function cleanStore() {
  fs.rmSync(path.join(os.homedir(), ".configurable-dashboard-gui", "layout-store.json"), { force: true });
}

async function launchApp(appRoot) {
  cleanStore();
  const app = await electron.launch({ args: [appRoot], env: { ...process.env, MAW_HEADLESS: "1" } });
  const page = await app.firstWindow();
  page.setDefaultTimeout(20000);
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector(".dashboard-layout-grid");
  await page.evaluate(() => document.fonts?.ready || Promise.resolve());
  await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; }" });
  return { app, page };
}

async function addTextWidget(page) {
  await page.locator(".panel-add-button").click({ force: true });
  const menu = page.locator(".panel-add-menu");
  await menu.evaluate((node) => node.classList.add("open"));
  const content = menu.locator('.object-add-category[data-object-menu-category="content"]');
  await content.evaluate((node) => {
    node.classList.add("is-open");
    node.querySelector(".object-add-category-trigger")?.setAttribute("aria-expanded", "true");
  });
  await content.locator('.widget-add-action[data-widget-kind="text"]').click({ force: true });
  await page.waitForSelector('.widget-layout > .widget-card[data-custom-widget="true"]');
}

function backgrounds() {
  const classificationPath = path.join(root, "artifacts", "themes-important-classification.json");
  if (!fs.existsSync(classificationPath)) return ["frosted-light", "warm-white", "slate", "near-black", "photo-earth"];
  return JSON.parse(fs.readFileSync(classificationPath, "utf8")).backgrounds;
}

function targetScenarios() {
  const result = [];
  const tones = backgrounds();
  tones.forEach((background) => {
    states.forEach((state) => {
      result.push({ viewport: responsiveViewports[0], background, state: state.id, setup: state.setup });
    });
  });
  ["frosted-light", "slate", "near-black", "photo-earth"].forEach((background) => {
    responsiveViewports.slice(1).forEach((viewport) => {
      result.push({ viewport, background, state: "rest", setup: "rest" });
    });
  });
  return result;
}

async function prepareState(page, scenario) {
  await page.setViewportSize({ width: scenario.viewport.width, height: scenario.viewport.height });
  await page.evaluate(({ background, setup }) => {
    document.documentElement.dataset.background = background;
    document.body.className = "";
    document.body.dataset.theme = "default";
    document.querySelectorAll(".open, .is-open, .db-panel-tools-open, .widget-tools-open, .db-panel-collapsed, .db-panel-pinned, .db-panel-dragging, .widget-dragging, .group-selected, .dashboard-active-resize").forEach((node) => {
      node.classList.remove("open", "is-open", "db-panel-tools-open", "widget-tools-open", "db-panel-collapsed", "db-panel-pinned", "db-panel-dragging", "widget-dragging", "group-selected", "dashboard-active-resize");
    });
    document.querySelectorAll("details[open]").forEach((node) => node.removeAttribute("open"));
    const panel = document.querySelector(".panel-layout > .db-panel");
    const widget = document.querySelector(".widget-layout > .widget-card");
    const panelMenu = document.querySelector(".panel-add-menu");
    const tonePopover = document.querySelector(".background-tone-popover");
    const panelTools = panel?.querySelector(".panel-tool-drawer");
    document.querySelectorAll(".panel-add-menu, .layout-slot-menu, .background-tone-popover").forEach((node) => {
      node.style.removeProperty("--panel-add-menu-max-height");
      node.style.removeProperty("--layout-slot-menu-max-height");
      node.style.removeProperty("max-height");
    });
    if (panel) panel.hidden = false;
    if (widget) widget.hidden = false;
    if (setup === "menus") {
      panelMenu?.classList.add("open");
      panelMenu?.style.setProperty("--panel-add-menu-max-height", "780px");
      panelMenu?.style.setProperty("max-height", "780px");
      tonePopover?.classList.add("open");
      tonePopover?.closest("details")?.setAttribute("open", "");
      document.querySelector(".object-add-category")?.classList.add("is-open");
    }
    if (setup === "tools") {
      panel?.classList.add("db-panel-tools-open", "db-panel-custom-color");
      widget?.classList.add("widget-tools-open", "db-panel-custom-color");
      if (panel) {
        panel.dataset.panelColor = "#2563eb";
        panel.style.setProperty("--panel-accent", "#2563eb");
        panel.style.setProperty("--panel-accent-rgb", "37, 99, 235");
      }
      panelTools?.classList.add("open");
    }
    if (setup === "dragging") {
      document.body.classList.add("group-select-active", "panel-interaction-active", "panel-resize-active");
      panel?.classList.add("group-selected", "db-panel-dragging");
      widget?.classList.add("group-selected", "widget-dragging", "dashboard-active-resize");
    }
    if (setup === "collapsed") {
      panel?.classList.add("db-panel-collapsed", "db-panel-pinned");
      panel?.querySelector(".panel-pin-toggle")?.setAttribute("aria-pressed", "true");
      if (widget) widget.hidden = true;
    }
    if (setup === "focus") {
      document.body.classList.add("layout-tools-active");
      panel?.classList.add("db-panel-tools-open");
      panel?.querySelector(".panel-settings-toggle")?.focus?.();
    }
    if (setup === "webgl") {
      document.body.classList.add("webgl-glass-on");
      panel?.classList.add("db-panel-tools-open");
    }
  }, { background: scenario.background, setup: scenario.setup });
  await page.waitForTimeout(30);
  if (scenario.setup === "menus") {
    await page.evaluate(() => {
      const panelMenu = document.querySelector(".panel-add-menu");
      panelMenu?.style.setProperty("--panel-add-menu-max-height", "780px");
      panelMenu?.style.setProperty("max-height", "780px");
    });
  }
}

function normalizeStyleValue(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function captureScenario(page, scenario) {
  await prepareState(page, scenario);
  return page.evaluate(({ scenario, selectors, computedProperties, customProperties }) => {
    const captureNode = (node, selector, index, pseudo = null) => {
      const styles = getComputedStyle(node, pseudo);
      const props = {};
      computedProperties.forEach((property) => {
        props[property] = String(styles[property] || styles.getPropertyValue(property) || "").replace(/\s+/g, " ").trim();
      });
      const vars = {};
      customProperties.forEach((property) => {
        vars[property] = String(styles.getPropertyValue(property) || "").replace(/\s+/g, " ").trim();
      });
      return {
        selector,
        index,
        key: node.id || "",
        tag: node.tagName.toLowerCase(),
        pseudo,
        props,
        vars,
      };
    };
    const captures = [];
    selectors.forEach((selector) => {
      const nodes = [...document.querySelectorAll(selector)].slice(0, 2);
      nodes.forEach((node, index) => {
        captures.push(captureNode(node, selector, index));
        if (selector.includes("db-panel-hd") || selector.includes("background-tone-option")) {
          captures.push(captureNode(node, selector, index, "::before"));
        }
      });
    });
    return {
      scenario,
      captures,
    };
  }, { scenario, selectors, computedProperties, customProperties });
}

async function captureOracle(appRoot = root) {
  const { app, page } = await launchApp(appRoot);
  try {
    const scenarios = targetScenarios();
    const records = [];
    for (const scenario of scenarios) {
      records.push(await captureScenario(page, scenario));
    }
    const payload = {
      schemaVersion: 1,
      capturedAt: "deterministic-baseline",
      appRootLabel: appRoot === root ? "workspace" : "mutation-copy",
      userAgent: await page.evaluate(() => navigator.userAgent),
      sourceHashes: Object.fromEntries(targetCssFiles.map((file) => [file, fileHash(file, appRoot)])),
      matrix: {
        backgrounds: backgrounds(),
        themes: ["default"],
        states: states.map((state) => state.id),
        selectors,
        computedProperties,
        customProperties,
      },
      records,
    };
    payload.hash = sha256(JSON.stringify({ ...payload, hash: undefined, capturedAt: undefined }));
    return payload;
  } finally {
    await app.close();
  }
}

async function deterministicBaseline() {
  const captures = [];
  const repeatCount = Number(process.env.CSS_ORACLE_REPEAT || 10);
  const rawCaptures = [];
  let firstCapture = null;
  let firstDivergentCapture = null;
  for (let index = 0; index < repeatCount; index += 1) {
    const capture = await captureOracle(root);
    if (!firstCapture) firstCapture = capture;
    if (firstCapture && capture.hash !== firstCapture.hash && !firstDivergentCapture) firstDivergentCapture = capture;
    if (index < 2) rawCaptures.push(capture);
    captures.push({ index: index + 1, hash: capture.hash, recordCount: capture.records.length });
    if (index === 0) {
      writeJson(path.join(artifactsDir, "computed-style-baseline.json"), capture);
      writeJson(path.join(runArtifactsDir, "computed-style-baseline.json"), capture);
    }
  }
  const unique = [...new Set(captures.map((entry) => entry.hash))];
  const result = {
    passed: unique.length === 1,
    repeat: `${repeatCount}/${repeatCount}`,
    hashes: captures,
    uniqueHashes: unique,
  };
  writeJson(path.join(artifactsDir, "computed-style-determinism.json"), result);
  writeJson(path.join(runArtifactsDir, "computed-style-determinism.json"), result);
  if (!result.passed) {
    writeJson(path.join(runArtifactsDir, "computed-style-debug-a.json"), rawCaptures[0]);
    writeJson(path.join(runArtifactsDir, "computed-style-debug-b.json"), rawCaptures[1]);
    if (firstDivergentCapture) writeJson(path.join(runArtifactsDir, "computed-style-debug-divergent.json"), firstDivergentCapture);
    throw new Error(`computed-style oracle not deterministic: ${unique.join(", ")}`);
  }
  return result;
}

function makeTempApp() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dashboard-css-oracle-"));
  ["app", "main.js", "preload.js", "index.html", "package.json"].forEach((item) => {
    fs.cpSync(path.join(root, item), path.join(tempRoot, item), { recursive: true });
  });
  return tempRoot;
}

function mutateFile(tempRoot, mutation) {
  const fullPath = path.join(tempRoot, mutation.file);
  const text = fs.readFileSync(fullPath, "utf8");
  if (!text.includes(mutation.search)) throw new Error(`mutation search string not found: ${mutation.id}`);
  fs.writeFileSync(fullPath, text.replace(mutation.search, mutation.replace), "utf8");
}

async function resistance() {
  const baseline = JSON.parse(fs.readFileSync(path.join(artifactsDir, "computed-style-baseline.json"), "utf8"));
  const mutations = [
    {
      id: "color-panel-title",
      file: "app/static/themes.css",
      search: "color: var(--ink-strong);",
      replace: "color: rgb(255, 0, 255);",
      kind: "color",
    },
    {
      id: "spacing-widget-gap",
      file: "app/static/dashboard-grid.css",
      search: "--widget-gap: 14px;",
      replace: "--widget-gap: 31px;",
      kind: "spacing",
    },
  ];
  const results = [];
  for (const mutation of mutations) {
    const tempRoot = makeTempApp();
    try {
      mutateFile(tempRoot, mutation);
      const capture = await captureOracle(tempRoot);
      results.push({
        ...mutation,
        baselineHash: baseline.hash,
        mutatedHash: capture.hash,
        caught: capture.hash !== baseline.hash,
      });
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }
  const output = {
    passed: results.every((entry) => entry.caught),
    mutations: results,
  };
  writeJson(path.join(artifactsDir, "css-oracle-resistance.json"), output);
  writeJson(path.join(runArtifactsDir, "css-oracle-resistance.json"), output);
  if (!output.passed) throw new Error("computed-style oracle failed to catch all CSS mutations");
  return output;
}

function cssByteIdentity(beforeHashes = null) {
  const after = Object.fromEntries(targetCssFiles.map((file) => [file, fileHash(file)]));
  const result = {
    passed: beforeHashes ? Object.entries(beforeHashes).every(([file, hash]) => after[file] === hash) : true,
    before: beforeHashes || after,
    after,
    note: "No checked-out CSS files were edited by this phase; mutation probes run against temporary app copies.",
  };
  writeJson(path.join(artifactsDir, "css-byte-identity.json"), result);
  writeJson(path.join(runArtifactsDir, "css-byte-identity.json"), result);
  return result;
}

function writeMapArtifacts() {
  const map = buildTangleMap();
  writeJson(path.join(artifactsDir, "css-tangle-map.json"), map);
  writeJson(path.join(runArtifactsDir, "css-tangle-map.json"), map);
  writeText(path.join(artifactsDir, "css-core-map.md"), markdownMap(map));
  writeText(path.join(runArtifactsDir, "css-core-map.md"), markdownMap(map));
  const plan = [
    "# CSS Consolidation Plan",
    "",
    "This plan orders future CSS work by safety. No CSS changes are made in phase 1.",
    "",
    "1. Tokenize hard-coded values into `tokens.css`. Risk: low-medium. Gate: computed-style parity for panels, widgets, controls, and menus.",
    "2. Collapse duplicated per-background-tone blocks into custom-property-driven rules. Risk: medium. Gate: all background tones in `computed-style-baseline.json` remain identical.",
    "3. Reduce removable `!important` declarations using `themes-important-classification.json`. Risk: medium-high. Gate: classified removable entries plus computed-style parity.",
    "4. Unify glass material rules shared by panels, widgets, menus, and WebGL fallback. Risk: high. Gate: photo/background/custom-color/webgl matrix parity.",
    "5. Split `themes.css` into cohesive modules only after parity and import-order proof. Risk: high. Gate: zero computed-style drift and unchanged CSS rule inventory.",
    "",
  ].join("\n");
  writeText(path.join(artifactsDir, "css-consolidation-plan.md"), plan);
  writeText(path.join(runArtifactsDir, "css-consolidation-plan.md"), plan);
  return map;
}

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.mkdirSync(runArtifactsDir, { recursive: true });
  const before = Object.fromEntries(targetCssFiles.map((file) => [file, fileHash(file)]));
  if (mode === "map" || mode === "all") writeMapArtifacts();
  if (mode === "capture" || mode === "all") await deterministicBaseline();
  if (mode === "resistance" || mode === "all") await resistance();
  cssByteIdentity(before);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
