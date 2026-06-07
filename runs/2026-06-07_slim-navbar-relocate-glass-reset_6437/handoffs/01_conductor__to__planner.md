# Hand-off: conductor -> planner  (run 2026-06-07_slim-navbar-relocate-glass-reset_6437, step 01)

## Task context
Slim the dashboard navbar by removing identity/Glass/Restore, moving Glass into the background popover, adding Reset next to Select, and preserving existing controls.

## What I did
Selected a frontend-ui-task roster with real delegated role contexts. Cited the AGENTS.md redesign exception because the user explicitly requested this redesign.

## Output / artifacts
- artifacts/conductor-plan.json  (roles, caps, redesign exception, and gates)
- artifacts/delegation-proof.json  (real sub-agent IDs per selected role)

## Open questions / risks
Glass must keep its `[data-liquid-glass-toggle]` listener but must not retain the reset class. Reset should reuse the existing default-layout reset path.

## Recommended next step
Plan the smallest DOM/CSS/test changes and preserve existing selectors for Save, Load, Select, add, undo, background, and reset.
