# Hand-off: planner -> worker  (run 2026-06-08_fixed-window-viewport-floor, step 02)

## Task context
The floor must be fixed viewport rows and remain constant regardless of content or panel expansion.

## What I did
Planned the implementation and tests around viewportRowFloorForLayout, direct drag, collision displacement, panel expansion, and panel-internal widgets.

## Output / artifacts
- agents/planner.md  (plan and risk notes)

## Open questions / risks
Panel-internal widgets need a visible-area clamp, not the global window clamp.

## Recommended next step
Implement the fixed viewport measurement and update the canaries.
