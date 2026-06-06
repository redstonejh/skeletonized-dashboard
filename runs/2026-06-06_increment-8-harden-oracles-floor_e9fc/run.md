# Run 2026-06-06_increment-8-harden-oracles-floor_e9fc

- Task: increment 8 harden blind oracles and declare extraction floor
- Workflow template: refactor-task
- Created: 2026-06-06 14:14
- Status: complete

## Conductor plan
Started from workflow template `refactor-task`.

Agents:
- conductor
- planner
- worker
- critic
- acceptance_gate

Deterministic checks:
- behavior-baseline: `python maw-tools/behavior_baseline.py capture --manifest <behavior-manifest.json> --output artifacts/behavior-baseline.json`
- behavior-diff: `python maw-tools/behavior_baseline.py verify --manifest <behavior-manifest.json> --baseline artifacts/behavior-baseline.json --output artifacts/behavior-diff.json`
- refactor-coverage: `python maw-tools/behavior_baseline.py coverage --manifest <behavior-manifest.json> --baseline artifacts/behavior-baseline.json --output artifacts/refactor-coverage.json`
- api-surface-diff: `python maw-tools/behavior_baseline.py api --manifest <behavior-manifest.json> --baseline artifacts/behavior-baseline.json --output artifacts/api-surface-diff.json`
- refactor-structure: `python maw-tools/behavior_baseline.py structure --plan artifacts/refactor-plan.json --manifest <behavior-manifest.json> --output artifacts/refactor-structure.json`
- complexity-report: `python maw-tools/behavior_baseline.py complexity --plan artifacts/refactor-plan.json --manifest <behavior-manifest.json> --baseline artifacts/behavior-baseline.json --output artifacts/complexity-report.json`
- perf-budget: `python maw-tools/behavior_baseline.py perf --plan artifacts/refactor-plan.json --manifest <behavior-manifest.json> --baseline artifacts/behavior-baseline.json --output artifacts/perf-budget.json`
- refactor-resistance: `python maw-tools/behavior_baseline.py resistance --manifest <behavior-manifest.json> --baseline artifacts/behavior-baseline.json --output artifacts/refactor-resistance.json`
- baseline-tests: `python -m pytest -q`
- handoffs: `python maw-tools/validate_handoffs.py <run_dir>`

Acceptance gates:
- behavior-baseline-pre-edit
- behavior-baseline-deterministic
- behavior-diff-clean
- changed-lines-covered
- public-api-stable-or-justified
- refactor-type-structure
- complexity-not-worse
- perf-budget
- refactor-regression-resistance
- tests-pass
- scope-contained
- handoffs-valid

## Required Artifact Checklist
See `artifacts/artifact-checklist.md`.

## Final result summary
Acceptance verdict: SHIP

Both blind oracles were hardened and resistance-proven. `conditional-style-runtime` moved to `app/static/modules/conditional-style-runtime.js`; `widget-content-runtime` moved to `app/static/modules/widget-content-runtime.js`. Final `app/static/app.js` line count is 3121, the hidden Electron suite passed, and the full canary suite repeated 10/10.
