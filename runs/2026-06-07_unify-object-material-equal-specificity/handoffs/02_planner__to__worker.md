# Hand-off: planner -> worker  (run 2026-06-07_unify-object-material-equal-specificity, step 02)

## Task context
Static material currently uses a stale computed-value replay block.

## What I did
Planned `body:is(.has-photo-background, :not(.has-photo-background))` for equal specificity and one shared declaration block per material surface.

## Output / artifacts
- agents/planner.md  (implementation plan)

## Open questions / risks
Token scope must also be shared or static mode will miss photo material variables.

## Recommended next step
Inspect and edit the canonical material blocks.

