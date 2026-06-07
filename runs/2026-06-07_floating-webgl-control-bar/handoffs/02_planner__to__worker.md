# Hand-off: planner -> worker  (run 2026-06-07_floating-webgl-control-bar, step 02)

## Task context
Implement the floating control bar while preserving existing button behavior.

## What I did
Prepared a DOM-preserving plan: add a gear trigger, convert the existing nav to a fixed panel, mount WebGL glass on that panel, and update tests to open controls through the gear.

## Output / artifacts
- `agents/planner.md` records the implementation plan.

## Open questions / risks
The background and add-object menus are sensitive to document-level pointer handling after the bar becomes fixed.

## Recommended next step
Implement the runtime, CSS, WebGL mount, and focused e2e coverage.
