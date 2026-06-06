# Hand-off: critic -> salvage_verifier  (run 2026-06-06_increment-7-mixed-context-salvage_2566, step 07)

## Task context
Gut the mixed-context-query-compatibility dormant island without changing behavior.

## What I did
Reviewed diff: active context/query behavior retained; final hidden e2e/canaries 10/10.

## Output / artifacts
- artifacts/api-surface-diff.json, behavior-byte-identity.json

## Open questions / risks
Deletion-scoped hidden-deps is used because full scan reports unrelated old couplings.

## Recommended next step
Verify salvage package.
