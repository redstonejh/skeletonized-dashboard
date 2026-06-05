# Deferred Extractions

The remaining `app/static/app.js` core is init-order-sensitive and still owns live closure state for dashboard interactions. This pass did not force a split that changed behavior.

## ordered-drag-runtime

- Cluster/symbol + file:line: `runOrderedDrag`, `app/static/app.js:1998-2770`
- Why deferred: attempted extraction to `app/static/modules/ordered-drag-runtime.js` behind a dependency-injection factory caused e2e drift in panel color menu and resize flows. The failure indicates an init/dependency coupling in the root event core, so the batch was reverted.
- KEEP interaction entangled: drag, collision/reflow, panel entry/exit absorption, edge auto-scroll, resize handler availability through shared init sequencing.
- Needed to finish safely: extract a shared interaction-state/geometry dependency module first, then split `runOrderedDrag` into smaller phases with explicit state handoff and run parity after each phase.

## widget-layout-lifecycle

- Cluster/symbol + file:line: `initWidgetLayout` and nested `initWidget`, `app/static/app.js:3380-3889`
- Why deferred: shared mutable closure state (`closeTimer`, suppression timers, hover-close resume handlers, workbench/color menu portals, runtime-control rebinding) spans widget tool chrome, workbench, move, resize, delete, and persistence bindings. Moving it as one factory risks preserving the body but hiding an init-order knot; splitting it requires a dedicated widget tool state object first.
- KEEP interaction entangled: widget recolor/rename/pin/delete, widget settings workbench, widget drag, widget resize, panel-internal widget move/resize, save/load persistence.
- Needed to finish safely: extract a `widget-tool-session` state module that owns open/close/workbench/color-menu lifecycle, then bind move/resize/action runtimes against that stable API.

## panel-layout-lifecycle

- Cluster/symbol + file:line: panel hydration loop and nested `initPanel`, `app/static/app.js:3890-4191`
- Why deferred: the panel core shares mutable closure state (`toolsCloseTimer`, `toolPointerCapture`, `suppressHeaderToggleUntil`, `movedDuringPointer`) with action, move, resize, collapse/expand, panel child hover, and color menu positioning. The cluster also initializes internal widget layouts before panel resize/move binding, making init order load-bearing.
- KEEP interaction entangled: panel recolor/rename/pin/collapse/delete, panel drag, panel resize, panel child containment, collision/reflow, save/load persistence.
- Needed to finish safely: extract a `panel-tool-session` state module and a panel lifecycle facade that receives `initWidgetLayout` only after widget lifecycle has been separated.

## group-resize-runtime

- Cluster/symbol + file:line: `runGroupResize` and helper functions, `app/static/app.js:2771-3249`
- Why deferred: this body shares geometry snapshots, live resize surfaces, group selection transforms, auto-zoom, collision resolution, and commit callbacks with both widget and panel resize bindings. A direct factory extraction was attempted after `workspace-compatibility-runtime` landed; e2e failed because panel resize-snap no longer changed span, so the batch was reverted.
- KEEP interaction entangled: select-mode multi-resize, widget resize-snap, panel resize-snap, collision/reflow, undo/save after resize.
- Needed to finish safely: extract shared resize geometry/session state used by widget and panel resize runtimes, then move `runGroupResize` behind the existing resize runtime.
## conditional-style-runtime

- Cluster/symbol + file:line: conditional style helpers and `applyStyleRulesForWidget`, `app/static/app.js:606-766`
- Why deferred: a direct module extraction passed Electron e2e but failed structured parity with a `resize-snap` geometry drift on `builder-notes` height, so the batch was reverted.
- KEEP interaction entangled: widget runtime hydration, panel/widget resize-snap geometry, save/load evidence snapshots.
- Needed to finish safely: extract only after widget runtime hydration and resize baseline state are separated, then compare resize-snap geometry before committing.

## widget-runtime-meaning-hydration

- Cluster/symbol + file:line: `window.dashboardWidgetRuntimeMeaning` binder and `hydrateWidgetRuntime`, `app/static/app.js:916-923`
- Why deferred: moving these wrappers into `widget-content-runtime.js` passed renderer smoke but failed Electron e2e because panel resize-snap no longer changed span, so the batch was reverted.
- KEEP interaction entangled: widget hydration, panel/widget resize handler readiness, runtime meaning globals used during initialization.
- Needed to finish safely: extract after resize handler setup no longer depends on widget runtime initialization timing, or move the entire widget runtime/controller setup as one cohesive module with parity after the full move.

## panel-core-primitives

- Cluster/symbol + file:line: `applyPanelSpan`, `applyPanelGridPosition`, `getPanelMinimumHeight`, `applyPanelHeight`, `app/static/app.js:419-606`
- Why deferred: moving these delegate closures to `panel-core-primitives.js` passed renderer smoke but failed Electron e2e; panel pin did not toggle and panel resize-snap no longer changed span, so the batch was reverted.
- KEEP interaction entangled: panel pin, panel resize-snap, panel lifecycle action controls, resize runtime initialization.
- Needed to finish safely: extract only with the panel action/resize lifecycle that consumes these delegates, or move the panel runtime setup and primitive delegates together while preserving initialization order.

## ordered-grid-items-runtime

- Cluster/symbol + file:line: ordered grid item query helpers around `orderedGridItems` / `globalGridItems`, `app/static/app.js:1375-1446`
- Why deferred: the initial extraction boundary cut through adjacent `normalizeGridLayout` and workspace visual LOD setup, producing a renderer parse error; the batch was reverted before behavioral gates.
- KEEP interaction entangled: collision/reflow, visual LOD, workspace scroll floor, ordered drag preview, resize occupancy.
- Needed to finish safely: isolate the exact helper block with AST-aware extraction or first move visual LOD setup into a facade so the boundary is unambiguous.

## widget-primitive-runtime

- Cluster/symbol + file:line: widget runtime delegate closures `ensureWidgetTools`, `syncWidgetRenderedHeightToFootprint`, `applyWidgetSpan`, `applyWidgetGridPosition`, `widgetGridCellFromPoint`, `app/static/app.js:1004-1012`
- Why deferred: after correcting the extraction boundary, renderer smoke passed but Electron e2e failed because resize-snap no longer changed span, so the batch was reverted.
- KEEP interaction entangled: widget tools initialization, panel/widget resize-snap, grid positioning, widget lifecycle binding.
- Needed to finish safely: move these delegates together with the resize runtimes or widget lifecycle binding that consumes them, preserving setup order around `createGridItemGeometry`.

## widget-content-runtime

- Cluster/symbol + file:line: widget runtime delegate closures `widgetInstanceFromElement`, `setWidgetRuntimeContent`, `renderWidgetRuntimeContent`, `app/static/app.js:883-885`
- Why deferred: initial extraction passed e2e and parity once, but repeated final e2e runs showed resize-snap no longer changed span. The extraction commit was reverted to restore the stable behavior contract.
- KEEP interaction entangled: widget runtime data hydration, runtime content rendering, panel/widget resize handler readiness.
- Needed to finish safely: move this only as part of a broader widget runtime setup extraction with resize handler readiness checks, or add a deterministic init-order smoke around resize binding before e2e.
