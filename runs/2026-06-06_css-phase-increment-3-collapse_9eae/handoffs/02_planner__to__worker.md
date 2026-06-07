# Hand-off: planner -> worker  (run 2026-06-06_css-phase-increment-3-collapse_9eae, step 02)

## Task context
The per-tone collapse must be pure CSS refactor with zero visual drift.

## What I did
Scoped the safe batch to duplicated `.background-tone-option[data-background-tone="..."]` swatch custom-property values with identical property/value pairs.

## Output / artifacts
- artifacts/refactor-plan.md
- artifacts/style-extraction.json

## Open questions / risks
Do not collapse unique tone values or alter selector specificity.

## Recommended next step
Apply the grouped selector batch and immediately compare computed-style fingerprints.
