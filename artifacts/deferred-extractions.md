# Deferred Extractions

The remaining `app/static/app.js` core is init-order-sensitive and still owns live closure state for dashboard interactions. This pass did not force a split that changed behavior.

## ordered-drag-runtime

- Cluster/symbol + file:line: `runOrderedDrag`, `app/static/app.js:2061-2833`
- Why deferred: attempted extraction to `app/static/modules/ordered-drag-runtime.js` behind a dependency-injection factory caused e2e drift in panel color menu and resize flows. The failure indicates an init/dependency coupling in the root event core, so the batch was reverted.
- KEEP interaction entangled: drag, collision/reflow, panel entry/exit absorption, edge auto-scroll, resize handler availability through shared init sequencing.
- Needed to finish safely: extract a shared interaction-state/geometry dependency module first, then split `runOrderedDrag` into smaller phases with explicit state handoff and run parity after each phase.

## widget-layout-lifecycle

- Cluster/symbol + file:line: `initWidgetLayout` and nested `initWidget`, `app/static/app.js:3443-3952`
- Why deferred: shared mutable closure state (`closeTimer`, suppression timers, hover-close resume handlers, workbench/color menu portals, runtime-control rebinding) spans widget tool chrome, workbench, move, resize, delete, and persistence bindings. Moving it as one factory risks preserving the body but hiding an init-order knot; splitting it requires a dedicated widget tool state object first.
- KEEP interaction entangled: widget recolor/rename/pin/delete, widget settings workbench, widget drag, widget resize, panel-internal widget move/resize, save/load persistence.
- Needed to finish safely: extract a `widget-tool-session` state module that owns open/close/workbench/color-menu lifecycle, then bind move/resize/action runtimes against that stable API.

## panel-layout-lifecycle

- Cluster/symbol + file:line: panel hydration loop and nested `initPanel`, `app/static/app.js:3953-4254`
- Why deferred: the panel core shares mutable closure state (`toolsCloseTimer`, `toolPointerCapture`, `suppressHeaderToggleUntil`, `movedDuringPointer`) with action, move, resize, collapse/expand, panel child hover, and color menu positioning. The cluster also initializes internal widget layouts before panel resize/move binding, making init order load-bearing.
- KEEP interaction entangled: panel recolor/rename/pin/collapse/delete, panel drag, panel resize, panel child containment, collision/reflow, save/load persistence.
- Needed to finish safely: extract a `panel-tool-session` state module and a panel lifecycle facade that receives `initWidgetLayout` only after widget lifecycle has been separated.

## group-resize-runtime

- Cluster/symbol + file:line: `runGroupResize` and helper functions, `app/static/app.js:2834-3312`
- Why deferred: this body shares geometry snapshots, live resize surfaces, group selection transforms, auto-zoom, collision resolution, and commit callbacks with both widget and panel resize bindings. A direct factory extraction was attempted after `workspace-compatibility-runtime` landed; e2e failed because panel resize-snap no longer changed span, so the batch was reverted.
- KEEP interaction entangled: select-mode multi-resize, widget resize-snap, panel resize-snap, collision/reflow, undo/save after resize.
- Needed to finish safely: extract shared resize geometry/session state used by widget and panel resize runtimes, then move `runGroupResize` behind the existing resize runtime.
