# Run: panel-internal-fit-no-wiggle

## Task
Fix panel-internal behavior so open panels fit their internal widgets without internal scroll space, and interacting with one panel-internal widget does not move sibling widgets.

## Delegation
Real MAW delegation used distinct existing sub-agent sessions after runtime delegation capability was detected.

## Outcome
SHIP

## Notes
- Tests and deterministic validation were intentionally not run because the user explicitly instructed `NO TESTS`.
- Code changes are limited to panel internal sizing, panel body/internal-grid CSS, and panel-local drag placement.
