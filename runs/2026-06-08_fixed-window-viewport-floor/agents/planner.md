# Planner

Plan:
1. Confirm target files and origin.
2. Locate viewportRowFloorForLayout and its consumers.
3. Replace content-derived floor measurement with fixed visible viewport measurement.
4. Preserve panel-internal behavior by using the panel body's visible area.
5. Extend tests for constant floor across panel expansion, no drag-created scroll, collision ratchet prevention, and panel-internal clamp.
6. Run focused checks, full e2e, and deterministic MAW gates.

Key risk:
Using grid host clientHeight, layout rect height, scrollHeight, or occupied bottom rows would reintroduce the bug.
