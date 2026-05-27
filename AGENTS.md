# Agent Instructions

This repository is a generic configurable dashboard builder. The dashboard interaction system is visually sensitive and must be treated as protected application behavior.

## Non-Negotiable Rules

- Do not redesign the UI unless the user explicitly asks for a redesign.
- Preserve existing class names, templates, visual language, spacing, shadows, radius, colors, glass effects, transitions, and theme behavior.
- Do not add product-specific concepts, vendor names, monitoring/security language, sample incident data, background integrations, external notification flows, authentication-provider flows, ranking logic, or incident terminology.
- Do not change drag, resize, collision, snapping, ghost preview, pinning, or save/load behavior without adding or updating Playwright tests first.
- Do not implement authentication, sharing, or permissions as frontend-only behavior; future access control must be enforced server-side.
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

For visual, styling, layout, animation, hover/focus, theme, glass-material, navbar, widget, panel, menu, or interaction-feel changes, also follow `docs/visual-ui-manual-inspection.md` before calling the work complete.

Final responses for visual/UI work must include a `Manual browser inspection` section. If manual inspection cannot be performed, say why, list what was verified instead, and mark visual judgment as remaining risk.

If a test cannot be run, document why in the final response and in any related bug report entry.

**User override:** When the user's prompt contains any of the following — "no tests", "skip tests", "do not run tests", "don't validate", "no validation", "CSS-only", "visual-only", "I'll test manually", or any equivalent instruction to skip automated validation — do not run any test suite. Note the skip in the final response. Targeted single-test runs explicitly instructed by the user are still permitted.

## Documentation To Check

- `docs/engineering-guidelines.md`
- `docs/visual-ui-manual-inspection.md`
- `docs/bug-report.md`
- `docs/drag-resize-audit.md`
- `docs/css-audit.md`
- `docs/authentication-system.md`
- `docs/permissions-model.md`
- `docs/workspace-sharing.md`
- `docs/security-guidelines.md`

Update these when changing behavior, interaction mechanics, or architectural rules.
