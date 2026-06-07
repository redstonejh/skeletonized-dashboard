# Hand-off: worker -> critic  (run 2026-06-06_remove-edge-auto-scroll-from_fb45, step 03)

## Task context
The implementation removes interaction edge scrolling and updates coverage to lock in the new behavior.

## What I did
Removed the exported scroll helper, app/runtime call sites, resize scroll compensation, history cleanup for old classes, and the perf scenario. Updated the ordered-drag canary to assert no scroll drift.

## Output / artifacts
- artifacts/dead-code-proof.json  (removed-symbol grep proof)
- artifacts/edge-auto-scroll-canaries.json  (repeat canary gate)
- artifacts/perf-scenario-removal.json  (perf scenario removal proof)

## Open questions / risks
Check that no active test or doc keeps the old symbol names alive and that no normal in-viewport drag result changed.

## Recommended next step
Review the diff for stale branches, run full e2e and 10x canaries, then verify perf no longer schedules the removed interaction.
