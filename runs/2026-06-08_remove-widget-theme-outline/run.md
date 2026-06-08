# Run: remove-widget-theme-outline

Verdict: SHIP

## Task
Remove the thin theme-colored outline on widgets entirely, in every state, without changing panels or adding dependencies.

## Standing Rules
- Real MAW delegation used through existing sub-agent sessions.
- No e2e, canary, or validation tests run by user instruction.
- Commit and push after implementation.

## Outcome
Widget edge painting was removed from the actual sources: CSS widget border/rim rules, selected/group-selected widget outline rules, live widget ghost rings, and inline widget recolor border writes. Panels were left on their existing edge styling.
