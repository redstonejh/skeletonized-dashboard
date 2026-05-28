# Regression Archive

Tracks regression test sessions: what was run, what failed, how each failure was classified, and what was fixed or deferred.

---

## Session 2026-05-28 — Bug Classes 1–5, 7–10 Initial Run

### Summary

32 new regression tests added to `tests/test_dashboard_builder_e2e.py` (lines 22313–22876) were run for the first time. All 32 now pass.

The 226-test full suite still has ~99 failures from stale `.timeframe-widget` selectors and other pre-commit-0d6d254 expectations. Those are explicitly deferred and were not touched in this session.

### Run command

```
.venv\Scripts\python.exe -m pytest -v tests/test_dashboard_builder_e2e.py -k \
  "test_widget_chrome or not_secondary_form or does_not_open_customization or \
  portals_to_overlay_layer or pointer_events_are_none_after_close or \
  anchor_delete_via_tool_drawer or left_click_divider_does_not or \
  right_click_divider_opens or right_click_panel_opens_tool_drawer or \
  right_click_stat_widget_opens or right_click_timeframe_widget or \
  left_click_stat_widget or stat_widget_click_leaves or \
  anchor_renders_inside_anchor_layer or anchor_delete_then_add or \
  anchor_positions_are_compact or add_menu_closes_after or \
  add_menu_pointer_events_pass_through or add_menu_submenu_alignment or \
  background_change_applies_immediately or overlay_layer_does_not_intercept or \
  background_adaptive_css_variables or content_well_has_visible_border or \
  content_well_inset_is_consistent or workbench_panel_closes_on_escape or \
  tool_drawer_closes_when_opening or tool_drawer_closes_on_outside or \
  right_click_anchor_opens_tool_drawer"
```

Result before fixes: **27 passed, 5 failed**
Result after fixes: **32 passed, 0 failed**

### Failure classifications and fixes

| Test | Classification | Fix |
|------|---------------|-----|
| `test_menu_pointer_events_are_none_after_close` | **Real behavior gap** — no Escape handler for widget tool drawers | Added `keydown` Escape listener in `app.js` calling `closeInactiveDashboardTools()` |
| `test_right_click_divider_opens_tool_drawer` | **Real behavior gap** — `.workspace-divider` excluded from `surfaceResponseSelector`, so contextmenu never fired | Extended contextmenu handler in `app.js` to also match `.panel-layout > .workspace-divider` |
| `test_right_click_timeframe_widget_opens_tool_drawer` | **Stale test assumption** — test used category `"time"`; actual category is `"controls"` | Changed `"time"` → `"controls"` in test |
| `test_anchor_positions_are_compact_ordered_stack` | **Test robustness** — menu items animate-in; 3rd sequential hover timed out before element stability | Added `page.wait_for_timeout(300)` inside the 3-anchor loop |
| `test_chart_widget_content_well_inset_is_consistent` | **Two stale assumptions**: (1) subcategory `"charts"` vs DOM attr `"Charts"` (capital C); (2) `>= 0` overflow guard assumed wrong containment direction (`runtime-chart-stage` is the *parent* of `widget-content-well`, not the child — insets are legitimately −3 on all sides from 1px border + 2px padding) | (1) `"charts"` → `"Charts"`; (2) replaced overflow assertions with symmetry checks: `abs(left − right) <= 1`, `abs(top − bottom) <= 1`, `all(abs(v) <= 8)` |

### Deferred: legacy full-suite failures

The full suite (~226 tests) has approximately 99 additional failures. These are **not regressions introduced in this session** — they predate it and stem from:

- Stale `.timeframe-widget` selectors (correct class is `.timeframe-widget-card` since commit 0d6d254)
- Removed `.panel-settings-toggle` expectations (element removed in commit 0d6d254)
- Other pre-0d6d254 contract assumptions

These are tracked separately and require scoped triage before any mass-fix. Do not attempt to bulk-update them without first understanding each failure cluster.

### Commit

`4c2c240` — "Stabilize current dashboard regression tests"

---

## Session 2026-05-28 — Bug Class 6: Workbench Panel Overlay Dismissal

### Summary

Root cause identified and fixed: `closeInactiveDashboardTools` used a DOM traversal (`item.querySelector(":scope > .widget-tools .widget-workbench-panel")`) to find the workbench panel, but `portalFloatingMenu` physically moves the panel to the `.workspace-menu-overlay-layer` when the workbench opens. The traversal always returned null after portal, so the panel was never hidden.

Fix: replaced the DOM traversal with a stored-reference lookup (`item.__widgetWorkbenchPanel`) and added a `restoreFloatingMenu` call before hiding, so the element returns to its original parent and the portal state is cleaned up correctly.

3 new regression tests added (35 total in the scoped suite, all passing).

### Files changed

| File | Change |
|------|--------|
| `app/static/app.js` | `closeInactiveDashboardTools` line ~1250: use `item.__widgetWorkbenchPanel` ref + `restoreFloatingMenu` instead of DOM traversal |
| `tests/test_dashboard_builder_e2e.py` | 3 new tests appended after line 22872 |

### Run command (35-test scoped suite)

```
.venv\Scripts\python.exe -m pytest -v tests/test_dashboard_builder_e2e.py -k \
  "test_widget_chrome or not_secondary_form or does_not_open_customization or \
  portals_to_overlay_layer or pointer_events_are_none_after_close or \
  anchor_delete_via_tool_drawer or left_click_divider_does_not or \
  right_click_divider_opens or right_click_panel_opens_tool_drawer or \
  right_click_stat_widget_opens or right_click_timeframe_widget or \
  left_click_stat_widget or stat_widget_click_leaves or \
  anchor_renders_inside_anchor_layer or anchor_delete_then_add or \
  anchor_positions_are_compact or add_menu_closes_after or \
  add_menu_pointer_events_pass_through or add_menu_submenu_alignment or \
  background_change_applies_immediately or overlay_layer_does_not_intercept or \
  background_adaptive_css_variables or content_well_has_visible_border or \
  content_well_inset_is_consistent or workbench_panel_closes_on_escape or \
  tool_drawer_closes_when_opening or tool_drawer_closes_on_outside or \
  right_click_anchor_opens_tool_drawer or workbench_closes_on_outside_click or \
  workbench_closes_on_escape_from_outside or opening_tool_drawer_closes_open_workbench"
```

Result: **35 passed, 0 failed**

### New tests and what they cover

| Test | What it verifies |
|------|-----------------|
| `test_workbench_closes_on_outside_click` | Clicking `.workspace-identity-island` removes `widget-workbench-open` and hides the panel |
| `test_workbench_closes_on_escape_from_outside` | Pressing Escape removes `widget-workbench-open` and hides the panel |
| `test_opening_tool_drawer_closes_open_workbench` | Dispatching contextmenu on a second widget closes the first widget's open workbench |

All three use real DOM interactions (not JS-injection `open_tools`) so they exercise the actual `closeInactiveDashboardTools` code path.

### Why the fix is architectural, not a special case

`closeInactiveDashboardTools` is the single shared dismiss function for ALL configuration surfaces (tool drawers, workbench panels, panel tool drawers). The fix makes the workbench branch use the same stored-reference + restore pattern that tool drawers already used (`item.__dashboardToolDrawer` via `restoreDashboardToolDrawer`). No new close paths were added.

### Deferred: legacy full-suite failures

Same ~99 failures as noted in the previous session entry. Not touched.

### Commit

`59ad0d8` — "Fix workbench panel dismissal via shared overlay close architecture"

---

## Session 2026-05-28 — Content-Well Border Geometry Normalization

### Summary

Content-well border geometry was inconsistent across widget types:
- Table/map/calendar/document cards inherited `stat-card`'s asymmetric `padding: 10px 14px 9px`, making the left/right inset 14px vs top 10px / bottom 9px.
- Content-well `border-radius` used `calc(var(--widget-composition-stage-radius) - 2px)` = 6px (wrong base variable, should derive from `var(--radius-md)` = 16px).
- Chart stage had hardcoded asymmetric `padding: 2px 3px` overriding the shared variable, then `:has(.widget-library-surface)` overrode that with `2px`.
- Chart stage `border-radius: 8px` from a shared rule produced corner mismatch with card's 16px outer radius.

Root cause: multiple hardcoded per-widget overrides diverged from shared geometry contract variables.

Fix: added a library-widget-card padding rule using `var(--widget-composition-stage-pad)`, corrected content-well `border-radius` formula, removed asymmetric chart stage `padding`, set chart stage `border-radius: var(--radius-md)`, and changed chart stage `:has(.widget-library-surface)` padding to use the variable.

5 content-well tests pass. 37-test scoped suite passes.

### Root cause

| Cause | Location | Effect |
|-------|---------|--------|
| No library-widget-card padding override | `dashboard-grid.css` ~2480 | Table/map/calendar/document inherit `stat-card`'s asymmetric `padding: 10px 14px 9px` |
| Wrong `border-radius` base variable | `dashboard-grid.css` `.widget-content-well` rule | `calc(var(--widget-composition-stage-radius) - 2px)` = 6px; correct is `calc(var(--radius-md) - var(--widget-composition-stage-pad))` = 12px |
| Hardcoded chart stage `padding: 2px 3px` | `dashboard-grid.css` ~6165 | Overrides shared `var(--widget-composition-stage-pad)` with asymmetric values |
| Hardcoded `padding: 2px` in `:has()` rule | `dashboard-grid.css` ~6177 | Applies wrong pad when library-surface present in stage |
| Chart stage `border-radius: 8px` | Shared stage rule `dashboard-grid.css` ~6134 | Concentric corner mismatch with card's `var(--radius-md)` = 16px |

### Files changed

| File | Change |
|------|--------|
| `app/static/dashboard-grid.css` | 5 edits: add library-widget-card `padding: var(--widget-composition-stage-pad)` rule; fix `border-radius` to `calc(var(--radius-md) - var(--widget-composition-stage-pad))`; remove asymmetric chart stage padding; add chart stage `border-radius: var(--radius-md)`; update `:has()` padding to use variable |
| `tests/test_dashboard_builder_e2e.py` | Updated `test_table_widget_content_well_inset_is_consistent` (was trivially 0 — same element); updated `test_chart_widget_content_well_inset_is_consistent` tighter bounds; added `test_chart_and_table_content_well_outer_gap_are_comparable`; added `test_content_well_border_radius_is_rounded` |

### Geometry values standardized

| Property | Value (standard density) | Formula |
|----------|--------------------------|---------|
| Library widget card padding | 4px | `var(--widget-composition-stage-pad)` |
| Chart stage padding | 4px | `var(--widget-composition-stage-pad)` |
| Chart stage outer border-radius | 16px | `var(--radius-md)` |
| Content-well border-radius | 12px | `calc(var(--radius-md) - var(--widget-composition-stage-pad))` |
| Content-well border width | 1px | unchanged |
| Table card-to-well measured gap | 5px (all sides) | 1px card border + 4px card padding |
| Chart card-to-well measured gap | 6px (all sides) | 1px card border + 1px stage border + 4px stage padding |
| Density scaling | automatic | `--widget-composition-stage-pad`: 2/3/4/5/6px for tiny/compact/standard/expanded/rich |

### Exact tests run

```
.venv\Scripts\python.exe -m pytest -q tests/test_dashboard_builder_e2e.py -k "content_well"
```
Result: **5 passed, 226 deselected**

37-test scoped suite also run and passes.

### Manual browser verification

Playwright headless geometry dump confirmed:

```
table-widget-card
  outer gap   top=5  right=5  bottom=5  left=5
  well radius 12px  |  well border 1px
  horiz sym diff: 0  vert sym diff: 0

chart-widget-card
  outer gap   top=6  right=6  bottom=6  left=6
  well radius 12px  |  well border 1px
  horiz sym diff: 0  vert sym diff: 0
```

Both gaps are symmetric (zero horizontal and vertical diff). The 1px difference between table (5px) and chart (6px) is structural: chart has an extra stage border between card and well.

### What was intentionally not changed

- Widget shell material (colors, gradients, shadows, backgrounds)
- Chart rendering behavior beyond stage containment geometry
- Table data styling (`runtime-table-tanstack` internals)
- Stat, timeframe, search, filter, image, video, map, calendar, document shell shapes beyond card padding correction
- Drag, resize, collision, persistence code paths
- Full test suite (only `content_well` tests targeted)

### Deferred: legacy full-suite failures

Same ~99 failures as noted in previous session entries. Not touched.

### Commit

(pending)
