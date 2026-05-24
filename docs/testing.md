# Testing

## Purpose

Testing protects the dashboard's interaction feel, visual consistency, layout persistence, and context behavior. Functional tests must exercise the app like a user and record failures with screenshots, videos, or traces when available.

## Current Command

Run the full test suite:

```powershell
.venv\Scripts\python.exe -m pytest -q
```

Use the non-quiet form when investigating failures:

```powershell
.venv\Scripts\python.exe -m pytest
```

For runtime profiling of the browser suite:

```powershell
.venv\Scripts\python.exe -m pytest tests\test_dashboard_builder_e2e.py -q --durations=10
```

During development, prefer targeted slices before the final full suite:

```powershell
.venv\Scripts\python.exe -m pytest tests\test_dashboard_builder_e2e.py -q -k "resize"
.venv\Scripts\python.exe -m pytest tests\test_dashboard_builder_e2e.py -q -k "group or drag"
```

## Browser Test Expectations

Playwright tests should cover:

- App load
- Dashboard load
- Settings load
- Console errors
- Network errors
- CSS import failures
- Background selection persistence
- Shared material consistency across light and deep background tones
- At least two background presets
- Mobile viewport behavior

On failure, tests should preserve useful artifacts:

- Screenshot
- Trace
- Video when practical
- Relevant console and network output

## Layout Coverage

Required for each universal dashboard object:

- Create
- Drag
- Resize when capability allows it
- Pin/unpin
- Rename when capability allows it
- Recolor or background/material behavior
- Delete/hide when capability allows it
- Save layout
- Load layout
- Reset/default layout
- Reload persistence

## Panel Coverage

- Add panel.
- Future: add widgets inside panel once nested widget behavior exists.
- Collapse and expand.
- Resize panel.
- Minimum-size panel does not grow when menu opens.
- Placeholder/content area stays aligned to panel body after resize.
- Future: panel context is inherited by children.
- Future: header context pill attachment works.
- Future: removing header context clears inherited context.

## Context Coverage

- Stat click filters table.
- Stat click filters graph.
- Clear filter restores table and graph.
- Panel context affects child widgets.
- Sibling widgets consume context inside a panel when configured.
- Wired context affects downstream widgets.
- Deleting a link removes wired inherited context.
- Collapse state does not break context propagation.

## Data Source And Query Coverage

- Data source definitions use neutral labels and no domain assumptions.
- Dataset/query selection persists.
- Widget field mappings persist.
- Stat aggregations work for count, sum, average, min, max, and distinct count.
- Table filtering, sorting, grouping, pagination, and selected columns work.
- Graph x-axis, y-axis, series grouping, aggregation, and timeframe bindings work.
- Computed fields validate safely and fail without breaking layout.
- Context filters update data-bound stat, graph, table, calendar, and panel widgets.
- Query errors show generic recoverable UI states.
- No credentials or secrets appear in browser-visible payloads.

## Engineer Mode Coverage

- Toggle on/off.
- Connection handles show and hide.
- Create link.
- Select link.
- Delete link.
- Link persists after reload.
- Normal mode hides wiring visuals but keeps links active.
- Link paths update after drag, resize, collapse, and viewport resize.

## Future Spatial Workspace Coverage

When the canvas gains pan/zoom behavior, tests must cover:

- Pan preserves grid alignment.
- Zoom preserves grid alignment.
- Drag, resize, ghost previews, and drop commits work at supported zoom levels.
- Menus and popovers position correctly after pan and zoom.
- Context inheritance indicators remain visible and meaningful at overview and detail zoom levels.
- Engineer Mode handles and links remain attached to sources and targets.
- Region collapse/expand does not corrupt layout or context propagation.
- Primary navigation does not require tabs.

## Visual Regression Coverage

Capture screenshots for:

- Dashboard on the default background
- Dashboard on a deep background
- At least two background presets
- Top toolbar
- Timeframe command surface
- Settings page and forms
- Dropdowns, popovers, and dialog surfaces
- Multiple workspace background presets
- Panel hover/focus state
- Widget hover/focus state
- Panel/widget menu parity across background tones
- Engineer Mode wiring
- Mobile viewport

Visual inconsistency counts as a bug and must be logged in `docs/bug-report.md`.

## Manual Browser Inspection For Visual UI Work

Automated tests and screenshots do not replace manual browser inspection for visual/UI changes.

For any visual, styling, layout, animation, hover/focus, background, glass-material, navbar, widget, panel, menu, or interaction-feel change, follow `docs/visual-ui-manual-inspection.md` before calling the work complete.

The final response for visual/UI work must include a `Manual browser inspection` section that records the page/workspace opened, elements inspected, states tested, backgrounds checked, visual result, and any remaining concerns.

This is an added requirement. Keep the existing Playwright, screenshot, trace, and full-suite validation requirements in place.

## Performance Coverage

Interaction performance is part of the dashboard UX contract. The dashboard should remain fluid without weakening protected drag, resize, collision, group, expand/collapse, or persistence behavior.

Performance work should:

- Measure first.
- Preserve the live ghost plus snapped footprint model.
- Avoid saving or serializing layout during pointermove.
- Avoid duplicate drag/resize systems.
- Avoid broad full-dashboard recomputation when a local operation is intended.
- Verify cleanup after repeated interactions.
- Prefer stable cleanup and bounded-artifact tests before frame-budget assertions.

Useful regression checks:

- Repeated drag leaves no stale drag ghosts or active classes.
- Repeated resize leaves no `.dashboard-live-resize` or `.dashboard-resize-preview` nodes.
- Pointercancel cleanup removes source and body interaction classes.
- Group interactions remove group boundary/live surfaces after commit or cancel.
- Expand/collapse does not move unrelated items.

Avoid fragile CI checks based on absolute frame rate, exact paint cost, or exact DOM read counts unless they have proven stable across machines.

See `docs/performance-stabilization-plan.md` for the current audit baseline and stabilization sequence.

## Bug Reporting Process

For every discovered issue:

1. Add or update a Playwright test that reproduces it.
2. Record steps, expected behavior, actual behavior, suspected source, artifact paths, and status in `docs/bug-report.md`.
3. Fix only after the behavior is reproducible.
4. Re-run the related test and the full suite when practical.

## Implementation Plan

### Phase 1

- Maintain this testing contract.
- Keep existing tests passing before feature work begins.

### Phase 2

- Add tests for registry-backed widget creation and persistence.
- Verify no current layout behavior regresses.

### Phase 3

- Add context propagation and filtering tests.

### Phase 4

- Add Engineer Mode link tests and visual artifacts.

### Phase 5

- Add toolbar and command-surface visual screenshots.

### Phase 6

- Require all feature, regression, context, Engineer Mode, and visual tests before the next major version is considered stable.

### Future Data Layer

- Add adapter contract tests.
- Add local query-engine unit tests.
- Add browser tests for visual field mapping and data-bound widgets.
- Add security tests proving secrets are not exposed to the frontend.

### Future Spatial Workspace

- Add browser tests for camera state, pan/zoom transforms, spatial region navigation, mini-map or overview controls, context-focused camera moves, and Engineer Mode routing under zoom.
