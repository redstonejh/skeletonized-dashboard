# Hand-off: planner -> worker  (run 2026-06-06_remove-edge-auto-scroll-from_fb45, step 02)

## Task context
Remove the feature deliberately, not as a perf optimization, and keep unrelated normal scrolling behavior.

## What I did
Classified the work into product deletion, inverse canary update, perf scenario removal, docs, and dead-code proof.

## Output / artifacts
- artifacts/conductor-plan.json  (acceptance criteria and role plan)

## Open questions / risks
Resize code still has scroll-delta compensation that may be stale after removing the interaction scroll loop.

## Recommended next step
Delete the mechanism and call sites, then run targeted ordered-drag and resize tests before full e2e.
