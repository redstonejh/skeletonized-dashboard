# Finish Widget Pseudo-Backend Removal

Task: remove the remaining data-source/query/context pseudo-backend contract from `widget-registry.js` and feeders while keeping all widget types rendering as display objects.

Selected roles: conductor, planner, worker, critic, acceptance_gate.

Delegation primitive: `multi_agent_v1.spawn_agent`.

Verdict: NEEDS-HUMAN.

Acceptance notes: static proof and the focused display-object canary passed, but the full e2e suite failed 10 tests. The change was not committed or pushed.
