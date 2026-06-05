# Perf Report

Goal: p95 frame time <= 16.67ms and zero long tasks >50ms for each hot interaction at 30 and 100 objects.

Baseline gate passed: False
Active glass LOD attempt passed: False
Resize RAF coalescing attempt passed: False

The run did not reach the 60fps gate. The app remains behavior-preserving because both optimization attempts that regressed measured interactions were reverted.

## Baseline

| Objects | Interaction | p50 ms | p95 ms | p99 ms | Long tasks >50ms | Dropped frames |
|---:|---|---:|---:|---:|---:|---:|
| 30 | drag-with-collision | 20.4 | 100.1 | 190 | 63 | 121 |
| 30 | resize-snap | 29.9 | 90.3 | 170.1 | 63 | 124 |
| 30 | collision-heavy-reflow | 10 | 20.4 | 60 | 0 | 29 |
| 30 | edge-auto-scroll | 10 | 30.4 | 59.5 | 0 | 38 |
| 30 | theme-background-switch | 10 | 230.1 | 360 | 6 | 10 |
| 30 | select-mode-multi-move | 10 | 29.6 | 110.1 | 4 | 27 |
| 100 | drag-with-collision | 10 | 20.3 | 70 | 3 | 22 |
| 100 | resize-snap | 10.5 | 200.1 | 489.9 | 65 | 119 |
| 100 | collision-heavy-reflow | 19.9 | 190.2 | 570 | 77 | 146 |
| 100 | edge-auto-scroll | 10 | 60.5 | 99.9 | 6 | 60 |
| 100 | theme-background-switch | 10 | 620 | 950.2 | 8 | 13 |
| 100 | select-mode-multi-move | 10 | 30.1 | 239.8 | 5 | 24 |

## Rejected Attempt: Active Glass LOD

| Objects | Interaction | p50 ms | p95 ms | p99 ms | Long tasks >50ms | Dropped frames |
|---:|---|---:|---:|---:|---:|---:|
| 30 | drag-with-collision | 30 | 99.8 | 190 | 63 | 128 |
| 30 | resize-snap | 10 | 29.9 | 59.9 | 0 | 33 |
| 30 | collision-heavy-reflow | 10 | 49.8 | 110.3 | 8 | 40 |
| 30 | edge-auto-scroll | 10.1 | 130.1 | 180.1 | 74 | 144 |
| 30 | theme-background-switch | 10 | 410.1 | 440 | 6 | 12 |
| 30 | select-mode-multi-move | 10 | 30.1 | 130 | 5 | 28 |
| 100 | drag-with-collision | 10 | 40.1 | 309.9 | 8 | 31 |
| 100 | resize-snap | 10.4 | 260.1 | 710 | 76 | 119 |
| 100 | collision-heavy-reflow | 29.9 | 230.1 | 589.6 | 77 | 146 |
| 100 | edge-auto-scroll | 190 | 640.1 | 700 | 186 | 232 |
| 100 | theme-background-switch | 10.1 | 580.1 | 769.8 | 10 | 13 |
| 100 | select-mode-multi-move | 10 | 30.3 | 349.9 | 5 | 28 |

## Rejected Attempt: Resize RAF Coalescing

| Objects | Interaction | p50 ms | p95 ms | p99 ms | Long tasks >50ms | Dropped frames |
|---:|---|---:|---:|---:|---:|---:|
| 30 | drag-with-collision | 20.1 | 110 | 190 | 64 | 107 |
| 30 | resize-snap | 50.1 | 160.1 | 319.9 | 68 | 101 |
| 30 | collision-heavy-reflow | 10 | 40.1 | 120.2 | 6 | 29 |
| 30 | edge-auto-scroll | 120.2 | 260 | 300 | 169 | 200 |
| 30 | theme-background-switch | 10.1 | 380.1 | 419.9 | 6 | 10 |
| 30 | select-mode-multi-move | 10 | 40 | 130.3 | 5 | 35 |
| 100 | drag-with-collision | 10 | 40 | 260.4 | 8 | 32 |
| 100 | resize-snap | 40.1 | 260 | 589.7 | 67 | 91 |
| 100 | collision-heavy-reflow | 10 | 40 | 269.6 | 9 | 52 |
| 100 | edge-auto-scroll | 10.1 | 300 | 390 | 29 | 98 |
| 100 | theme-background-switch | 10 | 400 | 1050 | 8 | 11 |
| 100 | select-mode-multi-move | 10 | 40.2 | 540 | 6 | 36 |

## Bottlenecks

- 100-object background switching remains the largest measured stall: baseline p95 620ms, p99 950.2ms, 8 long tasks.
- 100-object resize/collision paths miss the gate: resize p95 200.1ms with 65 long tasks; collision-heavy reflow p95 190.2ms with 77 long tasks.
- 30-object drag and resize also miss the gate, indicating hot-path work is not only high object count dependent.

## Verdict

NEEDS-HUMAN for performance: the benchmark is now repeatable, but no behavior-preserving optimization in this bounded pass achieved stable 60fps.
