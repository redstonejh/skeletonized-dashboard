# Deferred Extractions

The remaining `app/static/app.js` core is init-order-sensitive and still owns live closure state for dashboard interactions. This pass did not force a split that changed behavior.

## Completed After State-Spine Rewire

### panel-core-primitives

- Cluster/symbol: `applyPanelSpan`, `applyPanelGridPosition`, `getPanelMinimumHeight`, `applyPanelHeight`
- Completed in MAW run: `runs/2026-06-05_increment-3b-close-widget-resistance_d428`
- Outcome: app.js no longer owns named primitive delegate closures. Consumers bind to `panelRuntime` methods directly, and `initializePanelRuntimes` binds containment after creating `panelRuntime` to preserve init order.
- Proof: final canaries 10/10, behavior hash unchanged, and panel `applyPanelSpan` no-op mutation caught.

### widget-primitive-runtime

- Cluster/symbol: `ensureWidgetTools`, `syncWidgetRenderedHeightToFootprint`, `applyWidgetSpan`, `applyWidgetGridPosition`, `widgetGridCellFromPoint`
- Completed in MAW run: `runs/2026-06-05_increment-3b-close-widget-resistance_d428`
- Outcome: app.js no longer owns named widget primitive delegate closures. Consumers bind to `widgetRuntimeController` methods directly; `widgetGridCellFromPoint` collapsed to the existing `gridCellFromPoint` signature.
- Proof: added widget resize-snap and widget tools-init canaries; final canaries 10/10; widget `applyWidgetSpan` and `ensureTools` no-op mutations caught.

### ordered-drag-runtime

- Cluster/symbol: `runOrderedDrag`
- Completed in MAW run: `runs/2026-06-06_increment-4-phase0-body-zone-absorption`
- Outcome: `runOrderedDrag` now lives in `app/static/modules/ordered-drag-runtime.js` and is wired from `app.js` after its existing geometry, containment, group-drag, collision/reflow, auto-scroll, and commit dependencies are initialized.
- Proof: added deterministic body-zone widget absorption canary; `absorbWidgetIntoPanel` no-op mutation caught; full canary suite 10/10 green.
- Note: header/header-tolerance panel entry remains intentionally velocity-gated by `acceptsHeaderPanelEntry`; the body-zone canary is the committed absorption oracle.

### group-resize-runtime

- Cluster/symbol: `runGroupResize` and group resize helper functions
- Completed in MAW run: `runs/2026-06-06_increment-2b-group-resize-runtime_9377`
- Outcome: `runGroupResize` now lives in `app/static/modules/group-resize-runtime.js` and remains bound to `createResizeSessionGeometry`, `resize-surface-runtime`, `collision-reflow`, `grid-metrics-runtime`, panel containment, and workspace scroll-floor dependencies initialized by `app.js`.
- API: `createGroupResizeRuntime(deps)` returns `runGroupResize`, `alignedResizeHeight`, `groupGridBox`, `groupBoxBounds`, `applyGroupFootprintBounds`, `createGroupFootprint`, and `beginGroupLiveSurfaces`.
- Proof: select-mode multi-resize canary caught a `commitGroupResizeFromPreviews` no-op; full canary suite 10/10 green after the body move.

### widget-runtime-meaning-hydration

- Cluster/symbol: stale app-local `createWidgetRuntimeMeaning` factory wiring and `app/static/modules/widget-runtime-meaning.js`
- Completed in MAW run: `runs/2026-06-06_autonomous-extraction-fixed-point-loop_7e3d`
- Outcome: deleted the unused app-local meaning factory and module. The active runtime meaning implementation remains in `app/static/widget-runtime.js`, and `window.dashboardWidgetRuntimeMeaning` still delegates through `widgetRuntimeController`.
- Proof: added `widget-runtime-content-meaning` canary asserting committed runtime shell content and meaning datasets survive save/reload; the canary caught an `applyRuntimeMeaning` no-op on the active runtime path; full canary suite 10/10 green.

### widget-tool-session-state

- Cluster/symbol: widget tool/session mutable state (`suppressToolOpenUntil`, `suppressWidgetClickUntil`, `suppressSettingsClickUntil`, `ignoreToolLeaveCloseUntilPointerActivity`, `toolsOpenedByApproach`)
- Completed in MAW run: `runs/2026-06-06_fixed-point-extraction-widget-tool_22eb`
- Outcome: `createWidgetToolSession` now owns the remaining widget tool suppression and hover-close flags. `app.js` still owns the widget lifecycle body and only reads/writes those flags through the interaction-state API.
- Proof: hardened the widget tools-init canary to assert action-close suppression blocks immediate hover reopen; a `setSuppressToolOpenUntil` no-op mutation was caught; full Electron suite 10/10 green.

### widget-layout-lifecycle

- Cluster/symbol + file:line: `initWidgetLayout` and nested `initWidget`, `app/static/app.js:3380-3889`
- Completed in MAW run: `runs/2026-06-06_increment-5-widget-and-panel_1137`
- Outcome: `initWidgetLayout` and nested `initWidget` now live in `app/static/modules/widget-layout-runtime.js`. `app.js` constructs the runtime before `initializePanelRuntimes`, preserving the load-bearing order where panel runtimes receive a valid `initWidgetLayout` callback before panel hydration initializes internal widget grids.
- API: `createWidgetLayoutRuntime(deps)` returns `{ initWidgetLayout }`; existing `layout.__initWidget = initWidget` and `widget.__saveWidgetLayout = () => saveWidgetLayouts(layout)` compatibility hooks are preserved.
- Proof: `initWidget` early-return mutation was caught before extraction and again after the body moved; full hidden Electron suite passed 10/10 after extraction.

### panel-layout-lifecycle

- Cluster/symbol + file:line: panel hydration loop and nested `initPanel`, `app/static/app.js:3890-4191`
- Completed in MAW run: `runs/2026-06-06_increment-5b-2-panel-layout_6453`
- Outcome: the panel hydration loop and nested `initPanel` now live in `app/static/modules/panel-layout-runtime.js`. `app.js` constructs the runtime after `initializePanelRuntimes`, preserving the load-bearing order where `initWidgetLayout` exists before panel internal widget grids initialize and before panel action/move/resize binders run.
- API: `createPanelLayoutRuntime(deps)` returns `{ initPanelLayouts }`; existing `layout.__initPanel = initPanel` compatibility is preserved.
- Proof: `initPanel` early-return mutation was caught before extraction and again after the body moved; full hidden Electron suite passed 10/10 after extraction.

## conditional-style-runtime

- Cluster/symbol + file:line: conditional style helpers and `applyStyleRulesForWidget`, `app/static/app.js:606-766`
- Why deferred: the visible oracle remains blind to the active clear-only behavior. In MAW run `runs/2026-06-06_increment-6-extract-conditional-style_981f`, an `applyStyleRulesForWidget` early-return mutation passed the full Electron suite, including the hardened resize-snap geometry assertion.
- KEEP interaction entangled: widget runtime hydration, panel/widget resize-snap geometry, save/load evidence snapshots.
- Needed to finish safely: add a deterministic runtime-hydration canary that reaches `applyStyleRulesForWidget` and fails when stale conditional class/CSS/dataset cleanup is skipped, then extract.

### ordered-grid-items-runtime

- Cluster/symbol + file:line: ordered grid item query helpers around `orderedGridItems` / `globalGridItems`, `app/static/app.js:1375-1446`
- Completed in MAW run: `runs/2026-06-06_increment-6-extract-conditional-style_981f`
- Outcome: `orderedGridSelectorForLayout`, `orderedGridItems`, and `globalGridItems` now live in `app/static/modules/ordered-grid-items-runtime.js`. `layoutItemsForLogicalResolution`, `normalizeGridLayout`, visual LOD setup, and reflow helpers stayed resident.
- API: `createOrderedGridItemsRuntime({ gridHostForLayout, isPanelInternalGridItem })` returns `{ globalGridItems, orderedGridItems, orderedGridSelectorForLayout }`.
- Proof: module-level Electron canary catches transient-filter mutation; full hidden Electron suite passed 10/10 after extraction.

## widget-content-runtime

- Cluster/symbol + file:line: widget runtime delegate closures `widgetInstanceFromElement`, `setWidgetRuntimeContent`, `renderWidgetRuntimeContent`, `app/static/app.js:883-885`
- Why deferred: initial extraction passed e2e and parity once, but repeated final e2e runs showed resize-snap no longer changed span. The extraction commit was reverted to restore the stable behavior contract.
- KEEP interaction entangled: widget runtime data hydration, runtime content rendering, panel/widget resize handler readiness.
- Needed to finish safely: move this only as part of a broader widget runtime setup extraction with resize handler readiness checks, or add a deterministic init-order smoke around resize binding before e2e.

## mixed-context-query-compatibility dormant residue

- Cluster/symbol + file:line: data-source/context/query compatibility helpers, `app/static/app.js:356-1179`
- Dormant residue completed in MAW run: `runs/2026-06-06_increment-7-mixed-context-salvage_2566`
- Outcome: deleted the unused app-level data adapter destructures, the orphan `ensureContextBadge` helper, and the unused data-origin definition registry from `data-adapter-runtime.js`.
- KEEP interaction retained resident: active context resolution, widget query cache/runtime data, panel/widget hydration, panel color menu, resize span persistence, and save/load/reset compatibility remain in place.
- Proof: JS code graph generated; deleted symbols had no live references; final hidden Electron suite passed 10/10; `verdict_check.py` passed.

## 2026-06-05 Removed Feature Update

The previous removed-mode shim and empty relationship graph shim are no longer deferred extraction candidates because they were deleted. Any remaining broad-term scan hit that could not be deleted without breaking KEEP behavior is tracked in `artifacts/feature-removal-deferred.md`.
