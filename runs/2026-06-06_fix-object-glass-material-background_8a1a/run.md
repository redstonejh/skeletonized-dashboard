# MAW Run: fixed object glass material background-independent

Status: complete
Acceptance verdict: SHIP

## Objective
Ensure workspace object glass material never computes from `--bg` or `--bg-end`; the background may influence objects only optically through alpha and backdrop blur.

## Evidence
- `artifacts/object-bg-reference-audit.json` classifies every `var(--bg*)` use and shows object-surface refs reduced from 3 to 0.
- `artifacts/object-bg-grep-proof.json` proves `dashboard-grid.css` has zero `var(--bg*)` references.
- `artifacts/test-result-e2e.json` records the full hidden Electron suite passing once, 13/13.
- `artifacts/delegation-proof.json` records real sub-agent delegation.
