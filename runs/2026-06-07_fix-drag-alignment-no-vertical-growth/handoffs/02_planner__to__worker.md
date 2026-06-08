# Hand-off: planner -> worker  (run 2026-06-07_fix-drag-alignment-no-vertical-growth, step 02)

## Task context
The task targets the ordered drag runtime after tab paging and floating control-bar changes.

## What I did
Planned diagnosis of fixed drag visual positioning, panel-contained dragging, and committed-grid row clamping.

## Output / artifacts
- artifacts/drag-diagnosis.json  (to be completed by worker with measured cause)

## Open questions / risks
Panel-contained widgets may use a different containing block than top-level panels.

## Recommended next step
Measure live `style.top` vs `getBoundingClientRect().top`, fix the containing-block offset, then add canaries.

