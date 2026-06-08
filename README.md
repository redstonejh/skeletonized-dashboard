# Skeletonized Dashboard

A lean, native **Electron** dashboard customization GUI: pure HTML/CSS/JS, no backend.

The app provides Apple-style draggable and resizable panels and widgets with grid snapping, collision/reflow, live ghosts, derived color and photo backgrounds, one always-on liquid-glass WebGL material for dashboard objects and window/control-bar chrome, per-object recolor/rename/pin/collapse/delete, layout save/load/reset, and undo.

## Provenance

This repository was skeletonized from `configurable-dashboard-gui` into an Electron-only visual customization app.

Removed from that lineage: the Python/server backend, advanced legacy analysis surfaces, legacy relationship editing systems, old query/setup shells, settings pages, and all server routes. What remains is the interactive dashboard builder surface and its visual system.

## Persistence

Persistence is handled by the Electron preload bridge, not by a server.

`main.js` creates the Electron window with `contextIsolation: true` and `nodeIntegration: false`. `preload.js` exposes `window.dashboardPersistence`, which stores layout data in a JSON file under the user's home directory. Renderer code in `app/static/layout-persistence.js` uses that bridge when available and falls back to browser storage when it is not.

Workspace tabs are kept as one live renderer state. The active tab is mounted in the single dashboard grid, inactive tabs are parked as detached DOM nodes in memory, and the combined tab/page store is written through the existing persistence bridge on a debounce and before unload.
After a workspace page is mounted or restored, the combined widget/panel grid is reconciled through the shared occupancy model once the grid is measurable, preserving valid sparse positions while resolving actual overlaps.

## Text Editing

Visible dashboard names and text surfaces edit in place on the displayed text element. Tabs, panels, widget titles, and note bodies share the inline editing appearance instead of opening separate title inputs or boxed editors; tab tool menus close through the same outside-click, Escape, and edit-finish dismissal path.

## Widget Wells

Widgets with an imported/rendered visual well use a separated color model: the widget theme accent drives data marks/accent content and the object rim, while the shared well surface has a two-option white/dark-grey tone whose neutral foreground is derived for readability.
Well-backed widgets expose those well tones first in the shared color menu, followed by the normal theme accent palette.
Interacting inside a well is treated as inner-content interaction, so it does not trigger the parent widget hover/press lift; well surfaces use the shared rim sizing across widget types.
The timeframe control writes one client-side page-level active range; visualization widgets receive that shared range through the common widget display state and scope their data through the shared render path.

## Project Layout

- `main.js` - Electron main process and window creation.
- `preload.js` - isolated persistence bridge exposed to the renderer.
- `index.html` - renderer entry document; loads `./app/static/app.js` as an ES module.
- `package.json` - npm scripts and Electron/Playwright development dependencies.
- `package-lock.json` - locked npm dependency tree.
- `playwright.config.js` - Playwright configuration for Electron tests.
- `.env.example` - notes that no runtime environment variables are required.
- `AGENTS.md` - contributor and agent guardrails for preserving interaction behavior.
- `app/static/` - renderer CSS and JavaScript runtime.
- `app/static/app.js` - renderer composition root for the dashboard interaction system.
- `app/static/modules/` - ES modules for background controls, layout history, object actions, drag/resize helpers, persistence wiring, panel/widget runtime pieces, and related UI behavior.
- `app/static/style.css` - CSS import entry for the visual system.
- `app/static/tokens.css`, `app/static/base.css`, `app/static/layout.css`, `app/static/components.css`, `app/static/dashboard-grid.css`, `app/static/themes.css`, and `app/static/utilities.css` - preserved visual styling.
- `app/static/backgrounds/` - photo background assets used by the background selector.
- `electron-tests/` - Playwright end-to-end coverage for the Electron app.
- `artifacts/` - salvage audit evidence retained with the repo.
- `test-results/` - Playwright output from local test runs.

## Setup

Install dependencies:

```powershell
npm install
```

Run the app:

```powershell
npm start
```

## Tests

Run the Electron end-to-end suite:

```powershell
npm run test:e2e
```

The test suite launches Electron with `MAW_HEADLESS=1`, verifies the dashboard boots without a backend, preserves core customization behavior, and keeps drag/resize handlers connected. Normal `npm start` launches remain visible because the flag is not set.

## Contributor Guardrails

This app is interaction-heavy. Preserve the existing visual language and interaction feel unless a change explicitly asks for a redesign.

Before changing behavior, read:

- `AGENTS.md`
- `electron-tests/dashboard-electron.spec.js`
- `artifacts/interdependency-dossier.md`
- `artifacts/maw-dependencies.md`

Protected behavior includes:

- panel and widget add/move/resize controls
- grid snapping and sparse placement
- collision handling and reflow animation
- live ghost and resize preview alignment
- pinned-item protection
- grouped selection and multi-object movement
- no auto-scroll during drag/resize edge contact; normal page scrolling remains available
- viewport-row floor enforcement applies to manual drag placement; resize reflow may extend the layout below the viewport
- panel containment behavior
- per-object rename, recolor, pin, collapse, and delete controls
- layout save/load/reset and undo
- derived custom-color backgrounds, photo backgrounds, and the unified always-on liquid-glass material for workspace objects and window/control-bar chrome

For behavior changes, update or add Playwright coverage and run:

```powershell
npm run test:e2e
```

## Runtime Notes

- The app loads from local files through Electron.
- There is no backend process to start.
- There are no server routes.
- Persistent layout data is stored through the preload bridge.
- Visual CSS is intentionally large because it preserves the migrated dashboard material system.
