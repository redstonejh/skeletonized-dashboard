const { test, expect, _electron: electron } = require("@playwright/test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const TARGET_COUNTS = (process.env.PERF_OBJECT_COUNTS || "30,100")
  .split(",")
  .map((value) => Number.parseInt(value.trim(), 10))
  .filter((value) => Number.isFinite(value) && value > 0);

const PERF_ARTIFACT = process.env.PERF_ARTIFACT || path.join(__dirname, "..", "artifacts", "perf-theme-baseline.json");
const PROFILE_ARTIFACT = process.env.PERF_PROFILE_ARTIFACT || "";
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
  }, targetCount);
  await page.waitForTimeout(250);
}

async function installFrameProbe(page) {
  await page.evaluate(() => {
    window.__dashboardPerfProbe = {
      frameDeltas: [],
      longTasks: [],
      marks: [],
      running: false,
      rafId: 0,
      lastFrame: 0,
      reset() {
        this.frameDeltas = [];
        this.longTasks = [];
        this.marks = [];
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
      mark(name) {
        this.marks.push({ name, time: performance.now() });
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

async function startTracing(page) {
  const client = await page.context().newCDPSession(page);
  await client.send("Tracing.start", {
    categories: [
      "devtools.timeline",
      "disabled-by-default-devtools.timeline",
      "blink",
      "cc",
      "toplevel",
      "v8",
    ].join(","),
    transferMode: "ReturnAsStream",
  });
  return client;
}

async function stopTracing(client) {
  let stream = null;
  client.on("Tracing.tracingComplete", (event) => {
    stream = event.stream;
  });
  await client.send("Tracing.end");
  const deadline = Date.now() + 10000;
  while (!stream && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
  if (!stream) return null;
  let traceText = "";
  for (;;) {
    const chunk = await client.send("IO.read", { handle: stream });
    traceText += chunk.data || "";
    if (chunk.eof) break;
  }
  await client.send("IO.close", { handle: stream });
  return JSON.parse(traceText);
}

function summarizeTrace(trace) {
  const events = Array.isArray(trace?.traceEvents) ? trace.traceEvents : [];
  const names = {
    scripting: new Set(["FunctionCall", "EvaluateScript", "EventDispatch", "TimerFire", "RunTask", "V8.Execute"]),
    style: new Set(["RecalculateStyles", "UpdateLayoutTree", "ScheduleStyleRecalculation"]),
    layout: new Set(["Layout", "UpdateLayerTree"]),
    paint: new Set(["Paint", "PrePaint", "CompositeLayers", "RasterTask", "GPUTask", "DrawFrame"]),
  };
  const totals = { scripting_ms: 0, style_ms: 0, layout_ms: 0, paint_composite_ms: 0, other_timeline_ms: 0 };
  const top_events = [];
  for (const event of events) {
    if (event.ph !== "X" || !Number.isFinite(event.dur)) continue;
    const ms = event.dur / 1000;
    const name = String(event.name || "");
    if (names.scripting.has(name)) totals.scripting_ms += ms;
    else if (names.style.has(name)) totals.style_ms += ms;
    else if (names.layout.has(name)) totals.layout_ms += ms;
    else if (names.paint.has(name)) totals.paint_composite_ms += ms;
    else if (event.cat && String(event.cat).includes("devtools.timeline")) totals.other_timeline_ms += ms;
    if (ms >= 5) top_events.push({ name, cat: event.cat || "", duration_ms: Number(ms.toFixed(2)) });
  }
  top_events.sort((a, b) => b.duration_ms - a.duration_ms);
  for (const key of Object.keys(totals)) totals[key] = Number(totals[key].toFixed(2));
  return { breakdown: totals, top_events: top_events.slice(0, 25) };
}

async function collectThemeSwitchMetrics(page, objectCount, profile = false) {
  await installFrameProbe(page);
  await page.waitForFunction(() => {
    if (!window.__dashboardBackgroundPreloadReady?.then) return true;
    if (window.__dashboardBackgroundPreloadDone) return true;
    window.__dashboardBackgroundPreloadReady.finally(() => {
      window.__dashboardBackgroundPreloadDone = true;
    });
    return false;
  }, null, { timeout: 10000 }).catch(() => null);
  let traceClient = null;
  await page.evaluate(() => window.__dashboardPerfProbe.start());
  if (profile) traceClient = await startTracing(page);
  const started = Date.now();
  await page.locator(".background-tone-trigger").click({ force: true, timeout: 5000 });
  await page.evaluate(() => window.__dashboardPerfProbe.mark("menu-opened"));
  await page.locator('.background-photo-option[data-background-tone="photo-earth"]').click({ force: true, timeout: 5000 });
  await page.evaluate(() => window.__dashboardPerfProbe.mark("photo-earth-clicked"));
  await page.waitForTimeout(120);
  await page.locator(".background-tone-trigger").click({ force: true, timeout: 5000 });
  await page.locator('.background-tone-option[data-background-tone="dark-steel"]').click({ force: true, timeout: 5000 });
  await page.evaluate(() => window.__dashboardPerfProbe.mark("dark-steel-clicked"));
  await page.waitForTimeout(450);
  const trace = traceClient ? await stopTracing(traceClient) : null;
  const raw = await page.evaluate(() => {
    window.__dashboardPerfProbe.stop();
    return {
      frames: window.__dashboardPerfProbe.frameDeltas,
      longTasks: window.__dashboardPerfProbe.longTasks,
      marks: window.__dashboardPerfProbe.marks,
      domNodes: document.querySelectorAll("*").length,
      background: document.documentElement.dataset.background,
      hasPhoto: document.body.classList.contains("has-photo-background"),
    };
  });
  const frames = raw.frames.filter((value) => Number.isFinite(value) && value > 0);
  const longTasksOverBudget = raw.longTasks.filter((task) => task.duration > LONG_TASK_MS);
  const metric = {
    name: "theme-background-switch",
    object_count: objectCount,
    duration_ms: Date.now() - started,
    frame_count: frames.length,
    p50_frame_ms: percentile(frames, 50),
    p95_frame_ms: percentile(frames, 95),
    p99_frame_ms: percentile(frames, 99),
    max_frame_ms: Number((frames.length ? Math.max(...frames) : 0).toFixed(2)),
    dropped_frame_count: frames.filter((value) => value > FRAME_BUDGET_MS).length,
    long_task_count: longTasksOverBudget.length,
    long_tasks: longTasksOverBudget.map((task) => ({
      start_ms: Number(task.startTime.toFixed(2)),
      duration_ms: Number(task.duration.toFixed(2)),
      name: task.name,
    })),
    marks: raw.marks,
    dom_nodes: raw.domNodes,
    final_background: raw.background,
    final_has_photo: raw.hasPhoto,
    gate: {
      p95_under_16_67ms: percentile(frames, 95) <= FRAME_BUDGET_MS,
      no_long_tasks_over_50ms: longTasksOverBudget.length === 0,
    },
  };
  return { metric, profile: trace ? summarizeTrace(trace) : null };
}

test("theme background switch focused perf", async () => {
  test.setTimeout(120000);
  const { app, page } = await launchApp();
  const interactions = [];
  let profile = null;
  try {
    for (const count of TARGET_COUNTS) {
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await page.waitForSelector(".dashboard-layout-grid", { timeout: 10000 });
      await seedScene(page, count);
      const result = await collectThemeSwitchMetrics(page, count, Boolean(PROFILE_ARTIFACT) && count === 100);
      interactions.push(result.metric);
      if (result.profile) profile = result.profile;
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
    interactions,
    passed: interactions.every((item) => item.gate.p95_under_16_67ms && item.gate.no_long_tasks_over_50ms),
  };
  fs.mkdirSync(path.dirname(PERF_ARTIFACT), { recursive: true });
  fs.writeFileSync(PERF_ARTIFACT, JSON.stringify(payload, null, 2), "utf8");
  if (PROFILE_ARTIFACT && profile) {
    fs.mkdirSync(path.dirname(PROFILE_ARTIFACT), { recursive: true });
    fs.writeFileSync(PROFILE_ARTIFACT, JSON.stringify({ schema_version: 1, captured_at: new Date().toISOString(), ...profile }, null, 2), "utf8");
  }
  expect(interactions.length).toBe(TARGET_COUNTS.length);
});
