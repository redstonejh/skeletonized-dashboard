# Hand-off: worker -> critic  (run 2026-06-06_smooth-scroll-reveal-on-panel_bd10, step 03)

## Task context
The feature is implemented and needs review against the pure-scroll constraints.

## What I did
Added one-shot panel reveal and scroll-back logic, including a temporary bottom runway for smooth upward restoration and cleanup after scroll settles.

## Output / artifacts
- artifacts/targeted-scroll-reveal-tests.json  (focused canary result)
- artifacts/no-collision-reflow-evidence.json  (static no-reflow evidence)

## Open questions / risks
Verify manual user scroll cancels restoration and the temporary runway is removed.

## Recommended next step
Run targeted affected tests and inspect the implementation for any layout/collision calls.
