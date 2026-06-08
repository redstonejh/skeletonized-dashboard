# Remove Right Scroll Reserve

## Task
Remove the visible right-side scrollbar reserve / black bar so the background runs edge to edge without adding a compensating strip elsewhere.

## Delegation
Real MAW delegation used existing distinct sub-agent sessions because the runtime reported the spawn limit reached while delegated sessions were already available.

## Outcome
SHIP. The root page no longer requests a stable scrollbar gutter, and the root scrollbar is hidden/transparent so it does not reserve or paint a visible right-side strip. Internal scrollable menus and panels are untouched.

## Verification
Per user instruction, no tests, canaries, or validation commands were run.
