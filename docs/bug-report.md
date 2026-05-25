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
- Verify dashboard movement, resize, ghost previews, popovers, menus, shared material behavior, background selection, and responsive layout after CSS changes.

## Validation Checklist

Use this checklist when filing or closing a UI bug:

- App starts cleanly.
- `/dashboard` returns 200.
- `/settings` returns 200.
- CSS files load from `style.css` imports.
- No brace errors in CSS.
- No visible class-name changes.
- Shared glass components render consistently across default and deep background tones.
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
- Toolbar and command-surface regressions: hard-coded colors, default browser controls, background-driven material drift, icon misalignment, or stretched ungrouped controls.
- Universal object regressions: command surface, graphs, tables, calendars, widgets, and panels not sharing grid occupancy, pinning, sparse placement, save/load, or resize rules.

## Issue Log

### Automated Run Summary

Command:

```powershell
.venv\Scripts\python.exe -m pytest -q
```

Latest result: 99 passed, 1 skipped, 0 failed.

Previous discovery result: 6 passed, 3 failed.

Passed coverage included app/dashboard/settings load, CSS imports, absence of mode toggle state, expanded background palette persistence, shared material invariance across deep background selection, workspace toolbar command-island screenshots, toolbar mode toggles, Engineer-gated context visualizations, generic Add Widget menu options, registry-backed widget runtime contracts, search widget creation, shared timeframe controls, timeframe createability, timeframe resize, timeframe minimum resize clamping, exact layout save/load round trips, source-agnostic context inheritance through data-source adapters and semantic mappings, widget absorption into open panels, collapsed-panel non-absorption, panel child widget undo/redo and save/reload, small-panel menu overlays, panel placeholder/body sizing, adaptive panel content density, drag ghost creation, ordered drag reflow, anchor rail ghost/placeholder reordering, local top insertion, reversible collision previews, capability-gated panel previews for dividers/anchors/panels, suppression of underlying hover menus during drag, global widget/panel occupancy, pinned item protection, pin menu close behavior, sparse empty-space placement, grid-bound drag clamping, grid snapping alignment, collision/overlap checks, resize snapping, left-edge anchored resize, menu icon alignment, panel header chevron centering, panel/widget/timeframe hover-focus material coverage, restrained neutral widget hover shadows, group multi-selection, grouped drag, grouped proportional resize, pinned items inside groups, mixed widget/panel group transforms, group mode, layout save/load/reset, settings save, console errors, and network errors. One responsive/mobile viewport test remains temporarily skipped during the desktop-interaction iteration phase.

### BUG-112: Context Visualizations Were Exposed As A Normal Toolbar Mode

- Status: Verified
- Area: Workspace chrome / Engineer Mode / context visualization
- Severity: Medium
- Environment: Dashboard workspace, desktop Chromium, context badges, source-agnostic context inheritance, toolbar modes
- Observed: Context debug badges and inherited-context indicators were controlled by a separate Context toolbar button. Normal users could reveal context-debug surfaces outside Engineer Mode, and the toolbar exposed two advanced/debug modes instead of making Engineer the single visibility gate.
- Expected: Context logic may run internally in every mode, but context labels, inherited-context badges, region hints, debug labels, and physical context visualizations should be hidden by default and only appear while Engineer Mode is active. The Context button should not exist.
- Suspected cause: The initial phase-1 context visibility path introduced `context-view-active` as a standalone CSS/body toggle before the Engineer Mode visibility contract was tightened.
- Fix notes: Removed the Context toolbar button, removed the standalone `context-view-active` UI path, added centralized `isEngineerMode()` / Engineer refresh handling, and changed context badge creation/display so badges are created only while Engineer Mode is active. Context resolution and widget queries continue to run internally while hidden, and save/load remains independent of visibility.
- Validation: Updated workspace chrome and source-agnostic context tests to assert the Context button is absent, normal mode shows no context badges, Engineer Mode reveals badges, Engineer off removes badges, and context inheritance still resolves internally. Targeted workspace chrome/context/widget-runtime/compact-control slices passed, and the full `.venv\Scripts\python.exe -m pytest -q` run passed with 99 tests and 1 responsive/mobile test skipped by the desktop-iteration gate. Manual browser inspection verified default, Engineer-on, Engineer-off, light, and deep-slate states.

### BUG-111: Widgets Lacked A Runtime Contract Before New Widget Types

- Status: Verified
- Area: Widget system / runtime registry / context queries
- Severity: Medium
- Environment: Dashboard workspace, desktop Chromium, widget add menu, Engineer Mode context visibility, layout save/load
- Observed: Placeholder widgets were created through hard-coded branches in the dashboard script. Timeframe and search had special creation paths, table/graph/calendar menu entries fell back to generic stat-like placeholders, and unknown widget types had no explicit unsupported state.
- Expected: Each widget type should declare its defaults, minimum size, capabilities, settings, context/query behavior, renderer, and graceful unsupported behavior through a shared registry. Core layout, drag, resize, settings controls, and persistence should remain widget-type agnostic.
- Suspected cause: Widget creation and rendering grew inside `app/static/app.js` before the source-agnostic context adapter path existed, so the dashboard renderer owned both widget shell behavior and widget-specific content.
- Fix notes: Added `app/static/widget-registry.js` with registry-backed definitions for stat, timeframe, search, table, chart/graph, stat-filter, and calendar widgets. `app/static/app.js` now creates widgets through registry definitions, hydrates existing placeholder widgets into runtime metadata, persists `runtimeType` and config, lets widgets resolve current workspace context, asks definitions for source-neutral `ContextQuery` objects, renders normalized query results, and shows a generic unsupported-widget state for missing definitions. Smart-delete now compares widget config against registry defaults so newly created blank widgets still delete without confirmation.
- Validation: Added `test_widget_runtime_registry_drives_real_widget_contracts`, covering registry metadata, initial stat/timeframe hydration, table creation and context-backed querying, chart placeholder creation, search config save/reload, and unknown widget fallback. Targeted registry/search/timeframe/context/save-load/drag/delete slices passed, the full `.venv\Scripts\python.exe -m pytest -q` run passed with 99 tests and 1 responsive/mobile test skipped by the desktop-iteration gate, and manual browser inspection verified registry-created table, chart, and search widgets on light and deep-slate backgrounds.

### BUG-110: Workspace Context Was Not Source-Agnostic Or Slot-Persistent

- Status: Verified
- Area: Context system / data-source adapters / layout persistence
- Severity: Medium
- Environment: Dashboard workspace, desktop Chromium, Engineer Mode context visibility, layout save/load, live undo snapshots
- Observed: Workspace context regions had architectural direction, but there was no generic data-source adapter contract, semantic field mapping, or query path that let widgets resolve context without knowing source-specific details. Data-source and context records also were not included in the same layout slot persistence model as workspace objects.
- Expected: Dividers define regions, widgets resolve context dynamically from spatial position, context stores semantic mappings and source identity rather than raw source details, widgets query through adapters, save/load preserves data sources and contexts, and live undo/redo snapshots include context relationships.
- Suspected cause: The workspace state model had grid objects, dividers, anchors, and layout slots, but source/context inheritance was still only documented as future architecture and had no adapter registry or persistence hooks.
- Fix notes: Added a phase-1 client-side data-source registry with `manual`, `json`, and `csv` row-backed adapters, normalized schema inference, semantic mapping suggestions, source-neutral filtering/time-range/sort/projection helpers, resolved workspace context utilities, and a `dashboardContextEngine` debug API. Layout slots and live undo snapshots now include data sources and workspace contexts. Engineer Mode shows inherited source/mapping badges only when an object has resolved context, preserving normal widget text and drag tests when Engineer Mode is off.
- Validation: Added `test_source_agnostic_context_inheritance_uses_adapters_and_semantic_mappings`, covering root and divider-region contexts, moving a widget across regions, querying through built-in adapters, registering a new adapter without widget rewrites, context relationship undo/redo, Engineer-gated badge visibility, and save/reload persistence. Targeted context/divider/anchor/save-load/undo slices passed, the full `.venv\Scripts\python.exe -m pytest -q` run passed with 98 tests and 1 responsive/mobile test skipped by the desktop-iteration gate, and manual browser inspection verified context badges on light and deep-slate backgrounds.

### BUG-109: Widgets Could Not Be Intentionally Absorbed Into Open Panels

- Status: Verified
- Area: Dashboard grid / panel containment / widget drag lifecycle
- Severity: Medium
- Environment: Dashboard workspace, desktop Chromium, dragging widgets across open and collapsed panels
- Observed: Panels visually represented generic containers, but dragging a widget over an open panel had no intentional containment path. Widgets could only remain workspace-level grid objects, and there was no scoped internal panel grid or receptive hover state.
- Expected: Open panels should behave like receptive spatial containers. A widget dragged into an open panel should show calm receptive feedback, require a stable hover delay before absorption, become a panel child on commit, and then use a scoped internal grid without participating in the global dashboard collision map. Collapsed panels should not accept widgets.
- Suspected cause: Widget drag only targeted the shared dashboard occupancy map. Panel bodies had placeholder content but no child-widget persistence, internal grid initialization, or drag lifecycle layer for intentional container drops.
- Fix notes: Added scoped panel internal widget grids, panel child serialization, restore, undo/redo, save/load, and reset cleanup. Dashboard collision, FLIP snapshots, reflow item queries, and local/global occupancy helpers now exclude panel child widgets from top-level workspace calculations. Widget drag now has a separate absorption tracker that detects open panel drop containers, shows a subtle receptive animation, resets on pointer movement, cancels for collapsed/moved-away panels, and converts the dragged widget into panel child state after a stable hover. Child widgets reuse normal widget controls and can be moved inside the panel grid.
- Validation: Added `test_widget_absorbs_into_open_panel_after_stable_hover_and_round_trips` and `test_widget_hover_over_collapsed_panel_does_not_absorb`. Targeted absorption, search widget, save/load, undo, drag preview cleanup, widget drag, panel collision, group drag, and group resize slices passed. Manual browser inspection verified receptive feedback, absorption commit, child widget controls, deep background rendering, and no persistent top-level duplicate. Full `.venv\Scripts\python.exe -m pytest -q` passed with 97 tests and 1 responsive/mobile test skipped by the desktop-iteration gate.

### BUG-108: Group Resize Ghost Footprint Displaced Neighboring Objects

- Status: Verified
- Area: Dashboard grid / group resize / visual-only previews
- Severity: Medium
- Environment: Dashboard workspace, grouped resize with expanded footprint ghost visible
- Observed: During group resize, the composite group resize footprint could be used as the reflow collision source. That allowed ghost-only areas around selected members, including expanded footprint preview space, to push neighboring objects and leave them displaced after release.
- Expected: Expanded footprint ghosts and broad group visual surfaces are visual-only. Collision/reflow should use the selected members' snapped preview footprints and intended committed footprints, not empty ghost-only areas. Neighboring objects should move only when real resized member footprints overlap them.
- Suspected cause: `runGroupResize` resolved sparse layout against `.dashboard-group-resize-footprint`, a composite placeholder spanning the whole selected group bounds. The actual `.dashboard-group-member-preview` placeholders were intentionally excluded from generic occupancy maps, so the broad visual footprint became the collision authority.
- Fix notes: Added a multi-active sparse resolver for group resize that treats the snapped member previews as the active collision sources while excluding the composite group footprint. Commit now resolves member previews, copies those committed preview footprints onto the real selected members, and then removes all visual-only ghosts/footprints. The expanded footprint ghost remains visible but never enters occupancy, collision, or persistence.
- Validation: Added `test_group_resize_expanded_ghost_is_visual_only_for_collision`, which verifies an expanded ghost can visibly overlap a neighboring panel without moving it during preview or after release. Targeted ghost/group resize, individual panel resize, group move, and group edge-scroll slices passed. Manual browser inspection verified the ghost overlap, unchanged neighbor row/top, and cleanup after release.

### BUG-107: Group Resize Vertical Footprint Grew Separately From Open Panel Members

- Status: Verified
- Area: Dashboard grid / group resize / panel footprints
- Severity: Medium
- Environment: Dashboard workspace, grouped open panels, vertical group resize
- Observed: During vertical group resize, the composite group footprint could extend downward while selected open panel members did not receive enough vertical footprint growth to reach the resized group bounds. This made the preview/selection area feel detached from the child panel geometry.
- Expected: Group resize should propagate vertical growth into selected panel row spans, rendered heights, saved heights, collision footprints, and preview placeholders. The composite group footprint should agree with the resized member footprint union, and release/save/load should preserve the committed panel heights.
- Suspected cause: Group resize scaled each panel's height from its own starting row span only. For vertically stacked panels whose top offsets remain stable, that left lower panels under-sized relative to the scaled composite bottom edge, so the group footprint could grow independently from child object sizes.
- Fix notes: Added shared group panel row-span propagation based on both each member's own scaled height and its scaled bottom edge within the composite group. Live resize surfaces, snapped member previews, and final commit now use the same row-span calculation, while widgets remain one-row grid objects and collapsed panels retain their collapsed footprint behavior.
- Validation: Added `test_group_resize_vertical_growth_extends_open_panel_members` for stacked open panels. It verifies originals remain unchanged during preview, live panels grow, member preview row spans/heights grow, member preview bottom matches the composite group footprint bottom, release commits larger panel row spans/heights, no overlaps remain, and save/reload preserves the committed heights. Updated group undo coverage to assert panel rendered height restores with row span. Targeted group resize, group undo/move, and group edge auto-scroll slices passed. Manual browser inspection verified live preview, commit, and reload geometry.

### BUG-106: Anchor Divider Navigation Landed Below The Top Grid Row

- Status: Verified
- Area: Spatial anchors / divider navigation / sticky chrome alignment
- Severity: Medium
- Environment: Dashboard workspace, linked Anchor objects, sticky workspace navbar, lower-row dividers
- Observed: Linked anchors resolved the current divider element, but final scrolling used a fixed 96px offset. Deep dividers could land below the first visible grid row, especially when the divider was the lowest object and the browser clamped scroll at the page bottom.
- Expected: Anchor links store only the divider id, resolve the divider's live rendered position at click time, and smooth-scroll so the divider top aligns with the top-most visible workspace grid row beneath the sticky navbar. Missing dividers fall back gracefully to the workspace top.
- Suspected cause: The semantic id lookup was correct, but the destination alignment was based on a stale fixed chrome offset and did not ensure enough scrollable runway below low dividers to make top-row alignment possible.
- Fix notes: Replaced the fixed offset with live workspace-grid alignment math that uses the current divider DOM position, the current dashboard grid top-row position, and the sticky navbar as a guard. Added a non-persistent anchor navigation runway only when needed so bottom-most linked dividers can still align to the top grid row, and clear it on Top/missing-divider navigation.
- Validation: Updated anchor navigation and anchor layout-history Playwright coverage to assert both scroll target and visual divider-to-grid-row alignment after initial link, after moving/pushing the divider lower, and after save/reload. Targeted `anchor_links_to_divider_or_workspace_top_and_persists`, `anchors_join_layout_history_and_saved_layout_state`, and the broader `anchor` slice passed. Manual browser inspection verified the linked divider landing at the top visible grid row after movement and after save/reload, and `.venv\Scripts\python.exe -m pytest -q` passed with 93 tests and 1 responsive/mobile test skipped by the desktop-iteration gate.

### BUG-105: Anchor Delete Reflow Teleported Lower Rail Anchors

- Status: Verified
- Area: Spatial anchors / rail delete reflow / persistence
- Severity: Medium
- Environment: Dashboard workspace, left-rail Anchor objects with uneven vertical offsets
- Observed: Deleting an anchor caused lower anchors to jump to their updated rail positions. The rail normalization path also risked repacking offsets into fixed sequential slots when saving or restoring anchors.
- Expected: Anchors may keep arbitrary vertical rail offsets. Deleting an anchor should shift only anchors below the removed anchor upward by the removed footprint, preserve relative spacing, animate the movement smoothly, and keep updated offsets in undo/save/load state.
- Suspected cause: Anchor normalization reused the drag reorder packing path, and anchor deletion removed the source before lower anchors received any FLIP/reflow animation from their previous viewport position to their updated offset.
- Fix notes: Split position preservation from drag reorder packing. Routine normalize/save/restore now preserves existing `anchorOffset` values, while menu drag reorder still uses the existing packed preview/commit behavior. Anchor deletion now groups deleted anchors by rail, captures pre-delete positions, removes deleted anchors, shifts only lower anchors by the removed footprint plus rail gap, applies final offsets, and animates affected anchors with a transform-based FLIP transition.
- Validation: Added `test_anchor_delete_reflows_lower_anchors_without_repacking_arbitrary_offsets` for uneven offsets, middle/top/bottom delete behavior, animated lower-anchor reflow, no movement for bottom delete, undo restoration of arbitrary positions, and save/reload persistence after deletion. Targeted `anchor_delete_reflows`, `anchor`, and `delete or undo` slices passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 93 tests and 1 responsive/mobile test skipped by the desktop-iteration gate.

### BUG-104: Anchor Body Drag Could Enter Rail Preview Mode

- Status: Verified
- Area: Spatial anchors / rail drag lifecycle / navigation body behavior
- Severity: Medium
- Environment: Dashboard workspace, left-rail Anchor objects, desktop Chromium
- Observed: Dragging directly from the anchor body could start anchor rail movement and create a ghost/placeholder preview. This made the body navigation surface double as a drag handle and could leave anchors feeling stuck in preview/hover state after interrupted interactions.
- Expected: Anchor body interaction should only navigate to the linked divider or workspace top. Anchor reorder should start only from the explicit move control in the anchor settings menu. Body dragging should never create rail ghosts or placeholders, and menu-started movement should clear temporary state on pointerup, pointercancel, Escape, blur, lost pointer capture, and menu close.
- Suspected cause: The anchor initializer wired `pointerdown` on the anchor body into the same `startAnchorMove` path used by the menu move button, and the rail drag lifecycle had fewer cancellation hooks than widget/panel movement.
- Fix notes: Removed the body drag entry point, kept the existing move button in the anchor menu as the only rail reorder source, moved pointer capture to the anchor shell for menu-started drags, added document-scoped move lifecycle listeners, and added guarded cleanup for Escape, blur, lost pointer capture, pointercancel, pointerup, and menu close.
- Validation: Added `test_anchor_reorder_starts_from_menu_move_control_and_cleans_preview_state` for body-drag no-op behavior, body click navigation, menu-started preview, Escape cleanup, lost-pointer-capture cleanup, and committed menu reorder. Targeted anchor coverage passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 92 tests and 1 responsive/mobile test skipped by the desktop-iteration gate.

### BUG-103: Widget Move Preview Could Remain Stuck After Interrupted Move Control Interaction

- Status: Verified
- Area: Widget/panel drag lifecycle / ghost preview cleanup
- Severity: Medium
- Environment: Dashboard workspace, widget move control, desktop Chromium
- Observed: Clicking or interrupting the widget move control could occasionally leave the workspace in a move hover/ghost preview state even though the underlying move and collision behavior still worked.
- Expected: Move preview artifacts should exist only during an active move interaction. Pointerup, pointercancel, Escape, window blur, lost pointer capture, and no-drag clicks should all clear drag classes, placeholders, expanded footprint ghosts, interaction body flags, and temporary pointer state. A valid drag should commit once and then clear the same temporary state.
- Suspected cause: The shared ordered drag path relied on document-level pointer events and did not own pointer capture or lost-pointer-capture cleanup. The cleanup path also lacked the resize lifecycle's idempotent finish guard, so interrupted sessions could miss final artifact removal.
- Fix notes: Added pointer capture, lost-pointer-capture cancellation, guarded finish cleanup, listener removal, and safe pointer release to `runOrderedDrag` without changing collision, reflow, snapping, or commit math.
- Validation: Added `test_widget_move_preview_cleanup_handles_click_escape_and_lost_capture` for click-without-drag cleanup, Escape cleanup after preview creation, and lost pointer capture cleanup after preview creation. Targeted `widget_move_preview_cleanup` passed, related drag cleanup coverage for collision preview, underlying menu suppression, menu restore, large dashboard cleanup, and ordered drag reflow passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 91 tests and 1 responsive/mobile test skipped by the desktop-iteration gate.

### BUG-102: Default Workspace Composition Felt Mathematically Centered But Visually Off-Balance

- Status: Verified
- Area: Workspace composition / dashboard grid / navbar rhythm
- Severity: Low
- Environment: Dashboard workspace, normal desktop viewport, default and deep background tones
- Observed: The workspace container was centered, but the default object spans made the visual center of mass feel uneven. The timeframe object occupied five of six columns, the right-side stat/widget lane had only one narrow column on the first row, the panel row ended with a one-column Notes panel, and the divider exposed the mismatch between the full composition width and the heavier left-side objects.
- Expected: Navbar, workspace grid, dividers, and default object columns should share one calm width rhythm. The right utility/widget side should not feel squeezed, large horizontal widgets should not overpower the composition, and dividers should align to the same intentional workspace block.
- Suspected cause: The shared page shell still used an older 1180px width while the navbar polish layer used full-width chrome inside it, and the default spans were tuned around a five-column timeframe plus `3/2/1` panels rather than a clearer two-column utility rhythm.
- Fix notes: Introduced a shared 1224px workspace shell rhythm for the page/nav/grid, widened grid gutters slightly, reduced the default timeframe footprint from five to four columns, and arranged default stats plus Menu/Notes into a coherent two-column right utility lane. Content keeps the left four-column workspace lane, dividers continue to span the full composition block, and mobile viewports use a clean stacked/nested flow so one-column desktop objects do not become cramped on narrow screens. Add-object menus now close after creation so new objects can be interacted with immediately.
- Validation: Added `test_workspace_composition_uses_balanced_shell_and_column_rhythm` to verify nav/grid edge alignment, shared shell width, grid gutter rhythm, four-column timeframe placement, two right-side stat widgets on the first row, a `4 + 2` panel composition with Menu and Notes in the right utility lane, and divider alignment to the workspace block. Strengthened mobile viewport coverage to assert no visible widget/panel overlaps. Targeted composition/mobile/toolbar/reset/drag/resize coverage passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 91 tests.

### BUG-101: Delete Confirmation Did Not Distinguish Blank Objects From Configured Objects

- Status: Verified
- Area: Workspace objects / deletion / undo history
- Severity: Medium
- Environment: Dashboard workspace, panel/widget/divider/anchor delete controls and Delete key
- Observed: Delete behavior was inconsistent by object family. Panel and widget menu deletes always opened the confirmation dialog, blank objects could require unnecessary confirmation, anchors bypassed the shared dialog, and keyboard Delete did not share one object-deletion decision path.
- Expected: Blank/default workspace objects should delete immediately and create a normal undo checkpoint. Objects with meaningful user-authored changes should use the existing confirmation dialog. Menu buttons and Delete key should call the same central delete decision path for widgets, panels, dividers, anchors, search widgets, timeframe widgets, and future widget-like objects.
- Suspected cause: Delete handling lived in separate panel, widget, and anchor branches. The code had no shared `hasMeaningfulChanges`/blank-object helper and no generic workspace-object delete request.
- Fix notes: Added centralized workspace delete classification, title, layout, blank/default, and meaningful-change helpers. The shared delete request now handles immediate blank deletion, confirmation for meaningful objects, cancel preservation, confirm deletion, and one live history checkpoint for affected layout state. Anchor delete buttons now route through the same path, and Delete-key handling supports selected grid objects plus focused anchors/widgets/panels while ignoring editable inputs.
- Validation: Added `test_smart_delete_confirms_only_meaningful_workspace_objects` for blank search-widget Delete, edited widget confirmation/cancel/confirm/undo, blank panel immediate Delete, content panel confirmation/cancel/confirm/undo, default divider immediate Delete, renamed divider confirmation/undo, default anchor menu delete without confirmation, and linked anchor keyboard confirmation/cancel/confirm/undo. Targeted delete/undo/anchor coverage passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 90 tests.

### BUG-100: Anchor Destination Labels Read As Tiny Metadata

- Status: Verified
- Area: Spatial anchors / typography / visual alignment
- Severity: Low
- Environment: Dashboard workspace, Anchor objects linked and unlinked on the left rail
- Observed: Anchor destination labels such as `Top` and divider names were too small and sat high/left in the anchor body, making the widget-derived anchor surface feel visually empty.
- Expected: Anchor destination text should read as the primary navigation title. It should be larger, slightly stronger, vertically centered in the anchor body, and leave balanced room for the settings control.
- Suspected cause: Anchor labels reused the compact stat-label typography without enough anchor-specific composition, and the anchor body remained block-positioned inside a padded widget surface.
- Fix notes: Kept the shared widget material and control styling, but made the anchor surface align its content with flex, centered the anchor content vertically, and promoted the destination label to a 13px/820-weight navigation label with ellipsis and unchanged settings-button clearance.
- Validation: Updated anchor visual coverage to assert readable label size/weight, vertical centering, settings-button spacing, and matching behavior for both `Top` and linked divider labels. Targeted anchor coverage passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 89 tests.

### BUG-099: Anchors Bypassed Workspace History And Layout Ownership

- Status: Verified
- Area: Spatial anchors / undo-redo / layout persistence
- Severity: High
- Environment: Dashboard workspace, Anchor creation, deletion, divider linking, color edits, rail reorder, layout save/load
- Observed: Anchor mutations were written directly to the floating-anchor storage namespace. They did not participate in the live layout undo stack, could not be redone, and could feel permanent even when panel/widget changes were still draft workspace state.
- Expected: Anchors remain a special viewport-rail data type, but their committed state belongs to the same workspace history and saved layout model as panels, widgets, and dividers. Anchor creation, deletion, divider-link edits, color changes, and rail reorder commits should be undoable/redone. Explicit layout save/load should include anchors, with links persisted by divider id and resolved live on click.
- Suspected cause: `saveFloatingAnchors` always persisted localStorage immediately, while panel/widget save helpers only push live undo snapshots until an explicit layout save. The live undo snapshot did not serialize anchor layers, and the history model had no redo stack.
- Fix notes: Added anchors to live layout snapshots and restore. Added anchor cleanup to history artifact cleanup, restored anchor event handlers from snapshots, and changed routine anchor saves to push live history rather than localStorage. Explicit layout Save still persists anchors in the layout-scoped anchor key. Added in-memory redo support through `Ctrl+Y` / `Ctrl+Shift+Z`, and moved the global shortcut listener to capture phase so dashboard menu focus cannot block layout undo while editable inputs remain protected.
- Validation: Added `test_anchors_join_layout_history_and_saved_layout_state` to cover anchor create undo/redo, link undo/redo, color undo/redo, rail reorder undo/redo, delete undo/redo, saved layout reload with anchors, linked anchor live divider navigation after reload, moved-divider live targeting, and deleted-divider fallback. Targeted `undo or anchor` and `anchor or save or load` slices passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 89 tests.

### BUG-098: Linked Anchors Could Navigate To Stale Divider Positions

- Status: Verified
- Area: Spatial anchors / divider navigation
- Severity: Medium
- Environment: Dashboard workspace, Anchor linked to a Context Divider whose rendered grid row changes after linking
- Observed: A linked anchor could navigate as if the divider were still at its original link-time position after layout pressure or later placement changes moved the divider lower in the workspace.
- Expected: Anchor links are semantic divider references. The anchor stores the divider identity, resolves the current divider element when clicked, measures its current rendered position, and scrolls there smoothly. Missing divider targets should fall back gracefully to the top of the workspace.
- Suspected cause: Divider link resolution was too narrow and the navigation path did not make the live DOM measurement contract explicit, leaving room for stale target metadata to act like a physical navigation record.
- Fix notes: Broadened anchor divider resolution to find the current divider DOM node by linked divider identity across panel key, workspace region id, or context scope id. Added a dedicated current-target scroll helper so anchor clicks measure the resolved divider at navigation time and never reuse link-time coordinates.
- Validation: Updated `test_anchor_links_to_divider_or_workspace_top_and_persists` to link an anchor, verify initial divider navigation, move the linked divider lower after linking, and verify the same anchor scrolls to the divider's new rendered position. Targeted anchor coverage passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 88 tests.

### BUG-097: Anchors Used Offset-Based Freeform Drag Instead Of A Dedicated Rail Order

- Status: Fixed
- Area: Spatial anchors / rail interaction model
- Severity: Medium
- Environment: Dashboard workspace, multiple Anchor objects on the viewport rail
- Observed: Anchor movement still behaved like freeform side-rail offset dragging. Pointer X could switch anchors between side rails, position was saved as loose pixel offset, and the interaction did not expose a separate live ghost versus reorder preview model.
- Expected: Anchors should remain a special viewport-side data type on the left rail. Dragging should be vertical only, show a smooth live ghost, show a separate placeholder/reorder preview, collide only with other anchors, commit a simple rail order on release, and never enter dashboard grid snapping or widget/panel collision.
- Suspected cause: The initial floating-anchor implementation reused a direct offset mutation model for quick side-rail placement instead of a one-dimensional rail ordering interaction.
- Fix notes: Added committed `railOrder` persistence, left-only rail normalization, a cloned live drag ghost, a separate rail placeholder, preview-only anchor reordering during drag, and commit-on-release ordering. Anchor drag no longer changes side based on horizontal pointer position, no longer uses grid collision, and no longer exposes pin controls.
- Validation: Updated Playwright anchor coverage to verify vertical-only rail dragging, ghost and placeholder presence, no grid participation, no accidental navigation on drag release, anchor-only reordering, reload persistence, and unchanged widget/panel drag/resize coverage. Targeted anchor/widget drag/resize slices passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 88 tests.

### BUG-096: Anchor Body Repeated Widget-Style Labels Instead Of Destination

- Status: Fixed
- Area: Spatial anchors / navigation label content
- Severity: Low
- Environment: Dashboard workspace, Anchor objects linked and unlinked from Context Dividers
- Observed: Anchors visually inherited widget material but still displayed a large glyph, an anchor instance label such as `Anchor 5`, and a secondary target label such as `Top`. This made anchors feel like content widgets instead of compact navigation handles.
- Expected: Anchor body text should communicate only the navigation destination. Unlinked anchors should show `Top`; linked anchors should show the linked divider title only. Settings/control buttons should remain available, and divider-linking behavior should not change.
- Suspected cause: The first widget-inheritance pass reused stat-card value/label/meta markup wholesale instead of separating widget material inheritance from anchor destination content.
- Fix notes: Removed the visible glyph and metadata markup from anchor bodies, made the visible anchor label derive from `syncAnchorNavigationTarget`, and kept `anchorTitle` as internal metadata only. The anchor body now renders one destination label while retaining the shared widget material surface and settings controls.
- Validation: Updated anchor Playwright coverage to verify unlinked `Top`, linked divider-title-only body text, no glyph, no meta label, no `Anchor #` text, and settings/link controls still working. Targeted anchor coverage passed; full suite passed with `87 passed`. Manual inspection artifacts are in `test-results/manual-anchor-label-simplification/`.

### BUG-095: Widget-Derived Tool Menus Were Too Transparent Beside Panel Menus

- Status: Fixed
- Area: Widget controls / anchor controls / timeframe controls / shared menu material
- Severity: Medium
- Environment: Dashboard workspace, widget settings menus, Anchor settings menu, Timeframe settings menu, default and deep-slate backgrounds
- Observed: Panel tool drawers were readable, but widget-derived drawers used weaker translucent widget-only tokens. Their compact buttons and icons could look washed out on pale glass, and the same low-contrast menu treatment affected anchors and timeframe widgets because both inherit widget controls.
- Expected: Normal widgets, anchors, and timeframe widgets should inherit the same readable compact menu treatment as panel menus: stronger glass/opaque drawer surface, readable borders/rims, readable icon contrast, compact button hover/press behavior, and no separate per-widget visual system. Anchors should keep anchor-specific behavior, include the normal widget controls except resize, and keep their divider-link control.
- Suspected cause: `.widget-tools` and later `.widget-card.db-panel-custom-color` rules overrode shared panel control tokens with lower-alpha glass values, while timeframe carried a separate drawer fallback. Anchor markup only included link/color controls instead of the standard widget tool set.
- Fix notes: Strengthened the shared widget tool variables to match the readable panel menu treatment, routed timeframe drawer styling back through the same widget drawer variables, and updated custom-color widget control overrides to use the same readable control/drawer values as panels. Made the shared tool-button markup configurable so anchors reuse normal widget controls with resize excluded and divider linking added as an anchor-specific extra. Added anchor-local move, pin, rename, color, divider-link, and delete handling while keeping anchors fixed to the navigation layer and outside grid resize/collision.
- Validation: Updated widget/anchor Playwright coverage to verify readable drawer opacity, icon contrast, border/shadow, panel parity, timeframe inheritance, anchor inheritance, anchor controls present, and resize absent on anchors. Targeted menu/material, anchor, compact-control, object-geometry, navbar-layering, timeframe, and panel/widget menu parity slices passed. Manual browser inspection screenshots were captured under `test-results/manual-widget-menu-readability`, and `.venv\Scripts\python.exe -m pytest -q` passed with 87 tests.

### BUG-094: Floating Anchors Fell Back To A Separate Mini-Tab Skin

- Status: Fixed
- Area: Spatial anchors / widget material inheritance / navigation layer
- Severity: Medium
- Environment: Dashboard workspace, Anchor objects created from the Add menu, default and deep-slate backgrounds
- Observed: Anchors lived on the correct floating layer but still carried anchor-specific mini-card geometry and typography. The strongest custom widget material rules were scoped to `.widget-layout > .widget-card`, so floating anchors missed the final widget surface treatment and could read as a separate pale-blue side tab rather than a compact widget-like navigation object.
- Expected: Anchors remain viewport-fixed navigation objects outside normal grid collision while visually inheriting the real widget card material, stat typography hierarchy, custom-color surface/rim/shadow treatment, and widget settings/control button language. Divider linking should remain in the widget-style anchor settings menu, with linked anchors scrolling to the divider and unlinked anchors scrolling to the workspace top.
- Suspected cause: Anchor markup used custom `.workspace-anchor-*` typography and nodule styling, and late theme rules only targeted widgets that were direct children of `.widget-layout`. The anchor layer also sat just below the navbar, above object popovers, making it visually compete with workspace object menus.
- Fix notes: Reworked anchor markup to use shared `stat-val` and `stat-lbl` typography, removed standalone anchor surface/glyph styling, routed floating anchors through the same custom widget material selectors, kept only anchor-specific fixed rail sizing/positioning, and placed the anchor layer below object popovers while still above resting workspace objects. The existing divider-link menu continues to use widget drawer/control tokens.
- Validation: Updated `test_anchor_links_to_divider_or_workspace_top_and_persists` to compare anchor material, radius, gradient, shadow, typography, settings control dimensions, link menu styling, left-side default, scroll-to-divider, scroll-to-top fallback, persistence, and layering under object/navbar popovers. Targeted anchor, widget material, navbar layering, compact control, workspace chrome, background, and capability slices passed. Manual browser inspection screenshots were captured under `test-results/manual-anchor-widget-inheritance`, and `.venv\Scripts\python.exe -m pytest -q` passed with 87 tests.

### BUG-093: Anchors Looked Like Separate Side Pills And Lacked Divider Linking

- Status: Fixed
- Area: Spatial anchors / navigation layer / workspace object taxonomy
- Severity: Medium
- Environment: Dashboard workspace, Anchor objects created from the Add menu, left/right side rail placement, divider navigation
- Observed: Anchors had become behaviorally separate from grid widgets, but visually read as their own pill/tab component instead of inheriting the widget material system. New anchors also defaulted to the right rail, and there was no direct anchor setting for linking to a divider. Unlinked anchors still relied on workspace target metadata instead of providing the useful top-of-workspace fallback.
- Expected: Anchors should remain outside normal widget/panel/divider collision while looking like compact widget-like navigation objects attached to the side rail. They should default to the left rail, reuse widget glass/material and customization primitives, optionally link to a divider from their settings menu, navigate smoothly to that divider, and fall back to the top of the workspace when unlinked or when the linked divider is gone.
- Suspected cause: The first floating-anchor pass intentionally separated anchors from grid widgets, but it also introduced anchor-specific visual structure and target defaults. Anchor settings did not yet reuse widget customization controls, and link resolution did not carry a divider-specific persistence field.
- Fix notes: Reworked floating anchor markup to render as a widget-card/custom-color surface with widget-style settings controls, color customization, compact pressable controls, and left-rail default placement. Added `linkedDividerId` persistence, a divider-link menu inside anchor settings, sync helpers that derive navigation metadata from the linked divider, smooth-scroll fallback to workspace top, and safe link clearing when a divider target is deleted. Anchor collision remains isolated to the anchor layer.
- Validation: Updated anchor-layer coverage and added `test_anchor_links_to_divider_or_workspace_top_and_persists` to verify left default placement, fixed side-layer behavior, widget-like material/classes, color customization, divider linking, linked smooth-scroll navigation, unlinked top fallback, deleted-divider fallback, and save/load persistence. Manual browser inspection covered the anchor on default and deep-slate backgrounds, settings/color/link menus, linked divider navigation, fixed scroll behavior, and deleted-divider fallback. `.venv\Scripts\python.exe -m pytest -q` passed with 87 tests.

### BUG-092: Widget Submenus Lost Readability And Navbar Dropdowns Shared Object Layers

- Status: Fixed
- Area: Theme / widget controls / navbar layering
- Severity: Medium
- Environment: Dashboard workspace, widget and panel object menus, navbar Add/Layout/Profile/Background dropdowns
- Observed: Widget object settings drawers used a transparent-mixed background across the whole drawer surface, so the submenu shell faded into the widget/background more than the panel drawer. Open widget/panel controls also shared the same high popover layer family as navbar dropdowns, allowing object controls to visually compete with navbar menus.
- Expected: Widget submenu containers should retain readable glass structure comparable to panel submenu containers, while only the individual compact button nodules remain softer/translucent. Navbar dropdowns should deterministically layer above workspace objects, object surface controls, and object submenus.
- Suspected cause: The widget drawer material token reduced the entire drawer gradient by mixing with `transparent`, and the range widget carried a matching transparent fallback. Object-open z-index rules used generic dropdown/popover tokens that overlapped with navbar menu tokens instead of a clear workspace-object versus navbar-popover layer split.
- Fix notes: Rebuilt `--widget-drawer-bg` as a stronger glass drawer surface that keeps the translucent material but no longer fades the whole container, aligned custom-color widget and range-widget drawer fallbacks with that shell, and added explicit `--z-object-control`, `--z-object-popover`, and `--z-navbar-dropdown` tokens. Widget/panel controls and color menus now sit in object layers below the navbar, while workspace navbar dropdowns use the navbar dropdown layer.
- Validation: Updated `test_widget_surface_controls_use_translucent_widget_glass` to verify widget drawer readability, opacity, border, shadow, icon readability, and that drawer material is stronger than the compact buttons on default and deep backgrounds. Added `test_navbar_dropdowns_layer_above_object_controls` to verify open widget/panel controls remain below the navbar and Add/Layout dropdowns use the navbar dropdown layer. Targeted menu/chrome tests passed, the protected collision test was rerun after the layer adjustment, and `.venv\Scripts\python.exe -m pytest -q` passed with 86 tests.

### BUG-091: Collision Resolution Skipped Local Left Fallback After Below Slot Check

- Status: Fixed
- Area: Dashboard grid / collision reflow / drag preview and drop commit
- Severity: Medium
- Environment: Widget and panel drag collision in the six-column dashboard grid
- Observed: Local collision resolution had started preferring the below/current-column fallback, but the same resolver still treated nearby local-left and forward candidates as a distance-sorted pool in some paths. That could either choose left before a valid below slot or continue forward when below was blocked but a valid previous/left slot was open.
- Expected: Displaced objects should use a deterministic local priority order: direct below/current-column when empty, then previous/left local slot when below is occupied, then the next valid forward slot. This should remain a local collision fix, not global auto-pack.
- Suspected cause: `nearestLocalDisplacementSlot` mixed the row-major fallback with freed local vacancy candidates and sorted by distance. It also only checked candidates against already-processed occupied entries, so a "below" slot could appear available even when an unprocessed object already lived there.
- Fix notes: Split local displacement target selection into explicit below and left helpers. Below and left candidates are now validated against both committed occupied entries and a reserved snapshot of other objects, so they are used only when truly empty. Only after both local candidates fail does the resolver use the normal row-major forward fallback. Preview and commit paths both call the same helper.
- Validation: Reworked `test_collision_prefers_below_then_left_before_forward_for_widgets_and_panels` to cover below-slot reuse, previous/left-slot reuse when below is blocked, forward fallback when neither local option is available, preview/commit parity, no unrelated movement, and widget/panel parity. Targeted collision, expanded-panel, and protected group slices passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 85 tests.

### BUG-090: Anchors And Dividers Inherited Expanded Panel Preview Affordances

- Status: Fixed
- Area: Workspace object taxonomy / drag preview / divider headers / anchor layer
- Severity: Medium
- Environment: Dashboard workspace, Divider and Anchor objects created from the Add menu, divider move/resize preview, anchor rail movement
- Observed: Divider objects reused panel shell classes for grid participation, so drag/resize preview logic treated them like collapsed expandable panels and could show a large open-panel-style footprint. Divider headers also rendered a leftover leading status dot from panel accordion/header assumptions. Anchors were classified separately visually but did not receive the same explicit capability metadata as grid objects.
- Expected: Only openable/expandable panels should use expanded panel footprint previews or render accordion/status affordances. Dividers should remain one-row semantic surfaces without panel content ghosts or header dots. Anchors should remain floating navigation objects outside normal grid collision and should not create grid previews.
- Suspected cause: Preview and sizing helpers checked broad panel-shell conditions such as `.db-panel`, `.db-panel-collapsed`, or panel content defaults instead of asking explicit object capabilities. Divider markup still included a `workspace-divider-node` even after dividers became a distinct object type, and floating anchor creation bypassed the shared metadata sync.
- Fix notes: Added centralized workspace object capability metadata (`canExpand`, `isOpenable`, `hasExpandedFootprint`, `participatesInGridCollision`, `hasPanelContentArea`, `usesPanelHeader`, `usesAnchorLayer`, `usesDividerSurface`). Panel row-span, minimum-height, expanded-footprint, drag, resize, and header affordance paths now derive from those capabilities. Floating anchors now sync the same metadata, and divider markup no longer renders the inherited status node.
- Validation: Added `test_object_capabilities_gate_panel_previews_and_affordances` to verify divider/anchor/panel capability metadata, absence of divider status dots and accordion aria affordances, no expanded ghost during divider move/resize, no grid placeholder during anchor movement, and normal collapsed-panel expanded preview behavior. Targeted capability, anchor/divider, and full group behavior slices passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 85 tests.

### BUG-089: Navbar Controls And Background Greys Needed More Material Separation

- Status: Fixed
- Area: Navbar / dropdowns / background selector
- Severity: Medium
- Environment: Dashboard workspace chrome, Layout menu, Add menu, profile/background dropdowns
- Observed: Navbar control nodules and dropdown buttons were too close to the bright navbar surface, the Layout selector still carried a visual arrow, the Add menu opened centered under the plus control instead of aligning to the trigger edge, and adding more grey background options made the palette too tall for reliable lower-option selection.
- Expected: Navbar buttons and dropdown items should read as neutral grey glass nodules on the navbar surface, Layout should remain clickable without an arrow, the Add menu should use the same trigger-edge anchoring logic as other dropdowns, dropdown buttons should keep compact-control depression hover, and grey background choices should span from pale grey to near-black without changing component materials.
- Suspected cause: The final workspace chrome layer still used pale surface-derived navbar tokens, transparent dropdown menu buttons, centered Add-menu positioning, and the older Layout arrow child. The background popover had no internal max-height/scroll behavior before the grey palette expanded.
- Fix notes: Retuned the shared navbar control tokens toward neutral grey, gave dropdown buttons the same neutral nodule material at rest, removed the Layout arrow markup and centered the label, anchored the Add menu by left edge to the plus trigger, made the background popover internally scrollable, and added grey-only background tokens/options from very pale grey through near-black grey.
- Validation: Updated workspace chrome/background tests to assert the arrow is gone, Layout label is centered, Add menu left edge aligns with the plus trigger, dropdown buttons have visible nodule material, new grey tones appear, and background choices preserve shared glass tokens. Targeted `background or workspace_chrome or compact_pressable_controls` coverage passed, manual browser inspection screenshots were captured under `test-results/manual-navbar-grey-polish`, and `.venv\Scripts\python.exe -m pytest -q` passed with 84 tests.

### BUG-088: Compact Controls Still Had Legacy Lift And Glow Physics

- Status: Fixed
- Area: Compact controls / hover physics / timeframe / navbar menus / object menus
- Severity: Medium
- Environment: Dashboard workspace, timeframe controls, widget/panel tool drawers, navbar buttons, Layout/Add/profile dropdowns, confirm dialogs
- Observed: Several compact pressable controls still used older hover language after the large-object/compact-control split. Timeframe buttons and legacy search controls carried larger glow-like hover shadows, confirm dialog buttons lifted upward, and navbar dropdown/Add/profile menu controls did not all share the same final depression coverage.
- Expected: Widgets, panels, dividers, and other large workspace objects may keep a subtle spatial hover lift, but compact controls should settle inward on hover, press deeper on active, keep focus-visible distinct, and avoid glow, scale-up, icon float, or layout shift.
- Suspected cause: The shared pressable transform tokens existed, but older component rules still defined hover shadows and transforms before later workspace chrome rules. The shared selector list also missed some dropdown/profile/add menu entries.
- Fix notes: Reused the existing `--pressable-hover-transform`, `--pressable-active-transform`, and `--pressable-focus-transform` tokens; reduced timeframe/control hover shadows to restrained contact shadows; changed confirm dialog buttons from lift to depression; and added a final compact-control normalization layer for Layout, Add, profile/workspace, background, timeframe, and dialog controls without touching large object hover rules.
- Validation: Expanded `test_compact_pressable_controls_depress_without_sinking_large_surfaces` to cover navbar controls, Layout menu buttons, Add menu entries, profile/workspace dropdown options, disabled profile rows, and focus settling. Targeted compact/workspace/timeframe/widget-material coverage passed, manual browser inspection screenshots were captured under `test-results/manual-interaction-physics`, and `.venv\Scripts\python.exe -m pytest -q` passed with 84 tests.

### BUG-087: Timeframe Command Surface Was Not Createable As A Widget Type

- Status: Fixed
- Area: Widgets / timeframe command surface / add menu / adaptive density
- Severity: Medium
- Environment: Dashboard workspace, Add object menu, timeframe controls, widget move/resize/save/load
- Observed: The default timeframe surface visually looked like a widget and partially used the widget shell, but it was not exposed as a createable widget type. Custom widget creation only rendered stat-style anchors, and the timeframe shell still used a default cursor that made it feel less like the other movable widgets.
- Expected: Timeframe is a first-class widget type. It should be createable from the Add menu, render through the widget factory, receive the shared widget tools, move/resize/persist through the same widget lifecycle, and use adaptive density for its internal controls.
- Suspected cause: The original timeframe command surface was hard-coded in the dashboard template while the Add menu and custom widget factory only knew how to create generic stat widgets. The timeframe component styling also kept an older `cursor: default` shell value.
- Fix notes: Added a Timeframe entry to the Add menu, added a timeframe renderer path to `createCustomWidget`, gave custom timeframe widgets the same `widget-card` lifecycle metadata as other widgets, and set the timeframe shell cursor to match normal widget affordance. Timeframe preset, selector, refresh, and calendar controls continue to use the shared compact pressable depression rules.
- Validation: Added `test_timeframe_widget_is_createable_and_uses_widget_system` to verify createability, widget metadata, shared tools, move, adaptive resize to span 2, compact control density, pressable hover transforms, save/load persistence, and rendered controls. Targeted timeframe/control tests passed, scrollbar-change setup was updated to respect the timeframe widget's valid footprint, and `.venv\Scripts\python.exe -m pytest -q` passed with 84 tests.

### BUG-086: Closing A Moved Expanded Panel Let Displaced Objects Cross Above It

- Status: Fixed
- Area: Dashboard grid / panel expand-collapse / temporary displacement restoration
- Severity: High
- Environment: Dashboard workspace, expanded panel moved while open, neighboring panel or widget displaced below it
- Observed: After an expanded panel was moved downward and pushed a lower object farther down, collapsing the moved panel could restore that lower object all the way to its original baseline row, even if that row was now above the moved source panel.
- Expected: Collapse restoration should relax temporary displacement upward only within the correct local relationship. If an object is currently below the collapsed source panel in overlapping columns, it may move upward but must remain below the source panel.
- Suspected cause: `relaxCollapsedExpansionDisplacement` restored candidates toward their captured expansion baseline without applying a source-panel ordering boundary. The solver treated the displaced object as free to occupy any available baseline row, which was effectively a local auto-pack across the moved panel.
- Fix notes: Collapse relaxation now computes the collapsed source panel bounds and applies a local minimum row for candidates that are currently below it and share columns. Those objects still restore upward as much as possible, but their target row is clamped below the collapsed source panel. Unrelated objects and non-overlapping columns are left on the existing baseline restoration path.
- Validation: Added `test_closing_moved_expanded_panel_preserves_displaced_panel_order` and updated expanded-panel drag restoration coverage for the new local-order contract. Targeted expand/collapse tests, full group behavior slice, and `.venv\Scripts\python.exe -m pytest -q` passed with 83 tests.

### BUG-085: Navbar Groups Hovered Like Plates Instead Of Individual Buttons

- Status: Verified
- Area: Top bar / navbar / menu styling
- Severity: Medium
- Environment: Dashboard workspace, navbar controls, identity menu, Layout menu, Add menu, default and deep background tones
- Observed: Navbar command islands still rendered as separate underlay plates and inherited group-level hover motion. Hovering a grouped region could make the group feel active instead of only the actual button. The Layout arrow was drawn by an absolute pseudo-element that could drift into the label, the Add menu was left-anchored instead of visually originating from the add button, and the identity dropdown still framed the area as dashboard settings.
- Expected: The navbar should read as one widget-like glass surface with individual neutral glass buttons sitting directly on it. Hover/press feedback belongs to the hovered button only, Layout arrow geometry should be explicit and aligned to the label, the Add menu should anchor to the plus control, and the identity dropdown should be profile/workspace identity oriented rather than a settings menu.
- Suspected cause: Late workspace-chrome CSS gave every `.workspace-command-island` its own glass background, border, and hover/focus transforms. The Layout trigger relied on `::after` positioning relative to a mixed button/picker layout, and the dashboard switcher still included the legacy settings link.
- Fix notes: Removed visible command-island plates by making navbar groups transparent flex organizers, neutralized group hover/focus transforms, retuned navbar buttons to calmer grey glass controls with restrained blue only on Add, replaced Layout/Dashboard arrows with explicit flex children, centered the Add dropdown on the plus button, removed the settings link from the identity dropdown, and added Anchor and Divider entries to the Add menu. Anchor creates a placeholder custom widget; Divider creates a placeholder divider-flavored panel until the future object architecture lands. Layout and Add menus now close through Escape or outside pointer-down so expanded controls do not linger over unrelated navbar options.
- Validation: Updated `test_workspace_chrome_is_spatial_and_modes_still_work` to verify no settings link remains, command islands have no underlay material, hovering Save changes only Save and not its group or sibling, Layout arrow spacing is correct, Layout/Add menus have close paths, the Add menu is centered on the plus button, and Anchor/Divider appear in the Add menu. Updated generic panel/menu coverage to assert Anchor and Divider taxonomy entries are present. Targeted navbar/add/layout/background tests passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 79 tests.

### BUG-084: Widget Hover Shadow Read As Colored Floating Glow

- Status: Verified
- Area: Widgets / glass material / hover and focus polish
- Severity: Medium
- Environment: Dashboard workspace, default widgets, custom-color widgets, light and deep background tones
- Observed: Widget hover/focus shadows were larger and more saturated than the surrounding glass language. Default widgets could inherit blue-tinted hover shadow, and active/custom-color widgets added accent-colored shadow layers that made the object read as a floating glow rather than a subtle material response.
- Expected: Widget and panel bodies may keep a mild large-object hover presence, but the shadow should remain restrained, neutral, and physically believable. The hover/focus state should signal slight material activation without colored bloom, oversized spread, or artificial detachment from the workspace.
- Suspected cause: `dashboard-grid.css` used a 30px neutral widget hover shadow and a blue stat-card hover layer, while active/custom-color widget rules in `themes.css` added high-blur accent shadows. Those cascaded into more dramatic colored elevation than the current glass system needs.
- Fix notes: Reduced the default stat/widget hover shadow radius and opacity, replaced the blue hover layer with a neutral shadow, and removed accent-colored active/custom-color shadow blooms in favor of compact neutral depth plus the existing inset highlight. Layout, lift transform, borders, drag behavior, and compact-control interaction rules were unchanged.
- Validation: Added `test_widget_hover_shadow_stays_subtle_and_neutral`, which reads rendered `box-shadow` layers and rejects excessive blur or saturated non-inset shadow layers for default hover, active custom-color hover, and the same custom widget over a deep background tone. Targeted hover/focus and compact-control tests passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 79 tests.

### BUG-083: Click-Opened Object Settings Menu Used Static Drawer Offsets

- Status: Fixed
- Area: Panel controls / Widgets / menu positioning
- Severity: Medium
- Environment: Dashboard workspace, panel and widget settings menus opened by hover, direct click, or pointer click
- Observed: Opening an object settings menu by directly clicking the settings icon could leave the drawer visually embedded in the panel header/chevron edge. The normal hover reveal path looked correct, but click-open exposed the static drawer offset relationship more clearly.
- Expected: Hover-open and click-open use the same anchor, measurement, collision avoidance, and final transform. The drawer should clear the panel header edge, should not be clipped or embedded in the panel surface, and should behave consistently for panels and widgets near top/right/bottom placements.
- Suspected cause: The drawer had only static CSS `top`/`right` offsets. There was no shared positioning pass, and the absolute drawer is positioned relative to the compact `.panel-tools`/`.widget-tools` anchor rather than the full panel/widget root. That made direct-click geometry depend on a stale static relationship to the header edge.
- Fix notes: Added a shared `positionDashboardToolDrawer` helper used by the common panel/widget open functions. It measures the settings button, drawer, and actual offset parent, writes shared CSS custom properties for drawer top/right, clamps to the viewport, and keeps panel drawers clear of the header bottom edge. Hover, focus, click, drag-restore, and resize-restore now enter through the same open function and therefore share the same geometry.
- Validation: Added `test_object_settings_click_and_hover_share_menu_geometry`, which opens panel and widget drawers via hover, direct JS click, and pointer click, compares final drawer geometry, verifies panel header clearance and settings-button separation, repeats near the top/right edge, and keeps submenu button coverage intact. Targeted menu/control tests passed, a transient far-down auto-scroll timeout passed on direct rerun, and `.venv\Scripts\python.exe -m pytest -q` passed with 78 tests.

### BUG-082: Pinned Objects Blocked Panel Expansion Pressure

- Status: Fixed
- Area: Dashboard grid / panel expand-collapse / pinning
- Severity: High
- Environment: Dashboard workspace, pinned widgets and panels near a collapsed panel footprint
- Observed: Opening a panel next to a pinned widget or panel could make the expanded panel visually collide with or cut into the pinned object. The system treated pinned cells as globally immovable, so the expansion solver excluded pinned objects from temporary pushdown.
- Expected: Pinned means the user cannot directly drag or resize the object. It does not make the object immune to reversible layout pressure from panel expand/collapse. Opening a panel may temporarily displace pinned objects in the expansion path; closing the panel restores them to the captured pinned baseline; save/load while open preserves that baseline.
- Suspected cause: `applyVerticalPanelExpansion` pre-reserved pinned objects as fixed occupancy and only pushed unpinned candidates. `relaxCollapsedExpansionDisplacement` also filtered pinned objects out of collapse restoration, so even if they were moved by another path they would not participate in baseline relaxation.
- Fix notes: The panel expansion solver now treats all non-source dashboard items, including pinned widgets and panels, as pressure participants behind the expanded panel footprint. The collapse relaxation path now considers pinned items that exist in the expansion baseline. Direct drag, resize, group, and drop paths still reserve pinned cells and reject direct manipulation.
- Validation: Added `test_panel_expand_temporarily_displaces_pinned_widget_then_restores_baseline`, which places a pinned widget and pinned panel in an opening panel's footprint, verifies the pinned widget cannot be directly dragged or resized, opens the panel and verifies both pinned objects are pushed without overlap, saves while open and confirms stored expansion baselines keep the pinned baseline rows, reloads, collapses, and verifies both pinned objects restore. Targeted expansion/pinning/save-load tests passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 77 tests.

### BUG-081: Far Lower Widget Drops Could Use An Upward Fallback Slot

- Status: Fixed
- Area: Dashboard grid / drag / edge auto-scroll / layout commit
- Severity: High
- Environment: Dashboard workspace, bottom-edge drag into far auto-expanded lower rows
- Observed: A smallest widget could be dragged into newly revealed lower workspace rows, show a valid snapped preview, and then appear to return toward its starting/original area after release once the drop passed a deeper lower-row threshold. Panels did not show the same failure pattern.
- Expected: Widgets and panels use the same authoritative lower-workspace row model. If the snapped preview can occupy an auto-expanded row, commit accepts that same row on the first release. Fallback-to-origin only happens for genuinely invalid placements.
- Suspected cause: The widget active-drop path still used the older nearest sparse-slot fallback when the preferred active slot was blocked by immovable/pinned occupancy. Expanded panels already used the forward-only at-or-after fallback. That left widgets with a stale fallback path that could search back upward from the preview target instead of preserving the lower-row intent.
- Fix notes: Routed widget active-drop resolution and the shared preview placeholder resolution through `nearestSparseSlotAtOrAfter`, matching the expanded-panel commit contract. The snapped preview, widget commit, and panel commit now resolve blocked lower rows from the target row forward instead of searching back toward earlier content. Pointer timing, auto-scroll velocity, snapping math, collision validation, ghost previews, and scroll-runway cleanup were not changed.
- Validation: Added far-down Playwright coverage for small widgets at increasing depths, minimum-size timeframe widgets, larger widgets, and panels. The tests capture the snapped preview row/column before release and assert the committed item matches it, remains below the original workspace bottom, does not fallback to the origin, preserves widget/panel bounds parity, and leaves no auto-scroll artifacts or overlaps. Targeted edge auto-scroll and pinned-displacement tests passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 76 tests.

### BUG-073: Dark Mode Had Become A Separate Material System

- Status: Verified
- Area: Background selection / shared glass material
- Severity: High
- Environment: Dashboard workspace, default and deep background tones
- Observed: The app still carried a separate mode concept through CSS selectors, toolbar controls, localStorage keys, template picker groups, bootstrap logic, and Playwright coverage. That made darker workspaces behave like an alternate component theme rather than the same glass objects placed over a darker background.
- Expected: There is one shared glass/component material system. Selecting a darker workspace changes only the background environment and must not swap panel, widget, button, submenu, timeframe, nav, hover, focus, shadow, border, or icon material styling.
- Suspected cause: Earlier material fixes accumulated as `data-theme` branches and split light/dark background storage, so the cascade could retheme components instead of only changing ambient background colors.
- Fix notes: Removed dark-mode CSS branches, removed the theme toggle and split background mode markup, collapsed storage to one `dashboard-background` key, rewrote background tokens so presets only set `--bg` and `--bg-end`, expanded the background picker with deep black/charcoal/graphite/slate/navy/steel tones, and updated docs to describe one material system with background tones.
- Validation: Updated Playwright coverage to assert no mode toggle state remains, verify background hover/click persistence, and verify nav, panel, widget, timeframe, and settings control material styles remain unchanged when selecting `deep-slate`. Removed obsolete dark-mode-only tests. Targeted background/material slices passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 71 tests.

### BUG-074: Pinned Marker Looked Like A Floating HUD Badge

- Status: Verified
- Area: Pinned state / visual material
- Severity: Medium
- Environment: Dashboard workspace, pinned panels and widgets on default and deep background tones
- Observed: The pinned-state marker used an 18px badge plus a masked pin glyph. Even though it was smaller than the original hover-glow approach, it still read as a floating debug/HUD decoration and competed with calm panel/widget material.
- Expected: Pinned state should be visible as a tiny, quiet material cue: a subtle glass nodule embedded near the item edge, with no large symbol, glow, harsh outline, or separate overlay language.
- Suspected cause: The previous fix improved the explicitness of the pinned marker by adding symbolic detail, but that pushed the state cue away from the shared glass-nodule system.
- Fix notes: Replaced the badge-and-pin pseudo-element pair with a single 7px rounded glass dot. The dot uses shared glass/accent tokens, a restrained darker rim, a tiny material shadow, and no symbolic `::before` overlay.
- Validation: Updated `test_pin_control_uses_soft_dashboard_chrome` to assert the marker stays tiny, round, non-glowy, has no pseudo-element pin glyph, and remains present on a deep background. Targeted pin coverage passed.

### BUG-075: Open Panel Drag Could Visually Shrink While Keeping Expanded Footprint

- Status: Verified
- Area: Panel drag / expanded footprint / visual layout
- Severity: High
- Environment: Dashboard workspace, expanded panels with displaced neighbors
- Observed: Dragging an open panel could leave the logical `data-grid-row-span` and collision footprint expanded while the rendered panel height shrank back toward its minimum/content height during or after drop.
- Expected: An open panel remains visibly expanded unless explicitly collapsed. Drag surface, snapped placeholder, committed panel height, collision footprint, and saved layout footprint all agree.
- Suspected cause: Expanded height was partly owned by transient inline height. `runOrderedDrag` correctly cleared the fixed-position drag inline height on release, but `applyPanelGridPosition` only restored grid row/span state and did not reapply the rendered height from the expanded footprint.
- Fix notes: Added `syncPanelRenderedHeightToFootprint` and routed real panels through it from `applyPanelGridPosition`. Open panels now derive rendered height and `savedHeight` from the committed row span; collapsed panels still clear height. `gridItemRowSpan` now honors the expanded panel minimum even when an explicit stale row span is present.
- Validation: Expanded `test_dragging_expanded_panel_preserves_temporary_pushdown_restoration` to assert open panel height before drag, fixed drag-surface height during drag, snapped placeholder height and row span, post-drop rendered height, collapse restoration, reopen behavior, and absence of overlaps. Targeted collapsed/open drag coverage passed, broader drag/collapse/save coverage passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 71 tests.

### BUG-076: Empty Open Panel Surface Felt Like An Opaque Document Canvas

- Status: Verified
- Area: Panel empty state / glass material
- Severity: Medium
- Environment: Open empty panels on default and deep background tones
- Observed: The empty placeholder inside open panels used a high-opacity surface mix, so large empty panels read as heavy white/grey blocks instead of inactive frosted workspace space.
- Expected: Empty panel content areas should remain lightweight and atmospheric: translucent glass, subtle environmental blending, readable empty-state text, and no impact on populated panel/widget content.
- Suspected cause: `.panel-empty-state` reused stronger surface tokens intended for active surfaces, which made the placeholder fill dominate when stretched across a large open panel body.
- Fix notes: Reduced the empty-state fill to low-alpha shared glass tokens, softened the dashed edge, kept the inset highlight restrained, and added a light backdrop blur. The change is scoped to `.panel-empty-state`.
- Validation: Added `test_empty_panel_surface_is_translucent_without_affecting_populated_content`, which verifies default/deep background translucency, readable empty text/action styling, and unchanged populated timeframe surface material. Targeted empty-panel coverage passed.

### BUG-077: Object Settings Menu Controls Kept Legacy Bright Hover Feedback

- Status: Verified
- Area: Panel controls / widget controls / hover interaction
- Severity: Medium
- Environment: Dashboard workspace, widget and panel object settings menus on default and deep background tones
- Observed: Object settings controls already used the compact pressable downward transform, but old hover/focus/open shadow rules still added large zero-offset luminous halos. The pin glyph also nudged upward on hover, so the submenu could read as floating/brightened legacy buttons rather than compact controls settling into contact.
- Expected: Widget and panel settings buttons, submenu icon buttons, move/resize/pin/text/theme/delete controls, and object-menu controls should depress subtly on hover, press deeper on active, keep icons at the same visual scale as neighbors, avoid hover lift or icon float, and preserve the shared glass material without bright glow artifacts.
- Suspected cause: The shared pressable transform tokens were added after older object-control hover rules, leaving `.panel-settings-toggle`, `.panel-tool-button`, `.panel-lock-toggle`, `.panel-pin-toggle`, and custom-color overrides with legacy large shadow stacks such as zero-offset glow layers.
- Fix notes: Added shared object-control shadow tokens for rest, hover, active, and drawer states, routed panel/widget settings and submenu controls through those tokens, replaced custom-color hover/open/focus shadow overrides with the same compact-control material tokens, and changed the pin icon hover/active motion so it settles inward instead of floating upward.
- Validation: Expanded `test_compact_pressable_controls_depress_without_sinking_large_surfaces` to hover every widget and panel object settings/menu button, assert depression without scale-up, reject the old glow shadow pattern, verify active press is deeper than hover, keep drawer dimensions stable, and repeat a control check on `deep-slate`. Targeted `compact_pressable or pin_control` coverage passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 72 tests.

### BUG-078: Navbar Read As A Separate Toolbar Instead Of A Dashboard Widget

- Status: Verified
- Area: Top bar / workspace chrome / shared material
- Severity: Medium
- Environment: Dashboard workspace, default and deep background tones
- Observed: The navbar had accumulated stacked workspace-chrome overrides with floating island transforms, uneven opacity, special add-button glow, separated sync/settings icon controls, and menu styling that made the Layout dropdown feel like an admin toolbar instead of dashboard glass.
- Expected: The navbar should read as a normal dashboard widget surface. Its buttons, dropdowns, add control, layout controls, mode toggles, restore/background controls, spacing, vertical centering, hover, focus, and active behavior should follow the shared glass and compact pressable-control system.
- Suspected cause: Earlier navbar polish had treated the top bar as a special chrome layer, adding late overrides for atmospheric glow, island offsets, status popovers, and icon-only utilities instead of letting the same widget/control primitives own the surface.
- Fix notes: Removed the visible standalone sync/status control and standalone settings icon from the navbar, moved the settings path into the workspace identity selector, and replaced the late navbar-specific visual override with one widget-like glass surface, shared command-island rhythm, consistent 36px compact controls, shared pressable depression states, and shared glass menu treatment for Layout/Add/identity/background popovers.
- Validation: Updated `test_workspace_chrome_is_spatial_and_modes_still_work` to assert the sync/status and standalone settings icon are gone, the identity selector keeps one settings path, the navbar material is widget-like, controls are vertically centered and evenly sized, the Layout menu uses glass popover styling, default and `deep-slate` navbar screenshots render, and Add/Engineer/Context behaviors still work. Targeted workspace chrome, layout save/load, and background slices passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 72 tests.

### BUG-079: Open Settings Menus Obscured Active Drag And Resize Placement

- Status: Verified
- Area: Panel controls / widget controls / drag-resize visual cleanup
- Severity: Medium
- Environment: Dashboard workspace, open widget/panel settings drawers during drag and resize
- Observed: If a widget or panel settings drawer was open when the user started moving or resizing that item, the drawer stayed visually present over the active placement surface. Attempts to hide it by closing the menu risked losing the user's open-menu state when the interaction ended.
- Expected: The active item's settings/configuration drawer should hide immediately during drag or resize, without affecting grid measurements, collision, pointer flow, snapping, previews, or commit behavior, then restore to its prior open state when the interaction ends.
- Suspected cause: Tool drawer visibility was controlled only by hover/open classes. Those classes were independent from the existing `panel-interaction-active` and `panel-resize-active` body states, so the drawer remained visible during the interaction and hover-close timers could race restoration afterward.
- Fix notes: Reused the existing interaction body classes to hide open panel/widget drawers and color menus with `visibility`, `opacity`, and `pointer-events` only. Widget and panel tool handlers now remember whether the source drawer was open or the interaction began from the drawer, clear pending hover-close timers, and restore the same drawer after drag/resize cleanup. Follow-up click suppression prevents anchor-backed widget drags from triggering a dashboard filter reload on release.
- Validation: Added `test_open_settings_menu_hides_during_drag_and_resize_then_restores` for widget drag and panel resize hide/restore behavior, and updated the live-resize coverage to account for restored panel menus before moving on to widget resize. Targeted drag/resize/menu coverage passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 73 tests.

### BUG-080: Widget Surface Buttons Read As Too Opaque For Widget Glass

- Status: Verified
- Area: Widget controls / glass material
- Severity: Medium
- Environment: Dashboard workspace, widget settings buttons, widget tool drawers, and compact widget action buttons on default and deep background tones
- Observed: Widget controls inherited enough solid surface/accent mixing that settings buttons and submenu buttons felt pasted onto the widget rather than embedded into the same translucent glass body. The issue was most visible on custom-colored widgets where the control background was an opaque surface/accent mix.
- Expected: Widget controls remain readable and tactile, but their fill should be more translucent and atmospheric than panel controls, preserving edge definition, icon readability, and compact pressable hover/active depression without adding glow or brighter borders.
- Suspected cause: Widget custom-color control tokens used `surface-raised` plus accent color as an opaque background. The widget drawer also used a near-solid raised surface, and open/hover rules could route widget settings buttons back through the denser shared panel-control active fill.
- Fix notes: Retuned widget control tokens to use glass/transparent mixes, added widget-specific hover/active control fills, softened widget drawer surfaces, and kept panel controls unchanged. Timeframe widget tool drawers now inherit the same translucent widget drawer material instead of forcing an opaque raised fill.
- Validation: Added `test_widget_surface_controls_use_translucent_widget_glass` to verify widget settings/menu buttons and drawers stay translucent, readable, non-glowy, darker-rimmed, and less solid than panel controls on default and `deep-slate` backgrounds. Targeted widget material, compact-control, pin, timeframe, and shared background material slices passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 74 tests.

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

### BUG-058: Dark Timeframe Controls Lost Layered Glass Depth

- Status: Verified
- Area: Widgets / theme / dark-mode material polish
- Severity: Low
- Environment: Dashboard workspace, dark theme, timeframe command widget
- Observed: The dark-mode timeframe command surface read flatter and more recessed than the light-mode material. The outer pill, inner clusters, and individual controls used nearly the same dark override, so the ridged/inset container hierarchy disappeared.
- Expected: Dark mode preserves the same material hierarchy as light mode under smoked-glass lighting: a distinct outer command surface, nested capsule clusters, and raised readable controls with subtle borders, soft inner highlights, restrained shadows, and no neon rim.
- Suspected cause: A late dark-mode selector grouped `.timeframe-command-surface`, `.timeframe-presets`, `.timeframe-active-cluster`, and `.timeframe-utility-cluster` together with identical background, border, and shadow values, flattening the control stack.
- Fix notes: Split the dark timeframe material rules by layer. The outer command surface now uses a deeper smoked-glass ridge with low-contrast slate border, inner clusters use a separate inset capsule treatment, the active cluster has a slightly stronger inner material, and individual timeframe controls keep their own raised hover/active/focus surfaces. Navbar styling and interaction behavior were not changed.
- Screenshot: `test-results/timeframe-depth/timeframe-dark-layered-depth.png`
- Validation: Added `test_dark_timeframe_controls_preserve_layered_glass_depth`, which verifies the dark outer surface, inner clusters, active cluster, and buttons have distinct backgrounds/borders, retain inset highlight/shadow structure, avoid electric blue edge colors, and still provide hover elevation. Targeted timeframe/theme tests passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 69 tests.

### BUG-059: Undo Skipped The Most Recent Committed Dashboard Change

- Status: Verified
- Area: Dashboard grid / undo / layout state
- Severity: High
- Environment: Dashboard workspace, keyboard undo and toolbar undo after drag, resize, grouped interactions, add panel, and expand/collapse
- Observed: Undo did not reliably behave like Ctrl+Z for the last committed dashboard action. After some drag, resize, grouped, or add-panel flows, the first undo appeared to restore the wrong state, skip the most recent change, or do nothing.
- Expected: Ctrl+Z/Cmd+Z and the undo button restore the previous committed dashboard state exactly one step at a time. Undo history records committed user actions, not live ghosts, snapped previews, hover/focus state, selected visuals, or temporary interaction surfaces.
- Suspected cause: Shared dashboard interactions call `saveSharedGridLayouts`, which saves widget and panel layouts separately. Each save pushed a live undo snapshot, so one committed action could leave duplicate identical "after" states on the undo stack. The first undo popped only one duplicate and restored the same visible layout. Snapshots also included transient root item classes such as selected/tools-open/drag/resize state, and there was no document-level Ctrl+Z handler.
- Fix notes: Added sanitized committed-state snapshots that strip transient interaction/selection/tool classes from captured root items, added snapshot signatures so duplicate committed states are ignored, and cleaned live resize/drag/group/auto-scroll artifacts before and after restore. Ctrl+Z/Cmd+Z now invokes dashboard undo only outside editable fields and prevents browser default only when a dashboard undo actually handles the shortcut. The existing stack remains a committed-state history rather than a pointermove/live-preview log.
- Validation: Added undo regressions for widget move, widget resize, group move, group resize, add panel, expand/collapse, canceled drag preview exclusion, artifact cleanup, and input-field Ctrl+Z safety. Targeted undo tests passed, broader drag/resize/group/add/expand slices passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 73 tests.

### BUG-060: Upward Edge Auto-Scroll Felt Rigid And Made Sticky Navbar Bounce

- Status: Verified
- Area: Dashboard grid / drag-resize / edge auto-scroll / toolbar stability
- Severity: Medium
- Environment: Dashboard workspace, constrained viewport, upward top-edge drag from scrolled dashboard
- Observed: Bottom-edge drag and resize auto-scroll felt smooth, but dragging a widget or group toward the top edge from a scrolled dashboard could feel rigid and tile-stepped. The sticky workspace navbar could visibly shift as the document approached the top scroll boundary.
- Expected: Upward edge auto-scroll uses the same smooth requestAnimationFrame model as downward auto-scroll. The live drag shell remains pointer-continuous, the snapped footprint may update by grid row, the navbar remains visually stable, top-row placement remains reachable, and no stale auto-scroll/temporary runway state remains after release.
- Suspected cause: The upward branch used the shared velocity loop, but it still delegated top-boundary clamping to the browser by requesting negative scroll deltas that could exceed the remaining scroll distance. During the same top-edge interaction, the live dragged surface was clamped to viewport top while the document moved underneath it, making the visual shell feel stuck while the snapped footprint advanced by rows. Scroll boundary behavior was not explicitly suppressed during the active interaction.
- Fix notes: Bounded upward scroll deltas before calling `scrollBy`, added a gentle top-distance brake near `scrollY = 0`, temporarily suppresses vertical overscroll and smooth-scroll behavior for the interaction lifetime, and relaxes the live drag surface's top clamp only while actively auto-scrolling upward so the lifted object remains pointer-continuous. Downward workspace-extension behavior was left intact.
- Validation: Added `test_edge_auto_scroll_upward_is_smooth_and_keeps_navbar_stable` and `test_edge_auto_scroll_supports_group_drag_upward`, covering upward frame cadence, navbar x/y/height stability within 1px, top-row preview/commit, grouped upward drag, stale artifact cleanup, and no horizontal overflow. Targeted edge-scroll tests, drag/group/resize/undo slices, and `.venv\Scripts\python.exe -m pytest -q` passed with 75 tests.

### BUG-061: Dragging Expanded Panels Permanently Displaced Nearby Objects

- Status: Verified
- Area: Dashboard grid / drag / expand-collapse / layout state
- Severity: High
- Environment: Dashboard workspace, expanded panel drag followed by collapse and save/reload
- Observed: Dragging an open/expanded panel could make nearby objects move out of the way, but those objects could remain permanently shifted after the panel was dropped and later collapsed. In some cases the displaced object moved sideways, so collapse restoration no longer recognized it as an expansion-displaced item that should relax upward.
- Expected: Expanded-footprint pressure during panel movement is temporary layout pressure. It may affect live preview and collision while the panel is open, but collapse should release affected nearby objects upward when their prior valid cells are available. Only the moved panel's final position and unavoidable collision resolution should commit; unrelated objects should not globally repack or remain scrambled.
- Suspected cause: Expanded panel drag used the generic `commitActiveDropSlot` collision path. When the expanded footprint overlapped another item, that generic resolver could move the displaced item sideways into the nearest same-row sparse slot. Collapse restoration intentionally only relaxes items that remain in their baseline column, so the sideways escape converted temporary expanded-footprint displacement into permanent committed layout drift.
- Fix notes: Added an expanded-panel-specific drop commit path that keeps the expanded panel's final footprint collision-aware but resolves affected movable neighbors with vertical-only downstream pushdown. This preserves baseline columns for expansion-displaced items, allowing the existing local collapse relaxation to pull them back upward when the panel collapses. Generic collapsed/single-item drag behavior and downward auto-scroll runway behavior were not changed.
- Validation: Added `test_dragging_expanded_panel_preserves_temporary_pushdown_restoration`, which expands a panel, records the affected widget and unrelated object, drags the expanded panel over the widget, asserts the widget remains in its baseline column during temporary pushdown, saves/reloads while still expanded, collapses the loaded-expanded panel, verifies the widget and unrelated object return to their prior valid positions, saves/reloads again, and checks the stable collapsed layout persists. Targeted expanded-panel drag/collapse, add-panel, group, edge-scroll, and undo slices passed. During full-suite validation, unrelated transient Playwright/browser failures (`net::ERR_NO_BUFFER_SPACE` on reload and a group top-row drag timing miss) each passed on direct rerun. The final `.venv\Scripts\python.exe -m pytest -q` passed with 76 tests.

### BUG-062: Timeframe Adaptive Minimum Was Still One Column Too Conservative

- Status: Verified
- Area: Widgets / resize / adaptive density
- Severity: Low
- Environment: Dashboard workspace, timeframe widget resize, light and dark themes
- Observed: The previous adaptive-density fix reduced the timeframe widget minimum to three grid columns, but the rendered controls still had enough unused horizontal comfort space to remain usable one grid column smaller.
- Expected: The timeframe widget minimum represents the smallest still usable adaptive layout, not a comfortable spacious layout. Controls should remain visible, readable, clickable, and unclipped at the new floor, with compact spacing and wrapping used before increasing the footprint.
- Suspected cause: The runtime floor remained encoded in both `data-min-w` and the shared `gridItemMinimumSpan` controls fallback, and the CSS density ladder stopped at span 3 rather than defining an explicit denser span-2 state.
- Fix notes: Reduced the timeframe controls minimum from span 3 to span 2 in both the template metadata and the shared `gridItemMinimumSpan` controls fallback. Added an explicit span-2 dense-minimum CSS state that tightens command-surface gaps, cluster padding, preset widths, selected-timeframe width, icon button size, and reserved tool spacing while retaining visible controls, wrapping, and hover/focus behavior. Group resize fixtures were updated so proportional scaling can actually reach the new timeframe floor without another selected member's minimum stopping the scale first.
- Validation: Updated `test_timeframe_resize_clamps_to_adaptive_density_minimum` for light and dark themes to verify the snapped resize preview and final commit clamp at span 2, controls remain visible/unclipped, compact values activate, hover/focus remains usable, and no overlaps appear. Updated grouped resize minimum coverage for the new floor. Targeted timeframe tests passed, targeted timeframe/group resize tests passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 76 tests.

### BUG-063: Dark Timeframe Controls Still Read Too Flat Against Light-Mode Depth

- Status: Verified
- Area: Theme / dark mode / timeframe widget material
- Severity: Low
- Environment: Dashboard workspace, dark theme, timeframe command widget
- Observed: The dark-mode timeframe command group had the correct structure but still read flatter and more recessed than the light-mode ridged glass material. Generic dark active/hover button styles could also override the timeframe-specific button shadow stack, leaving active controls with only a single inset highlight.
- Expected: Dark mode uses the same material hierarchy as light mode under smoked-glass lighting: protruding outer command surface, distinct inset/ridged clusters, individually raised buttons, subtle low-contrast borders, restrained highlights, and no neon edge/glow.
- Suspected cause: The dark overrides separated the surface, clusters, and controls, but several layers used similar dark values and modest shadows. The active button cascade was not specific enough to keep the timeframe-specific layered shadow/background over the shared button active rule.
- Fix notes: Reworked the dark timeframe material stack without touching navbar styling. The outer command surface now uses a stronger smoked-glass ridge with a top radial highlight, deeper lower inset, and low-contrast slate border. The preset, active, and utility clusters now read as separate inset capsules. Individual timeframe buttons, refresh/calendar icon controls, and active/focus states now carry their own raised dark-glass background images and multi-inset shadow stack. Added more specific timeframe button selectors so shared active/hover button rules cannot flatten the control elevation.
- Screenshot: `test-results/timeframe-depth/timeframe-dark-layered-depth.png`
- Validation: Strengthened `test_dark_timeframe_controls_preserve_layered_glass_depth` to assert radial highlight layers, distinct wrapper/cluster/button backgrounds, distinct borders, multiple inset shadows, restrained border brightness, no electric-blue edge colors, and hover elevation. Targeted timeframe visual/resize tests passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 76 tests.

### BUG-064: Pin Control Looked Like A Harsh Utility Toggle

- Status: Verified
- Area: Controls / pinning / visual system
- Severity: Low
- Environment: Dashboard workspace, panel and widget tool drawers, light and dark themes
- Observed: The pin icon used a heavier generic pushpin mask, the pinned control state relied on a louder glow, and the pinned corner marker read more like a bright status/debug badge than an integrated workspace-state affordance.
- Expected: Pinning remains understandable but visually quiet. The pin button should share the 34px glass control primitive, use softer icon weight and sizing, show hover/focus and active states without harsh outlines or neon glow, and keep pinned markers subtle in both light and dark mode.
- Suspected cause: The pin glyph and pinned-state marker were older utility/status styling while later settings, resize, and timeframe controls had moved toward softer glass materials. Custom-color panel overrides also used broad `!important` tool-button rules that could flatten pin-specific active styling.
- Fix notes: Replaced the pin mask with a smaller, lighter rounded glyph, softened the pinned button material, reduced the pinned marker size and glow, added dark smoked-glass pinned button/marker overrides, and added final pin-specific selectors so custom-color panel/widget chrome cannot override the refined state. Pin classes, ARIA state, and behavior logic were not changed.
- Validation: Added `test_pin_control_uses_soft_dashboard_chrome` for light and dark themes. The test checks pin/settings control sizing parity, icon centering and scale, hover/focus feedback, pinned/unpinned visual distinction, subdued pinned marker sizing, dark-mode non-neon borders, and coverage across expanded panel, collapsed panel, and widget controls. Targeted pin/pinned/layout tests passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 78 tests.

### BUG-065: Bottom Edge Drop Could Lose Newly Revealed Workspace Placement

- Status: Verified
- Area: Dashboard grid / drag / edge auto-scroll / layout commit
- Severity: High
- Environment: Dashboard workspace, bottom-edge drag into temporary lower runway
- Observed: Dragging near the bottom edge could smoothly reveal temporary lower workspace rows and show the snapped placeholder in that new area, but releasing the pointer could make the page/item appear to jump back toward the earlier content area instead of preserving the previewed lower placement.
- Expected: The snapped placeholder row/column shown at release is the drop source of truth. The committed item should accept rows revealed during the active interaction, the page should not collapse back before commit, and save/reload should preserve the lower placement.
- Suspected cause: The shared auto-scroll cleanup removed the temporary body runway immediately at pointerup, before drag and resize commit callbacks applied the final grid state. Removing the runway could shrink the document and clamp `scrollY` against the old height during the same release frame, so the committed placement and visible viewport no longer lined up with the live preview.
- Fix notes: Split the auto-scroll lifecycle into stopping the RAF loop and clearing the temporary runway. Successful drag/drop and resize releases now stop scrolling while preserving the runway through the commit path, then clear it after the committed grid state has accepted the final row/span. Canceled interactions still clear the runway immediately. The snapped placeholder/footprint remains the commit source; no new placement engine or permanent spacer was added.
- Validation: Added `test_edge_auto_scroll_drop_commits_newly_revealed_lower_rows`, which drags a widget beyond the original dashboard content into the temporary lower runway, captures the placeholder row/column and release scroll position, verifies the committed item matches the preview without viewport collapse, saves/reloads, and checks the lower placement persists without overlap or stale auto-scroll artifacts. Targeted edge-scroll drag, panel drag, group drag, and deep-workspace tests passed. A first full-suite run had one unrelated transient focus color serialization failure that passed on direct rerun; the final `.venv\Scripts\python.exe -m pytest -q` passed with 79 tests.

### BUG-066: Upward Edge Auto-Scroll Still Felt Choppy

- Status: Verified
- Area: Dashboard grid / drag-resize / edge auto-scroll / motion quality
- Severity: Medium
- Environment: Dashboard workspace, constrained viewport, upward and downward edge drag
- Observed: Bottom-edge auto-scroll was generally smoother, but upward auto-scroll still felt rigid and visually choppy. Dragging toward the top edge could look less continuous than the live ghost, and the two directions did not feel like one motion system.
- Expected: Top and bottom edge auto-scroll share the same requestAnimationFrame model, eased velocity ramp, capped speed, pixel-delta scrolling, navbar stability, preview/commit agreement, and cleanup behavior.
- Suspected cause: The upward path still carried direction-specific braking near the top boundary while the downward path used the main edge-pressure curve. That made the top-edge velocity collapse into smaller per-frame deltas as the document approached the top, which could be perceived as rigid/stuttered movement. The previous tests only bounded maximum jump size and did not require enough progressive same-direction frames.
- Fix notes: Removed the upward-only top brake and unified both directions behind one target-velocity calculation using the same cubic edge-pressure curve. Added per-frame velocity easing inside the shared RAF loop so scroll speed ramps smoothly toward the target while still stopping immediately when the pointer leaves the edge zone. Existing bounded scroll deltas, overscroll suppression, scroll anchoring suppression, and deferred runway cleanup remain in place for navbar stability and preview/commit agreement.
- Validation: Strengthened edge auto-scroll sampling with a shared smoothness assertion for upward and downward movement. The tests now require progressive same-direction scroll over multiple frames, reject row-sized jumps, keep navbar geometry stable during upward drag, verify top-row placement, verify lower-runway drop commit/persistence, and check stale class/spacer cleanup. Targeted `edge_auto_scroll` tests passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 79 tests.

### BUG-067: Dark Mode Material Read As Outlined Panels Instead Of Smoked Glass

- Status: Verified
- Area: Theme / dark mode / glass material system
- Severity: Medium
- Environment: Dashboard workspace, dark theme, timeframe controls, nav controls, widgets, panels, menus, and group visuals
- Observed: Light mode surfaces read as layered frosted glass, but dark mode surfaces could read as harsh outlined rectangles, flat dark pills, glowing HUD controls, or cutouts against the background. The timeframe command buttons exposed the mismatch most clearly: their structure was correct, but several late dark overrides flattened controls or made active borders too blue/bright.
- Expected: Dark mode should use the same depth hierarchy as light mode under smoked-glass lighting: restrained borders, internal haze, soft inset highlights, layered controls, readable active states, and no neon/electric outlines.
- Suspected cause: Dark theme refinements had accumulated as component-specific overrides. Some later rules replaced gradient glass with solid or transparent backgrounds, and active/focus borders mixed too much accent color into the edge, making borders define the object instead of supporting the material.
- Fix notes: Added shared dark smoked-glass material tokens in `themes.css` for panel surfaces, inset clusters, controls, hover controls, active controls, borders, highlights, and shadows. Repointed global dark surfaces, nav controls, dropdown menus, widget cards, panels, group selection surfaces, and timeframe control layers to those tokens. Timeframe buttons now use the shared dark glass control material while keeping their existing compact sizing and behavior. Light mode rules were not changed.
- Validation: Added `test_dark_mode_global_materials_use_smoked_layered_glass`, which captures light/dark screenshots and verifies navbar controls, add menu, widget card, panel, timeframe command surface, timeframe clusters, active timeframe preset, and icon controls use gradient glass layers, inset highlights, restrained border brightness, non-neon shadows, and hover state changes. Strengthened dark/timeframe coverage passed with `dark`, `timeframe`, pin, and hover/focus slices, and `.venv\Scripts\python.exe -m pytest -q` passed with 80 tests.

### BUG-068: Minimum-Size Widgets Appeared To Teleport After Lower-Workspace Drop

- Status: Verified
- Area: Dashboard grid / drag / edge auto-scroll / layout commit
- Severity: High
- Environment: Dashboard workspace, minimum-span timeframe/widget drag into bottom-edge temporary runway
- Observed: The lower-workspace drop fix worked for panels and larger widgets, but a widget at its minimum footprint could still appear to jump back toward the original content area after being dropped below the initial dashboard bounds. The snapped placeholder showed a valid lower row and the committed grid data accepted that row, but the viewport moved upward during release.
- Expected: Minimum-size widgets use the same drop contract as larger widgets and panels. The snapped placeholder row/column at release is the commit source of truth, newly revealed lower rows are valid, the viewport should not collapse away from the dropped item, and save/reload should preserve the lower placement.
- Suspected cause: This was not a separate minimum-size placement resolver rejecting the row. The one-row footprint committed correctly, but placeholder removal and restoration during pointerup let browser scroll anchoring adjust `scrollY` before the temporary lower runway was cleared. Larger items naturally left enough committed document height to mask the adjustment; minimum-size widgets exposed the scroll-position side effect.
- Fix notes: The drag commit path now captures the release scroll position when the temporary lower runway was active, commits from the snapped placeholder, reconciles a minimal committed dashboard host scroll floor before clearing the body runway, and reapplies the release scroll target after cleanup. Normal drops clear any prior committed scroll floor, canceled interactions still remove only transient runway state, and the shared row/column commit path remains unchanged for all item sizes.
- Validation: Added `test_edge_auto_scroll_commits_minimum_size_widget_to_lower_workspace`, which forces the timeframe widget to its minimum span, drags it into newly revealed lower rows while auto-scroll is active, verifies the committed span/column/lower row match the preview contract, verifies the viewport does not collapse upward, checks cleanup/no horizontal overflow, saves/reloads, and asserts the lower minimum-size placement persists. Targeted `edge_auto_scroll` tests passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 81 tests.

### BUG-069: Dark Mode Control Glass Diverged Into HUD Buttons

- Status: Verified
- Area: Theme / dark mode / widget and panel controls
- Severity: Medium
- Environment: Dashboard workspace, dark theme, timeframe widget, panel/widget settings controls, tool drawers
- Observed: Dark mode redefined the same glass objects from light mode as dark filled controls: timeframe pills and icon buttons became hard dark capsules, settings buttons read as dark circular UI buttons, and panel/widget tool drawers could become separate dark submenu layers.
- Expected: Dark mode keeps the same glass material primitive used in light mode for nodules, pills, settings buttons, panel/widget controls, and submenu clusters. Only environmental luminance, reflection strength, and behind-glass contrast should change.
- Suspected cause: Dark theme overrides had accumulated around `.preset-btn`, `.range-custom-trigger`, `.range-icon-button`, `.panel-settings-toggle`, `.panel-tool-button`, `.panel-tool-drawer`, `.widget-tool-drawer`, and pinned controls. Those overrides replaced shared glass inheritance with solid dark fills, darker hover mixes, outline-heavy borders, and dark-specific shadow stacks.
- Fix notes: Removed the dark-only component rethemes for timeframe controls, panel/widget settings buttons, tool drawers, and pinned controls so they inherit the shared glass rules from `components.css` and `dashboard-grid.css`. Kept the adjustment at the environmental token layer by making dark hover tint and inset light catch highlights instead of mixing controls toward black.
- Validation: Updated `test_dark_timeframe_controls_preserve_layered_glass_depth` to guard against reintroducing dark-only control selectors, verify light/dark geometry and material-structure parity for the timeframe buttons, settings nodule, and tool drawer, and reject the old dark HUD fill values. Updated `test_dark_mode_global_materials_use_smoked_layered_glass`, `test_dark_panel_settings_menu_matches_widget_without_white_ring`, and existing dark/pin assertions so shared glass controls are checked as inherited controls rather than dark-specific gradient layers. Targeted theme/timeframe/pin slices passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 81 tests.

### BUG-070: Pinned Indicator Was Implemented As An Overbright Pin Hover

- Status: Verified
- Area: Theme / pinned controls / widget and panel state
- Severity: Medium
- Environment: Dashboard workspace, light and dark themes, panel/widget tool drawers
- Observed: The pinned-state visual refinement was expressed through a special pin button hover treatment instead of the pinned indicator itself. The pin hover became brighter than neighboring submenu controls, the pin glyph was visually undersized, and the control read as a glowing button state rather than a calm pinned-state marker.
- Expected: Hover on the pin control should remain part of the shared glass button system. Pinned state should be visible without hover through a clear, elegant material/status detail on the pinned item, and the pin glyph should match the visual scale of neighboring action icons.
- Suspected cause: A final pin-specific theme block overrode the shared submenu hover with a stronger gradient/shadow stack. The pin mask was also reduced to a 14px box with a narrow internal path, making the glyph smaller than adjacent icons.
- Fix notes: Removed the special pin hover override so hover returns to the shared submenu glass treatment. Normalized the pin glyph to the 16px icon scale with a larger mask path. Reworked the pinned item marker from a tiny dot into a small glass badge with an embedded pin glyph, with restrained dark-theme environmental tuning.
- Validation: Updated `test_pin_control_uses_soft_dashboard_chrome` to verify pin icon sizing, subtle shared hover behavior, visible pinned marker dimensions, marker pin glyph presence, and unchanged pin/unpin behavior in light and dark themes. Targeted pin/control coverage passed, manual light/dark pinned-panel screenshots were checked at `test-results/pin-indicator-manual/pinned-light-panel.png` and `test-results/pin-indicator-manual/pinned-dark-panel.png`, and `.venv\Scripts\python.exe -m pytest -q` passed with 81 tests.

### BUG-071: Dark Glass Used Bright Outlines Instead Of Dark Refraction Rims

- Status: Verified
- Area: Theme / dark mode / glass material system
- Severity: Medium
- Environment: Dashboard workspace, dark theme, glass panels, widgets, timeframe controls, settings buttons, and submenu controls
- Observed: Dark mode still separated many glass objects with light or blue-tinted rims. Timeframe pills and settings nodules could read as outlined HUD capsules, even after they were routed back through the shared glass primitive.
- Expected: Dark mode should follow the same material logic as light mode: a darker rim around a subtly different/lifted glass surface, with readability coming from material luminance and soft shadow rather than bright outlines or glow.
- Suspected cause: Dark glass border tokens and inherited control variables still used light slate or accent-mixed border values. Custom-color controls also mixed accent color directly into settings button and drawer borders, and timeframe border variables reused accent-heavy light-mode formulas.
- Fix notes: Retuned dark global glass border tokens to darker rim values, added shared rim variables for panel/widget tool drawers and hover borders, introduced timeframe rim variables, and fed dark mode darker control borders while keeping interiors slightly lifted from the parent surface. Custom-color controls now route through dark rim variables instead of bright accent outlines. Light-mode fallbacks remain the existing values.
- Validation: Added `test_dark_glass_controls_use_dark_rims_not_light_outlines`, which verifies dark panels, widgets, timeframe surfaces, pills, icon buttons, settings buttons, and tool drawers use borders darker than their exposed surface color and reject bright rim values/glow-like shadows. Targeted dark glass/control coverage passed, the dark timeframe screenshot was visually checked at `test-results/timeframe-depth/timeframe-dark-layered-depth.png`, and `.venv\Scripts\python.exe -m pytest -q` passed with 82 tests.

### BUG-072: Compact Pressable Controls Floated Like Large Dashboard Objects

- Status: Verified
- Area: Theme / controls / hover and active motion
- Severity: Medium
- Environment: Dashboard workspace, light and dark themes, widget/panel controls, timeframe controls, toolbar controls
- Observed: Compact pressable controls inherited the large-object hover language in several places. Timeframe pills, settings buttons, submenu controls, nav buttons, and dropdown triggers could lift upward on hover, while active/pressed states sometimes only reset to neutral. That made small controls feel like floating surfaces instead of tactile buttons settling into glass.
- Expected: Large dashboard objects such as panels and widgets can retain subtle hover lift, but compact pressable controls should depress subtly on hover and depress more clearly while active/pressed. Focus-visible treatment should remain accessible and distinct without forcing the whole widget or panel body to sink.
- Suspected cause: Hover, focus, open, and active selectors were grouped together with `translateY(-1px)` across timeframe buttons, panel/widget tool buttons, custom-color controls, and navbar command controls. Some later workspace-chrome selectors had enough specificity to override shared control behavior.
- Fix notes: Added shared pressable transform tokens, routed timeframe buttons, panel/widget settings and submenu controls, color swatches, nav buttons, dropdown triggers, and action controls through the compact pressable model, and removed later upward-hover transform declarations from workspace-chrome controls. Widget, panel, and timeframe widget bodies still keep the established lifted hover surface behavior.
- Validation: Added `test_compact_pressable_controls_depress_without_sinking_large_surfaces`, which verifies widget/panel/timeframe bodies still lift while timeframe presets, widget settings/submenu buttons, and the theme toggle depress on hover, with active press deeper than hover. Targeted hover/control coverage passed, and `.venv\Scripts\python.exe -m pytest -q` passed with 83 tests.

### BUG-073: Interaction Hot Paths Repeated Stable Grid Geometry Reads

- Status: Verified
- Area: Dashboard grid / drag-resize / performance
- Severity: Medium
- Environment: Dashboard workspace, drag, resize, grouped drag/resize, edge auto-scroll, Chromium local profiling harness
- Observed: Pointer interactions kept healthy frame cadence on the default dashboard, but resize and grouped interactions repeatedly re-derived stable grid gap/width, panel row spans, panel minimum rows, and broad FLIP reflow item lists during live threshold updates.
- Expected: Live interaction math should reuse stable per-interaction geometry where safe, refresh viewport-relative rects only when scrolling can change them, and keep preview/collision/commit geometry derived from the same model.
- Suspected cause: Grid helpers were centralized functionally, but every caller still measured independently. Sparse preview resolution and FLIP animation helpers also queried broad dashboard item sets during each snapped preview update.
- Fix notes: Added per-interaction grid metrics with a panel minimum-row cache, passed those metrics into drag/resize/group preview geometry, sparse preview resolution, expanded-footprint ghosts, and release alignment helpers, and allowed live FLIP reflow to reuse a cached item set while DOM membership is stable. Commit paths, snapping, collision rules, auto-scroll timing, and visual surfaces were not changed.
- Validation: Added `test_large_dashboard_drag_resize_cleanup_stays_bounded` for repeated drag/resize cleanup on a larger deterministic widget fixture. Local temporary measurement showed widget resize drop from roughly 584 rect / 1436 computed-style reads to 66 rect / 401 computed-style reads while frame cadence stayed near 16.7ms. Targeted resize, group, edge auto-scroll, expand/collapse, and large-dashboard tests passed.

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
