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
- Added a shared resize lifecycle guard for widget, panel, and group resize entry points. It owns document-level pointer listeners, pointer capture, Escape/window-blur cancellation, and final cleanup so resize previews, live clones, body interaction classes, and source classes cannot remain stale after pointercancel or interrupted resize.
- Brought group resize onto the same live-preview architecture as individual resize: selected members render fixed live clones during pointer movement, snapped placeholders represent the grid footprint/collision source, original members stay hidden and unmutated until commit, and collapsed selected panels keep an expanded-footprint ghost.
- Refined group drag and resize to use a composite group footprint for collision/reflow while member live surfaces preserve exact relative spacing. Group footprints use directional sparse resolution so surrounding items move after the composite object instead of jumping upward into the group path.
- Refined grouped geometry so resize scales member width/height from the composite bounds without scaling each member's row/top offset. Group drag cell targeting now uses the composite placeholder dimensions, which allows a selected group to target the first valid dashboard row instead of being displaced by the active item's smaller source dimensions.
- Unified grouped visual state styling with a shared group boundary surface for active move and resize. This is visual-only: it expands the boundary by the selected outline outset and keeps resize clone outlines in the selected-state language without changing collision, snap, placement, or commit math.
- Added resize-aware auto-zoom camera assistance for direct widget/panel resize. It applies a temporary visual camera scale to the shared dashboard scene while matching body-fixed live resize surfaces to that same camera transform, keeps grid/collision/save geometry unchanged, normalizes resize pointer deltas through the inverse camera scale, and clears with the shared resize lifecycle cleanup.
- Scoped release-time resize alignment to the active layout domain. Panel-contained widgets now align only against siblings in the same panel-local grid instead of consulting unrelated global workspace objects.
- Refined local collision displacement so the first downward move is based on the blocking/incoming footprint rather than the displaced object's full height. A 1-row object entering a panel now pushes a larger panel child down by the minimal row clearance needed instead of by the child's own height.
- Added surface-drag shortcuts for widgets, panels/dividers, and anchors while preserving the explicit Move controls. Surface starts now defer event consumption until the shared drag threshold is crossed, so ordinary widget body clicks still open workbenches and child controls remain excluded from drag initiation.
- Expand/collapse now separates the committed layout baseline from temporary accordion displacement. The first panel expansion in a session captures a layout-level baseline; each collapse locally relaxes only displaced items upward toward that baseline when cells are free, avoiding both stranded pushdown gaps and global auto-packing.
- Pinned objects remain locked against direct user drag/resize and direct collision displacement, but panel expand/collapse treats them as temporary pressure participants. Their baseline coordinates are captured with the same expansion snapshot and restored on collapse, including after save/load of an open panel.
