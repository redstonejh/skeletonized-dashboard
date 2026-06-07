# MAW Run: CSS phase increment 3 per-tone collapse

Status: complete
Acceptance verdict: SHIP

## Objective
Collapse duplicated per-background-tone swatch custom-property declarations in 	hemes.css with zero computed-style drift.

## Evidence
- rtifacts/computed-style-preedit-baseline.json saved the pre-edit compact fingerprint.
- rtifacts/computed-style-parity.json reports 0 scenario hash diffs across 533 scenarios.
- rtifacts/computed-style-determinism.json reports 10/10 deterministic oracle captures.
- rtifacts/css-oracle-resistance.json catches color and spacing mutations.
- rtifacts/canary-repeat-10x.json and rtifacts/test-result-e2e.json record 10/10 e2e canary passes.
- rtifacts/change-verification.json records themes.css line count 5399 -> 5393 and !important count 412 -> 412.
- rtifacts/delegation-proof.json passes real delegation proof.
