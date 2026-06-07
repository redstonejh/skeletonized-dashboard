# Hand-off: planner -> worker  (run 2026-06-07_gut-datasource-dataflow-engineer-mode, step 01)

## Task context
Remove the data-source/dataflow/engineer-mode subsystem while preserving widgets as display objects.

## What I did
Mapped removable storage, adapter, managed query, and visible configuration strings; identified visual persistence to keep and decouple.

## Output / artifacts
- artifacts/datasource-removal-map.json  (classification and removal map)

## Open questions / risks
The main risk was removing region metadata needed by layout interactions.

## Recommended next step
Remove subsystem code and keep display-region metadata only.
