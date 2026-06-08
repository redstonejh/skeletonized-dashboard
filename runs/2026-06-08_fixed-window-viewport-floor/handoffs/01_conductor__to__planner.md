# Hand-off: conductor -> planner  (run 2026-06-08_fixed-window-viewport-floor, step 01)

## Task context
Fix drag floor calculation so it is derived from the fixed viewport rather than content height.

## What I did
Selected the core MAW roles and established the acceptance gates.

## Output / artifacts
- run.md  (run scope and acceptance target)

## Open questions / risks
The grid host expands with content, so any fallback to host height risks reintroducing the bug.

## Recommended next step
Map the floor function and shared drag/collision call chain.
