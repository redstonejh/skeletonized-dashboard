# Hand-off: planner -> dependency_mapper  (run 2026-06-06_increment-7-mixed-context-salvage_2566, step 02)

## Task context
Gut the mixed-context-query-compatibility dormant island without changing behavior.

## What I did
Planned conservative deletion: keep active context/query behavior, cut only no-caller dormant residue.

## Output / artifacts
- artifacts/salvage-plan.md, keep-vs-dormant.json

## Open questions / risks
Do not move active context/query subsystem.

## Recommended next step
Map dependencies and live callers.
