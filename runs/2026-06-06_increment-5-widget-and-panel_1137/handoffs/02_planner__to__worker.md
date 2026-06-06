# Hand-off: planner -> worker  (run 2026-06-06_increment-5-widget-and-panel_1137, step 02)

## Task context
Cluster A centers on `initWidgetLayout` and nested `initWidget` in `app.js`.

## What I did
Classified hydration as bind-existing, widget action/move/resize runtimes as bind-existing, widget session state as bind-existing, and the lifecycle body as move-with-body.

## Output / artifacts
- artifacts/oracle-precheck-initWidget-noop.json  (pre-move no-op caught)
- artifacts/behavior-baseline.json  (pre-edit hidden e2e baseline)

## Open questions / risks
The dependency bag is large; preserve init order and compatibility hooks exactly.

## Recommended next step
Create `widget-layout-runtime.js`, move the lifecycle body unchanged, and construct `initWidgetLayout` before `initializePanelRuntimes`.