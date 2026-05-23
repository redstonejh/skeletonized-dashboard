# Agent Instructions

This repository is a generic configurable dashboard builder. The dashboard interaction system is visually sensitive and must be treated as protected application behavior.

## Non-Negotiable Rules

- Do not redesign the UI unless the user explicitly asks for a redesign.
- Preserve existing class names, templates, visual language, spacing, shadows, radius, colors, glass effects, transitions, and theme behavior.
- Do not add product-specific concepts, vendor names, monitoring/security language, sample incident data, background integrations, external notification flows, authentication-provider flows, ranking logic, or incident terminology.
- Do not change drag, resize, collision, snapping, ghost preview, pinning, or save/load behavior without adding or updating Playwright tests first.
- Treat flicker, jitter, off-grid placement, sticky collision previews, overlap, clipping, text/icon misalignment, and dark-mode visual drift as bugs.
- Prefer focused fixes over broad rewrites. Read the current code before changing it.

## Protected Systems

- `app/static/app.js`: dashboard state, ordered/sparse grid placement, drag/resize mechanics, theme behavior, save/load slots, group mode, panel/widget controls.
- `app/static/dashboard-grid.css`: grid layout, widget/panel states, drag ghosts, resize handles, placeholders, interaction transitions.
- `app/static/themes.css`: light/dark theme polish and final visual overrides.
- `app/templates/dashboard.html`: dashboard shell and control markup.
- `tests/test_dashboard_builder_e2e.py`: browser regression suite for user-facing behavior.

## Drag And Resize Rules

- Widgets and panels share one dashboard occupancy map.
- Pinned items reserve their cells globally and must never be displaced by other interactions.
- Drag preview state must be reversible. Neighboring items may visually shift during preview, but only the actively dragged item commits on drop.
- Sparse placement is valid. Do not auto-pack intentional empty grid space during ordinary drag/resize.
- Use transforms/FLIP-style animation for movement previews and committed grid styles for settled layout.
- Keep committed layout, preview layout, and final drop result separate.

## Required Validation

Before committing user-facing changes, run:

```powershell
.venv\Scripts\python.exe -m pytest -q
```

If a test cannot be run, document why in the final response and in any related bug report entry.

## Documentation To Check

- `docs/engineering-guidelines.md`
- `docs/bug-report.md`
- `docs/drag-resize-audit.md`
- `docs/css-audit.md`

Update these when changing behavior, interaction mechanics, or architectural rules.
