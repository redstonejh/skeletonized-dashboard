# MAW Run: CSS oracle cleanup compact hashed fingerprint

Status: complete
Acceptance verdict: SHIP

## Objective
Replace the 62 MB computed-style baseline with a compact hashed fingerprint, remove tracked large derived JSON blobs, preserve CSS byte identity, and validate behavior.

## Evidence
- `artifacts/computed-style-fingerprint.json` is the compact oracle.
- `artifacts/computed-style-determinism.json` proves 10/10 identical fingerprints.
- `artifacts/css-oracle-resistance.json` proves color and spacing mutations are caught.
- `artifacts/css-no-change.json` records the no-CSS-change gate.
- `artifacts/large-derived-json-check.json` records no tracked derived JSON over 1 MB.
- `artifacts/test-result-e2e.json` records the full e2e pass.
- `artifacts/delegation-proof.json` passes delegation_check.py.
