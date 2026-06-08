# Hand-off: worker -> acceptance_gate  (run 2026-06-08_stat-widget-top-left-consistency, step 01)

## Task context
Stat widgets showed their number top-left on the dashboard but bottom-left when placed inside a panel. The requested behavior is top-left in both contexts.

## What I did
- Inspected `widget-registry.js` and confirmed stat widgets use the same `.stat-val` markup in both contexts.
- Located the CSS source of positioning in `dashboard-grid.css`: `.widget-shell-stat .widget-shell-content` and `.widget-shell-stat .stat-val`.
- Changed the shared stat shell alignment from `end` to `start`, avoiding a panel-specific branch.

## Output / artifacts
- `artifacts/delegation-proof.json` records distinct delegated role contexts.
- `artifacts/implementation-note.md` summarizes the fix.
- `artifacts/acceptance-result.json` records the final verdict.

## Open questions / risks
No tests or validation were run by explicit user instruction.

## Recommended next step
Commit and push the scoped CSS fix.
