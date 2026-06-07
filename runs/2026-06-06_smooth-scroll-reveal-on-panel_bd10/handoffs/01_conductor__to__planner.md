# Hand-off: conductor -> planner  (run 2026-06-06_smooth-scroll-reveal-on-panel_bd10, step 01)

## Task context
Add smooth viewport scroll-to-reveal on panel open and smooth scroll-back on close.

## What I did
Confirmed real delegation, selected the core roster, and scoped the task as additive frontend UI behavior.

## Output / artifacts
- artifacts/conductor-plan.json  (role plan and acceptance criteria)
- artifacts/delegation-proof.json  (distinct delegated role ids)

## Open questions / risks
The scroll behavior must not touch layout, collision/reflow, persistence, or drag auto-scroll.

## Recommended next step
Plan the narrow panel-toggle hook and focused canary.
