# Bug Report

This document tracks UI and interaction bugs for the configurable dashboard builder. Visual inconsistency counts as a bug.

## Precision Standard

The dashboard depends on motion feel, spacing consistency, visual alignment, and interaction polish. Fixes must preserve the existing Apple-style dashboard language and should refine the current system rather than introduce new patterns.

Be especially vigilant about:

- Pixel alignment and subpixel movement
- Spacing rhythm between panels, widgets, menus, controls, and headers
- Transition smoothness and easing consistency
- Hover state stability with no size jumps
- Drag and resize smoothness
- Grid snapping precision
- Ghost-preview alignment
- Animation jitter, flicker, and reflow during movement
- Z-index layering for headers, dropdowns, popovers, modals, resize handles, and drag ghosts
- Overflow clipping around panels, menus, and tool drawers
- Shadow and border-radius consistency
- Text and icon alignment
- Panel padding, margins, and internal rhythm
- Transform-origin consistency

## Fix Rules

- Preserve the existing visual design.
- Do not redesign or invent a new motion system.
- Prefer precision fixes over broad restyling.
- Match the dominant existing behavior when uncertain.
- Avoid `!important` unless preserving an existing interaction override requires it.
- Keep class names stable unless a confirmed bug cannot be fixed otherwise.
- Verify dashboard movement, resize, ghost previews, popovers, menus, theme behavior, and responsive layout after CSS changes.

## Validation Checklist

Use this checklist when filing or closing a UI bug:

- App starts cleanly.
- `/dashboard` returns 200.
- `/settings` returns 200.
- CSS files load from `style.css` imports.
- No brace errors in CSS.
- No visible class-name changes.
- Light and dark themes both render correctly.
- Hover states do not shift layout.
- Dragging does not jitter or flicker.
- Resize handles remain aligned and layered.
- Ghost previews align to the grid.
- Menus/popovers are not clipped and layer above panels.
- Text and icons remain centered at desktop and mobile widths.

## Issue Log

### Automated Run Summary

Command:

```powershell
.venv\Scripts\python.exe -m pytest -q
```

Latest result: 18 passed, 0 failed.

Previous discovery result: 6 passed, 3 failed.

Passed coverage included app/dashboard/settings load, CSS imports, theme persistence, drag ghost creation, ordered drag reflow, reversible collision previews, global widget/panel occupancy, pinned item protection, sparse empty-space placement, grid-bound drag clamping, grid snapping alignment, collision/overlap checks, resize snapping, menu icon alignment, dark-mode panel hover parity, group mode, layout save/load/reset, settings save, mobile overflow checks, console errors, and network errors.

### BUG-004: Legacy Drag And Resize Collision Solver Allowed Non-Deterministic Movement

- Status: Verified
- Area: Dashboard grid
- Severity: High
- Environment: Chromium via Playwright, 1440x1000 viewport, light theme
- Steps to reproduce:
  1. Open `/dashboard`.
  2. Drag widgets or panels across occupied grid positions.
  3. Resize a panel or widget across neighboring items.
  4. Watch for placeholder drift, overlap, teleporting, or unexpected item negotiation.
- Expected behavior: The dashboard treats items as an ordered grid list. The active item lifts above the grid, a placeholder marks the target slot, surrounding items shift by ordered slot reflow, and final drop/resize commits exact grid coordinates.
- Actual behavior: The previous pointer handlers mixed pointer tracking, placeholder movement, collision negotiation, reflow animation, and persistence separately for widgets and panels. Neighboring items negotiated free slots instead of following list order, which made the system vulnerable to jitter, teleporting, overlap, and desynced previews.
- Likely source: `app/static/app.js` legacy `applyLocalCollisionLayout`, duplicated widget/panel drag handlers, duplicated widget/panel resize handlers, and cell-based placeholder updates.
- Fix notes: Added a centralized ordered-slot packer, shared FLIP-style reflow animation, shared ordered drag runner, ordered resize previews, and final commit through DOM order plus grid coordinates. The remaining legacy collision entry point now delegates to ordered packing for compatibility with collapse/expand callers.
- Validation: `.venv\Scripts\python.exe -m pytest -q` passed with 11 tests.

### BUG-005: Drag Preview Could Leave The Dashboard Grid Bounds

- Status: Verified
- Area: Dashboard grid
- Severity: High
- Environment: Chromium via Playwright, 1440x1000 viewport, light theme
- Observed: Dragged panels/widgets could be pulled outside the dashboard area, and pointer movement could imply invalid drop positions.
- Expected: The lifted drag preview remains clamped horizontally to the dashboard grid, remains visible vertically, and final drop state resolves to a valid grid cell.
- Suspected cause: Drag movement was clamped to viewport-visible edges instead of the dashboard grid bounds.
- Fix notes: Drag movement now clamps against the dashboard grid rect for horizontal bounds and visible dashboard area for vertical movement. Final placement always passes through sparse grid slot resolution.
- Validation: `.venv\Scripts\python.exe -m pytest -q` passed with 17 tests.

### BUG-006: Widgets And Panels Did Not Share One Occupancy Map

- Status: Verified
- Area: Dashboard grid
- Severity: High
- Environment: Chromium via Playwright, 1440x1000 viewport, light theme
- Observed: Widget movement and panel movement were resolved inside separate layout lists, allowing widgets to move underneath panels or ignore panel occupancy.
- Expected: Widgets and panels participate in one dashboard grid occupancy system.
- Suspected cause: Ordered placement used `.widget-layout` or `.panel-layout` as the movement boundary even though both are `display: contents` children of the same dashboard grid.
- Fix notes: Added host-wide grid item collection and sparse global occupancy resolution across widgets, panels, and placeholders.
- Validation: `.venv\Scripts\python.exe -m pytest -q` passed with 17 tests.

### BUG-007: Pinned Items Could Be Displaced By Other Movement

- Status: Verified
- Area: Dashboard grid / pinning
- Severity: High
- Environment: Chromium via Playwright, 1440x1000 viewport, light theme
- Observed: Drag/resize reflow could move other items without first reserving pinned item cells.
- Expected: Pinned items must not be moved, swapped, overwritten, pushed, or reflowed by another item.
- Suspected cause: Pinned state blocked direct movement of the pinned item but was not treated as a hard occupancy reservation for other interactions.
- Fix notes: Sparse layout resolution reserves pinned item bounds first. Active drops that collide with pinned bounds resolve to the nearest valid unpinned slot.
- Validation: `.venv\Scripts\python.exe -m pytest -q` passed with 17 tests.

### BUG-008: Widget Menu Icon Alignment Drifted From Panel Controls

- Status: Verified
- Area: Widget controls
- Severity: Medium
- Environment: Chromium via Playwright, 1440x1000 viewport, light theme
- Observed: Widget menu icons could render off-center compared with panel menu icons.
- Expected: Widget menu icons are vertically and horizontally centered in the same 34px controls as panel menu icons.
- Suspected cause: Widget-specific control sizing did not restate the same centering and line-height constraints as the shared panel tool buttons.
- Fix notes: Widget tool controls now explicitly use the same inline-flex centering, fixed dimensions, zero padding, and zero line-height as panel controls.
- Validation: `.venv\Scripts\python.exe -m pytest -q` passed with 17 tests.

### BUG-009: Dark Mode Panel Hover Highlight Did Not Match Widget Polish

- Status: Verified
- Area: Theme / panel hover
- Severity: Medium
- Environment: Chromium via Playwright, 1440x1000 viewport, dark theme
- Observed: Dark-mode panel hover and focus felt heavier and less polished than widget hover.
- Expected: Dark-mode panel hover uses the same soft highlight behavior as dark-mode widgets.
- Suspected cause: Older dark panel hover rules used a different border/shadow treatment than the final widget polish layer.
- Fix notes: Added a dark panel hover/focus rule beside the existing dark widget hover polish rule so panels inherit the same border and shadow behavior.
- Validation: `.venv\Scripts\python.exe -m pytest -q` passed with 17 tests.

### BUG-010: Grid Compacted Too Aggressively And Removed Intentional Empty Space

- Status: Verified
- Area: Dashboard grid
- Severity: High
- Environment: Chromium via Playwright, 1440x1000 viewport, light theme
- Observed: Drag/drop reflow aggressively packed items upward, making it difficult to place an item in lower empty space intentionally.
- Expected: Empty grid space is valid. Dropping into open space should preserve the user-selected row and column whenever possible.
- Suspected cause: Ordered packing always started from the top of each layout and treated dense packing as the default interaction model.
- Fix notes: Added sparse placement resolution that keeps existing valid positions, places the active item at the intended target when available, and moves surrounding items only when needed to resolve a real collision.
- Validation: `.venv\Scripts\python.exe -m pytest -q` passed with 17 tests.

### BUG-011: Drag Collision Preview Permanently Shifted Neighbor Items

- Status: Verified
- Area: Dashboard grid
- Severity: High
- Environment: Chromium via Playwright, 1440x1000 viewport, light theme
- Observed: Dragging an item into another item preview-shifted neighbors downward, but those neighbors kept the shifted `data-grid-row`/`data-grid-col` values after the dragged item moved away or dropped elsewhere.
- Expected: Collision response during drag is preview-only. Only the actively dragged item commits a new position on drop; neighboring items return to their original committed state unless a separate explicit layout action changes them.
- Suspected cause: Sparse preview layout reused live `data-grid-row`/`data-grid-col` state during pointer movement, so preview reflow became the next committed baseline.
- Fix notes: Drag preview now restores the drag-start layout snapshot before every preview calculation. Drop handling restores the same snapshot, removes the placeholder, resolves a valid target for the active item against committed neighbor positions, and commits only that active item.
- Validation: `.venv\Scripts\python.exe -m pytest -q` passed with 18 tests.

### BUG-001: Add Panel Menu Does Not Open Reliably From Pointer Click

- Status: Verified
- Area: Top bar / panel controls
- Severity: High
- Environment: Chromium via Playwright, 1440x1000 viewport, light theme
- Steps to reproduce:
  1. Open `/dashboard`.
  2. Click the `+` panel action button in the top bar.
  3. Observe the `.panel-add-menu` state.
- Expected behavior: The add menu opens, receives the `open` class, and exposes clickable `Add panel` and `Add widget` actions above the dashboard grid.
- Actual behavior: The menu remains closed after the pointer click. In earlier discovery runs, the menu action was also visually present but pointer clicks were intercepted by the page/grid layer.
- Screenshot: `test-results/tests_test_dashboard_builder_e2e.py_test_add_panel_menu_actions_are_pointer_clickable/failure.png`
- Trace: `test-results/tests_test_dashboard_builder_e2e.py_test_add_panel_menu_actions_are_pointer_clickable/trace.zip`
- Likely source: `app/static/app.js` around the `.panel-add-picker` click listener; `app/static/themes.css` selectors `.panel-add-picker`, `.panel-add-button`, `.panel-add-menu`; `app/templates/dashboard.html` top-bar add menu markup.
- Fix notes: The existing click handler could toggle the menu closed after hover/focus had already opened it. The pointer click now calls the existing `openMenu()` path directly, preserving the current hover menu behavior and styling.
- Validation: `.venv\Scripts\python.exe -m pytest -q` passed with 9 tests.

### BUG-002: Narrow Custom Panel Tool Drawer Obscures Header And Blocks Collapse/Expand

- Status: Verified
- Area: Panel controls / dashboard grid
- Severity: Medium
- Environment: Chromium via Playwright, 1440x1000 viewport, light theme
- Steps to reproduce:
  1. Open `/dashboard`.
  2. Add a custom panel.
  3. Rename and recolor it.
  4. Open its tool drawer.
  5. Pin and unpin the panel.
  6. Click the panel header/collapse target.
- Expected behavior: The one-column custom panel header remains mechanically usable. The title/collapse target should not be hidden by the tool drawer, and clicking the header should expand/collapse predictably.
- Actual behavior: The custom panel remains `db-panel-collapsed`. The tool drawer visually covers most of the narrow panel header, including the title area, and the expected expand action does not occur.
- Screenshot: `test-results/tests_test_dashboard_builder_e2e.py_test_panel_crud_controls_and_visual_state/failure.png`
- Trace: `test-results/tests_test_dashboard_builder_e2e.py_test_panel_crud_controls_and_visual_state/trace.zip`
- Likely source: `app/static/app.js` custom panel creation and collapse handler around `createCustomPanel`, `.db-panel-collapsed`, and `.db-panel-hd`; `app/static/dashboard-grid.css` selectors `.panel-tool-drawer`, `.db-panel-tools-open`, `.db-panel-collapsed`; theme overrides for custom-color panel headers.
- Fix notes: The dashboard already computed `--panel-min-width`; CSS now applies that width only while panel tools are open or focused so the drawer does not cover the header on one-column panels. Header collapse clicks now ignore the tool-control region, including retargeted clicks caused by hover-open movement. A short hover-open guard prevents the settings hover from becoming an accidental collapse/expand click, and explicit tool actions clear that guard.
- Validation: `.venv\Scripts\python.exe -m pytest -q` passed with 9 tests.

### BUG-003: Custom Widget Delete Control Does Not Open Confirmation Dialog After Editing

- Status: Verified
- Area: Widgets / panel controls
- Severity: High
- Environment: Chromium via Playwright, 1440x1000 viewport, light theme
- Steps to reproduce:
  1. Open `/dashboard`.
  2. Add a custom widget.
  3. Rename it.
  4. Recolor it.
  5. Resize it.
  6. Pin and unpin it.
  7. Open widget tools and click the delete control.
- Expected behavior: The shared delete confirmation dialog opens and allows the widget to be deleted.
- Actual behavior: The delete dialog remains hidden after clicking the widget delete control.
- Screenshot: `test-results/tests_test_dashboard_builder_e2e.py_test_widget_crud_controls_resize_and_delete/failure.png`
- Trace: `test-results/tests_test_dashboard_builder_e2e.py_test_widget_crud_controls_resize_and_delete/trace.zip`
- Likely source: `app/static/app.js` widget initialization around `.panel-delete-handle`, widget tool open/close behavior, and `showDeleteDialog`; `app/templates/base.html` shared `#panel-delete-dialog`; `app/static/dashboard-grid.css` widget tool drawer layering.
- Fix notes: Widget deletion now uses the existing shared confirmation dialog path instead of deleting immediately. The confirm handler branches between panel and widget targets while preserving custom-item removal, hidden draft lists, group-selection cleanup, layout saving, and toast feedback.
- Validation: `.venv\Scripts\python.exe -m pytest -q` passed with 9 tests.

## Entry Template

```md
### BUG-000: Short title

- Status: Open | In Progress | Fixed | Verified
- Area: Dashboard grid | Panel controls | Widgets | Theme | Top bar | Settings | Other
- Severity: Low | Medium | High
- Environment: Browser, viewport, theme
- Observed:
- Expected:
- Suspected cause:
- Fix notes:
- Validation:
```
