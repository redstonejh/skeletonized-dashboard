# Configurable Dashboard Builder

A local FastAPI app for creating and arranging dashboard panels and widgets from the browser. The app is intentionally context-neutral: it provides the dashboard shell, layout controls, theme behavior, placeholders, and generic persistence without tying the UI to a specific product or data source.

## Features

- Configurable dashboard shell with the existing top bar, theme toggle, menus, popovers, and placeholder content
- Add panel and add widget controls
- Move, resize, pin, rename, recolor, collapse, and delete controls
- Group mode for selecting and moving multiple panels or widgets
- Ghost placement previews, grid snapping, collision handling, and reflow animation
- Layout save/load slots, reset to default, draft edits, and undo
- Generic search/filter shell across visible dashboard content
- SQLite tables for neutral dashboard, panel, widget, and layout profile records
- Generic JSON API endpoints for dashboard state and persistence

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

Protected behaviors include:

- shared widget/panel grid occupancy
- sparse intentional placement
- pinned-item protection
- reversible drag collision previews
- resize snapping
- ghost preview alignment
- layout save/load/reset
- theme and dark-mode hover polish
- menu, popover, icon, and control alignment

Do not modify drag, resize, snapping, collision, pinning, theme polish, or layout persistence without updating Playwright coverage and running the test suite.

## Configuration

Optional environment values are shown in `.env.example`.

```env
APP_DATABASE_PATH=./data/dashboard_builder.db
APP_LOG_PATH=./logs/app.log
```

## Notes

The default dashboard is deliberately sparse. It includes placeholder widgets, a table panel, a menu panel, and a notes panel so the builder interactions are immediately testable without shipping product-specific data.
