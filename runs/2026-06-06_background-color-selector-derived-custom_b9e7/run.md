# MAW Run: background color selector derived custom-color redesign

Status: complete
Acceptance verdict: SHIP

## Objective
Replace the hand-tuned solid color background selector with a derived `--base-tone` model and a custom color picker while leaving photo backgrounds intact.

## Evidence
- User explicitly requested this redesign; AGENTS.md redesign guard is satisfied.
- `artifacts/background-color-redesign-metrics.json` records `themes.css` line/declaration reductions and removal of solid tone CSS selectors.
- `artifacts/photo-background-proof.json` records photo option preservation evidence.
- `artifacts/canary-repeat-10x.json` records 10/10 passing hidden e2e runs.
- `artifacts/perf-budget.json` records non-regression against `artifacts/perf-theme-baseline.json`.
- `artifacts/delegation-proof.json` records distinct real sub-agent ids.
