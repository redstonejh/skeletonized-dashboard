# Hand-off: conductor -> planner  (run 2026-06-07_floating-webgl-control-bar, step 01)

## Task context
Move the static dashboard controls into a gear-triggered floating WebGL-glass panel.

## What I did
Selected a compact frontend role roster and scoped the change to control bar, gear, tab offset, and tests.

## Output / artifacts
- `artifacts/delegation-proof.json` records the delegated roles.

## Open questions / risks
Existing control listeners are bound at startup and should not be lost by cloning controls.

## Recommended next step
Plan the DOM-preserving implementation.
