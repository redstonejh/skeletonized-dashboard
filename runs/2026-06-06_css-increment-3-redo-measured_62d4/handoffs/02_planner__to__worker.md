# Hand-off: planner -> worker  (run 2026-06-06_css-increment-3-redo-measured_62d4, step 02)

## Task context
The progress gate requires measurement of total, collapsible, and remaining per-tone declarations.

## What I did
Defined background-tone declarations and the small-collapsible stop condition.

## Output / artifacts
- artifacts/refactor-plan.md

## Open questions / risks
Do not force collapse if the measured remaining duplication is genuinely small.

## Recommended next step
Create `per-tone-duplication-report.json` from actual `themes.css`.
