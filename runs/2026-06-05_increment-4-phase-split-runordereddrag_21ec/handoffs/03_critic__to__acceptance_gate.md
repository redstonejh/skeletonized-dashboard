# Hand-off: critic -> acceptance_gate  (run 2026-06-05_increment-4-phase-split-runordereddrag_21ec, step 03)

## Task context
Acceptance must enforce the Phase 0 hard stop before any ordered-drag extraction.

## What I did
Reviewed the Phase 0 evidence. Four drag behaviors now have a green canary, but panel entry/exit absorption could not be made deterministic. The retained suite passes with six tests.

## Output / artifacts
- artifacts/phase0-resistance-precheck.json  (failed Phase 0 gate)
- artifacts/phase0-partial-clean.log  (green suite)
- artifacts/absorption-smoke-failing-trace.log  (blocked behavior trace)

## Open questions / risks
Do not mark `ordered-drag-runtime` done and do not update the extraction floor as moved; no product-code extraction was attempted.

## Recommended next step
Write `NEEDS-HUMAN` with the untestable behavior named as panel entry/exit absorption.
