# Configurable Dashboard Builder

A local FastAPI app for creating and arranging dashboard panels and widgets from the browser. The app is intentionally context-neutral: it provides the dashboard shell, layout controls, shared glass material system, background selection, placeholders, and generic persistence without tying the UI to a specific product or data source.

## Features

- Configurable dashboard shell with the existing top bar, background selector, menus, popovers, and placeholder content
- Add panel and add widget controls
- Move, resize, pin, rename, recolor, collapse, and delete controls
- Select mode for choosing and moving multiple panels or widgets
- Smooth live ghosts, snapped footprints, grid snapping, collision handling, edge auto-scroll, and reflow animation
- Layout save/load slots, reset to default, draft edits, and undo
- Generic search/filter shell across visible dashboard content
- SQLite tables for neutral dashboard, panel, widget, and layout profile records
- Generic JSON API endpoints for dashboard state and persistence

## Product Direction

The project is evolving from a configurable dashboard into a continuous spatial workspace. The long-term model is tabless: users should remain inside one large dashboard surface and navigate through spatial context, anchors, grouping, and saved regions rather than switching between conventional tabs or pages.

Current architectural principles:

- Panels are generic layout containers, not inherent content types.
- Tables, notes, menus, charts, calendars, filters, and dense controls should be modeled as widgets or future panel content.
- Movement and resizing should feel spatial, pointer-continuous, and visually reversible.
- Snapping should assist placement without making live motion feel rigid.
- Grouped objects should behave as composite spatial objects during drag, resize, preview, collision, and commit.
- Temporary layout pressure from drag, resize, expansion, and edge-scroll previews must remain separate from committed layout state.
- Dense widgets should prefer adaptive density before increasing their minimum grid footprint.
- There is one shared layered glass material system; background tones only change the workspace environment behind it.

## Roadmap

The upcoming work is intentionally staged around stabilization first, then larger architecture. See `docs/pre-overhaul-stabilization-roadmap.md` for the detailed pre-overhaul checklist.

### Current Progress

- Spatial anchors now live on a left-side viewport rail with dedicated anchor ordering, persistence, undo/redo, divider linking, and live divider navigation.
- Widgets can be intentionally absorbed into open panels, where they become panel children with scoped internal grid state, save/load, and undo/redo support.
- Workspace context now resolves through source-agnostic data-source adapters, semantic mappings, inherited divider regions, and normalized context queries.
- Widget rendering now uses `app/static/widget-registry.js`, so stat, timeframe, search, table, chart, stat-filter, and calendar widgets declare runtime contracts outside core grid interaction code.
- Context visualization is hidden in normal mode and is revealed through Engineer Mode, keeping the default workspace clean while preserving internal context inheritance.
- Large-workspace performance now separates layout correctness from visual cost with viewport-aware reflow animation, pseudo-LOD material tiers, row-bucketed collision queries, cached logical geometry records, and reduced DOM reads on committed geometry.
- Smart object insertion now treats the top/default workspace area as a first-class visible divider region, keeps repeated adds deterministic, and places new objects in the region the user is actually viewing.
- Newly added widget cards remain in-app workspace objects when clicked, so link-backed placeholder content no longer reloads away unsaved additions.
- Top-edge drag auto-scroll now brakes smoothly near the fixed navbar and workspace top while preserving the existing bottom-edge runway behavior.
- Engineer Mode now includes an optional right-side mini-map overlay rendered from committed workspace geometry, and Region Summary is available as a normal spatial-awareness widget.
- Image, Video, and PDF / Document are now registry-backed rich content widgets with safe URL/reference previews, captions, resize-aware containment, save/load persistence, and normal workspace/panel behavior.
- Activity Feed, AI Assistant placeholder, and Engineer-gated Context Inspector widgets are now registry-backed workspace meta widgets that consume resolved workspace/context state without dashboard-renderer special cases.
- Workspace infrastructure now includes centralized query lifecycle/caching, schema-driven widget settings, asset references for rich media, adaptive density tiers, a structured workspace event bus, and centralized Engineer Mode diagnostics for context, layout, ownership, cache, event, and LOD visibility.
- Viewport-aware pseudo-LOD is now centralized around shared visual tiers and overscan rules, with focused/selected/dragged/resized objects promoted to full fidelity, anchor rail objects classified separately, and far-offscreen hover/material effects reduced without changing layout correctness.
- Engineer Mode now exposes a persisted relationship graph with subtle spatial links for context, filter, query, containment, semantic, operator, and conditional-style relationships. Foundational AND/OR/NOT logical operator nodes and StyleRule nodes are hidden from normal mode, while normal widgets still apply the computed visual results.

### Near-Term Stabilization

- Keep drag, resize, collision, snapping, ghost previews, pinning, collapse, undo, and save/load deterministic under repeated interaction.
- Continue tightening edge auto-scroll so newly reachable grid rows remain smooth, preview-accurate, and commit-safe.
- Preserve local collision behavior and avoid global repacking during add, drag, resize, expand, collapse, and grouped operations.
- Strengthen Playwright coverage for visual cleanup, stale interaction classes, save/reload persistence, grouped behavior, and compact widget sizing.
- Keep controls, panels, widgets, menus, and selection surfaces routed through one coherent glass material hierarchy across every background tone.

### Spatial Navigation And Context

- Floating Spatial Anchors: viewport-fixed controls that act as spatial bookmarks into dashboard regions, panels, groups, widgets, or saved viewports.
- Context Dividers: elegant horizontal glass boundaries that define ambient dashboard zones without becoming normal panels.
- Context Inheritance: widgets, panels, groups, anchors, and future controls inherit local spatial context before falling back to global workspace context.
- Tabless Navigation: the navbar should stay minimal and should not become the primary navigation model; future navigation should scroll or focus the continuous workspace.
- Saved Viewports And Workspace States: named spatial positions, density arrangements, and context-aware snapshots that help users return to meaningful regions.

### Future Interaction Systems

- Composite group interactions with shared visual language, local collision, proportional resize, and stable member relationships.
- Region-aware placement that understands context zones without scrambling unrelated dashboard items.
- Richer undo/redo transaction boundaries for committed dashboard actions while excluding live previews and transient surfaces.
- Hidden computational easter eggs may eventually emerge from the real logic, context, event, conditional-style, and spatial computation systems. Examples could include tiny simulations, reactive pixel grids, signal-flow experiments, or redstone-like visual logic behaviors, but these should remain optional Engineer/experimental configurations rather than primary product features.
- Compact Workspace Mode as a separate constrained-viewport interaction contract, with single-column layout behavior, collapsed workspace chrome, simplified interactions, compressed anchor rail/drawer behavior, responsive density scaling, and progressive disclosure. This is intentionally not desktop scaled down.
- Accessibility-first keyboard support for anchors, groups, dividers, panels, widgets, and major dashboard commands.
- Reduced-motion equivalents for cinematic scroll, drag, resize, collapse, and anchor navigation.

### Future Widget And Panel Architecture

- Widget-inside-panel support, with panels remaining generic containers.
- Table, notes, menu, chart, calendar, search, filter, timeframe, and control widgets as composable content types.
- Adaptive-density sizing rules for dense information and control widgets.
- Semantic panel relationships and contextual grouping without encoding content type into panel identity.
- Future widget marketplace or registry concepts, if needed, should remain context-neutral and data-source neutral.

### Performance And Scale

- Measure pointermove hot paths, DOM reads/writes, collision cost, reflow cost, paint cost, and save/load serialization before optimizing.
- Batch live interaction writes through requestAnimationFrame where practical.
- Keep live visual transforms separate from committed grid layout writes.
- Limit collision/reflow work to affected local regions where possible.
- Explore virtualization or partial rendering only after the dashboard can exceed current practical DOM limits.
- Keep Playwright tests meaningful while using targeted slices during development and full-suite runs before completion.

### Non-Goals For Now

- No conventional tab/page architecture for primary navigation.
- No frontend-only authentication, sharing, or permissions.
- No product-specific monitoring, security, vendor, incident, ranking, or notification concepts.
- No fake widget insertion inside panels until nested widget behavior is implemented for real.
- No global auto-pack behavior that silently rewrites intentional dashboard space.
- No compact/mobile workspace mode until desktop interaction laws, panel containment, context inheritance, widget runtime architecture, and performance systems are stable.
- No separate toy/simulation engine for hidden easter eggs; playful computational behavior should reuse the real workspace logic/event/context infrastructure if it is ever explored.

## Routes

- `GET /`
- `GET /dashboard`
- `GET /settings`
- `POST /settings`
- `GET /api/dashboard`
- `GET /api/dashboard/layout`
- `POST /api/dashboard/layout`
- `GET /api/dashboard/widgets`
- `POST /api/dashboard/widgets`
- `GET /api/dashboard/panels`
- `POST /api/dashboard/panels`
- `GET /api/dashboard/profiles`

## Project Layout

- `app/main.py` starts FastAPI, mounts static assets, and registers generic routes.
- `app/models.py` defines neutral `Dashboard`, `Panel`, `Widget`, `LayoutProfile`, `WidgetType`, and `MenuItem` models.
- `app/database.py` creates the SQLite schema.
- `app/storage.py` stores dashboard metadata, panels, widgets, and layout profiles.
- `app/routes/dashboard.py` renders the dashboard builder.
- `app/routes/settings.py` renders simple dashboard settings.
- `app/routes/api.py` exposes generic dashboard APIs.
- `app/templates/` contains the generic shell, dashboard, and settings pages.
- `app/static/app.js` contains the protected dashboard interaction system.
- `app/static/widget-registry.js` contains registry-backed widget runtime definitions and renderers.
- `app/static/style.css` is an import manifest for the split CSS architecture.
- `app/static/tokens.css`, `base.css`, `layout.css`, `components.css`, `dashboard-grid.css`, `themes.css`, and `utilities.css` contain the preserved visual system.
- `AGENTS.md` defines mandatory guardrails for AI agents and contributors.
- `docs/engineering-guidelines.md` documents architecture and interaction rules.
- `docs/bug-report.md` tracks discovered interaction and polish bugs.
- `tests/test_dashboard_builder_e2e.py` covers browser-level dashboard behavior.

## Setup

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m playwright install chromium
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Then open `http://127.0.0.1:8000`.

On Windows, `start.bat` starts the same local server after dependencies are installed.

## Tests

Run the browser-based dashboard builder suite with:

```powershell
.venv\Scripts\python.exe -m pytest
```

Playwright traces, screenshots, and videos for failed tests are written under `test-results/`.

## Contributor And Agent Guardrails

This project is interaction-heavy. Future changes should preserve the existing Apple-style dashboard feel and must not accidentally reintroduce product-specific monitoring/security concepts.

Before changing dashboard behavior, read:

- `AGENTS.md`
- `docs/engineering-guidelines.md`
- `docs/drag-resize-audit.md`
- `docs/bug-report.md`
- `docs/performance-stabilization-plan.md`
- `docs/pre-overhaul-stabilization-roadmap.md`
- `docs/architecture/README.md`
- `docs/spatial-anchors.md`
- `docs/context-divider-architecture.md`

Protected behaviors include:

- shared widget/panel grid occupancy
- sparse intentional placement
- pinned-item protection
- reversible drag collision previews
- resize snapping
- ghost preview alignment
- layout save/load/reset
- background tone and shared material hover polish
- menu, popover, icon, and control alignment

Do not modify drag, resize, snapping, collision, pinning, material/background polish, or layout persistence without updating Playwright coverage and running the test suite.

## Configuration

Optional environment values are shown in `.env.example`.

```env
APP_DATABASE_PATH=./data/dashboard_builder.db
APP_LOG_PATH=./logs/app.log
```

## Notes

The default dashboard is deliberately sparse. It includes placeholder widgets and generic panel containers so the builder interactions are immediately testable without shipping product-specific data. Panels are layout containers; table, menu, notes, chart, and calendar experiences should be modeled as widgets or panel content rather than inherent panel types.
