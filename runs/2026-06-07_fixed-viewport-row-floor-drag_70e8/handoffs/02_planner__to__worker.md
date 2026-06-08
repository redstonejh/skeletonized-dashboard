# Hand-off: planner -> worker  (run 2026-06-07_fixed-viewport-row-floor-drag_70e8, step 02)

## Task context
Enforce a fixed viewport-row floor for both ordered drag and collision/reflow. The floor must come from clientHeight, not scrollHeight or occupied content, and repeated collision must not ratchet the grid downward.

## What I did
Identified the shared-helper plan: define `viewportRowFloorForLayout` in `app.js`, pass it into `ordered-drag-runtime.js` and `collision-reflow.js`, and pass rowLimit through drag preview and final commit paths.

## Output / artifacts
- artifacts/behavior-diff.json (planned behavior contract and implemented summary)

## Open questions / risks
Panel expansion is an allowed exception and must remain separate from ordinary drag collision.

## Recommended next step
Implement the shared helper and floor-aware collision search paths, then add a ratchet canary.
