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

## Next Major Version Bug Watchlist

The context-aware visual analytics workspace adds new failure modes. Track any issue here as soon as it is discovered and add a regression test before fixing it.

- Widget registry regressions: wrong default size, wrong capabilities, broken create/delete, or renderer output that drifts from existing widget styling.
- Context propagation regressions: stale filters, incorrect inheritance, conflicting context precedence, or collapsed panels breaking child context.
- Panel context attachment regressions: header/chevron drops that corrupt layout, attach invalid context, or leave badges out of sync.
- Engineer Mode regressions: handles interfering with drag/resize/menu controls, links clipping behind panels, stale link routes after movement, or deleted links continuing to filter targets.
- Toolbar and command-surface regressions: hard-coded colors, default browser controls, poor dark-mode parity, icon misalignment, or stretched ungrouped controls.
- Universal object regressions: command surface, graphs, tables, calendars, widgets, and panels not sharing grid occupancy, pinning, sparse placement, save/load, or resize rules.

## Issue Log

### Automated Run Summary

Command:

```powershell
.venv\Scripts\python.exe -m pytest -q
```

Latest result: 68 passed, 0 failed.

Previous discovery result: 6 passed, 3 failed.

Passed coverage included app/dashboard/settings load, CSS imports, theme persistence, expanded background palette persistence, secondary surface glass-language screenshots, workspace toolbar command-island screenshots, toolbar mode toggles, generic Add Widget menu options, theme-aware timeframe controls, timeframe resize, timeframe minimum resize clamping, exact layout save/load round trips, small-panel menu overlays, panel placeholder/body sizing, adaptive panel content density, drag ghost creation, ordered drag reflow, local top insertion, reversible collision previews, suppression of underlying hover menus during drag, global widget/panel occupancy, pinned item protection, pin menu close behavior, sparse empty-space placement, grid-bound drag clamping, grid snapping alignment, collision/overlap checks, resize snapping, left-edge anchored resize, menu icon alignment, panel header chevron centering, light-mode panel/widget/timeframe hover-focus parity, dark-mode panel hover parity, dark-mode panel/widget menu parity, group multi-selection, grouped drag, grouped proportional resize, pinned items inside groups, mixed widget/panel group transforms, group mode, layout save/load/reset, settings save, mobile overflow checks, console errors, and network errors.

### BUG-023: Secondary App Surfaces Felt Disconnected From Dashboard Glass Language

- Status: Verified
- Area: Theme / settings / forms / menus / popovers
- Severity: Medium
- Environment: Chromium via Playwright, 1440x1000 viewport, light and dark themes with background presets
- Observed: Dashboard widgets and top-bar controls had a stronger visual language than settings forms, secondary controls, utility sections, dropdowns, popovers, and modal-like dialogs. Those surfaces felt flatter and less integrated.
- Expected: Settings pages, forms, dropdowns, submenus, popovers, dialogs, utility panels, save bars, and secondary cards use the same Apple-glass surface language, spacing rhythm, shadow treatment, rounded geometry, theme-aware hover/focus behavior, and tactile control polish as the dashboard.
- Suspected cause: Earlier polish focused on dashboard widgets/panels and top toolbar controls, while generic form/menu styles still used flatter surface and input rules.
- Fix notes: Added shared glass/field/control tokens, unified secondary surface styling, polished settings form sections and save bar, upgraded dialog/menu/dropdown surfaces, and added a background tone picker that separates accent color, background tone, and light/dark mode.
- Screenshots: `test-results/workspace-visual-language/dashboard-light-blue-mist.png`, `test-results/workspace-visual-language/dashboard-add-menu-glass.png`, `test-results/workspace-visual-language/settings-light-blue-mist.png`, `test-results/workspace-visual-language/settings-dark-midnight-blue.png`, `test-results/workspace-visual-language/dashboard-dark-midnight-blue.png`
- Validation: Added `test_background_presets_and_secondary_surfaces_share_glass_language`. `.venv\Scripts\python.exe -m pytest -q` passed with 29 tests.

### BUG-021: Layout Save/Load Did Not Round-Trip Exact Item State

- Status: Verified
- Area: Dashboard grid / layout persistence
- Severity: High
- Environment: Chromium via Playwright, 1440x1000 viewport, light theme
- Observed: A saved sparse layout with pinned items could reload with positions rewritten by the default dashboard grid sync. In the reported pattern `A* - B - C - D - E*`, the stored data preserved the pinned flags, but load-time grid synchronization could make the visual state appear shifted and could rewrite sparse positions.
- Expected: Save/load is a true round trip. Item id, type, grid position, grid size, order/index, pinned state, collapsed state, color/theme, widget config, panel membership, child order, locked/resizable flags, and future context attachments/links must restore by item id without compaction or inferred state.
- Suspected cause: `syncDefaultDashboardGrid` always reassigned dashboard grid positions after saved item state was applied. One initialization path still called it in forced/default mode, so sparse saved coordinates were compacted on load.
- Fix notes: Changed dashboard grid sync so normal initialization only fills missing coordinates and reserves existing saved coordinates globally. Reset/default layout is now the only path that forces default placement. Save payloads now include collapsed state plus neutral capability metadata, and widget resize honors explicit `minW`/`minH` metadata.
- Validation: Added `test_layout_save_load_round_trips_exact_item_state`, which creates five widget items, pins A and E, saves, inspects stored localStorage payloads, resets, loads, and asserts exact ids, order, grid positions, sparse rows, pinned flags, mixed panel/widget state, collapsed panel state, and resized panel state. `.venv\Scripts\python.exe -m pytest -q` passed with 28 tests.

### BUG-022: Content-Filled Widgets Could Resize Below Their Usable Control Width

- Status: Verified
- Area: Widgets / resize
- Severity: Medium
- Environment: Chromium via Playwright, 1440x1000 viewport, light theme
- Observed: The timeframe command widget could be resized below the width needed to display preset pills, active timeframe capsule, utility icon controls, and the settings button cleanly.
- Expected: Widget types define a minimum viable grid size. Resize snaps to grid intervals and clamps to the next valid size when a smaller size would clip, hide, stack awkwardly, or make controls unreadable.
- Suspected cause: Widget resize logic used a hard minimum span of `1` for every widget type and did not consider content-heavy controls.
- Fix notes: Added per-item minimum span metadata through `data-min-w`, gave the timeframe command widget `data-min-w="4"`, and routed widget/panel span application plus live resize/release snapping through a shared `gridItemMinimumSpan` helper.
- Validation: Added `test_timeframe_resize_clamps_to_content_minimum`, which attempts to shrink the timeframe widget below its usable width and asserts it clamps to span 4 with no visible control clipping. `.venv\Scripts\python.exe -m pytest -q` passed with 28 tests.

### BUG-012: Timeframe Control Used Plain Search-Input Styling Instead Of Dashboard Glass Controls

- Status: Verified
- Area: Widgets / theme
- Severity: Medium
- Environment: Chromium via Playwright, 1440x1000 viewport, light theme with multiple preset colors
- Observed: The top timeframe/search placeholder rendered as a form-like search input, which did not match the dashboard toolbar buttons, floating icon controls, or glass widget language.
- Expected: The timeframe area uses rounded glass pills, compact spacing, centered icons/text, soft borders/shadows, and inherits the active preset theme color through the existing panel/widget accent variables.
- Suspected cause: The control reused legacy `.range-search-input` styling instead of the established widget/tool button treatment.
- Fix notes: Replaced the visible placeholder search field with generic timeframe preset pills, a compact selected-timeframe pill, and two glass icon buttons. The styling reuses `.preset-btn`, `.range-custom-trigger`, widget accent variables, and existing hover/active timing instead of hard-coded colors.
- Screenshot: `test-results/timeframe-theme-controls/timeframe-teal.png`, `test-results/timeframe-theme-controls/timeframe-pink.png`
- Validation: `.venv\Scripts\python.exe -m pytest -q` passed with 20 tests.

### BUG-013: Underlying Panel/Widget Menus Could Open During Drag Or Resize

- Status: Verified
- Area: Dashboard grid / panel controls / widget controls
- Severity: High
- Environment: Chromium via Playwright, 1440x1000 viewport, light theme
- Observed: Dragging an item over another panel/widget could trigger hover/focus menu behavior on the item underneath.
- Expected: While dragging or resizing, only the active item and its preview state can respond. Non-active item controls must not open or receive hover/focus menu activation until the interaction ends.
- Suspected cause: Body-level drag state existed for transition suppression, but hover handlers and pointer targets for inactive item tools still remained active.
- Fix notes: Added a shared dashboard interaction guard, closed inactive tool drawers at drag/resize start, marked the active resize source, and suppressed pointer events for non-active panels/widgets while movement is active.
- Validation: `.venv\Scripts\python.exe -m pytest -q` passed with 20 tests.

### BUG-014: Timeframe And Tool Control Polish Drifted From The Dashboard Glass Language

- Status: Verified
- Area: Widgets / theme / panel controls
- Severity: Medium
- Environment: Chromium via Playwright, 1440x1000 viewport, light and dark themes with teal and pink preset colors
- Observed: Timeframe foreground text/icons could render darker than the surrounding glass controls, the command surface felt like a stretched toolbar, widget settings controls sat at the top-right instead of the right-side midpoint, and dark-mode panel tool hover/focus feedback did not feel as consistent as widget controls.
- Expected: Timeframe text/icons use the existing accessible theme foreground, controls sit in compact glass clusters, widget settings buttons are centered on the right edge, and dark-mode panel tool hover/focus states match the widget control polish.
- Suspected cause: Generic `.range-bar` text rules overrode pill foreground color, the timeframe utility group inherited legacy search-field sizing, widget tools used a top offset, and dark panel tool-open rules fell back to a less polished panel shadow.
- Fix notes: Scoped timeframe foreground to the existing accent text variable, grouped presets/active timeframe/utilities into compact glass clusters, centered widget tools with the same 34px control rhythm, and added dark-mode panel tool hover/focus overrides using the existing panel/widget control variables.
- Screenshots: `test-results/timeframe-theme-controls/timeframe-light-teal.png`, `test-results/timeframe-theme-controls/timeframe-light-pink.png`, `test-results/timeframe-theme-controls/timeframe-dark-teal.png`, `test-results/timeframe-theme-controls/timeframe-dark-pink.png`
- Validation: `.venv\Scripts\python.exe -m pytest -q` passed with 20 tests.

### BUG-015: Minimum-Size Panel Menu Changed Panel Layout Size

- Status: Verified
- Area: Panel controls / dashboard grid
- Severity: High
- Environment: Chromium via Playwright, 1440x1000 viewport, light theme
- Observed: Opening tools on a minimum-width panel caused the panel itself to grow because the open state applied a larger `min-width`.
- Expected: Tool drawers and popovers float above the panel and never change the panel grid span, grid row, width, or height.
- Suspected cause: `.panel-layout > .db-panel.db-panel-tools-open` applied `min-width: var(--panel-min-width)`, which changed the grid item dimensions instead of only overlaying controls.
- Fix notes: Removed the layout-affecting open-state min-width and kept tool content as an overlay. Header tool hit-testing was simplified so hidden drawer geometry does not block normal panel header clicks.
- Validation: `.venv\Scripts\python.exe -m pytest -q` passed with 24 tests.

### BUG-016: Timeframe Widget Was Visually A Dashboard Object But Could Not Resize

- Status: Verified
- Area: Widgets / dashboard grid
- Severity: Medium
- Environment: Chromium via Playwright, 1440x1000 viewport, light theme
- Observed: The timeframe control looked and behaved like a widget but its CSS forced `grid-column: 1 / -1 !important`, preventing the shared resize system from changing its span.
- Expected: The timeframe widget participates in the same universal widget resize rules unless explicitly locked.
- Suspected cause: A hard full-width grid-column override beat the inline grid span written by the shared widget resize handler.
- Fix notes: Replaced the forced full-row grid-column rule with a normal default `span 6`, allowing the existing widget resize affordance and persistence path to work.
- Validation: `.venv\Scripts\python.exe -m pytest -q` passed with 24 tests.

### BUG-017: Pin/Unpin Left Tool Menus Stuck Open

- Status: Verified
- Area: Panel controls / widget controls
- Severity: Medium
- Environment: Chromium via Playwright, 1440x1000 viewport, light theme
- Observed: Pinning worked functionally, but the tool drawer could remain open or focus-active after the pin action.
- Expected: Pin/unpin closes the drawer, releases tool focus, and normal hover behavior resumes.
- Suspected cause: The pin state changed without clearing menu state, and focused drawer controls could keep `:focus-within` drawer styles active after the open class was removed.
- Fix notes: Pin/unpin now closes the relevant tool drawer, blurs focus only for that pin action, and briefly suppresses hover reopen so the menu does not immediately re-open under the cursor. Explicit settings clicks still reopen tools normally.
- Validation: `.venv\Scripts\python.exe -m pytest -q` passed with 24 tests.

### BUG-018: Dropping On The Top Grid Item Could Send It To The End

- Status: Verified
- Area: Dashboard grid / ordered placement
- Severity: High
- Environment: Chromium via Playwright, 1440x1000 viewport, light theme
- Observed: Moving an item into the top occupied slot could resolve by sending the displaced top item to a far lower/end slot.
- Expected: Dropping into the first slot behaves like ordered insertion: the active item takes the target slot and affected neighbors shift forward/down/right locally.
- Suspected cause: Final drop commit only tried to place the active item around committed occupied cells. It did not commit the same local forward shift represented by the collision preview.
- Fix notes: Added a targeted drop-commit path for occupied target slots. Open-space drops still commit only the active item; collision drops place the active item at the target and shift non-pinned affected items forward using the shared sparse occupancy checks. Pinned items remain reserved and are not displaced.
- Validation: `.venv\Scripts\python.exe -m pytest -q` passed with 24 tests.

### BUG-019: Empty Panel Placeholder Did Not Track The Resized Body Area

- Status: Verified
- Area: Panel content / dashboard grid
- Severity: Medium
- Environment: Chromium via Playwright, 1440x1000 viewport, light and dark themes
- Observed: Resized panels could leave the empty placeholder visually detached from the panel body, with inconsistent height/alignment.
- Expected: The panel body owns the available content area below the header, and direct empty placeholders fill that body area while respecting panel sizing and padding rhythm.
- Suspected cause: `.db-panel-body` sized to its content with a fixed max-height, while direct placeholder cards kept their own intrinsic dimensions.
- Fix notes: Made `.db-panel-body` a flex column that grows inside the panel, removed the open-state max-height cap, and made direct empty-state placeholders stretch to the body bounds without fixed offsets.
- Screenshots: `test-results/panel-placeholder-sizing/placeholder-light-resized.png`, `test-results/panel-placeholder-sizing/placeholder-dark-resized.png`
- Validation: `.venv\Scripts\python.exe -m pytest -q` passed with 26 tests.

### BUG-020: Dark Panel Settings Menu Showed A White Ring Unlike Widgets

- Status: Verified
- Area: Theme / panel controls
- Severity: Medium
- Environment: Chromium via Playwright, 1440x1000 viewport, dark theme
- Observed: Opening or hovering panel settings in dark mode could show a bright white/near-white ring or border that widgets did not show.
- Expected: Dark-mode panel settings/menu controls match widget settings/menu controls and do not add a white outline.
- Suspected cause: Late dark-mode panel-only selectors overrode the shared widget control treatment with brighter border and shadow values.
- Fix notes: Added a final dark custom-panel control rule that matches the widget settings computed background, border, shadow, and outline state, and reduced the dark open-panel border away from white-tinted ring colors.
- Screenshots: `test-results/dark-menu-parity/panel-open-dark.png`, `test-results/dark-menu-parity/widget-open-dark.png`
- Validation: `.venv\Scripts\python.exe -m pytest -q` passed with 26 tests.

### BUG-021: Top Toolbar Felt Like A Button Row Instead Of A Workspace Command Surface

- Status: Superseded by BUG-024
- Area: Top bar / visual language
- Severity: Medium
- Environment: Chromium via Playwright, 1440x1000 viewport, light and dark themes
- Observed: The top toolbar used correct glass materials and controls, but the controls read as a flat row of equally weighted actions.
- Expected: At the time, the toolbar was explored as modular workspace orchestration UI. That command-island direction has since been rejected; BUG-024 defines the current spatial workspace chrome direction.
- Suspected cause: Existing toolbar markup grouped actions mostly by page region rather than task family, and the Add control was too small for the composition workflow.
- Fix notes: Historical note only. The six-island implementation was removed from the visual cascade during BUG-024 and should not be reintroduced.
- Screenshots: `test-results/workspace-toolbar/toolbar-light-command-islands.png`, `test-results/workspace-toolbar/toolbar-dark-command-islands.png`
- Validation: `.venv\Scripts\python.exe -m pytest -q` passed with 30 tests.

### BUG-022: Grouping Behaved Like Rigid Same-Type Layout Resizing

- Status: Verified
- Area: Dashboard grid / grouping
- Severity: High
- Environment: Chromium via Playwright, 1440x1000 viewport, light theme
- Observed: Group interactions were biased by the active item and same-type peers. Group resize applied equal span deltas and release-to-row behavior, which could stop too early or force selected items toward uniform sizing. Group movement did not act like a shared transform across panels and widgets.
- Expected: Grouping behaves like multi-selection. Dragging one selected movable item moves the selected movable set while preserving relative offsets and sparse gaps. Resizing uses a temporary shared boundary, scales items proportionally, and clamps each object to its own minimum size.
- Suspected cause: The old implementation filtered peers by kind/layout and reused individual resize math plus group fill-span helpers instead of computing transforms from the selected set's bounds.
- Fix notes: Added cross-type selected transform members, group drag delta resolution against global occupancy, pinned selected item reservations, proportional group resize from a shared bounding box, and per-item minimum clamps. Group selection visuals were softened to a subtle glass-native outline/glow.
- Validation: `.venv\Scripts\python.exe -m pytest -q` passed with 32 tests.

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

### BUG-024: Top Bar Command Islands Felt Crowded And Admin-Like

- Status: Verified
- Area: Top bar / workspace chrome / settings / modal surfaces
- Severity: Medium
- Environment: Dashboard workspace, light and dark themes
- Observed: The previous toolbar redesign rendered six bordered command islands, a loud Add Widget button, and several equal-weight utility controls. It felt crowded, repetitive, and closer to generic admin software than a calm spatial workspace.
- Expected: The toolbar should feel like one atmospheric Apple-glass workspace chrome layer with a clear workspace anchor, subtle creation control, lower-weight secondary controls, and floating glass menus. Settings and delete confirmation surfaces should share the same premium glass language.
- Suspected cause: The toolbar implementation solved information architecture by adding more bordered capsules and equal visual weight instead of reducing persistent chrome and using spatial hierarchy.
- Fix notes: `dashboard.html` now marks the top bar as `.workspace-chrome` and changes the creation affordance to a compact plus control. `themes.css` neutralizes the rejected command-island visual treatment, adds a single floating chrome layer, soft ghost controls, a restrained add control, spatial menu surfaces, and matching settings/dialog glass refinements.
- Validation: Added Playwright coverage for the new chrome hierarchy, menu behavior, mode toggles, settings surface glass, and delete dialog glass. `.venv\Scripts\python.exe -m pytest -q` passed with 33 tests.

### BUG-025: Workspace Chrome Still Read As A Toolbar On A Card

- Status: Verified
- Area: Top bar / workspace chrome
- Severity: Medium
- Environment: Dashboard workspace, light and dark themes
- Observed: The improved chrome still had a large glass slab behind the controls, which made the top surface read as a web app header or toolbar card instead of spatial workspace chrome.
- Expected: The workspace should remain primary. Controls should appear as floating atmospheric surfaces with hierarchy from depth, position, opacity, and interaction state, not from a giant persistent toolbar container.
- Suspected cause: The `.workspace-chrome` container carried too much border, background, shadow, and uniform horizontal rhythm.
- Fix notes: The `.workspace-chrome` container is now visually transparent with only ambient glow/guide layers. Depth moved to the workspace anchor, compact creation lens, quiet appearance edge controls, and hover/active states. Persistence controls are lower-opacity and less prominent until interaction.
- Validation: Updated Playwright coverage to assert the chrome container is not a visible slab while the floating anchor and create affordance retain glass/depth treatment. `.venv\Scripts\python.exe -m pytest -q` passed with 33 tests.

### BUG-026: Dark Mode Drifted Into Neon / Cyberpunk Edge Lighting

- Status: Verified
- Area: Theme / visual language / dashboard surfaces
- Severity: Medium
- Environment: Dashboard workspace, dark theme
- Observed: Dark mode used overly bright blue borders, high-contrast outlines, and saturated glow shadows that made the product feel cyberpunk/gamer instead of Apple-like midnight glass.
- Expected: Dark mode should feel like the same product at night: restrained, cinematic, glass-like, and premium. Depth should come from layered surfaces, translucency, blur, soft gradients, and shadow hierarchy, not electric glowing edges.
- Suspected cause: Older dark-mode rules used bright `#67a9ff`, `#75b9ff`, high-alpha accent borders, and outer `rgba(103, 169, 255, ...)` glow shadows across cards, controls, menus, active states, group selection, and chrome.
- Fix notes: Dark tokens now use a calmer accent and softer material border. A final midnight-glass calibration layer reduces glow intensity, lowers accent border saturation, softens hover/active/group/drag/placeholder states, and shifts depth back to shadows and inner highlights.
- Validation: Added Playwright coverage asserting dark mode uses the calmer accent token and avoids the previous bright-blue neon shadow values on dashboard hover/chrome surfaces. `.venv\Scripts\python.exe -m pytest -q` passed with 34 tests.

### BUG-027: Dark Mode Borders Too Neon On Dashboard Controls

- Status: Verified
- Area: Theme / dashboard surfaces / workspace chrome
- Severity: Medium
- Environment: Dashboard workspace, dark theme
- Observed: Some dashboard surfaces still inherited older bright blue border and glow treatment, especially panel headers, table rows, empty states, timeframe clusters, panel/widget controls, and the workspace chrome accent.
- Expected: Dark mode borders and hover/focus states remain visible but read as muted glass rims rather than electric blue outlines.
- Suspected cause: Earlier dark-mode cascade layers still contained saturated border and `0 0 ...` glow rules, and the final dark polish layer did not explicitly cover every dashboard surface.
- Fix notes: Added a final dark-only border refinement for panel headers, table content rows, empty states, timeframe command clusters, panel/widget controls, and workspace chrome accent surfaces. The refinement keeps light mode untouched and does not change layout, drag, resize, grid placement, save/load, pinning, collapse, or grouping behavior.
- Validation: Expanded `test_dark_mode_uses_midnight_glass_not_neon_edges` to cover table, empty-state, timeframe, and workspace chrome surfaces. `.venv\Scripts\python.exe -m pytest -q` passed with 34 tests.

### BUG-028: Top Navigation Visual Drift

- Status: Verified
- Area: Theme / navigation polish
- Severity: Medium
- Environment: Dashboard workspace, light and dark themes
- Observed: The top navigation/header did not visually match the rest of the dashboard. In light mode it appeared washed out and hard to distinguish; in dark mode it felt detached from the dashboard surface language.
- Expected: The top nav uses the same polished glass/card language as dashboard controls, with visible but subtle borders, restrained shadows, coherent toolbar grouping, and no neon dark-mode edges.
- Suspected cause: Recent workspace chrome layers made the nav container and controls too transparent, so the top bar lost connection with the grey/blue dashboard cards and panels.
- Fix notes: Added a focused top-nav polish layer for `.app-nav.workspace-chrome`, dashboard switcher, layout slot controls, add button, reset/undo/group/mode/status controls, theme/background controls, settings link, and nav menus. This is a contained polish bug fix, not a redesign; markup, class names, dashboard layout, drag, resize, save/load, pin, collapse, and group behavior are unchanged.
- Validation: Updated `test_workspace_chrome_is_spatial_and_modes_still_work` to assert visible light/dark chrome surfaces and preserve layout slot/add menu behavior. Manual Playwright smoke checked `/dashboard`, light and dark top nav, theme toggle, layout slot dropdown, add menu, reset/undo/group controls, and settings link. `.venv\Scripts\python.exe -m pytest -q` passed with 34 tests.

### BUG-029: Resize Preview Snapped Abruptly Between Grid Sizes

- Status: Verified
- Area: Dashboard grid / resize polish
- Severity: Medium
- Environment: Dashboard workspace, Chromium via Playwright, light theme
- Observed: Dragging felt fluid because the active object lifted under the pointer while a ghost/placeholder represented grid placement, but resizing mutated the visible item directly between snapped grid spans and row heights. After the first attempted fix, the live app still did not feel smooth during resize; resize feedback was still not behaving like the drag interaction.
- Expected: Resize should use the same direct-manipulation model as drag: the active panel or widget follows pointer movement continuously, a translucent grid-aligned preview marks the snapped target size, and the final commit remains grid-based.
- Suspected cause: The normal widget and panel resize handlers applied snapped span/height changes to the live item on pointermove, with no separate live surface or resize ghost. The first attempted fix also let the snapped panel footprint normalize from raw rendered height with `ceil` row math, so the footprint could jump on tiny pointer movement.
- Fix notes: Reworked the attempted resize preview into an explicit translucent, non-interactive `.dashboard-live-resize` clone appended to `body` for all normal panel/widget resize interactions. The real source gets `.dashboard-resize-source` and is hidden during active resize, while a separate `.dashboard-resize-preview` placeholder remains the blue snapped grid footprint. Release snapping now measures the snapped footprint instead of the hidden source, so final commit follows the preview. Panel row snapping now uses pointer-delta row thresholds instead of immediate `ceil` normalization.
- Validation: Strengthened `test_resize_has_live_surface_and_grid_preview` to assert sub-grid live preview movement, translucent preview styling, hidden source state, unchanged committed span during pointer movement, unchanged snapped footprint below grid threshold, changed snapped footprint after crossing threshold, and grid-aligned commit. Manual Playwright probe against `http://127.0.0.1:8001/dashboard` confirmed updated JS/CSS are served and the temporary debug marker was removed; an 8x7px pointer move changed the live clone by 8x7px while the snapped footprint delta stayed 0x0. `.venv\Scripts\python.exe -m pytest -q` passed with 36 tests.

### BUG-030: Collapsed Panels Did Not Show Expanded Footprint During Movement

- Status: Verified
- Area: Dashboard grid / collapsed panel preview
- Severity: Medium
- Environment: Dashboard workspace, Chromium via Playwright, light theme
- Observed: Collapsed panels could be dragged and resized, but the only visible footprint was the compact collapsed row. After the first attempted fix, the expanded-footprint preview still did not appear or did not behave correctly when moving or resizing collapsed panels in the running dashboard.
- Expected: Dragging or resizing a collapsed panel shows a translucent expanded-footprint ghost that is informational only. The ghost must not reserve cells, push neighbors, affect snapping, alter collision logic, or persist to layout state.
- Suspected cause: Existing drag and resize preview paths only represented the active collapsed panel's committed grid footprint. There was no separate visual-only expanded footprint layer.
- Fix notes: Kept the body-level `.dashboard-expanded-footprint-ghost` visual-only layer for collapsed panel drag and resize, while preserving the collapsed one-row grid placeholder as the real placement footprint. The expanded ghost has no grid/placeholder classes and does not enter occupancy, snapping, collision, or persistence paths.
- Validation: `test_collapsed_panel_drag_and_resize_show_expanded_footprint_ghost` and targeted drag/resize tests passed. `.venv\Scripts\python.exe -m pytest -q` passed with 36 tests.

### BUG-031: Collapsed Expanded-Footprint Ghost Could Misalign With Real Opened Panel

- Status: Verified
- Area: Dashboard grid / collapsed panel preview
- Severity: Medium
- Environment: Dashboard workspace, Chromium via Playwright, light theme
- Observed: When dragging or resizing a collapsed panel, the dashed expanded-footprint ghost could extend too far or start/end at the wrong vertical interval. It did not always line up with the panel's actual opened footprint.
- Expected: The expanded-footprint ghost represents the exact opened panel bounds: same left, top, and width as the collapsed panel or snapped resize footprint, and height equal to the real expanded grid height using the same row math as the open-panel layout.
- Suspected cause: The ghost used rendered/live clone dimensions or proposed pixel heights in some resize paths, while actual open-panel geometry is determined by committed grid rows and saved expanded height.
- Fix notes: Added expanded-footprint row helpers that ignore the collapsed one-row state and derive ghost height from saved expanded height, expanded minimum rows, or snapped resize rows. During collapsed resize, the ghost now anchors to the snapped `.dashboard-resize-preview` footprint instead of the freeform live clone.
- Validation: Updated `test_collapsed_panel_drag_and_resize_show_expanded_footprint_ghost` to capture the ghost, commit the resize, open the panel, and assert the opened panel bounds match the ghost bounds within grid tolerance. Targeted drag/resize tests passed. `.venv\Scripts\python.exe -m pytest -q` passed with 36 tests.

### BUG-032: Panel Expand Used General Reflow Instead Of Vertical Pushdown

- Status: Verified
- Area: Dashboard grid / expand-collapse
- Severity: Medium
- Environment: Dashboard workspace, Chromium via Playwright, light theme
- Observed: Opening a collapsed panel could route affected items through the general placement resolver. In the NOTES-above-TABLE case, TABLE moved sideways into another open slot instead of staying in its column and moving down.
- Expected: Expand/collapse behaves like an accordion: the opened panel keeps its current top/left and expands downward, affected items below the expanded footprint shift straight down, and collapse restores the compact layout when space is available. Drag/drop and resize keep their existing placement logic.
- Suspected cause: The panel toggle handler called `applyLocalCollisionLayout` on expand, which delegates to the broader ordered/grid placement machinery and can choose a lateral slot.
- Fix notes: Added a focused vertical expansion pass for panel opening that preserves each affected item's column/span and only advances rows enough to clear grid overlaps. Collapse continues to use the existing expansion snapshot restore so temporarily pushed items can return upward.
- Validation: Added `test_panel_expand_uses_vertical_pushdown_not_sideways_reflow`, which places NOTES collapsed directly above TABLE, opens NOTES, asserts TABLE remains in the same column and moves down, then collapses NOTES and asserts TABLE returns upward. `.venv\Scripts\python.exe -m pytest -q` passed with 37 tests.

### BUG-033: Dark Widget Borders Kept Neon Active And Focus Rims

- Status: Verified
- Area: Theme / widget-panel parity
- Severity: Medium
- Environment: Dashboard workspace, Chromium via Playwright, dark theme
- Observed: Earlier dark-mode cleanup calmed panel borders, but default and custom colored widgets could still keep bright active, focus, selected, and hover rims. This made widgets and panels feel like different component families in dark mode.
- Expected: Dark-mode widgets keep their colored surface identity while sharing the same soft glass rim, hover, focus, active, selected, drag, and resize treatment as panels. Focus remains visible without electric blue or saturated color halos.
- Suspected cause: Older widget-specific dark rules for `.stat-card.active`, `.widget-card.db-panel-custom-color.active`, group selection, and custom color variants remained later or more specific than some panel-focused neon cleanup rules.
- Fix notes: Added a final dark-only widget/panel parity calibration in `themes.css` that uses muted material border colors, restrained inset focus/selection treatment, and removes outer accent glow from widget active, selected, dragging, and live resize states while preserving custom widget background color.
- Validation: Added `test_dark_widget_focus_and_active_borders_match_panel_softness` and reran the existing dark midnight-glass, hover parity, and menu parity tests successfully. `.venv\Scripts\python.exe -m pytest -q` passed with 38 tests.

### BUG-034: Panel Content Density Did Not Adapt Before Overflow

- Status: Verified
- Area: Panel content / dashboard grid
- Severity: Medium
- Environment: Dashboard workspace, light and dark themes
- Observed: Small panels could waste useful vertical space because panel chrome, empty placeholders, table cell padding, and table empty-state padding retained medium/large spacing even when the available panel height was tight. This made scrollbars or clipping appear before the panel had compressed its internal rhythm.
- Expected: Panels preserve the existing visual language while progressively adapting internal density. Small panels reduce nonessential padding and gaps, tables show more useful rows before overflow, empty states scale down gracefully, and medium/large panels keep the normal polished spacing.
- Suspected cause: Panel header, empty-state, and table spacing were fixed CSS values that did not respond to the panel's committed grid row span.
- Fix notes: Added a focused CSS density calibration using existing panel classes and committed `data-grid-row-span` state. Small and medium-short panels now reduce header height, header padding, title size, empty-state padding/gaps, table cell padding, and table empty-state padding while medium/large panels retain the standard rhythm. This is a fitting/polish fix, not a layout, drag, resize, collision, save/load, or component architecture change.
- Validation: Added `test_panel_content_density_adapts_before_overflow` for row-span-aware panel density. `.venv\Scripts\python.exe -m pytest -q` passed with 39 tests.

### BUG-035: Light Background Palette Felt Washed Out

- Status: Verified
- Area: Theme / background palettes
- Severity: Medium
- Environment: Dashboard workspace, light and dark themes
- Observed: The existing light background tones skewed very pale, making the workspace feel washed out and limiting richer neutral choices. Dark mode also needed calmer low-neon variants beyond the existing set.
- Expected: Background palettes provide grounded light-mode greys, slate, graphite-light, muted blue-grey, and neutral dim options, plus calm dark charcoal/navy/slate/glass options. Dashboard panels, widgets, nav chrome, menus, and settings surfaces remain readable, separated, and premium.
- Suspected cause: The original background preset list focused on soft frosted light tones and did not include enough darker-neutral ambient palettes.
- Fix notes: Added expanded `data-background` token sets for grounded light neutrals and calm dark palettes, exposed the new options in dashboard and settings pickers, added compact swatch previews, and made final nav/menu surfaces use palette tokens so chrome stays cohesive with the selected background. Added `docs/theme-palettes.md` with palette intent and contrast guidance.
- Validation: Updated `test_background_presets_and_secondary_surfaces_share_glass_language` to verify new light and dark palette entries, swatch previews, persistence, grounded light background tokens, subdued dark borders, and glass surface separation. `.venv\Scripts\python.exe -m pytest -q` passed with 39 tests.

### BUG-036: Right-Side Objects Could Not Resize Wider From The Left Edge

- Status: Verified
- Area: Dashboard grid / resize semantics
- Severity: Medium
- Environment: Dashboard workspace, widgets and panels
- Observed: Objects placed on the right side were hard to make wider because the existing resize interaction only behaved like a right/bottom edge resize. Dragging left did not provide an anchored-right resize path where the object grows toward the left.
- Expected: A left-side resize handle keeps the object's right edge fixed while the left edge moves. The object grows or shrinks toward the left, grid snapping still applies, the live resize clone follows raw pointer movement, the snapped footprint represents the anchored-left result, and saved layout state persists the new column and span.
- Suspected cause: Resize logic only calculated width from the right edge and did not have a left-edge mode that recomputed `gridCol` from the original right boundary.
- Fix notes: Added a left-side resize handle to the existing panel/widget tool drawer and extended the current live-resize plus snapped-footprint path with a left-edge mode. The right boundary remains anchored while `gridCol` and span update, and the drawer keeps controls in a stable two-row hit-test footprint when the extra handle is present.
- Validation: Added `test_left_edge_resize_anchors_right_edge_for_right_side_widget` to prove sub-grid live preview movement, anchored snapped footprint behavior, committed column/span updates, and saved layout persistence. `.venv\Scripts\python.exe -m pytest -q` passed with 40 tests.

### BUG-037: Widget Settings Controls Drifted From Panel Edge Alignment

- Status: Verified
- Area: Dashboard controls / visual alignment
- Severity: Low
- Environment: Dashboard workspace, widgets and panels
- Observed: Widget settings controls used a different right offset than panel header controls, so widgets and panels with the same right edge did not visually align their control buttons.
- Expected: Panel and widget settings buttons share the same right inset token, remain vertically centered in their respective header/card surfaces, and keep floating tool drawers anchored from the same edge.
- Suspected cause: Widget tools used a hardcoded absolute `right` offset while panel controls were positioned by header padding.
- Fix notes: Added a shared dashboard control inset for panel header right padding and widget tool positioning. This is visual polish only and does not change drag, resize, snapping, save/load, or control behavior.
- Validation: Updated `test_widget_menu_icons_align_like_panel_icons` to assert panel, stat widget, and timeframe widget right-inset parity plus existing glyph centering. `.venv\Scripts\python.exe -m pytest -q` passed with 40 tests.

### BUG-038: Panel Hover And Focus Did Not Match Widget Interaction Polish

- Status: Verified
- Area: Dashboard controls / hover and focus parity
- Severity: Medium
- Environment: Dashboard workspace, light and dark themes
- Observed: Panels and widgets used different hover and focus surface treatments. Widgets had the preferred lift, border, and shadow response, while panels, collapsed panels, and custom-color panel states could fall back to different shadows or no lift.
- Expected: Panels, collapsed panels, stat widgets, and timeframe widgets share the same object-level hover/focus treatment while preserving individual color identity and avoiding neon dark-mode outlines.
- Suspected cause: Panel hover rules and late custom-color theme overrides diverged from the widget hover rules, and the timeframe widget did not share the same outer object hover surface.
- Fix notes: Updated panel, collapsed panel, stat widget, and timeframe widget hover/focus selectors to share the widget-style lift, border, and shadow treatment. Custom-color panel hover/focus now uses the same non-neon surface shadow as custom widgets. Drag, resize, snapping, save/load, and layout behavior were not changed.
- Validation: Added `test_panel_widget_hover_focus_surface_parity` for light-mode hover/focus parity across panel, collapsed panel, stat widget, and timeframe widget, and reran existing dark hover/focus/menu parity tests. `.venv\Scripts\python.exe -m pytest -q` passed with 41 tests.

### BUG-039: Panel Header Chevron Was Not Optically Centered

- Status: Verified
- Area: Dashboard controls / icon alignment
- Severity: Low
- Environment: Dashboard workspace, light and dark themes
- Observed: The panel header chevron could appear slightly off-center inside its circular control, especially on compact panel headers where the header padding changed but the chevron used a fixed absolute left offset.
- Expected: The chevron stays visually centered inside the fixed circular control across menu, notes, table, empty, collapsed, and open panel states in both light and dark themes.
- Suspected cause: The circle was laid out from adaptive header padding, while the chevron used a hardcoded `left` value and border-based drawing that introduced optical stroke asymmetry.
- Fix notes: Positioned the chevron from the same header padding math as the circle and replaced the border-corner drawing with a centered mask icon. The circle size, header layout, collapse behavior, and panel interactions were not changed.
- Validation: Added `test_panel_header_chevrons_are_optically_centered` to verify chevron/circle center alignment, mask rendering, and light/dark parity. `.venv\Scripts\python.exe -m pytest -q` passed with 42 tests.

### BUG-040: Expanded-Footprint Ghost Did Not Follow Live Resize Geometry

- Status: Verified
- Area: Drag / resize preview
- Severity: Medium
- Environment: Dashboard workspace, collapsed panels during resize
- Observed: During collapsed-panel resize, the live header/panel preview moved and resized with the pointer, but the dashed expanded-footprint ghost could stay anchored to the old snapped footprint instead of tracking the live preview.
- Expected: During resize, the live resized panel/header is the visual source of truth for the informational expanded-footprint ghost. The ghost follows the live preview's left, top, and width while keeping its height equal to the expanded/open footprint. The snapped resize footprint remains the collision and commit source.
- Suspected cause: The ghost was updated from `.dashboard-resize-preview`, and resize movement returned early between snapped grid thresholds. That meant sub-grid pointer movement could update `.dashboard-live-resize` without refreshing the expanded-footprint ghost.
- Progress notes: This was the resize bug being worked on before later steering requests interrupted the turn. The implementation now creates the ghost from the resize start rect, updates it from `.dashboard-live-resize.getBoundingClientRect()` on every collapsed-panel resize pointermove, and removes the stale snapped-footprint update path. CSS also keeps the fixed-position ghost border-box aligned and disables its width/height transition during active resize so it does not lag behind the live preview.
- Validation: Updated `test_collapsed_panel_drag_and_resize_show_expanded_footprint_ghost` to prove sub-grid live preview movement, ghost-to-live left/top/width alignment, snapped footprint independence, expanded height preservation, and grid-aligned commit. Targeted tests and `.venv\Scripts\python.exe -m pytest -q` passed with 42 tests after the steering cleanup.

### BUG-041: Resize Toolbar Exposed Direction-Specific Controls

- Status: Verified
- Area: Dashboard controls / resize UX
- Severity: Medium
- Environment: Dashboard workspace, widgets and panels
- Observed: Floating tool drawers exposed separate resize buttons for normal and left-edge resizing. The extra direction-specific icon added visual noise and made resize feel like an engineering mode choice instead of direct manipulation.
- Expected: Tool drawers expose one high-level resize action. Directional anchored-edge behavior remains available through direct edge dragging and the resize preview, while the snapped footprint continues to drive collision and commit behavior.
- Suspected cause: Left-edge resize was added as a separate toolbar button instead of an inferred direct-manipulation edge path.
- Fix notes: Removed the dedicated left-resize toolbar button from rendered and generated panel/widget tools. The existing resize button keeps standard right-edge behavior, while direct pointerdown on an item's left or right edge infers the anchored edge internally and reuses the existing live resize clone, snapped footprint, collision, and commit path.
- Validation: Updated `test_single_resize_control_infers_left_edge_resize_for_right_side_widget` to assert only one toolbar resize action is exposed, no left-direction resize button exists, direct left-edge dragging anchors the right edge, the live clone follows raw motion, the snapped footprint stays grid-aligned, and saved layout state persists the inferred resize.

### BUG-042: Widget Resize Could Strand Interaction State Or Trigger Link Navigation

- Status: Verified
- Area: Dashboard grid / resize lifecycle
- Severity: High
- Environment: Dashboard workspace, widgets and panels
- Observed: Widget resize could feel intermittent: resize appeared active but stopped changing size, repeated attempts could need a refresh, and direct widget edge resizing could reset layout unexpectedly.
- Expected: Every resize start has exactly one guarded finish path. Pointerup, pointercancel, Escape, window blur, and exceptions during resize preview/commit cleanup live clones, snapped previews, source classes, active classes, body interaction classes, and group transform classes. Direct widget resize must not produce a follow-up anchor click.
- Suspected cause: Widget, panel, and group resize each owned document listeners and cleanup independently. If pointerup was lost or a preview/commit callback threw, cleanup after the callback could be skipped. Widget edge resize also began from an anchor element, so mouseup could synthesize a click/navigation after the resize.
- Fix notes: Added a shared resize lifecycle guard that cancels any previous resize, captures the pointer when possible, listens for pointerup, pointercancel, Escape, and window blur, and runs cleanup through `finally`. Routed widget, panel, and group resize through it without changing their grid math. Added a widget resize click suppressor so direct edge resize cannot become a dashboard link click.
- Validation: Added `test_widget_resize_lifecycle_repeats_cancels_and_persists` for repeated same-widget resize, immediate opposite-direction resize, widget-panel-widget resize, pointercancel cleanup, stale artifact checks after every resize, and reload persistence. Strengthened group resize cleanup assertions. Targeted resize tests and `.venv\Scripts\python.exe -m pytest -q` passed with 43 tests.

### BUG-043: Page Jolted Horizontally When Expand/Collapse Toggled Scrollbar

- Status: Verified
- Area: Dashboard grid / page scroll
- Severity: Medium
- Environment: Chromium, constrained desktop viewport, light and dark themes
- Observed: Expanding a panel could make page content exceed the viewport, causing the vertical scrollbar to appear. Collapsing the panel removed the scrollbar. The changing scrollbar gutter altered the centered page width and made the dashboard jolt horizontally.
- Expected: Panel expand/collapse preserves accordion-style vertical pushdown and natural page scrolling without horizontal dashboard movement when the browser scrollbar appears or disappears.
- Suspected cause: The document used the browser's default automatic scrollbar gutter, so the root/page layout width changed between non-overflow and overflow states.
- Fix notes: Added `scrollbar-gutter: stable` to the root document element so the vertical scrollbar gutter is reserved without JS measurements, artificial padding, or dashboard-specific compensation. Follow-up calibration moved the root/background paint onto `html`, clipped accidental page-level horizontal overflow, and separated document scrollbar styling from panel/table internal scrollbars so the reserved page gutter has a transparent scrollbar, track, and corner over the exact shared dashboard background instead of a permanent white strip.
- Validation: Added `test_panel_expand_collapse_does_not_shift_dashboard_when_scrollbar_changes` to force a no-overflow collapsed state, expand a saved-height panel until the document overflows, switch to dark mode, collapse again, assert the dashboard/page left and width do not shift, assert document/body scroll widths do not exceed client widths, assert root/body backgrounds match, and assert the document scrollbar base, track, and corner remain transparent. Manual Playwright smoke captured light and dark expand/collapse states.

### BUG-044: Group Resize Bypassed Live Clone And Snapped Footprint Parity

- Status: Verified
- Area: Dashboard grid / group resize
- Severity: Medium
- Environment: Dashboard workspace, group-selected widgets and panels
- Observed: Group resize used proportional grid math, but it drove the real selected members during pointermove. That made group resize feel harder and snappier than individual resize, skipped `.dashboard-live-resize` surfaces and `.dashboard-resize-preview` footprints, and meant collapsed selected panels did not participate in the expanded-footprint ghost language.
- Expected: Group resize should use the same visual/source/footprint separation as individual widget and panel resize. Live clones follow the pointer smoothly, snapped placeholders show the grid-aligned footprint/collision source, original selected members remain unmutated until commit, and collapsed panels still show their expanded footprint ghost.
- Suspected cause: `runGroupResize` predated the live resize surface work and called `applyGroupResizeLayout` directly on selected source members during pointermove.
- Fix notes: Reused the existing resize preview architecture for group resize. Each selected member now gets a live clone plus snapped placeholder; `applyGroupResizeLayout` can resolve placeholder sizing from the original source item, so min spans, widget/panel type, and collapsed-panel behavior remain consistent. Commit removes preview artifacts, restores the original snapshot, and applies the final snapped group layout to the real members.
- Validation: Added `test_group_resize_uses_live_clones_snapped_previews_and_collapsed_ghost` to pause mid-drag, assert live clones/previews/source classes/expanded ghost exist, verify live clones retain group-selected hover styling, verify originals do not mutate during preview, then release and assert final grid-aligned state and cleanup. Targeted group resize tests and `.venv\Scripts\python.exe -m pytest -q` passed with 45 tests.

### BUG-045: Group Transform Did Not Behave Like One Spatial Object

- Status: Verified
- Area: Dashboard grid / grouped drag and resize
- Severity: High
- Environment: Dashboard workspace, grouped widgets and panels, light and dark themes
- Observed: Group drag used the active item as the only free-moving ghost while other selected members snapped independently on the grid. Group resize used per-member snapped previews as collision sources. This made selected objects drift apart visually, allowed neighbors to resolve around individual members instead of the full group, and could produce a harsh debug-like group movement surface.
- Expected: Grouped interactions preserve member spacing and read as one composite object. Live visual members move together, one snapped composite footprint reserves the group area, surrounding items move out of the way of that footprint, and commit applies the resolved group delta or proportional resize back to individual grid items without jumps.
- Suspected cause: The grouped paths reused single-item placeholder mechanics but did not promote the selected set's bounding box to the collision/reflow source. Sparse resolution also used nearest-slot behavior, which could move surrounding items upward during group preview instead of producing accordion-style pushdown.
- Fix notes: Added a shared composite group footprint helper and fixed live group surfaces. Group drag now hides original members, moves cloned member surfaces inside a calm glass shell, and drives reflow from one footprint. Group resize now keeps per-member previews visual-only while the composite resized footprint owns collision and reflow. Added directional sparse resolution for group footprints so surrounding movable items resolve after the composite area. Replaced the harsh active group surface with neutral glass/slate styling in light and dark mode.
- Validation: Added `test_group_drag_uses_composite_footprint_and_preserves_member_spacing` and `test_group_resize_composite_footprint_pushes_surrounding_items`. These pause mid-interaction to assert original state is unmutated, member spacing is preserved, a single composite footprint exists, surrounding blockers move down, no black shell is present, cleanup removes group artifacts, repeated drag does not drift, and final layouts do not overlap. Manual Playwright smoke captured light and dark grouped drag surfaces. `.venv\Scripts\python.exe -m pytest -q` passed with 48 tests.

### BUG-046: Group Resize Fanned Stacked Members And Top Drag Missed Row One

- Status: Verified
- Area: Dashboard grid / grouped drag and resize
- Severity: High
- Environment: Dashboard workspace, grouped panels, light and dark themes
- Observed: Resizing vertically stacked grouped panels could fan members apart, and dragging a group toward the top of the dashboard could leave the composite preview pushed below the first valid grid row. The active group shell also still read darker and more debug-like than the settled group selection state.
- Expected: Group resize preserves each member's stable row/top offset inside the selected stack while resizing the composite footprint. Group drag can target row one when row one is otherwise available. Active group visuals stay in the same neutral glass selection language as the pre-drag group state.
- Suspected cause: Group resize applied the vertical resize scale to each member's row/top offset as well as its height, which changed the spacing relationship between stacked members. Group drag converted pointer position to a grid cell with the active source item instead of the composite footprint placeholder, so top placement used the wrong dimensions and effectively clamped the group downward.
- Fix notes: Kept the composite footprint collision path from BUG-045, but changed group resize so member row/top offsets remain stable while item heights can scale. Group drag now uses the composite placeholder when mapping pointer position to a snapped cell. The active group shell, member clone, and footprint styles were tuned to neutral slate/glass borders and shadows in both themes.
- Validation: Added `test_group_drag_can_target_top_grid_row` and `test_group_resize_preserves_stacked_panel_spacing`, and extended the composite drag test with save/reload and active-shell color checks. Targeted group tests and `.venv\Scripts\python.exe -m pytest -q` passed with 50 tests. Manual Playwright smoke captured light top-row group drag plus dark group drag and stacked group resize states.

### BUG-047: Group Boundary Visuals Changed Between Selection, Move, And Resize

- Status: Verified
- Area: Dashboard grid / grouped visual states
- Severity: Medium
- Environment: Dashboard workspace, grouped panels, light and dark themes
- Observed: Initial group selection used the desired soft outline language, but active group move drew a tighter composite shell and group resize live clones inherited generic resize shadows/borders, including dark theme black-looking per-item edges.
- Expected: Group selection, active move, and active resize share the same visual boundary language. The active composite boundary uses the same visual outset, radius, border width, and border color family as the selected state, and grouped resize clones keep each member's selected outline treatment without black/debug borders.
- Suspected cause: `.group-selected`, `.dashboard-group-live-shell`, and `.dashboard-live-resize.group-selected` were styled by separate paths. The move shell used the raw member union rect and a larger shell radius, while resize clones fell through to the generic `.dashboard-live-resize` dark override.
- Fix notes: Added a shared `.dashboard-group-boundary` visual surface for active grouped move and resize. The boundary is expanded by the selected outline outset without changing the underlying collision, drag, resize, snap, or persistence geometry. Group resize live clones now receive the group-selected outline styling instead of the generic resize border/shadow.
- Validation: Added `test_group_boundary_visuals_match_selection_during_move_and_resize` for light and dark themes. It compares selected, move, and resize boundary dimensions/styles, checks per-member resize clone outlines, and rejects black border/shadow styles. Targeted group tests and `.venv\Scripts\python.exe -m pytest -q` passed with 52 tests. Manual Playwright smoke captured selected, moving, and resizing group states in light and dark themes.

### BUG-048: Collapse Did Not Restore Nested Expansion Pushdown After Group Resize

- Status: Verified
- Area: Dashboard grid / expand-collapse
- Severity: High
- Environment: Dashboard workspace, grouped panels after group resize, repeated panel expand/collapse
- Observed: After panels were resized as a group, expanding upper collapsed panels pushed lower panels down correctly. Collapsing the expanded panels could leave the lower panel stranded too far down, especially when panels were collapsed in the same order they were expanded.
- Expected: Expansion displacement remains temporary. Collapsing panels locally relaxes displaced items upward into their stable post-resize positions when space is available, without globally compacting unrelated dashboard items.
- Suspected cause: Collapse restoration used a per-panel full layout snapshot. Nested expansions captured snapshots at different temporary states, so collapsing an earlier panel could discard the only snapshot that knew the lower panel's original stable row; a later collapse then restored toward an already-pushed intermediate row.
- Fix notes: Replaced per-panel full snapshot restoration with a layout-level expansion baseline plus local upward relaxation. The baseline is captured once at the first expansion after the committed layout, group-resized coordinates included. On each collapse, only items that are below their baseline row and still in their baseline column are considered; each moves upward only as far as it can without overlapping current expanded panels, pinned items, or other occupied cells. The baseline is cleared when the expansion session ends.
- Validation: Added `test_panel_collapse_restores_local_pushdown_after_group_resize` for both normal and post-group-resize flows. It expands/collapses upper panels repeatedly in the failure-prone order, asserts the lower panel returns to its post-resize baseline, verifies widgets/unrelated items do not globally repack, checks no overlaps, and saves/reloads the collapsed layout. Targeted expand/collapse tests, grouped interaction tests, and `.venv\Scripts\python.exe -m pytest -q` passed with 54 tests. Manual Playwright smoke captured light and dark baseline, expanded pushdown, and restored collapsed states.

### BUG-049: Expanded Panel Header Used Legacy Compact Chevron Geometry

- Status: Verified
- Area: Dashboard controls / icon alignment
- Severity: Low
- Environment: Dashboard workspace, light and dark themes
- Observed: Collapsed panels used the modern header/chevron control size, but expanding a compact row-span panel made the left chevron area appear smaller and shifted, as if it had fallen back to an older compact header treatment.
- Expected: The chevron control frame and icon dimensions remain consistent across collapsed, expanded, hover, selected, grouped, and repeated expand/collapse states. Expansion may rotate the chevron, but it must not resize or shift the control.
- Suspected cause: Legacy expanded-only row-span density rules still changed `--panel-header-min-height`, `--panel-header-pad-y`, and `--panel-header-pad-x`. The pseudo-element icon dimensions stayed fixed, but the header control frame compressed around them.
- Fix notes: Kept the compact content/table density variables for shorter expanded panels, but restored the modern header control min-height and padding variables for expanded row spans. No expand/collapse JavaScript or layout behavior changed.
- Validation: Added `test_panel_chevron_size_stays_stable_across_expand_collapse_states` for light and dark themes to verify collapsed, hover, grouped, expanded, recollapsed, and repeated-cycle chevron/header metrics remain stable. Updated the content-density regression so compact panels keep content/table density without shrinking the header control frame. Targeted chevron/density tests passed, `.venv\Scripts\python.exe -m pytest -q` passed with 56 tests, and manual Playwright smoke captured light/dark collapsed, grouped, and expanded states in `test-results/manual-chevron-stability/`.

### BUG-050: Default Panel Architecture Implied Table Was A Panel Type

- Status: Verified
- Area: Dashboard architecture / panel content model
- Severity: Medium
- Environment: Dashboard workspace, default seeded panels, documentation
- Observed: The default dashboard encoded a `builder-table` / `panel-table` identity and titled the default container `Table`, which implied that a panel could inherently be a table. The intended architecture is that panels are generic layout containers while tables, menus, notes, charts, calendars, and similar experiences are widgets or content components.
- Expected: Panels expose title, color, collapse, settings, resize, pinning, grouping, and layout behavior only. Table content may exist as legacy/demo content, but table is not a core panel type.
- Suspected cause: Early demo markup used a table-filled panel as a convenient default example, and the demo identity leaked into panel keys, titles, empty-state copy, docs, and CSS token naming.
- Fix notes: Renamed the default table-identified panel to a generic content container, updated seeded panel identity/title, reframed the table markup as demo content inside the generic panel, renamed table-content CSS variables away from `panel-table`, and updated docs to state that panels are containers while tables are widgets/content. No nested widget behavior was implemented.
- Validation: Added `test_panels_are_generic_containers_not_table_panel_types` to assert the default content panel is generic, no table panel add action exists, table remains a widget/content option, and newly added panels use generic empty-panel copy. Updated E2E selectors to use the generic content panel identity while preserving existing drag, resize, group, expand/collapse, density, and persistence coverage. Targeted architecture/content-panel tests passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 57 tests.

### BUG-051: Loaded Expanded Panels Lost Collapse Restoration Baseline

- Status: Verified
- Area: Dashboard grid / expand-collapse / layout persistence
- Severity: High
- Environment: Dashboard workspace, saved layout loaded with panels already expanded
- Observed: If a panel was expanded during the current session, collapsing it restored lower displaced items upward correctly. If the same layout was saved while expanded and then reloaded, the panel started open but collapsing it did not release lower items back into the freed space.
- Expected: Collapse restoration behaves the same whether a panel was opened in the current session or loaded already open from a saved layout. Expanded footprint displacement remains temporary and should not become permanent merely because the layout was saved while open.
- Suspected cause: Same-session expansion captured `layout.__expansionBaselineSnapshot` before pushdown. Saved expanded layouts restored the open visual state and displaced rows, but did not reconstruct the pre-expansion baseline used by `relaxCollapsedExpansionDisplacement`.
- Fix notes: Persisted serializable expansion-baseline state with saved panel/widget layout records when a layout is saved during an active expansion session. On load, expanded panels reconstruct an in-memory expansion baseline and active expansion source set so collapse can run the same local upward relaxation path used in the original session. Normal collapsed saves still restore as collapsed layouts and do not require global repacking.
- Validation: Added `test_loaded_expanded_panels_restore_pushdown_on_collapse`, covering multiple expanded panels, save while open, same-session collapse, reload into expanded state, loaded-state collapse restoration, unrelated item stability, no overlaps, and saving/reloading again while collapsed. Targeted expand/collapse tests passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 58 tests.

### BUG-052: Generic Panels Still Rendered Legacy Table Content

- Status: Verified
- Area: Dashboard architecture / panel placeholders / create menu
- Severity: Medium
- Environment: Dashboard workspace, default seeded panels, add/create menu, light and dark themes
- Observed: The generic content panel still rendered old table column headers (`Name`, `Type`, `Value`, `State`), the menu and notes panels used different empty-state markup and wording, and the create menu exposed a separate `Context Panel` option even though it had no distinct behavior.
- Expected: Panels are blank layout containers. Default and newly added panels use one shared empty placeholder pattern, no generic panel renders table headers, table remains a widget/content concept, and the create menu exposes only the current generic `Panel` type.
- Suspected cause: The previous panel/table reframing renamed the default table panel but intentionally left demo table markup in place, so old content-architecture assumptions continued to leak through the panel body and tests. The create menu also retained an old future-facing context-panel label without a matching implementation.
- Fix notes: Removed the default panel table markup and table-specific panel density rules, standardized all default and custom panel bodies on the same `.panel-empty-state` placeholder with a nonfunctional `Add widgets` affordance, removed the `Context Panel` menu item, and documented context-specific panels as future architecture instead of a current create option. No nested widget behavior was added.
- Validation: Updated `test_panels_are_generic_containers_not_table_panel_types`, toolbar menu coverage, dark-mode polish coverage, and content-density coverage to assert no legacy panel table headers, one generic Panel menu item, no Context Panel option, shared placeholder structure, and no interactive placeholder behavior. Targeted panel/menu/theme/density tests passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 58 tests.

### BUG-053: Drag And Resize Did Not Auto-Scroll At Viewport Edges

- Status: Verified
- Area: Dashboard grid / drag-resize / grouped interactions
- Severity: High
- Environment: Dashboard workspace, constrained viewport, long dashboard scroll area
- Observed: During drag or resize, moving the pointer near the bottom of the viewport did not scroll the page to reveal lower dashboard space. Items could not be naturally placed or resized into newly revealed rows without manually scrolling first.
- Expected: Active widget, panel, and grouped drag/resize interactions smoothly auto-scroll near the top or bottom viewport edge, keep live ghosts and snapped footprints updating, stop immediately after leaving the edge zone or ending the interaction, and never introduce horizontal page scroll.
- Suspected cause: Drag and resize pointermove handlers only reacted to pointer events. Once the pointer reached the viewport edge, no shared scroll loop advanced the document, and resize math used viewport pointer deltas without accounting for document scroll delta.
- Fix notes: Added one shared requestAnimationFrame edge auto-scroll helper for active pointer interactions. Drag paths update snapped previews as the document scrolls under the pointer. Resize paths include vertical scroll delta in live and snapped geometry so bottom-edge scrolling extends resize into newly revealed grid rows. Follow-up tuning changed the velocity model from pixels-per-frame to capped pixels-per-second, added a short edge dwell before scrolling starts, temporarily disables scroll anchoring, and uses removable body padding as an interaction-only workspace runway instead of a permanent spacer. Cleanup runs through existing drag/resize lifecycle teardown and removes `dashboard-auto-scroll-active`, `dashboard-interaction-scroll-extended`, temporary padding, and overflow-anchor overrides.
- Validation: Added `test_edge_auto_scroll_supports_widget_drag_resize_and_upward_drag`, `test_edge_auto_scroll_extends_temporary_workspace_for_deep_drag`, `test_edge_auto_scroll_supports_panel_drag_cleanup`, `test_edge_auto_scroll_supports_panel_resize`, and `test_edge_auto_scroll_supports_group_drag_and_resize`. Coverage verifies widget drag, panel drag, widget resize, panel resize, group drag, group resize, upward auto-scroll, temporary runway creation/removal, bounded short-interval scroll speed, final committed grid state, stopped scroll loop after release, stale artifact cleanup, and no horizontal overflow. Targeted edge-scroll tests, drag/resize/group slices, and `.venv\Scripts\python.exe -m pytest -q` passed.

### BUG-054: Legacy Panel Header Classes Shifted Titles On Expansion

- Status: Verified
- Area: Dashboard controls / panel headers
- Severity: Low
- Environment: Dashboard workspace, default panels, light and dark themes
- Observed: Some default panels, especially legacy Menu and Notes containers, shifted their header title text slightly left when opened or collapsed. The generic Content panel did not make the legacy type path as obvious.
- Expected: Panel identity, title, and accent color do not affect header geometry. Collapsed, expanded, hover, selected, grouped, and active states should keep the title x-position stable.
- Suspected cause: Menu and Notes still used legacy type-specific header class names while Content and new panels used the shared generic header class. Expanded compact row-span density rules also changed `--panel-header-gap`, so the fixed chevron stayed in place while the flex title moved left.
- Fix notes: Normalized Menu and Notes headers onto the same shared `db-panel-hd db-panel-hd-items` structure used by Content and newly created panels. Kept compact expanded-panel content density but restored the modern 12px header gap so expansion cannot change title x-position. No expand/collapse, drag, resize, collision, persistence, or panel semantics changed.
- Validation: Added `test_default_panel_header_titles_do_not_shift_across_expand_collapse` for light and dark themes. It asserts Menu, Notes, and Content share the same header class/child structure, then measures each title x-position while collapsed, expanded, and recollapsed with a 1px tolerance. Targeted header/chevron tests passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 65 tests.

### BUG-055: Added Panels Entered The Grid Without Deterministic Committed Placement

- Status: Verified
- Area: Dashboard grid / panel creation / layout persistence
- Severity: High
- Environment: Dashboard workspace, repeated generic panel additions, shared widget/panel grid
- Observed: Adding several panels could scramble the dashboard. Existing widgets and panels shifted sideways or into unexpected rows, and those inferred positions could later become saved committed layout state.
- Expected: Adding a panel inserts one new spatial object into the stable dashboard layout. The new panel receives a deterministic grid position, unrelated objects keep their current coordinates, and any direct collision is resolved through local vertical pushdown rather than global repacking or sideways nearest-slot movement.
- Suspected cause: The add-panel path appended a collapsed custom panel without committed `gridCol`/`gridRow` coordinates. Because `.panel-layout` participates in the root dashboard grid through `display: contents`, the browser could auto-place the new panel visually before the app committed a layout position. Later resolver/save/load paths then had to infer placement from partially committed state, allowing global sparse resolution to make unrelated sideways moves permanent.
- Fix notes: The add-panel path now synchronizes existing committed dashboard coordinates, computes a deterministic append target from the current panel spatial order, assigns the new panel's grid position before insertion, and commits the insert through a local vertical pushdown helper. The helper treats all unrelated items as fixed obstacles and moves only objects that directly overlap the inserted footprint; moved objects keep their columns and slide downward to the first valid row. Pinned items remain fixed, and the helper falls back to the existing sparse slot finder only if the inserted target itself conflicts with a pinned footprint.
- Validation: Added `test_adding_many_panels_appends_without_global_layout_scramble` and `test_panel_add_collision_uses_local_vertical_pushdown`. Coverage adds eight panels, verifies default widgets/panels do not move, checks custom panel positions are committed and row-major, rejects duplicate occupied grid cells and visible overlaps, saves/reloads to confirm deterministic persistence, verifies add-delete-add remains stable, and verifies a deliberate add-target collision pushes only the blocker downward while unrelated items retain their original coordinates. Targeted add/layout/save tests passed, grouped interaction slices passed, `.venv\Scripts\python.exe -m pytest -q` passed with 67 tests, and a Chromium smoke added 10 panels in dark mode with no duplicate cells or horizontal overflow.

### BUG-056: Edge Auto-Scroll Runway Grew In Visible Steps

- Status: Verified
- Area: Dashboard grid / drag-resize / motion polish
- Severity: Medium
- Environment: Dashboard workspace, bottom-edge drag and resize auto-scroll
- Observed: Edge auto-scroll could create reachable lower workspace correctly, but the temporary scrollable area appeared to grow in perceptible steps. The live interaction stayed functional, yet the viewport motion felt bouncy as new rows became reachable.
- Expected: Logical snapped footprints may update at grid thresholds, but page scrolling and the temporary workspace runway should grow smoothly in pixels. Live drag/resize surfaces should remain pointer-continuous, with no full-page bounce when extra workspace is created.
- Suspected cause: The helper filled the whole missing bottom runway immediately when remaining scroll space dropped below the desired buffer. Even with root/body scroll anchoring disabled, that large padding change could make scroll-height expansion visually step-like while snapped previews continued updating discretely.
- Fix notes: The interaction runway now tracks a target height and approaches it in bounded requestAnimationFrame increments. This preserves the logical grid/preview snapping while decoupling the scrollable-space extension from row-sized placement jumps. Scroll anchoring is also disabled on the active dashboard host for the interaction lifetime, then restored with the existing cleanup path.
- Validation: Added RAF-frame scroll/runway cadence assertions to edge auto-scroll coverage. Deep widget drag, panel resize, and group drag now sample active auto-scroll frames and reject row-sized scroll jumps or large runway growth jumps while still verifying final commit, cleanup, no stale classes, and no horizontal overflow. Targeted edge auto-scroll tests passed, grouped interaction slices passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 67 tests.

### BUG-057: Timeframe Minimum Footprint Was Calibrated To Spacious Layout

- Status: Verified
- Area: Widgets / resize / adaptive density
- Severity: Medium
- Environment: Dashboard workspace, timeframe widget resize, light and dark themes
- Observed: The timeframe command widget could only shrink to four grid columns even though its controls could remain usable with a tighter adaptive-density layout.
- Expected: Dense widgets should attempt compact spacing, reduced padding, condensed control widths, and wrapping before increasing their minimum required grid span. The timeframe widget should resize one column smaller while keeping controls visible, usable, readable, and unclipped.
- Suspected cause: The previous minimum-size fix correctly introduced per-widget minimum span metadata, but it calibrated the timeframe floor to the comfortable/spacious control layout instead of the smallest usable adaptive layout.
- Fix notes: Reduced the timeframe widget `data-min-w` and shared controls fallback from 4 columns to 3 columns. Added a span-3 compact density state for the timeframe command surface that tightens cluster gaps, surface padding, preset widths, selected-timeframe width, and icon button size while preserving usable hit areas and existing hover/focus treatment. Added the adaptive-density-first sizing rule to engineering and pre-overhaul architecture docs.
- Validation: Updated `test_timeframe_resize_clamps_to_adaptive_density_minimum` for light and dark themes. The test resizes below the allowed floor, verifies the live snapped preview and final commit clamp at span 3, checks compact density values, asserts visible controls are not clipped or undersized, exercises hover/focus states, and verifies no overlaps. Updated group resize tests to use the new minimum. Targeted timeframe/group resize tests passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 68 tests.

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
