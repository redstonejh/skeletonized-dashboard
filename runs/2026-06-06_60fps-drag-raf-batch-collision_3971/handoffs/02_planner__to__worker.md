# Hand-off: planner -> worker  (run 2026-06-06_60fps-drag-raf-batch-collision_3971, step 02)

## Task context
The extracted drag runtime has phase boundaries, but final commit behavior must remain byte-identical and pointer-up must flush pending preview work.

## What I did
Planned a narrow caller-side scheduler in `ordered-drag-runtime.js`: keep cell/state calculation synchronous and schedule only `animateOrderedGridReflow` / `resolveSparseGridLayout` callbacks.

## Output / artifacts
- artifacts/conductor-plan.json  (accepted plan and constraints)

## Open questions / risks
Queued panel entry/exit work can become stale; cancellation and pointer-up flush are load-bearing.

## Recommended next step
Worker should implement a narrow rAF scheduler in `ordered-drag-runtime.js` only, then run the ordered-drag canary before perf.
