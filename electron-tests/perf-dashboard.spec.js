const { test, expect, _electron: electron } = require("@playwright/test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const TARGET_COUNTS = (process.env.PERF_OBJECT_COUNTS || "30,100")
  .split(",")
  .map((value) => Number.parseInt(value.trim(), 10))
  .filter((value) => Number.isFinite(value) && value > 0);

const PERF_ARTIFACT = process.env.PERF_ARTIFACT || path.join(__dirname, "..", "artifacts", "perf-baseline.json");
const FRAME_BUDGET_MS = 16.67;
const LONG_TASK_MS = 50;

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
  await page.waitForSelector(".dashboard-layout-grid", { timeout: 10000 });
  return { app, page };
}

async function closeApp(app) {
  await app.close();
  await new Promise((resolve) => setTimeout(resolve, 300));
}

function percentile(values, percentileValue) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1));
  return Number(sorted[index].toFixed(2));
}

async function seedScene(page, targetCount) {
  await page.evaluate((count) => {
    const panelLayout = document.querySelector(".panel-layout");
    const widgetLayout = document.querySelector(".widget-layout");
    const panelTemplate = panelLayout?.querySelector(".db-panel");
    const widgetTemplate = widgetLayout?.querySelector(".widget-card");
    if (!panelLayout || !widgetLayout || !panelTemplate || !widgetTemplate) return;

    document.querySelectorAll("[data-perf-clone='true']").forEach((node) => node.remove());

    const columns = 12;
    const panelsToCreate = Math.max(0, Math.floor(count / 2) - panelLayout.querySelectorAll(".db-panel").length);
    const widgetsToCreate = Math.max(0, count - panelsToCreate - widgetLayout.querySelectorAll(".widget-card").length);

    for (let index = 0; index < panelsToCreate; index += 1) {
      const clone = panelTemplate.cloneNode(true);
      const col = ((index * 3) % columns) + 1;
      const row = 8 + Math.floor(index / 4) * 3;
      clone.dataset.perfClone = "true";
      clone.dataset.panelKey = `perf-panel-${index}`;
      clone.dataset.gridCol = String(col);
      clone.dataset.gridRow = String(row);
      clone.dataset.currentSpan = "3";
      clone.dataset.gridRowSpan = "2";
      clone.style.gridColumn = `${col} / span 3`;
      clone.style.gridRow = `${row} / span 2`;
      clone.querySelector(".db-panel-title, .panel-title-text, h2")?.replaceChildren(`Perf Panel ${index + 1}`);
      panelLayout.appendChild(clone);
    }

    for (let index = 0; index < widgetsToCreate; index += 1) {
      const clone = widgetTemplate.cloneNode(true);
      const col = ((index * 2) % columns) + 1;
      const row = 8 + Math.floor(index / 6) * 2;
      clone.dataset.perfClone = "true";
      clone.dataset.widgetKey = `perf-widget-${index}`;
      clone.dataset.gridCol = String(col);
      clone.dataset.gridRow = String(row);
      clone.dataset.currentSpan = "2";
      clone.dataset.gridRowSpan = "2";
      clone.style.gridColumn = `${col} / span 2`;
      clone.style.gridRow = `${row} / span 2`;
      clone.querySelector(".widget-title, .db-panel-title, h3")?.replaceChildren(`Perf Widget ${index + 1}`);
      widgetLayout.appendChild(clone);
    }

    document.dispatchEvent(new CustomEvent("dashboard:perf-scene-ready", { detail: { count } }));
  }, targetCount);
  await page.waitForTimeout(250);
}

async function prepareScene(page, targetCount) {
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector(".dashboard-layout-grid", { timeout: 10000 });
  await installFrameProbe(page);
  await seedScene(page, targetCount);
}

async function installFrameProbe(page) {
  await page.evaluate(() => {
    window.__dashboardPerfProbe = {
      frameDeltas: [],
      longTasks: [],
      running: false,
      rafId: 0,
      lastFrame: 0,
      reset() {
        this.frameDeltas = [];
        this.longTasks = [];
        this.lastFrame = 0;
      },
      start() {
        this.reset();
        this.running = true;
        const tick = (time) => {
          if (!this.running) return;
          if (this.lastFrame) this.frameDeltas.push(time - this.lastFrame);
          this.lastFrame = time;
          this.rafId = requestAnimationFrame(tick);
        };
        this.rafId = requestAnimationFrame(tick);
      },
      stop() {
        this.running = false;
        cancelAnimationFrame(this.rafId);
      },
    };
    if (!window.__dashboardPerfLongTaskObserver && "PerformanceObserver" in window) {
      try {
        window.__dashboardPerfLongTaskObserver = new PerformanceObserver((list) => {
          const probe = window.__dashboardPerfProbe;
          if (!probe?.running) return;
          for (const entry of list.getEntries()) {
            probe.longTasks.push({ startTime: entry.startTime, duration: entry.duration, name: entry.name });
          }
        });
        window.__dashboardPerfLongTaskObserver.observe({ entryTypes: ["longtask"] });
      } catch {
        window.__dashboardPerfLongTaskObserver = null;
      }
    }
  });
}

async function collectMetrics(page, name, objectCount, action) {
  await page.evaluate(() => window.__dashboardPerfProbe.start());
  const started = Date.now();
  await action();
  await page.waitForTimeout(350);
  const raw = await page.evaluate(() => {
    window.__dashboardPerfProbe.stop();
    return {
      frames: window.__dashboardPerfProbe.frameDeltas,
      longTasks: window.__dashboardPerfProbe.longTasks,
      domNodes: document.querySelectorAll("*").length,
    };
  });
  const frames = raw.frames.filter((value) => Number.isFinite(value) && value > 0);
  const droppedFrames = frames.filter((value) => value > FRAME_BUDGET_MS).length;
  const longTasksOverBudget = raw.longTasks.filter((task) => task.duration > LONG_TASK_MS);
  return {
    name,
    object_count: objectCount,
    duration_ms: Date.now() - started,
    frame_count: frames.length,
    p50_frame_ms: percentile(frames, 50),
    p95_frame_ms: percentile(frames, 95),
    p99_frame_ms: percentile(frames, 99),
    max_frame_ms: Number((frames.length ? Math.max(...frames) : 0).toFixed(2)),
    dropped_frame_count: droppedFrames,
    long_task_count: longTasksOverBudget.length,
    long_tasks: longTasksOverBudget.map((task) => ({
      start_ms: Number(task.startTime.toFixed(2)),
      duration_ms: Number(task.duration.toFixed(2)),
      name: task.name,
    })),
    dom_nodes: raw.domNodes,
    gate: {
      p95_under_16_67ms: percentile(frames, 95) <= FRAME_BUDGET_MS,
      no_long_tasks_over_50ms: longTasksOverBudget.length === 0,
    },
  };
}

async function pointerDrag(page, locator, dx, dy, steps = 48) {
  const box = await locator.boundingBox({ timeout: 5000 });
  expect(box).toBeTruthy();
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps;
    await page.mouse.move(startX + dx * progress, startY + dy * progress);
    await page.waitForTimeout(4);
  }
  await page.mouse.up();
}

async function openTools(page, selector) {
  const item = page.locator(selector).first();
  await item.evaluate((node) => {
    const isWidget = node.classList.contains("widget-card");
    node.classList.add(isWidget ? "widget-tools-open" : "db-panel-tools-open");
    document.body.classList.add("layout-tools-active");
  });
  return item;
}

test("dashboard hot interactions perf baseline", async () => {
  test.setTimeout(180000);
  const { app, page } = await launchApp();
  const results = [];
  try {
    await installFrameProbe(page);
    for (const count of TARGET_COUNTS) {
      await prepareScene(page, count);

      const dragPanel = await openTools(page, '.panel-layout > .db-panel[data-panel-key="builder-notes"]');
      results.push(await collectMetrics(page, "drag-with-collision", count, async () => {
        await pointerDrag(page, dragPanel.locator(".panel-move-handle"), -300, 240, 60);
      }));

      await prepareScene(page, count);
      const resizePanel = await openTools(page, '.panel-layout > .db-panel[data-panel-key="builder-notes"]');
      results.push(await collectMetrics(page, "resize-snap", count, async () => {
        await pointerDrag(page, resizePanel.locator(".panel-resize-handle"), -220, 220, 60);
      }));

      await prepareScene(page, count);
      const reflowPanel = await openTools(page, '.panel-layout > .db-panel[data-panel-key="builder-content"]');
      results.push(await collectMetrics(page, "collision-heavy-reflow", count, async () => {
        await pointerDrag(page, reflowPanel.locator(".panel-move-handle"), 360, 260, 72);
      }));

      await prepareScene(page, count);
      const edgePanel = await openTools(page, '.panel-layout > .db-panel[data-panel-key="builder-notes"]');
      results.push(await collectMetrics(page, "edge-auto-scroll", count, async () => {
        await pointerDrag(page, edgePanel.locator(".panel-move-handle"), 120, 760, 90);
      }));

      await prepareScene(page, count);
      results.push(await collectMetrics(page, "theme-background-switch", count, async () => {
        await page.locator(".background-tone-trigger").click({ force: true, timeout: 5000 });
        await page.locator('.background-photo-option[data-background-tone="photo-earth"]').click({ force: true, timeout: 5000 });
        await page.waitForTimeout(120);
        await page.locator(".background-tone-trigger").click({ force: true, timeout: 5000 });
        await page.locator('.background-tone-option[data-background-tone="dark-steel"]').click({ force: true, timeout: 5000 });
      }));

      await prepareScene(page, count);
      const multiPanel = await openTools(page, '.panel-layout > .db-panel[data-panel-key="builder-content"]');
      await page.keyboard.down("Shift");
      await page.locator('.panel-layout > .db-panel[data-panel-key="builder-notes"]').click({ force: true });
      await page.keyboard.up("Shift");
      results.push(await collectMetrics(page, "select-mode-multi-move", count, async () => {
        await pointerDrag(page, multiPanel.locator(".panel-move-handle"), -240, 200, 60);
      }));
    }
  } finally {
    await closeApp(app);
  }

  const payload = {
    schema_version: 1,
    captured_at: new Date().toISOString(),
    frame_budget_ms: FRAME_BUDGET_MS,
    long_task_budget_ms: LONG_TASK_MS,
    target_counts: TARGET_COUNTS,
    interactions: results,
    passed: results.every((item) => item.gate.p95_under_16_67ms && item.gate.no_long_tasks_over_50ms),
  };
  fs.mkdirSync(path.dirname(PERF_ARTIFACT), { recursive: true });
  fs.writeFileSync(PERF_ARTIFACT, JSON.stringify(payload, null, 2), "utf8");
});
