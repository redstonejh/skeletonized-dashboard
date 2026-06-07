# Hand-off: worker -> critic  (run 2026-06-06_60fps-drag-raf-batch-collision_3971, step 03)

## Task context
A narrow rAF scheduling attempt was made and then evaluated against behavior and perf gates.

## What I did
First tried a broad collision batcher; it failed the ordered-drag canary and was replaced with the narrower scheduled-reflow seam. The narrower attempt passed the ordered-drag canary but failed perf: drag and collision-heavy interactions regressed to ~1000 ms p95/max frame samples and edge-auto-scroll timed out. The source change was reverted.

## Output / artifacts
- artifacts/perf-drag-with-collision-after.json  (failed attempted perf data)
- artifacts/perf-collision-heavy-reflow-after.json  (failed attempted perf data)
- artifacts/perf-comparison.json  (comparison against baseline and timeout note)
- artifacts/behavior-canary.json  (ordered-drag canary passed before perf failure; full gate not run)

## Open questions / risks
The likely issue is not just reflow call frequency; delayed preview reflow interacts with the perf harness pointer cadence and/or auto-scroll frame scheduling.

## Recommended next step
Critic should reject SHIP, verify source was reverted, and preserve the failing artifacts for a future deeper scheduling design.
