# Hand-off: critic -> acceptance_gate  (run 2026-06-06_fix-object-glass-material-background_8a1a, step 04)

## Task context
Fix object glass material so workspace objects do not compute from --bg or --bg-end; background influence is only optical through alpha and backdrop blur.

## What I did
Audited all CSS ar(--bg*) references, stripped object-surface violations, added object invariance e2e, ran full hidden Electron e2e once, and recorded MAW gate artifacts.

## Output / artifacts
- artifacts/object-bg-reference-audit.json
- artifacts/object-bg-grep-proof.json
- artifacts/test-result-e2e.json
- artifacts/delegation-proof.json
- artifacts/acceptance-result.json

## Open questions / risks
The visual material changes intentionally, so computed-style fingerprint parity is not applicable. Existing broader contrast risks over arbitrary photos remain outside this fixed-material invariant.

## Recommended next step
Verify MAW gates and commit/push if clean.
