# Hand-off: conductor -> planner  (run 2026-06-06_remove-edge-auto-scroll-from_fb45, step 01)

## Task context
Remove interaction edge scrolling from drag, resize, and group interactions while preserving normal scrolling and committed in-viewport outcomes.

## What I did
Verified the dashboard checkout and selected the core real-delegation MAW roster.

## Output / artifacts
- artifacts/conductor-plan.json  (roles, scope, and acceptance gates)
- artifacts/delegation-proof.json  (real sub-agent ids for selected roles)

## Open questions / risks
The old feature spans drag, resize, group-resize, history cleanup, tests, perf, and documentation.

## Recommended next step
Plan the deletion in active code first, then replace the positive scroll canary with an inverse no-scroll canary.
