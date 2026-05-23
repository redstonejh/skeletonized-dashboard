# Drag And Resize Audit

This note documents the dashboard movement system before the ordered-slot rebuild.

## Current Files

- `app/static/app.js`: owns pointer tracking, grid math, placeholder creation, collision handling, reflow animation, resize preview, and layout persistence.
- `app/static/dashboard-grid.css`: owns visual drag/resize states, placeholders, fixed-position drag ghosts, transition disabling during interaction, snapping transitions, z-index, and resize handles.
- `tests/test_dashboard_builder_e2e.py`: covers drag ghost creation, grid alignment, overlap checks, resize span changes, layout save/load/reset, mobile overflow, console errors, and network errors.

## Current Function Groups

- Grid primitives: `gridHostForLayout`, `gridRectForLayout`, `gridGapForLayout`, `gridHeightForRows`, `gridRowsFromHeight`, `gridItemRowSpan`, `gridItemSpan`, `applyPanelGridPosition`, `applyWidgetGridPosition`.
- Legacy pointer-to-grid helpers: `gridCellFromPoint`, `panelGridCellFromPoint`, `widgetGridCellFromPoint`.
- Legacy reflow animation: `animatePanelReflow`, `animateWidgetReflow`.
- Legacy collision/reflow: `snapshotGridLayout`, `restoreGridLayoutSnapshot`, `gridBoundsForItem`, `gridBoundsOverlap`, `nextGridSlot`, `localCollisionItems`, `applyLocalCollisionLayout`, `normalizeGridLayout`.
- Widget movement: `initWidget` pointer handlers for `.panel-move-handle` and `.panel-resize-handle`.
- Panel movement: `initPanel` pointer handlers for `.panel-move-handle` and `.panel-resize-handle`.

## Problems To Remove

- Drag and resize handlers duplicate nearly identical panel/widget logic.
- Placeholder movement is cell/collision based instead of ordered-list based.
- `applyLocalCollisionLayout` lets each neighboring item negotiate its own slot, which can create jitter, overlap risk, and non-deterministic feeling reflow.
- Pointer tracking, layout calculation, preview rendering, and drop commit are interleaved inside each handler.
- Resize previews mutate layout and collision state on every pointer move with competing animation paths.
- Several timing cleanups exist to paper over event-order issues around drag, resize, and snapping.

## Replacement Direction

- Centralize ordered grid packing and use it for drag previews, resize previews, final commits, and collision cleanup.
- Treat widgets and panels as ordered lists within their existing layout groups while preserving the shared six-column dashboard grid.
- Use placeholders for preview state and fixed positioning only for the actively dragged item.
- Animate surrounding items with transform-based FLIP reflow.
- Commit DOM order, grid position, size, and persistence only when drag/resize ends.
- Keep existing class names, CSS states, placeholders, z-index tokens, shadows, radius, spacing, and menu behavior.

## Implemented Replacement

- Added `packOrderedGridItems`, `applyOrderedGridLayout`, `animateOrderedGridReflow`, `orderedInsertionIndexFromPoint`, and `runOrderedDrag`.
- Replaced duplicated widget/panel drag handlers with the shared ordered drag runner.
- Replaced widget/panel resize preview and commit paths with ordered layout reflow.
- Routed the legacy collision entry point through ordered packing so collapse/expand callers use the same deterministic movement model.
- Expanded layout snapshots to include span and saved-height state for reversible resize previews.
- Added regression coverage for ordered widget drag and snapped panel resize persistence.
