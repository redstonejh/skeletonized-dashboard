# Performance Stabilization Plan

## Purpose

This document plans a performance stabilization pass for the dashboard interaction system.

The goal is to improve runtime performance, interaction smoothness, and large-dashboard scalability without changing the dashboard's core UX behavior.

The dashboard should continue to feel:

- Fluid.
- Spatial.
- Premium.
- Calm.
- Responsive.
- Visually polished.

This is not a redesign plan and not permission to simplify behavior by removing protected interaction quality. Performance work must preserve the current interaction model: live ghosts follow the pointer, snapped footprints remain independent, grouped objects behave as composite spatial entities, final commits snap to the grid, and expand/collapse stays local and predictable.

## Measurement First

Performance work should start with observation, not guesses.

Recommended baseline checks:

- Interaction frame cadence during drag.
- Interaction frame cadence during resize.
- Interaction frame cadence during grouped drag and grouped resize.
- Expand/collapse reflow cost.
- Approximate DOM geometry reads during active interactions.
- Approximate computed-style reads during active interactions.
- Mutation churn during active interactions.
- Live artifact cleanup after interaction end.
- Slowest Playwright tests.

Useful tools:

- Chrome Performance panel.
- Playwright-driven measurement harnesses.
- `PerformanceObserver` where browser support is useful.
- Temporary monkey-patched counters for `getBoundingClientRect` and `getComputedStyle` during local audits.
- MutationObserver counters for style/class/child-list churn.
- `pytest --durations=10` for test runtime review.

Do not commit ad hoc measurement monkey patches to production code.

## Current Baseline Observation

Measured locally on Chromium at a 1440x1000 viewport against the default dashboard using a temporary Playwright measurement harness. The harness counted approximate geometry reads, computed-style reads, DOM mutations, and requestAnimationFrame cadence during representative interactions.

Suggested artifact path when rerunning the local harness:

- `test-results/performance-audit/baseline-metrics.json`

| Interaction | Duration | Avg Frame | P95 Frame | Max Frame | Rect Reads | Computed Style Reads | Mutations |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Widget drag | 913ms | 16.67ms | 16.80ms | 16.80ms | 59 | 388 | 41 |
| Widget resize | 890ms | 16.66ms | 16.70ms | 16.70ms | 1098 | 1422 | 59 |
| Group drag | 1045ms | 16.67ms | 16.70ms | 16.80ms | 77 | 626 | 115 |
| Group resize | 1050ms | 16.67ms | 16.70ms | 16.80ms | 295 | 871 | 97 |
| Expand/collapse | 639ms | 16.66ms | 16.80ms | 16.80ms | 50 | 25 | 7 |

Interpretation:

- Frame cadence is healthy on the default dashboard.
- Resize is the current read-heavy path, especially widget resize.
- Group interactions have higher mutation churn because they create live surfaces, previews, boundaries, group classes, and cleanup artifacts.
- Expand/collapse appears modest on the default dashboard, but it should be retested with denser layouts and nested expansion sessions.
- The current dashboard size is not enough to expose scaling limits. A large-dashboard fixture is needed before claiming large-workspace readiness.

Measurement cautions:

- The harness itself adds overhead and should be used for relative investigation, not absolute performance budgets.
- Browser frame cadence in Playwright is not the same as a full manual Chrome Performance trace.
- Stable automated frame-budget assertions should be avoided unless they are proven non-flaky across machines.

## Stabilization Pass - 2026-05-24

This pass focused on architecture hardening and hot-path normalization before adding anchors, dividers, contextual inheritance, tabless navigation, and larger spatial environments.

Scope:

- Measured representative drag, resize, grouped drag, grouped resize, and bottom edge auto-scroll interactions with a temporary local Playwright harness.
- Kept production behavior unchanged: no timers, no retry/drop fallback, no collision weakening, and no drag/resize cadence changes.
- Added a bounded large-dashboard cleanup regression test instead of brittle frame-budget assertions.

Artifacts from the local measurement harness:

- `test-results/performance-audit/current-metrics.json`
- `test-results/performance-audit/current-metrics-2.json`
- `test-results/performance-audit/after-cache-metrics.json`

The harness monkey-patches `getBoundingClientRect`, `getComputedStyle`, a `MutationObserver`, and `requestAnimationFrame`. Treat these as relative local measurements, not CI performance budgets.

### Findings

- Widget resize was the clearest hot path because each snapped threshold update re-entered sparse collision/reflow and repeatedly derived stable grid metrics, panel row spans, and panel minimum rows.
- Drag, group drag, group resize, and auto-scroll already had healthy frame cadence on the default dashboard, but they still repeated stable grid gap/width reads and broad reflow item queries.
- Group resize cost is mostly mutation/DOM-surface churn from live members, member previews, composite footprint, expanded ghosts, and boundary surfaces. This is expected for the current visual contract and should not be reduced by removing feedback.
- The deepest auto-scroll scenarios are browser-scheduling sensitive. They should be run as targeted slices when investigating scroll performance.

### Applied Optimizations

- Added per-interaction grid metrics for stable layout width, gap, column width, column step, row step, and a panel minimum-row cache.
- Routed drag, resize, group resize, resize previews, expanded-footprint ghosts, alignment helpers, and sparse preview resolution through the same optional metrics object where it is safe.
- Kept grid rect refresh explicit during drag so auto-scroll still uses current viewport-relative grid coordinates.
- Added optional cached reflow item sets for FLIP animation during live threshold updates, avoiding repeated broad host queries when DOM membership is stable for the interaction.
- Kept final commit paths deterministic and still derived from the snapped placeholder/footprint.

### Local Before/After Snapshot

Measured on Chromium at a 1440x1000 viewport, default dashboard, using the temporary harness. The most comparable pre-change run was `current-metrics.json`; group interactions used the corrected fixture in `current-metrics-2.json`.

| Interaction | Rect Reads Before | Rect Reads After | Style Reads Before | Style Reads After | Avg Frame After | P95 Frame After |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Widget drag | 144 | 109 | 485 | 428 | 16.67ms | 16.70ms |
| Widget resize | 584 | 66 | 1436 | 401 | 16.67ms | 16.70ms |
| Group drag | 194 | 151 | 714 | 609 | 16.67ms | 16.70ms |
| Group resize | 195 | 130 | 742 | 627 | 16.67ms | 16.80ms |
| Auto-scroll drag | 567 | 386 | 901 | 628 | 16.66ms | 16.70ms |

Interpretation:

- The pass materially reduced repeated layout/style reads, especially widget resize.
- Frame cadence stayed healthy in the local harness.
- Mutation counts are largely unchanged because the same live surfaces, previews, boundaries, and cleanup artifacts are still created to preserve UX.

### Architecture Notes

- Geometry ownership is more explicit: pointer sessions now capture stable grid metrics once, refresh only viewport-relative rects when scrolling can change them, and pass that model into preview/collision helpers.
- Preview, temporary displacement, and committed layout remain separate. The metrics cache does not own placement state and is discarded with the interaction.
- Sparse placement remains valid. No global auto-pack was introduced.
- Group resize still behaves as a composite object; member surfaces and previews use cached per-layout metrics without changing relative geometry or commit math.

### Remaining Risks

- Large-dashboard scaling still needs a richer deterministic fixture with many panels, mixed row spans, pinned items, collapsed panels, and grouped members.
- `alignedResizeSpan` and `alignedResizeHeight` still scan possible alignment targets on release. This is acceptable now because it is not in every pointermove, but it remains a future large-dashboard candidate.
- `applyGroupResizeLayout` still performs collision checks per member during snapped group resize. It is correct for current coverage, but future persisted groups may need a stronger composite geometry API.
- Paint cost from glass, shadows, and backdrop filters was not reduced in this pass; visual polish remains intentionally preserved.

## Identified Hot Paths

### Drag

Primary code areas:

- `runOrderedDrag`
- `gridCellFromPoint`
- `movePreview`
- `animateOrderedGridReflow`
- `restoreGridLayoutSnapshot`
- `resolveSparseGridLayout`
- group drag helpers such as live group surfaces and composite footprints

Risk:

- Preview updates can trigger layout reads through FLIP reflow.
- Group drag adds live surfaces and group boundary updates.
- Collision/reflow can become expensive as item count grows.

### Resize

Primary code areas:

- Widget resize handler around `.panel-resize-handle`
- Panel resize handler around `.panel-resize-handle`
- `beginLiveResizeSurface`
- `updateLiveResizeSurface`
- `createResizePreview`
- `animateOrderedGridReflow`
- `alignedResizeHeight`
- `alignedResizeSpan`
- `restoreGridLayoutSnapshot`
- `applyOrderedGridLayout`

Risk:

- Widget resize currently shows the highest geometry and computed-style read counts.
- Resize paths can alternate live visual writes with snapped layout/reflow updates.
- Release alignment can scan neighboring items.
- Collapsed-panel expanded-footprint ghosts require careful geometry reads.

### Group Resize

Primary code areas:

- `runGroupResize`
- `applyGroupResizeLayout`
- group live resize surfaces
- group boundary surface
- group composite footprint
- per-member preview surfaces

Risk:

- Group resize has more DOM surfaces than single resize.
- It updates member live clones, expanded ghosts, composite boundary, member previews, and composite footprint.
- It can regress if per-member previews become collision sources again.

### Collision/Reflow

Primary code areas:

- `packOrderedGridItems`
- `applyOrderedGridLayout`
- `animateOrderedGridReflow`
- `resolveSparseGridLayout`
- `commitActiveDropSlot`
- expand/collapse local relaxation helpers

Risk:

- FLIP animation reads before and after layout changes.
- Ordered packing is currently acceptable for small dashboards but may scale poorly if called repeatedly on dense layouts.
- Full host queries inside animation helpers can become a scaling limit.

### Expand/Collapse

Primary code areas:

- expansion baseline capture
- local upward relaxation
- saved height/row-span synchronization
- collision pushdown

Risk:

- Nested expansion sessions can make temporary displacement costly or fragile.
- Large dashboards may make local relaxation scans more expensive.

### Save/Load Layout Sync

Primary code areas:

- `saveSharedGridLayouts`
- layout serialization and restore paths
- custom panel/widget restore

Risk:

- Save/load should remain outside pointermove paths.
- Future anchors, context links, workspace profiles, and widget configs will increase payload size.

## Stabilization Goals

### Reduce Pointermove Work

Pointermove paths should:

- Use cached grid measurements captured at interaction start.
- Avoid repeated `getBoundingClientRect()` where start geometry is enough.
- Avoid repeated `getComputedStyle()` where grid gap, columns, and row height are stable during the interaction.
- Batch DOM writes inside `requestAnimationFrame` if pointer events outpace frames.
- Avoid synchronous read/write/read cycles.
- Update live ghosts with transform/position writes only.
- Update snapped footprints only when grid threshold changes.
- Avoid save/state persistence during live movement.

### Preserve Interaction Model

Performance work must not regress:

- Live ghost follows pointer smoothly.
- Snapped footprint remains visually independent.
- Final commit snaps to grid.
- Left-edge resize anchors the opposite edge.
- Group interactions behave as one composite object.
- Original group members do not jump while previews are active.
- Expand/collapse remains local and spatial.
- No edge teleporting.
- No stale preview artifacts.

### Reflow Optimization

Review whether reflow:

- Queries the full dashboard host when only a local affected set is needed.
- Recomputes sorted layout state repeatedly during one interaction.
- Restores snapshots more often than necessary.
- Moves unrelated panels.
- Reads layout after writes inside the same frame.

Potential direction:

- Cache ordered item lists at interaction start.
- Cache stable item metadata separately from live DOM geometry.
- Use affected-item sets for FLIP where possible.
- Reserve full-dashboard scans for validation or explicit global operations.
- Keep local accordion restoration separate from ordered packing.

### CSS Rendering Audit

Preserve the premium material language, but audit expensive effects:

- `backdrop-filter` on surfaces that move or animate.
- Large layered shadows on live ghosts.
- Repeated glass layers inside moving preview surfaces.
- Transitions on layout-affecting properties during active interaction.
- `will-change` usage that remains on too many resting elements.

Preferred direction:

- Keep rich glass on stable surfaces.
- Keep moving live surfaces visually premium but cheaper than static cards when the difference is minimal.
- Prefer transform/opacity animations.
- Avoid animating width/height except where live resize requires it.
- Use active-interaction classes to disable nonessential transitions.

Do not strip visual polish broadly. Optimize only where measurements show cost.

### DOM Lifecycle Cleanup

Verify every interaction leaves no:

- `.dashboard-live-resize`
- `.dashboard-resize-preview`
- group boundary surfaces
- group live member surfaces
- expanded-footprint ghosts
- stale source classes
- stale active classes
- body interaction classes
- duplicate event listeners

The existing cleanup tests are valuable and should be preserved.

## Near-Term Optimization Candidates

These are candidates for future implementation, not changes already made by this plan.

### Candidate 1: Cache Grid Metrics Per Interaction

Currently several paths call grid measurement helpers during active interaction. Capture stable grid metrics at start:

- Grid rect.
- Gap.
- Row height.
- Column width.
- Column step.
- Row step.
- Layout key/host.

Use that cached object through pointermove, unless viewport resize or zoom is introduced mid-interaction.

Expected benefit:

- Fewer computed-style reads.
- Less layout pressure.
- Easier deterministic pointer math.

### Candidate 2: Throttle Snapped Reflow To Animation Frames

Live ghost movement should remain continuous. Snapped reflow can be scheduled once per animation frame when pointermove events arrive faster than frames.

Expected benefit:

- Avoid repeated snapshot/restore/reflow work in one frame.
- Keep visual live surface responsive.

Constraint:

- Final pointer position must still be committed deterministically.
- The last queued snapped footprint must flush before pointerup commit.

### Candidate 3: Split Live Writes From Grid Reflow Writes

Live surfaces can be updated every move. Grid reflow should only happen when the snapped cell/span/row threshold changes.

This is already partly true. The stabilization pass should verify it consistently across:

- Widget resize.
- Panel resize.
- Group resize.
- Group drag.
- Collapsed-panel expanded ghosts.

### Implemented: Shared Edge Auto-Scroll For Active Interactions

Active drag and resize interactions use one shared requestAnimationFrame-driven edge auto-scroll helper.

Design:

- Pointermove handlers update the helper with the latest viewport pointer position.
- The helper computes vertical scroll velocity from pointer distance to the top or bottom viewport edge.
- Velocity increases gradually closer to either edge with one shared cubic pressure curve, a short dwell before scrolling starts, and per-frame velocity easing so scroll motion ramps in pixels rather than stepping by grid rows.
- Velocity is time-based, not frame-count based, so headless or high-refresh browsers cannot turn the loop into runaway page movement.
- The helper only writes `window.scrollBy(0, velocity * deltaTime)` inside animation frames.
- A transient `dashboard-auto-scroll-active` body class exists only while the scroll loop is running.
- A transient `dashboard-interaction-scroll-extended` body class and temporary body padding create a removable workspace runway while dragging/resizing near the bottom edge.
- The runway grows toward a target height in bounded requestAnimationFrame increments, so scrollable space expands in pixels instead of appearing as one large row-sized jump.
- Successful releases stop the RAF scroll loop first but preserve the temporary runway until the drag/resize commit path has accepted the final snapped row/span. Canceled interactions clear it immediately.
- Successful lower-workspace drops also reconcile the committed dashboard host height before clearing the temporary runway, using the release scroll position as the preservation target. This prevents minimum-footprint widgets from committing to a valid lower grid row while the browser scrolls the viewport upward during placeholder cleanup.
- Scroll anchoring is disabled only during the active interaction on the root, body, and active dashboard host so placeholder/reflow movement does not cause browser-driven scroll jumps.
- Reduced-motion users receive a lower maximum velocity.
- Cleanup is owned by the drag and resize interaction lifecycles and runs on pointerup, pointercancel, Escape/window blur where those lifecycle paths exist, and cancellation/error cleanup. Cleanup removes the scroll loop, active classes, temporary padding, and overflow-anchor overrides.

Behavior constraints:

- The helper does not create a second drag or resize system.
- Drag paths continue to use the existing live ghost plus snapped footprint model.
- Resize paths include scroll delta in their vertical resize math so bottom-edge auto-scroll expands into newly revealed dashboard space instead of freezing at the original viewport pointer delta.
- Grid rects are still read through existing helpers, so scrolling naturally updates viewport-relative grid conversion without storing stale rects.
- Temporary workspace extension is removed after interaction end; no permanent blank area is introduced unless the committed item layout itself creates it.
- The snapped placeholder or resize footprint remains the source of truth for final commit, including rows that only became reachable because the temporary runway existed during the interaction.
- No save/load work runs during the auto-scroll loop.

Regression coverage:

- Widget drag bottom auto-scroll and top auto-scroll.
- Deep widget drag into temporary workspace extension.
- Widget drop into newly revealed lower rows with save/reload persistence.
- Minimum-size widget drop into newly revealed lower rows with save/reload persistence.
- Smooth scroll/runway frame cadence during deep widget drag, panel resize, and group drag.
- Panel drag bottom auto-scroll and runway cleanup.
- Widget resize bottom auto-scroll.
- Panel resize bottom auto-scroll.
- Group drag bottom auto-scroll.
- Group resize bottom auto-scroll.
- Scroll loop cleanup after pointerup.
- No horizontal page overflow.
- Existing drag, resize, group, ghost, footprint, and cleanup tests.

### Candidate 4: Reuse Cached Ordered Item Lists During Interaction

`animateOrderedGridReflow` queries host items before and after updates. For dense dashboards, repeated broad queries may become expensive.

Possible improvement:

- Capture candidate reflow items at interaction start.
- Pass affected items into animation helpers.
- Refresh the list only when DOM membership changes.

Constraint:

- Placeholder insertion/removal must remain represented.
- Pinned and hidden items must remain correctly excluded/included.

### Candidate 5: Optimize Release-Time Alignment Scans

`alignedResizeHeight` and related helpers scan potential alignment targets. This is acceptable now but should be cached or scoped for large dashboards.

Possible improvement:

- Build target edge candidates at resize start.
- Refresh only when preview crosses a threshold that changes affected items.
- Limit candidates to same layout host and relevant row/column vicinity.

### Candidate 6: Large-Dashboard Fixture

Create a deterministic browser fixture with many generic widgets and panels.

Use it to test:

- Drag responsiveness.
- Resize responsiveness.
- Group resize responsiveness.
- Expand/collapse local restoration.
- Cleanup after repeated interactions.
- Save/load payload behavior.

Avoid strict frame budgets initially. Prefer cleanup and bounded-work assertions until measurements are stable across machines.

## CSS Performance Guidance

### Safe Areas To Audit

- Moving live resize surfaces.
- Group live member surfaces.
- Group boundaries.
- Dragging surfaces.
- Preview/placeholder surfaces.
- Toolbar popovers when layered above active interactions.

### Rules

- Do not remove glass language globally.
- Avoid adding more shadow layers to moving surfaces.
- Avoid `backdrop-filter` on high-frequency moving surfaces unless measured acceptable.
- Avoid layout-affecting hover transitions.
- Prefer active-interaction transition suppression.
- Keep text/icon alignment stable across states.
- Use shared material tokens rather than hardcoded performance shortcuts.

## Test Suite Performance

Measured with:

```powershell
.venv\Scripts\python.exe -m pytest tests\test_dashboard_builder_e2e.py -q --durations=10
```

Result:

- 56 passed in 114.17s.

Slowest tests:

| Test | Duration |
| --- | ---: |
| `test_widget_resize_lifecycle_repeats_cancels_and_persists` | 7.26s |
| `test_panel_collapse_restores_local_pushdown_after_group_resize[True]` | 5.00s |
| `test_panel_collapse_restores_local_pushdown_after_group_resize[False]` | 4.09s |
| `test_background_presets_and_secondary_surfaces_share_glass_language` | 3.34s |
| `test_group_drag_uses_composite_footprint_and_preserves_member_spacing` | 3.14s |
| `test_collapsed_panel_drag_and_resize_show_expanded_footprint_ghost` | 2.98s |
| `test_panel_chevron_size_stays_stable_across_expand_collapse_states[light]` | 2.92s |
| `test_resize_has_live_surface_and_grid_preview` | 2.59s |
| `test_drag_ghost_grid_snapping_and_collision_handling` | 2.46s |
| `test_panel_chevron_size_stays_stable_across_expand_collapse_states[dark]` | 2.38s |

Interpretation:

- The slowest tests are meaningful interaction regressions and should not be weakened casually.
- Development should use targeted slices, then full suite before completion.
- Future performance-specific tests should be stable and cleanup-oriented before adding frame-budget assertions.

Recommended workflow:

1. Run the targeted failing test.
2. Run a related keyword slice.
3. Run `--durations=10` when test runtime is affected.
4. Run the full suite before final completion.

Examples:

```powershell
.venv\Scripts\python.exe -m pytest tests\test_dashboard_builder_e2e.py -q -k "resize"
.venv\Scripts\python.exe -m pytest tests\test_dashboard_builder_e2e.py -q -k "group or resize"
.venv\Scripts\python.exe -m pytest tests\test_dashboard_builder_e2e.py -q --durations=10
.venv\Scripts\python.exe -m pytest -q
```

## Performance Regression Checks

Useful stable checks:

- Repeated drag does not leave stale DOM nodes.
- Repeated resize does not leave stale live surfaces or previews.
- Pointercancel cleans active classes.
- Group drag/resize cleanup removes group artifacts.
- Expand/collapse does not move unrelated items.
- Large-dashboard interactions do not create unbounded artifact growth.

Risky checks:

- Hard frame-rate budgets in CI.
- Absolute paint-duration thresholds.
- Exact counts of DOM reads/writes across browsers.

Preferred first step:

- Add a large-dashboard cleanup/stability test before adding timing budgets.
- Store local performance harnesses as optional developer scripts only if they become reusable and low-maintenance.

## Documentation Rules For Future Performance Work

When making performance changes:

- Record the measured bottleneck.
- Describe the optimization.
- Explain why UX behavior is preserved.
- Note whether visual quality changed.
- Add or update Playwright coverage if interaction behavior changes.
- Run targeted tests and the full suite.
- Update this document with new observations.

## Remaining Performance Risks

- Default-dashboard measurements may hide large-dashboard scaling issues.
- Widget resize is read-heavy and should be the first measured optimization target.
- Group resize creates multiple live/preview surfaces and may become costly with larger groups.
- Collision/reflow still relies on DOM-host queries in key paths.
- CSS glass/shadow effects are visually important but may need per-surface tuning for large moving groups.
- Save/load payload size will grow with context, anchors, profiles, and richer widgets.
- Playwright suite runtime will grow as interaction coverage expands.

## Recommended Stabilization Sequence

1. Keep current behavior unchanged and establish repeatable measurements.
2. Add a deterministic large-dashboard fixture or optional measurement script.
3. Cache grid metrics per interaction.
4. Audit widget resize for avoidable geometry/style reads.
5. Add requestAnimationFrame scheduling for snapped reflow if measurements justify it.
6. Scope FLIP reflow to affected items where possible.
7. Audit moving-surface CSS effects.
8. Add large-dashboard cleanup and bounded-artifact tests.
9. Re-run duration profiling and update this document.

## Success Criteria

The performance pass succeeds when:

- Pointer interactions remain visually identical or better.
- Live ghosts and resize clones stay smooth.
- Snapped footprints remain deterministic.
- Group interactions preserve composite behavior.
- Expand/collapse remains local and predictable.
- DOM reads/writes in hot paths are reduced or bounded.
- No stale artifacts accumulate after repeated interactions.
- Large-dashboard behavior is measured, not assumed.
- Test runtime remains understandable and development slices are documented.
