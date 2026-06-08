# MAW Run: remove widget runtime empty-state explainer

Task: remove the widget runtime/empty-state explainer card entirely.

Verdict: SHIP

Selected roles: conductor, planner, worker, critic, acceptance_gate.
Delegation capability: multi_agent_v1.spawn_agent.

Acceptance gates:
- Forbidden runtime explainer terms grep clean.
- Empty widgets render normal-size minimal placeholders, never the old card.
- Existing Electron e2e suite passes once with MAW_HEADLESS=1.
- delegation_check.py and verdict_check.py pass.

