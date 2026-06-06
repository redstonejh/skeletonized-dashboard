# Run Summary

- Run: `2026-06-06_fixed-point-extraction-widget-tool_22eb`
- Task type: `refactor`
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
| plan-check | FAIL | [Errno 2] No such file or directory: 'runs\\2026-06-06_fixed-point-extraction-widget-tool_22eb\\artifacts\\plan-check-result.json' |
| handoffs | PASS | 4 handoffs |
| test | PASS | configured |
| required-evidence | PASS | 9 artifacts |
| acceptance-result | PASS | verdict SHIP |

## Required Artifacts
| Artifact | Status | Reason |
| --- | --- | --- |

## Acceptance
- Verdict: `SHIP`
- Violations: `0`

