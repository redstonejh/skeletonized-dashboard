# Fix Panel Exit Widget Placement

Verdict: SHIP

Task: widgets dragged out of panels should land on the dashboard through normal collision/reflow, without overlap or disappearance.

Outcome:
- Routed panel-exit extraction through the existing dashboard `commitActiveDropSlot` with explicit metrics and row floor.
- Added an opt-in nearest-open fallback to `commitActiveDropSlot` for newly extracted widgets when exact target reflow rejects.
- Passed the viewport row floor into panel containment runtime setup.
- Tests were not run by user instruction.

