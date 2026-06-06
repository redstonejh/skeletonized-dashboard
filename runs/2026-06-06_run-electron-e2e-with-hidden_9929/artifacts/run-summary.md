# Run Summary

- Run: `2026-06-06_run-electron-e2e-with-hidden_9929`
- Task type: `refactor-task`
- Final verdict: `SHIP`
- Caps: `max_agents=5`, `max_parallel=3`, `max_iters=3`

## Role Pipeline
- conductor -> planner
- planner -> worker
- worker -> critic
- critic -> acceptance_gate

## Deterministic Gates
| Gate | Status | Detail |
| --- | --- | --- |
| plan-check | FAIL | [Errno 2] No such file or directory: 'runs\\2026-06-06_run-electron-e2e-with-hidden_9929\\artifacts\\plan-check-result.json' |
| handoffs | PASS | 4 handoffs |
| test | PASS | configured |
| required-evidence | PASS | 9 artifacts |
| acceptance-result | PASS | verdict SHIP |

## Required Artifacts
| Artifact | Status | Reason |
| --- | --- | --- |
| artifacts/behavior-baseline.json | PASS | passed field |
| artifacts/behavior-diff.json | PASS | passed field |
| artifacts/refactor-coverage.json | PASS | passed field |
| artifacts/api-surface-diff.json | PASS | passed field |
| artifacts/refactor-structure.json | PASS | passed field |
| artifacts/complexity-report.json | PASS | passed field |
| artifacts/perf-budget.json | PASS | passed field |
| artifacts/refactor-resistance.json | PASS | passed field |
| artifacts/test-result.json | PASS | passed field |

## Acceptance
- Verdict: `SHIP`
- Violations: `0`
