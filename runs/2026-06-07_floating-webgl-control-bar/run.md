# Floating WebGL Control Bar

Workflow: frontend-ui-task
Started: 2026-06-07

## Task

Move the dashboard controls behind a fixed top-left gear. The opened control bar must float above the workspace, animate out from the gear, be draggable with persisted position, render a WebGL liquid-glass panel body, and leave the tab bar/workspace occupying the vacated static navbar space.

## Delegation

Real sub-agents were spawned through the runtime delegation primitive. See `artifacts/delegation-proof.json`.

## Verification

- Syntax checks: `node --check` on touched JavaScript and the Electron spec.
- Full hidden Electron e2e: `npm.cmd run test:e2e -- --workers=1` -> 20 passed.
- Targeted perf smoke: `PERF_OBJECT_COUNTS=30`, `PERF_INTERACTIONS=drag-with-collision`, `npm.cmd run test:perf -- --workers=1` -> Playwright test passed; artifact records the existing drag perf gate status for this unchanged interaction.
- Delegation proof and verdict checks: passed.

## Final result summary

Acceptance verdict: SHIP
