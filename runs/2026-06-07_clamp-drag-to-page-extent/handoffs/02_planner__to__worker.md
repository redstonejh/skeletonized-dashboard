# Hand-off: planner -> worker  (run 2026-06-07_clamp-drag-to-page-extent, step 02)

## Task context
The old clamp used lowest occupied row. It must use current page extent rows.

## What I did
Identified `ordered-drag-runtime.js` as the runtime boundary and the existing drag alignment test as the best canary host.

## Output / artifacts
- agents/planner.md  (implementation plan)

## Open questions / risks
Use fully fitting rows so drag cannot create even a partial extra row of scroll.

## Recommended next step
Implement the clamp and update the canary.

