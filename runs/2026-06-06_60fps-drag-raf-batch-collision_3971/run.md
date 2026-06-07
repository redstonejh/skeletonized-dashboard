# Run 2026-06-06_60fps-drag-raf-batch-collision_3971

- Task: 60fps drag optimization: rAF-batch collision on extracted drag phases
- Status: complete

## Conductor plan
See `artifacts/conductor-plan.json`.

## Final result summary
Verdict: NEEDS-HUMAN

A narrow rAF scheduling attempt in `app/static/modules/ordered-drag-runtime.js` preserved the ordered-drag canary, but failed the perf gate: `drag-with-collision` and `collision-heavy-reflow` regressed to ~1000 ms p95/max frame samples, and `edge-auto-scroll` timed out as a standalone perf interaction under the spec's 180s timeout. The source change was reverted, so no product change is shipped or pushed.
