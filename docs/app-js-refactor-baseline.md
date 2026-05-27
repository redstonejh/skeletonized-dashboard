# app.js Refactor Baseline

Date: 2026-05-27

Branch: `clean-main`

HEAD at audit start: `32ec4e7`

Scope: audit only. No behavior refactor started.

Working tree note: this baseline was captured with existing uncommitted changes in `app/static/app.js`, `app/static/dashboard-grid.css`, `app/static/themes.css`, `app/static/tokens.css`, `app/static/widget-registry.js`, `app/templates/dashboard.html`, and `tests/test_dashboard_builder_e2e.py`.

## Responsibility Zones

`app/static/app.js` is currently a single DOMContentLoaded-centered runtime with multiple public browser runtimes exported on `window`. The useful extraction seams are below.

### Workspace State

Primary line ranges:

- `70-198`: workspace event bus, toasts, activity normalization, meta widget refresh scheduling.
- `752-856`: localStorage key ownership, profile/slot keys, JSON helpers.
- `1192-1379`: group selection, clipboard root state, live undo/redo state capture.
- `2144-2244`: workspace object metadata, object types, capabilities, context model constants.
- `2533-2807`: data source/context persistence and resolved context inheritance.
- `3131-3251`: divider/region synchronization and spatial region derivation.
- `13746`: `window.dashboardSpatialRuntime`.
- `14511`: `window.dashboardWorkspaceEvents`.
- `14694`: `window.dashboardContextEngine`.

Owned concerns:

- Current layout/profile identity.
- Workspace events and activity feed inputs.
- Selection/group state.
- Workspace object identity and capability metadata.
- Spatial context inheritance and region model.

Extraction target:

- `workspace-state.js`
- `workspace-events.js`
- `context-engine.js`

### Widget Creation And Rendering

Primary line ranges:

- `6194-6258`: widget runtime DOM replacement and registry-render bridge.
- `6220-6288`: `renderWidgetRuntimeContent`.
- `6533`: `window.dashboardWidgetSettingsRuntime`.
- `6670`: `window.dashboardQueryRuntime`.
- `6700`: `window.dashboardWidgetRuntimeMeaning`.
- `6800`: `window.dashboardAssetRuntime`.
- `7248-7295`: `createCustomWidget`.
- `8287-8379`: widget tools, span, grid position helpers.
- `12210-12335`: `saveWidgetLayouts` and `initWidgetLayout`.
- `16314-16426`: Add Object widget creation path.

Owned concerns:

- Creating registry-backed widget DOM.
- Runtime rendering/hydration.
- Widget tools/settings wiring.
- Widget persistence.
- Widget query state and runtime meaning.

Extraction target:

- `widget-controller.js`
- `widget-renderer.js`
- `widget-settings-runtime.js`
- Keep `widget-registry.js` as the definition source.

### Panel Behavior

Primary line ranges:

- `5399-5454`: `createCustomPanel`.
- `5455-5520`: `savePanelLayouts`.
- `7296-7486`: panel child widget helpers and panel-local empty state.
- `9708-9762`: collapse/expansion displacement restoration.
- `10721-10848`: panel entry, absorb/extract widget containment.
- `13108-13735`: `initPanel`, expand/collapse, panel drag, panel resize.
- `16202-16313`: Add Object panel/divider creation.

Owned concerns:

- Panel creation and persistence.
- Expand/collapse state.
- Header/tool interactions.
- Panel-local widget grids and child ownership.
- Widget absorb/extract transition.

Extraction target:

- `panel-controller.js`
- `panel-containment.js`

### Drag And Resize

Primary line ranges:

- `956-1185`: hover/tool interaction gating used by drag and resize.
- `1380-1559`: resize auto-zoom camera.
- `8387-8615`: edge auto-scroll.
- `8618-8713`: resize lifecycle.
- `8714-8830`: resize previews and live surfaces.
- `10886-11651`: ordered drag lifecycle and panel entry/exit drag handling.
- `11652-12209`: group resize helpers.
- `11960-12209`: `runGroupResize`.
- `13108-13735`: panel move/resize event wiring.
- `12286-13035`: widget move/resize event wiring in `initWidgetLayout`.

Owned concerns:

- Pointer capture and cancellation.
- Live ghost/preview surfaces.
- Edge auto-scroll and resize camera.
- Group move/resize.
- Final drag/resize commit handoff.

Extraction target:

- `drag-controller.js`
- `resize-controller.js`
- `edge-autoscroll.js`
- `group-interactions.js`

### Collision And Reflow

Primary line ranges:

- `2000-2090`: grid constants and metrics.
- `8831-8950`: grid snapshots and expansion baseline snapshots.
- `8950-9002`: bounds, overlap, row-bucket collision candidates.
- `9009-9298`: local collision layout, default grid sync, normalization.
- `9306-9384`: ordered/global item selectors and geometry records.
- `9483-10191`: scroll floor, placement, sparse slots, insertion targets.
- `10431-10656`: group collision/move placement.
- `10545-10650`: ordered packing and FLIP reflow.

Owned concerns:

- Grid metrics and coordinate conversion.
- Occupancy maps.
- Sparse placement.
- Local displacement.
- Ordered packing.
- FLIP/reflow animation.

Extraction target:

- `grid-metrics.js`
- `collision-engine.js`
- `reflow-engine.js`

### Save And Load

Primary line ranges:

- `752-856`: storage key definitions and JSON helpers.
- `1276-1699`: live layout undo/redo snapshots and restore.
- `5455-5520`: panel layout serialization.
- `12210-12335`: widget layout serialization.
- `13750-14143`: canonical persistence snapshots, validation, save/load/migration.
- `14149`: `window.dashboardPersistenceRuntime`.
- `15536-15886`: layout source selector activation, save, load, generated source persistence.
- `16439-16524`: undo/redo keyboard and command handling.
- `16536-16633`: reset behavior.

Owned concerns:

- localStorage profiles/slots.
- Layout source identity.
- Save/load/reset.
- Undo/redo.
- Canonical persistence validation.

Extraction target:

- `persistence.js`
- `layout-source-runtime.js`
- `undo-runtime.js`

### Menus

Primary line ranges:

- `295-388`: shared menu overlay/portal layer.
- `389-480`: background menu and preview.
- `559-610`: status menus.
- `715-747`: dashboard switcher menu.
- `15536-15886`: layout selector menu and activation.
- `15912-16435`: Add Object categories, submenus, and creation dispatch.
- `17286-17754` in tests currently cover object settings menu behavior.

Owned concerns:

- Top-level portal positioning.
- Add Object menu rendering and submenu placement.
- Layout selector rendering.
- Menu close/open lifecycles.

Extraction target:

- `menu-overlay.js`
- `add-object-menu.js`
- `layout-selector.js`

### Hover And Interaction State

Primary line ranges:

- `956-1185`: surface response, hover zones, tool open gating.
- `1192-1275`: group-selection interaction state.
- `1564-1602`: cleanup of transient undo/interaction artifacts.
- `16863-17075` in tests currently cover drag/menu suppression and settings-menu restoration.
- `17626-18222` in tests currently cover widget controls and hover material behavior.

Owned concerns:

- Passive hover response.
- Hover ownership suppression.
- Tool drawer open state.
- Interaction locks and body classes.
- Cleanup after drag/resize/delete.

Extraction target:

- `interaction-state.js`
- `hover-controller.js`
- `tool-drawer-controller.js`

### Engineer Mode

Primary line ranges:

- `482-550`: Engineer Mode toggle state and listeners.
- `3511`: `window.dashboardDataSubstrateRuntime`.
- `3750-4485`: graph endpoints, relationship routing, wire nodules.
- `4407`: `renderWorkspaceWireNodules`.
- `14161-14402`: relationship runtime, ports, lineage, dataflow links.
- `14463`: `window.dashboardEngineerMode`.
- `11178-11936` in tests cover data filters, dataset origins, underlay, shift, minimap gating.

Owned concerns:

- Engineer visibility gate.
- Backend/dataflow widget visibility.
- Output-to-input wires.
- Dataset origin ports and lineage.
- Relationship graph API.

Extraction target:

- `engineer-mode.js`
- `relationship-runtime.js`
- `wire-renderer.js`
- `data-substrate-runtime.js`

### Demo Layouts And Data

Primary line ranges:

- `14797-15023`: generated workspace profiles, demo workspace reset, preset application, demo workspace runtime.
- `15024-15488`: AI workspace action types, action execution helpers, validation.
- `15489`: `window.dashboardWorkspaceActionRuntime`.
- `15536-15886`: layout source integration for saved, demo, AI example, and generated workspaces.

Owned concerns:

- Demo layout generation.
- AI example layout activation.
- Generated layout registry.
- Workspace action execution.
- AI workspace validation.

Extraction target:

- `demo-workspace-runtime.js`
- `workspace-action-runtime.js`
- `ai-workspace-operator.js`

## Baseline Test Results

Full suite:

```powershell
.venv\Scripts\python.exe -m pytest -q
```

Result: timed out after 15 minutes. Treat as inconclusive, not pass/fail.

Targeted passing groups:

```powershell
.venv\Scripts\python.exe -m pytest `
  tests/test_dashboard_builder_e2e.py::test_app_dashboard_settings_and_assets_load `
  tests/test_dashboard_builder_e2e.py::test_add_object_menu_uses_categorized_right_expanding_submenus `
  tests/test_dashboard_builder_e2e.py::test_nav_dropdowns_use_floating_glass_menu_system_without_restyling_object_settings `
  tests/test_dashboard_builder_e2e.py::test_layout_selector_loads_demo_and_ai_workspace_sources_without_polluting_saved_layouts `
  -q
```

Result: 4 passed.

```powershell
.venv\Scripts\python.exe -m pytest `
  tests/test_dashboard_builder_e2e.py::test_widget_runtime_registry_drives_real_widget_contracts `
  tests/test_dashboard_builder_e2e.py::test_every_add_menu_widget_entry_creates_registry_backed_runtime_widget `
  tests/test_dashboard_builder_e2e.py::test_demo_data_runtime_generates_deterministic_transformable_scenarios `
  tests/test_dashboard_builder_e2e.py::test_demo_workspace_presets_render_visible_data_and_persist_panel_scope `
  -q
```

Result: 4 passed.

```powershell
.venv\Scripts\python.exe -m pytest `
  tests/test_dashboard_builder_e2e.py::test_ai_operator_plans_executes_and_persists_visual_dashboard `
  tests/test_dashboard_builder_e2e.py::test_ai_operator_what_if_uses_derived_fields_and_engineer_transparency `
  tests/test_dashboard_builder_e2e.py::test_ai_operator_strict_validation_rejects_unsupported_and_untraceable_actions `
  tests/test_dashboard_builder_e2e.py::test_ai_assistant_right_rail_builds_workspace_from_prompt `
  -q
```

Result: 4 passed.

```powershell
.venv\Scripts\python.exe -m pytest `
  tests/test_dashboard_builder_e2e.py::test_widget_drags_directly_into_open_panel_and_round_trips `
  tests/test_dashboard_builder_e2e.py::test_panel_drag_absorbs_full_size_widgets_by_expanding_panel `
  tests/test_dashboard_builder_e2e.py::test_panel_contained_widgets_use_same_registry_runtime_contracts `
  tests/test_dashboard_builder_e2e.py::test_panel_context_is_additional_widget_inheritance_layer `
  tests/test_dashboard_builder_e2e.py::test_panel_internal_widget_grid_uses_consistent_inset_spacing `
  -q
```

Result: 4 passed, 1 failed.

```powershell
.venv\Scripts\python.exe -m pytest `
  tests/test_dashboard_builder_e2e.py::test_engineer_mode_dataflow_links_are_gated_normalized_and_persisted `
  tests/test_dashboard_builder_e2e.py::test_engineer_wire_nodules_drag_to_create_directional_dataflow_link `
  tests/test_dashboard_builder_e2e.py::test_data_filter_widget_registers_configures_persists_and_exposes_dataflow_ports `
  tests/test_dashboard_builder_e2e.py::test_dataset_origin_node_browses_substrate_and_exposes_typed_outputs `
  tests/test_dashboard_builder_e2e.py::test_shift_widget_reacts_to_dataflow_signal_and_persists_config `
  -q
```

Result: 5 passed.

```powershell
.venv\Scripts\python.exe -m pytest `
  tests/test_dashboard_builder_e2e.py::test_timeframe_widget_is_createable_and_uses_widget_system `
  tests/test_dashboard_builder_e2e.py::test_timeframe_control_widget_writes_context_time_range_and_persists `
  tests/test_dashboard_builder_e2e.py::test_table_widget_consumes_context_rows_density_and_persistence `
  tests/test_dashboard_builder_e2e.py::test_chart_widget_registry_renders_chart_types_and_context_rows `
  tests/test_dashboard_builder_e2e.py::test_filter_control_widget_emits_context_filters_and_persists `
  -q
```

Result: 3 passed, 2 failed.

```powershell
.venv\Scripts\python.exe -m pytest `
  tests/test_dashboard_builder_e2e.py::test_panel_crud_controls_and_visual_state `
  tests/test_dashboard_builder_e2e.py::test_widget_crud_controls_resize_and_delete `
  tests/test_dashboard_builder_e2e.py::test_drag_ghost_grid_snapping_and_collision_handling `
  tests/test_dashboard_builder_e2e.py::test_surface_drag_shortcut_uses_move_system_without_replacing_body_click `
  tests/test_dashboard_builder_e2e.py::test_panel_surface_drag_shortcut_preserves_explicit_move_handle `
  -q
```

Result: 5 passed.

```powershell
.venv\Scripts\python.exe -m pytest `
  tests/test_dashboard_builder_e2e.py::test_timeframe_widget_uses_shared_resize_system `
  tests/test_dashboard_builder_e2e.py::test_widget_vertical_resize_commits_rows_and_respects_widget_types `
  tests/test_dashboard_builder_e2e.py::test_resize_preview_snaps_to_grid_and_persists `
  tests/test_dashboard_builder_e2e.py::test_widget_resize_lifecycle_repeats_cancels_and_persists `
  -q
```

Result: 3 passed, 1 failed.

```powershell
.venv\Scripts\python.exe -m pytest `
  tests/test_dashboard_builder_e2e.py::test_layout_save_load_round_trips_exact_item_state `
  tests/test_dashboard_builder_e2e.py::test_group_mode_and_layout_save_load_reset `
  tests/test_dashboard_builder_e2e.py::test_ctrl_z_undoes_widget_move_and_resize_one_commit_at_a_time `
  tests/test_dashboard_builder_e2e.py::test_ctrl_z_undoes_add_panel_and_expand_collapse `
  -q
```

Result: 4 passed.

```powershell
.venv\Scripts\python.exe -m pytest `
  tests/test_dashboard_builder_e2e.py::test_widgets_and_panels_share_global_occupancy `
  tests/test_dashboard_builder_e2e.py::test_pinned_items_are_not_displaced_by_drag `
  tests/test_dashboard_builder_e2e.py::test_collision_prefers_below_then_left_before_forward_for_widgets_and_panels `
  tests/test_dashboard_builder_e2e.py::test_drag_collision_preview_does_not_stick_to_neighbors `
  -q
```

Result: 4 passed.

```powershell
.venv\Scripts\python.exe -m pytest `
  tests/test_dashboard_builder_e2e.py::test_passive_object_hover_reactions_are_suppressed_during_drag_and_resize `
  tests/test_dashboard_builder_e2e.py::test_open_settings_menu_hides_during_drag_and_resize_then_restores `
  tests/test_dashboard_builder_e2e.py::test_object_settings_click_and_hover_share_menu_geometry `
  tests/test_dashboard_builder_e2e.py::test_navbar_dropdowns_layer_above_object_controls `
  -q
```

Result: 3 passed, 1 failed.

```powershell
.venv\Scripts\python.exe -m pytest `
  tests/test_dashboard_builder_e2e.py::test_widget_surface_controls_use_translucent_widget_glass `
  tests/test_dashboard_builder_e2e.py::test_panel_widget_hover_focus_surface_parity `
  tests/test_dashboard_builder_e2e.py::test_panel_child_widget_hover_does_not_lift_parent_panel `
  tests/test_dashboard_builder_e2e.py::test_widget_runtime_meaning_drives_restrained_environmental_response `
  -q
```

Result: 3 passed, 1 failed.

Unique targeted passing tests: 46.

## Current Failing Tests

These failures reproduced when rerun individually, so they are not currently classified as flaky.

1. `test_panel_internal_widget_grid_uses_consistent_inset_spacing`
   - Failure: `open_tools(widget)` clicks `.panel-settings-toggle`, but `.panel-tool-drawer` remains hidden.
   - Area: panel containment / widget tool drawer visibility.

2. `test_chart_widget_registry_renders_chart_types_and_context_rows`
   - Failure: test expected `"No data source"` immediately after chart creation; chart instead rendered demo data with `"36 groups / demo"`.
   - Area: chart runtime / demo-data fallback expectations.

3. `test_filter_control_widget_emits_context_filters_and_persists`
   - Failure: direct click on `.widget-add-action[data-widget-kind="filter"]` timed out because the item exists but is hidden until the Controls category/submenu is opened.
   - Area: Add Object menu test flow / filter widget creation path.

4. `test_widget_resize_lifecycle_repeats_cancels_and_persists`
   - Failure: `open_tools(widget)` clicks `.panel-settings-toggle`, but `.panel-tool-drawer` remains hidden.
   - Area: widget tool drawer visibility / resize setup.

5. `test_object_settings_click_and_hover_share_menu_geometry`
   - Failure: after repositioning widget to column 6, hover on settings toggle does not reveal `.panel-tool-drawer`.
   - Area: widget settings drawer hover geometry / edge placement.

6. `test_panel_widget_hover_focus_surface_parity`
   - Failure: panel hover border and widget hover border differ beyond tolerance.
   - Area: panel/widget material parity.

## Flaky Tests

None observed in this baseline pass. Every failed targeted test was rerun individually and failed again.

The full suite timing out after 15 minutes is an execution/runtime baseline issue, not a flaky-test classification.

## Known Manual Bugs / Risks

- A prior manual browser screenshot showed `127.0.0.1` connection refused when no local server was running. This is an environment/startup issue to account for during manual inspection, not an application behavior failure.
- Current automated failures indicate a manual risk around widget tool drawer discoverability/visibility, especially for compact or edge-positioned widgets.
- Current automated failures indicate a material parity risk: widget hover border response is not matching panel hover response within the existing tolerance.
- No separate manual browser inspection was performed for this baseline because no UI behavior was intentionally changed in this pass.

## Refactor Plan

Refactor one module at a time. Each extraction should preserve public behavior and keep the original call sites working until tests prove the seam is stable.

### Phase 0: Freeze Baseline

- Keep this document as the starting point.
- Do not move code until the current targeted failures are either fixed or explicitly accepted as pre-existing baseline failures.
- For each extraction, run the nearest targeted tests plus any currently failing baseline test in that area.

### Phase 1: Pure Helpers And Storage Keys

Extract low-risk pure utilities first:

- JSON/localStorage helpers.
- Storage key builders.
- HTML escaping.
- ID helpers.
- Color normalization helpers.

Target module:

- `app/static/dashboard-storage.js`
- `app/static/dashboard-utils.js`

Risk:

- Low behavior risk, but high import-order risk because many later systems depend on these helpers.

Validation:

- App load.
- Layout save/load.
- Demo/layout selector tests.

### Phase 2: Menu Overlay And Add/Layout Menus

Extract the top-level menu portal before moving drag or grid code.

Target modules:

- `menu-overlay.js`
- `add-object-menu.js`
- `layout-selector.js`

Keep:

- Existing classes and DOM structure.
- Main navbar unchanged.
- Object settings menus untouched unless explicitly part of a later task.

Validation:

- Add Object menu tests.
- Layout selector demo/AI tests.
- Menu layering tests.

### Phase 3: Widget Runtime Boundary

Extract widget lifecycle glue while leaving registry definitions in `widget-registry.js`.

Target modules:

- `app/static/widget-runtime.js` (current extraction target)
- `widget-settings-runtime.js`

Keep:

- `renderWidgetRuntimeContent` behavior.
- Widget config persistence format.
- Widget tools DOM and class names.

Validation:

- Widget registry contract.
- Every Add Object entry creates a runtime widget.
- Stat/table/chart/timeframe/filter/media/system widget slices.
- Current tool-drawer failing tests before and after.

Status update, 2026-05-27:

- Extracted registry-backed widget creation, hydration, render replacement, layer/density metadata, runtime meaning application, widget tools DOM insertion, and widget grid footprint helpers into `app/static/widget-runtime.js`.
- `app/static/app.js` still owns query refresh orchestration, settings/workbench event handling, and workspace-level save/load dispatch until later narrower extractions.
- Fixed the compact/overlapped widget tool hit-test regression by containing widget child z-index stacks at the widget-card boundary.

### Phase 4: Panel Controller And Containment

Extract panel behavior only after widget runtime is stable.

Target modules:

- `panel-controller.js`
- `panel-containment.js`

Keep:

- Panel-local child ownership.
- Header/chevron click behavior.
- Expand/collapse baseline behavior.
- Child widget registry/runtime parity.

Validation:

- Panel CRUD.
- Panel containment and expansion tests.
- Panel child save/load/copy/paste/resize tests.
- Current `test_panel_internal_widget_grid_uses_consistent_inset_spacing` failure before and after.

### Phase 5: Grid Metrics, Collision, And Reflow

Move geometry and collision without changing algorithms.

Target modules:

- `grid-metrics.js`
- `collision-engine.js`
- `reflow-engine.js`

Keep:

- Sparse placement valid.
- Pinned item reservation.
- Preview/commit separation.
- FLIP animation behavior.

Validation:

- Drag ghost/collision tests.
- Global occupancy tests.
- Pinned item tests.
- Resize preview and save/load tests.
- Group move/resize tests.

### Phase 6: Drag And Resize Controllers

Only move pointer lifecycle after geometry helpers are imported cleanly.

Target modules:

- `drag-controller.js`
- `resize-controller.js`
- `edge-autoscroll.js`
- `group-interactions.js`

Keep:

- Existing drag handles.
- Surface drag threshold behavior.
- Pointer capture timing.
- Cleanup artifacts.

Validation:

- Protected drag/resize/panel/menu tests.
- Edge auto-scroll tests.
- Group drag/resize tests.
- Current resize lifecycle failure before and after.

### Phase 7: Engineer Mode And Relationship Runtime

Extract after grid and widget identity lookup are stable.

Target modules:

- `engineer-mode.js`
- `relationship-runtime.js`
- `wire-renderer.js`
- `data-substrate-runtime.js`

Keep:

- Output-to-input rule.
- Normal Mode gating.
- Panel-contained widget graph endpoint lookup.
- Dataset Origin lineage.

Validation:

- Engineer dataflow tests.
- Dataset Origin tests.
- Shift/Data Filter tests.
- AI Engineer transparency tests.

### Phase 8: Demo Workspace And AI Action Runtime

Extract generated workspaces last, because they compose every earlier subsystem.

Target modules:

- `demo-workspace-runtime.js`
- `workspace-action-runtime.js`
- `ai-workspace-operator.js`

Keep:

- Layout selector integration.
- Generated layout registry.
- No saved-layout pollution.
- AI actions use workspace primitives only.

Validation:

- Demo data runtime tests.
- Demo workspace preset tests.
- Layout selector demo/AI tests.
- AI operator tests.

## Refactor Rules For Each Phase

- One module extraction per PR/commit.
- Preserve existing exported `window.dashboard*` runtime shapes until callers are migrated.
- Prefer moving code unchanged first, then cleanup in a separate pass.
- Do not rename classes or data attributes during module extraction.
- Add an adapter shim if a function needs temporary global access.
- Run the targeted tests for that module before and after extraction.
- Update this baseline with changed failing/passing status after each phase.
