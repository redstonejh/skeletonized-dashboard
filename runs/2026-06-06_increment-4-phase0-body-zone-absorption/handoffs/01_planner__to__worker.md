# Hand-off: planner -> worker  (run 2026-06-06_increment-4-phase0-body-zone-absorption, step 01)

## Task context
Complete increment 4 Phase 0 by proving panel absorption through the body zone, then extract ordered drag only if the oracle catches the committed absorption path.

## What I did
Confirmed the target-discovery requirements and planned a body-zone canary that avoids the velocity-gated header/header-tolerance path.

## Output / artifacts
- artifacts/target-discovery.json  (discovery guard)

## Open questions / risks
Header entry remains velocity-gated and is intentionally not the deterministic resistance oracle.

## Recommended next step
Add the body-zone canary, prove it 10/10, and plant an `absorbWidgetIntoPanel` no-op to confirm the committed containment assertion fails.
