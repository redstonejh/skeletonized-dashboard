# Hand-off: planner -> worker

## Task context
Remove the widget pseudo-backend contract while preserving widget rendering.

## What I did
Identified the removable contract terms and the live surfaces to preserve.

## Output / artifacts
- `artifacts/widget-registry-pseudobackend-removal.json`

## Open questions / risks
`layer` and `backendOnly` are live menu/layout metadata and must not be removed by name alone.

## Recommended next step
Remove query/data-source contract fields and replace data-dependent render failures with demo/display placeholders.

