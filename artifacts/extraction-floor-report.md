# Extraction Floor Report

Date: 2026-06-05

Verdict: DONE-AT-DOCUMENTED-FLOOR

## Decision

The ES-module split has reached the documented floor for the current architecture. No new extraction was attempted in this pass.

`artifacts/deferred-extractions.md` is now treated as a permanent do-not-retry list for the previously failed factory/dependency-injection extraction attempts. Retrying those clusters with the same approach is considered a workflow bug because parity already rejected them.

`artifacts/app-core-map.md` accounts for 100% of `app/static/app.js` and provides the coupling/canary map for future work. Future extraction work must start with a state-first strategy, such as extracting a shared interaction-state, widget-tool-session, panel-tool-session, or resize-geometry module before peeling any deferred behavior cluster.

## 2026-06-05 State-First Increment

The floor moved: `app/static/modules/interaction-state.js` now owns the first shared interaction state spine. This pass moved tool/session state ownership only; it did not retry any deferred behavior-body cluster.

- `app/static/app.js` line count before this increment: 5270
- `app/static/app.js` line count after this increment: 5263
- New state API: `createWidgetToolSession`, `createPanelToolSession`, `createResizeSessionGeometry`
- Pre-edit resize/pin canaries: 10/10 green after replacing fixed pointer-drag sleeps with commit waits
- Post-edit resize/pin/drag/save canaries: 10/10 green
- MAW run: `runs/2026-06-05_state-first-interaction-state-extraction_2d67`

## 2026-06-05 Increment 2a Resize-Session Extension

The floor moved only at the state-spine layer. `createResizeSessionGeometry` now owns the group-resize preview entries, derived preview member/start-bound/source/metrics maps, reflow item list, preview cols/rows, snapshots, and runtime surface handles. `runGroupResize` still lives in `app/static/app.js`; `group-resize-runtime` remains deferred until the remaining app.js-local behavior dependencies are reviewed and moved without a body-first factory/DI retry.

- Added canary: deterministic select-mode multi-resize commit check
- Pre-edit canaries: 10/10 green with two matching behavior baselines
- Post-2a canaries: 10/10 green
- Behavior diff: post-2a baseline hash matches pre-edit baseline
- MAW run: `runs/2026-06-05_increment-2-move-rungroupresize-onto_03e2`

## 2026-06-05 Increment 3b Primitive Rewire Shipped

The floor moved for the primitive delegate layer. `app/static/app.js` no longer owns named delegate closures for panel span/position/height or widget tools/span/position primitives. Panel consumers bind directly to `panelRuntime` methods, widget consumers bind directly to `widgetRuntimeController` methods, and `initializePanelRuntimes` now binds panel containment after creating `panelRuntime` so the previous init order remains intact.

- Completed clusters: `panel-core-primitives`, `widget-primitive-runtime`
- `app/static/app.js` line count after this increment: 5240
- Added canaries: widget resize-snap, widget tools-init/action
- Phase A canaries: 10/10 green after widget oracle hardening
- Final canaries: 10/10 green
- Resistance: panel `applyPanelSpan`, widget `applyWidgetSpan`, app init `ensureTools`, and runtime `ensureTools` no-op mutations were all caught
- MAW run: `runs/2026-06-05_increment-3b-close-widget-resistance_d428`

## 2026-06-06 Increment 4 Ordered Drag Runtime Shipped

The floor moved for ordered drag. `runOrderedDrag` now lives in `app/static/modules/ordered-drag-runtime.js`; `app.js` constructs it after the existing drag, containment, collision/reflow, group-selection, auto-scroll, and commit dependencies are initialized. No perf scheduling/coalescing optimization was shipped.

- Completed cluster: `ordered-drag-runtime`
- `app/static/app.js` line count before this increment: 5044
- `app/static/app.js` line count after this increment: 4348
- Added canary: deterministic body-zone workspace-widget absorption into a panel with save/reload persistence
- Body-zone absorption canary: 10/10 green
- Full canary suite: 10/10 green
- Resistance: `absorbWidgetIntoPanel` no-op mutation was caught by committed panel-child containment assertion
- Scope note: header/header-tolerance panel entry remains velocity-gated by `acceptsHeaderPanelEntry`; the body-zone canary guards the absorption commit path
- MAW run: `runs/2026-06-06_increment-4-phase0-body-zone-absorption`

## 2026-06-06 Increment 2b Group Resize Runtime Shipped

The floor moved for group resize. `runGroupResize` now lives in `app/static/modules/group-resize-runtime.js`; `app.js` constructs it after the resize session spine, resize surface runtime, collision/reflow helpers, grid metrics, panel containment, and workspace scroll-floor helpers are available. This was a state-spine-bound extraction, not a retry of the previous body-first factory/DI attempt.

- Completed cluster: `group-resize-runtime`
- `app/static/app.js` line count before this increment: 4348
- `app/static/app.js` line count after this increment: 3894
- New runtime API: `createGroupResizeRuntime(deps)` returns `runGroupResize`, `alignedResizeHeight`, `groupGridBox`, `groupBoxBounds`, `applyGroupFootprintBounds`, `createGroupFootprint`, and `beginGroupLiveSurfaces`
- Resistance: select-mode multi-resize caught a `commitGroupResizeFromPreviews` no-op
- Full canary suite: 10/10 green
- MAW run: `runs/2026-06-06_increment-2b-group-resize-runtime_9377`

## 2026-06-06 Autonomous Pass 1 Widget Runtime Meaning Deletion

The floor moved for widget runtime meaning hydration. The stale app-local `createWidgetRuntimeMeaning` factory wiring and its now-unreferenced `app/static/modules/widget-runtime-meaning.js` module were deleted. The active runtime meaning implementation remains in `app/static/widget-runtime.js`, and the public `window.dashboardWidgetRuntimeMeaning` compatibility global still delegates through `widgetRuntimeController`.

- Completed cluster: `widget-runtime-meaning-hydration`
- `app/static/app.js` line count before this increment: 3894
- `app/static/app.js` line count after this increment: 3885
- Added canary: widget runtime content and meaning survive save/reload
- Resistance: active `applyRuntimeMeaning` no-op was caught by the new canary
- Full canary suite: 10/10 green
- MAW run: `runs/2026-06-06_autonomous-extraction-fixed-point-loop_7e3d`

## 2026-06-06 Widget Tool Session State Checkpoint

The floor moved at the widget state-spine layer, not the widget lifecycle body. `createWidgetToolSession` now owns the remaining widget suppression and hover-close flags: `suppressToolOpenUntil`, `suppressWidgetClickUntil`, `suppressSettingsClickUntil`, `ignoreToolLeaveCloseUntilPointerActivity`, and `toolsOpenedByApproach`. `app.js` still owns the widget lifecycle body and accesses these values through the explicit session API.

- Completed state prerequisite: `widget-tool-session-state`
- `app/static/app.js` line count before this increment: 3885
- `app/static/app.js` line count after this increment: 3874
- Extended state API: `getSuppressSettingsClickUntil`, `getSuppressToolOpenUntil`, `getSuppressWidgetClickUntil`, `getToolsOpenedByApproach`, `isIgnoringToolLeaveCloseUntilPointerActivity`, `setIgnoreToolLeaveCloseUntilPointerActivity`, `setSuppressSettingsClickUntil`, `setSuppressToolOpenUntil`, `setSuppressWidgetClickUntil`, `setToolsOpenedByApproach`
- Added canary assertion: widget tool action-close suppression blocks immediate hover reopen
- Resistance: widget `setSuppressToolOpenUntil` no-op was caught by the hardened widget tools-init canary
- Full canary suite: 10/10 green
- MAW run: `runs/2026-06-06_fixed-point-extraction-widget-tool_22eb`

## 2026-06-06 Increment 5A Widget Layout Lifecycle Runtime Shipped

The floor moved for widget lifecycle ownership. `initWidgetLayout` and its nested `initWidget` body now live in `app/static/modules/widget-layout-runtime.js`, bound to the existing widget tool-session spine, widget hydration module, and widget action/move/resize runtimes. `app.js` still constructs `initWidgetLayout` before `initializePanelRuntimes`, so panel runtime setup and panel internal widget-grid hydration receive the same callback in the same order.

- Completed cluster: `widget-layout-lifecycle`
- `app/static/app.js` line count before this increment: 3874
- `app/static/app.js` line count after this increment: 3533
- New runtime API: `createWidgetLayoutRuntime(deps)` returns `{ initWidgetLayout }`
- Compatibility preserved: `layout.__initWidget = initWidget`; `widget.__saveWidgetLayout = () => saveWidgetLayouts(layout)`
- Resistance: `initWidget` early-return mutation was caught before extraction and after the body moved
- Full hidden canary suite: 10/10 green
- Scope note: `panel-layout-lifecycle` remains deferred; no panel lifecycle body move shipped in this cluster
- MAW run: `runs/2026-06-06_increment-5-widget-and-panel_1137`

## 2026-06-06 Increment 5B-1 Panel Tool Session Completed

The floor moved for panel tool-session state. `createPanelToolSession` now owns the remaining primitive panel tool flags that were still local to `initPanel`: tool-open suppression, hover-leave suppression during pointer activity, and approach-open state. DOM lifecycle behavior stayed resident in `app.js`; this phase only moved state ownership onto the session spine.

- Completed phase: `panel-tool-session`
- `app/static/app.js` line count before this phase: 3533
- `app/static/app.js` line count after this phase: 3528
- Extended API: `getSuppressToolOpenUntil`, `setSuppressToolOpenUntil`, `isIgnoringToolLeaveCloseUntilPointerActivity`, `setIgnoreToolLeaveCloseUntilPointerActivity`, `getToolsOpenedByApproach`, `setToolsOpenedByApproach`
- Resistance: `setSuppressToolOpenUntil` no-op was caught by the panel pin suppression canary
- Full hidden canary suite: 10/10 green
- Scope note: panel lifecycle body remains resident until the separate 5B-2 body move
- MAW run: `runs/2026-06-06_increment-5b-panel-tool-session_580f`

## 2026-06-06 Increment 5B-2 Panel Layout Lifecycle Runtime Shipped

The floor moved for panel lifecycle ownership. The panel layout hydration loop and nested `initPanel` body now live in `app/static/modules/panel-layout-runtime.js`, bound to the completed panel tool-session spine and the existing panel hydration/action/move/resize runtimes. `app.js` still constructs the runtime after `initializePanelRuntimes` and after the widget layout runtime exists, preserving the load-bearing order where panel internal widget grids initialize before panel move/resize binding.

- Completed cluster: `panel-layout-lifecycle`
- `app/static/app.js` line count before this phase: 3528
- `app/static/app.js` line count after this phase: 3303
- New runtime API: `createPanelLayoutRuntime(deps)` returns `{ initPanelLayouts }`
- Compatibility preserved: `layout.__initPanel = initPanel`; internal widget grids still call `initWidgetLayout` before panel binders
- Resistance: `initPanel` early-return mutation was caught before extraction and after the body moved
- Full hidden canary suite: 10/10 green
- MAW run: `runs/2026-06-06_increment-5b-2-panel-layout_6453`

## 2026-06-06 Increment 6 Ordered Grid Items Runtime Shipped

The floor moved for ordered grid query helpers. `orderedGridSelectorForLayout`, `orderedGridItems`, and `globalGridItems` now live in `app/static/modules/ordered-grid-items-runtime.js`. The extraction intentionally did not move `layoutItemsForLogicalResolution`, `normalizeGridLayout`, visual LOD setup, or collision/reflow bodies.

- Completed cluster: `ordered-grid-items-runtime`
- Resident-deferred cluster: `conditional-style-runtime` remains blocked because `applyStyleRulesForWidget` no-op passed the full Electron suite; artifact: `runs/2026-06-06_increment-6-extract-conditional-style_981f/artifacts/cluster-a-oracle-precheck-applyStyleRulesForWidget-noop.json`
- `app/static/app.js` line count before this phase: 3303
- `app/static/app.js` line count after this phase: 3287
- New runtime API: `createOrderedGridItemsRuntime({ gridHostForLayout, isPanelInternalGridItem })` returns `{ globalGridItems, orderedGridItems, orderedGridSelectorForLayout }`
- Resistance: transient-filter mutation in `globalGridItems` was caught by the module-level ordered grid canary
- Full hidden canary suite: 10/10 green
- MAW run: `runs/2026-06-06_increment-6-extract-conditional-style_981f`

## 2026-06-06 Increment 7 Mixed Context Dormant Residue Gutted

The floor moved for the mixed context/query compatibility island's dormant residue. The active context/query compatibility helpers remain resident because they are still coupled to widget runtime data, hydration, settings, panel containment refresh, and persistence. The deleted surface was limited to graph/text-proven no-caller residue.

- Completed dormant residue: `mixed-context-query-compatibility`
- `app/static/app.js` line count before this phase: 3287
- `app/static/app.js` line count after this phase: 3263
- Deleted from `app.js`: unused app-level destructures returned by `createDataAdapterRuntime` and no-caller `ensureContextBadge`
- Deleted from `app/static/modules/data-adapter-runtime.js`: unused `dataOriginDefinitions` map, `registerDataOriginDefinition`, and seeded origin metadata block
- Compatibility preserved: `dataSourceAdapters`, record adapters, context resolution, query cache/inflight handling, widget runtime data, and save/load context fields remain unchanged
- Full hidden canary suite: 10/10 green
- MAW run: `runs/2026-06-06_increment-7-mixed-context-salvage_2566`

## 2026-06-06 Increment 8 Blind Oracles Hardened And Final Clusters Shipped

The floor moved for the final two previously blind clusters. The conditional-style oracle now reaches the active `applyStyleRulesForWidget` clear-on-render path by injecting stale conditional class, CSS variables, and datasets into a real text widget, then triggering render through `dashboardWidgetSettingsRuntime`. The widget-content oracle now updates a real text widget through the settings runtime, verifies rendered content persists across save/reload, and confirms widget tools plus resize handle readiness by resizing after reload.

- Completed clusters: `conditional-style-runtime`, `widget-content-runtime`
- `app/static/app.js` line count before this phase: 3263
- `app/static/app.js` line count after conditional-style-runtime: 3122
- `app/static/app.js` line count after widget-content-runtime: 3121
- New runtime API: `createConditionalStyleRuntime(deps)` returns `applyStyleRulesForWidget` plus moved helper functions
- New runtime API: `createWidgetContentRuntime({ widgetRuntimeController })` returns `{ renderWidgetRuntimeContent, setWidgetRuntimeContent, widgetInstanceFromElement }`
- Resistance: skipping `clearConditionalStyleForWidget` was caught by the stale conditional cleanup canary; `setRuntimeContent` no-op was caught by the text-widget runtime content canary
- Full hidden canary suite: 10/10 green
- MAW run: `runs/2026-06-06_increment-8-harden-oracles-floor_e9fc`

## Current State

- `app/static/app.js` line count: 3121
- `app/static/modules/*.js` count: 66
- `app/static/app.js` SHA256: `D9C923F0D9AC9C0030AF5B40F3D2B98D8E37076BB9AE48489557BC3F3AD29ED7`
- Core coverage artifact: `artifacts/app-core-map.md`
- Deferred cluster artifact: `artifacts/deferred-extractions.md`

## Permanent Do-Not-Retry Clusters

Do not retry these with the same factory/DI extraction strategy:

- `widget-layout-lifecycle`
- `panel-layout-lifecycle`
- `panel-core-primitives`
- `widget-primitive-runtime`

## Stop Condition

No known deferred extraction cluster remains in `artifacts/deferred-extractions.md`. Future work should treat `app/static/app.js` as the documented composition-root floor unless a new, resistance-proven cluster is identified.

## Required Canary Before Any Future Extraction

Before any future attempt, keep these canaries green:

- Electron e2e: `npm run test:e2e`
- MAW preserve-parity against the frozen interaction baseline, especially:
  - resize-snap span and height
  - panel pin toggle
  - drag live ghost
  - grid snap
  - collision/reflow
  - save/reload identical

