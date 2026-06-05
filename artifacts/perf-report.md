# Full 60fps Performance Redesign Report

Goal: all hot interactions at 30 and 100 objects meet `p95 <= 16.67ms`, zero long tasks over `50ms`, and no max-frame stall over `100ms`, while preserving behavior and resting look.

Verdict: **NEEDS-HUMAN / NO-SHIP for the 60fps redesign.** The accepted code change in this pass is test-harness only: `PERF_INTERACTIONS` filtering for focused benchmark runs. Runtime redesign attempts were reverted because they failed the perf gate or regressed a canary path.

## Baseline

| Objects | Interaction | p95 ms | p99 ms | Max ms | Long tasks >50ms | Dropped frames |
|---:|---|---:|---:|---:|---:|---:|
| 30 | drag-with-collision | 89.9 | 170.4 | 220 | 63 | 125 |
| 30 | resize-snap | 29.9 | 69.9 | 69.9 | 0 | 19 |
| 30 | collision-heavy-reflow | 40 | 90 | 180 | 7 | 30 |
| 30 | edge-auto-scroll | 139.9 | 189.5 | 230 | 77 | 150 |
| 30 | theme-background-switch | 249.8 | 430 | 430 | 6 | 12 |
| 30 | select-mode-multi-move | 39.9 | 160.2 | 259.7 | 5 | 33 |
| 100 | drag-with-collision | 39.9 | 280 | 480.1 | 8 | 32 |
| 100 | resize-snap | 29.9 | 80 | 179.9 | 3 | 41 |
| 100 | collision-heavy-reflow | 40.3 | 319.9 | 469.9 | 9 | 50 |
| 100 | edge-auto-scroll | 650 | 799.6 | 1120.1 | 186 | 214 |
| 100 | theme-background-switch | 459.9 | 899.9 | 899.9 | 10 | 14 |
| 100 | select-mode-multi-move | 40.2 | 330.1 | 670 | 5 | 36 |

Evidence: `artifacts/perf-full-60fps-baseline.json`.

## Rejected Runtime Attempts

| Attempt | Result |
|---|---|
| M1 persistent photo layer cache / opacity swap | Reverted. 100-object theme switch worsened to `max 2010ms` and `8` long tasks. |
| CSS `contain: paint` on panels/widgets | Reverted. Some 100-object drag/reflow cases improved, but resize regressed hard: 100-object resize `p95 29.9 -> 200ms`, long tasks `3 -> 64`. |
| M3 resize lifecycle rAF coalescing | Reverted. 100-object resize regressed to `p95 290ms`, `max 670ms`, `67` long tasks. |

Detailed defer notes: `artifacts/perf-deferred.md`.

## Accepted Change

`electron-tests/perf-dashboard.spec.js` now supports:

```bash
PERF_INTERACTIONS=resize-snap npm run test:perf
```

The filter allows milestone-specific profiling without rerunning unrelated interactions. Smoke evidence: `artifacts/perf-full-60fps-filter-smoke.json`.

Validation for the accepted harness change:

- `npm run test:e2e`: passed 2/2.
- Filtered perf smoke: passed as a bounded benchmark runner and emitted only the requested `resize-snap` interaction.

## Current Blockers

- The worst spike is the documented `ordered-drag-runtime` / edge-auto-scroll core, which is a `DO-NOT-TOUCH-WITHOUT shared interaction-state split` region in `artifacts/app-core-map.md`.
- Wrapper-level coalescing is insufficient; safe optimization needs an explicit session-state split inside the drag/resize bodies so immediate scroll/runway work can stay per-frame while collision/reflow work is batched.
- Theme switching remains dominated by photo/compositor/decode spikes. Mounting all photo layers in the live DOM worsened the stall; a safe retry needs an off-main/live-document warmup strategy or a transitional renderer that preserves computed-CSS/look parity.
