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

## Current State

- `app/static/app.js` line count: 3528
- `app/static/modules/*.js` count: 62
- `app/static/app.js` SHA256: `AC18E0361EF736F75C1EAE769BF57D429C37E447169276F64169265516E3B81B`
- Core coverage artifact: `artifacts/app-core-map.md`
- Deferred cluster artifact: `artifacts/deferred-extractions.md`

## Permanent Do-Not-Retry Clusters

Do not retry these with the same factory/DI extraction strategy:

- `widget-layout-lifecycle`
- `panel-layout-lifecycle`
- `conditional-style-runtime`
- `panel-core-primitives`
- `ordered-grid-items-runtime`
- `widget-primitive-runtime`
- `widget-content-runtime`
- `mixed-context-query-compatibility`

## Stop Condition

No unattempted, non-deferred, cohesive extraction remains that is both large enough to materially reduce `app.js` and safe to attempt without first introducing shared state/session modules. This pass therefore terminates without extraction.

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

