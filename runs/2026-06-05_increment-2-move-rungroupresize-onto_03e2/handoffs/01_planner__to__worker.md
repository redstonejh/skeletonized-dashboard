# Hand-off: planner -> worker  (run 2026-06-05_increment-2-move-rungroupresize-onto_03e2, step 01)

## Task context
Increment 2 targets `group-resize-runtime`: first extend the resize-session geometry spine, then move the body only if the API gap is small and parity stays deterministic.

## What I did
Confirmed target discovery, generated the JS code graph, added the missing select-mode multi-resize canary, proved the current tree deterministic 10/10, and captured two matching pre-edit behavior baselines.

## Output / artifacts
- artifacts/target-discovery.json  (required checkout guard)
- artifacts/code-graph.json  (deterministic JS graph)
- artifacts/pre-edit-canary-determinism.json  (10/10 pre-edit canary proof)
- artifacts/behavior-baseline.json  (two matching pre-edit captures)

## Open questions / risks
The historical failure mode was body-first extraction while app.js closure state stayed implicit. Worker must extend state ownership first and stop before a body move if the remaining behavior dependency set is still broad.

## Recommended next step
Implement 2a only at first: route group-resize mutable preview/reflow/session state through `createResizeSessionGeometry`, then run the full canary loop and behavior diff.
