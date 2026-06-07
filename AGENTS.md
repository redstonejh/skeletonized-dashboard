# Agent Instructions

This repository is a native Electron dashboard customization GUI. It is pure HTML/CSS/JS and has no backend process.

## Non-Negotiable Rules

- Do not redesign the UI unless the user explicitly asks for a redesign.
- Preserve existing class names, visual language, spacing, shadows, radius, colors, glass effects, transitions, themes, and photo background behavior.
- Do not change drag, resize, collision, snapping, ghost preview, pinning, panel containment, layout save/load/reset, or undo behavior without updating Playwright coverage. Edge auto-scroll during drag/resize has been intentionally removed; preserve normal page scrolling.
- Treat flicker, jitter, off-grid placement, sticky collision previews, overlap, clipping, text/icon misalignment, and theme visual drift as bugs.
- Keep persistence routed through the Electron preload bridge or the existing renderer fallback; do not add a backend.
- Prefer focused fixes over broad rewrites. Read the current code before changing it.

## Protected Files

- `main.js`: Electron window setup and renderer security flags.
- `preload.js`: isolated persistence bridge.
- `index.html`: renderer entry markup.
- `app/static/app.js`: renderer composition root for dashboard interactions.
- `app/static/modules/`: ES-module interaction and runtime pieces.
- `app/static/dashboard-grid.css`: grid layout, widget/panel states, drag ghosts, resize handles, placeholders, and interaction transitions.
- `app/static/themes.css`: theme, photo background, and glass-material polish.
- `electron-tests/dashboard-electron.spec.js`: Electron end-to-end regression coverage.

## Drag And Resize Rules

- Widgets and panels share one dashboard occupancy map.
- Pinned items reserve their cells globally and must not be displaced by other interactions.
- Drag preview state must be reversible. Neighboring items may visually shift during preview, but only the actively dragged item commits on drop.
- Sparse placement is valid. Do not auto-pack intentional empty grid space during ordinary drag or resize.
- Use transforms or FLIP-style animation for movement previews and committed grid styles for settled layout.
- Keep committed layout, preview layout, and final drop result separate.

## Required Validation

Before committing user-facing behavior changes, run:

```powershell
npm run test:e2e
```

If a test cannot be run, document why in the final response.

**User override:** When the user's prompt contains any of the following - "no tests", "skip tests", "do not run tests", "don't validate", "no validation", "CSS-only", "visual-only", "I'll test manually", or an equivalent instruction to skip automated validation - do not run the test suite. Note the skip in the final response. Targeted single-test runs explicitly instructed by the user are still permitted.

## Documentation To Check

- `README.md`
- `artifacts/interdependency-dossier.md`

Update documentation when changing behavior, interaction mechanics, persistence, or architectural rules.
