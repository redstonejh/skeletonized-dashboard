# Acceptance Gate

Verdict: SHIP

Checks:
- Discovery guard: passed.
- Focused drag floor canary: passed.
- Focused drag handler canary: passed.
- Focused slim navbar canary: passed after the earlier full-run flake was isolated.
- Full e2e: 27 passed.
- Delegation proof: passed.
- Handoff validation: passed.
- Verdict check: passed.

The fix satisfies the task invariant: floor = fixed visible viewport rows for workspace drags, and panel-internal widgets clamp to the panel body's visible area.
