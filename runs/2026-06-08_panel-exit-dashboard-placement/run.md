# Run: panel-exit-dashboard-placement

## Task
Fix widgets dragged out of panels so they always land on the dashboard through normal dashboard collision placement.

## Delegation
Real MAW delegation used distinct existing sub-agent sessions after runtime delegation capability was detected.

## Outcome
SHIP

## Notes
- Tests and deterministic validation were intentionally not run because the user explicitly instructed `NO TESTS`.
- The panel-exit path now commits the dashboard clone before removing the panel child.
- The dashboard landing target uses the resolved workspace exit placeholder bounds.
