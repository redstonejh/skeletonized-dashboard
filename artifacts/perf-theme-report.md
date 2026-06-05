# Theme Switch Perf Report

Goal: theme/background switch p95 <= 16.67ms and zero long tasks >50ms at 30 and 100 objects.

Baseline gate passed: False
Final verdict: NEEDS-HUMAN. All runtime optimization attempts were reverted because none reached the gate reliably without measurable regressions.

## Baseline

| Objects | p50 ms | p95 ms | p99 ms | Max ms | Long tasks >50ms | Dropped frames |
|---:|---:|---:|---:|---:|---:|---:|
| 30 | 10 | 270.1 | 470 | 470 | 6 | 12 |
| 100 | 10 | 10.5 | 159.9 | 919.6 | 10 | 13 |

## 100-Object Trace Breakdown

| Category | Duration ms |
|---|---:|
| scripting_ms | 10209.91 |
| style_ms | 1672.31 |
| layout_ms | 52.02 |
| paint_composite_ms | 636.05 |
| other_timeline_ms | 1574.44 |

Top trace events:
- RunTask (disabled-by-default-devtools.timeline): 471.44ms
- ThreadControllerImpl::RunTask (toplevel): 471.35ms
- EventHandler::handleMousePressEvent (blink): 460.2ms
- RunTask (disabled-by-default-devtools.timeline): 442.46ms
- ThreadControllerImpl::RunTask (toplevel): 442.32ms
- EventHandler::handleMousePressEvent (blink): 429.6ms
- RunTask (disabled-by-default-devtools.timeline): 425.9ms
- ThreadControllerImpl::RunTask (toplevel): 425.72ms
- RunTask (disabled-by-default-devtools.timeline): 368.95ms
- ThreadControllerImpl::RunTask (toplevel): 368.86ms

## Rejected Attempt: hover preview coalescing

| Objects | p50 ms | p95 ms | p99 ms | Max ms | Long tasks >50ms | Dropped frames |
|---:|---:|---:|---:|---:|---:|---:|
| 30 | 10.1 | 180 | 400 | 400 | 3 | 12 |
| 100 | 10 | 10.7 | 320 | 1200 | 8 | 12 |

## Rejected Attempt: image src preload

| Objects | p50 ms | p95 ms | p99 ms | Max ms | Long tasks >50ms | Dropped frames |
|---:|---:|---:|---:|---:|---:|---:|
| 30 | 10.1 | 189.8 | 440 | 440 | 3 | 11 |
| 100 | 10 | 10.8 | 379.8 | 570 | 8 | 12 |

## Rejected Attempt: image decode preload

| Objects | p50 ms | p95 ms | p99 ms | Max ms | Long tasks >50ms | Dropped frames |
|---:|---:|---:|---:|---:|---:|---:|
| 30 | 80.2 | 399.9 | 399.9 | 399.9 | 3 | 12 |
| 100 | 10 | 20 | 300.1 | 320.3 | 6 | 12 |

## Rejected Attempt: offscreen CSS prewarm

| Objects | p50 ms | p95 ms | p99 ms | Max ms | Long tasks >50ms | Dropped frames |
|---:|---:|---:|---:|---:|---:|---:|
| 30 | 10.2 | 199.8 | 440 | 440 | 3 | 11 |
| 100 | 10 | 19.9 | 319.7 | 370 | 7 | 12 |

## Rejected Attempt: img panel substitution

| Objects | p50 ms | p95 ms | p99 ms | Max ms | Long tasks >50ms | Dropped frames |
|---:|---:|---:|---:|---:|---:|---:|
| 30 | 59.8 | 220 | 220 | 220 | 3 | 11 |
| 100 | 10 | 40 | 190.1 | 400.5 | 7 | 17 |

## Rejected Attempt: final candidate rerun

| Objects | p50 ms | p95 ms | p99 ms | Max ms | Long tasks >50ms | Dropped frames |
|---:|---:|---:|---:|---:|---:|---:|
| 30 | 99.9 | 580 | 580 | 580 | 3 | 11 |
| 100 | 10 | 129.6 | 410.4 | 410.4 | 6 | 12 |

## Finding

- The initial trace is dominated by event/scripting and compositor work around menu traversal and background clicks, with major `RunTask` / `EventHandler` stalls.
- Decode/prewarm attempts reduced some long-task counts but did not reliably hit p95 <= 16.67ms; subsequent reruns still showed `GpuImageDecodeCache::DecodeImage` and compositor commit stalls on the switch path.
- The remaining safe path likely requires a deeper redesign of photo background rendering and theme cascade invalidation, with a dedicated look-parity matrix. This pass stopped under the defer rule rather than forcing a risky cascade rewrite.
