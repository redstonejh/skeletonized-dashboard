# Hand-off: worker -> acceptance_gate  (run 2026-06-08_remove-widget-active-colored-border, step 01)

## Task context
The previous patch removed accent-mixed widget `border-color`, but widgets still showed an extra colored edge. The user requested a fresh investigation.

## What I did
- Inspected widget edge sources beyond normal `border-color`, including pseudo-elements, shadows, outlines, hover, and active state rules.
- Identified the remaining source: all widgets carry the `.stat-card` class, and `.stat-card:hover`, `.stat-card.active`, plus `.widget-layout > .stat-card.active:hover` still painted blue borders/outlines/shadows.
- Replaced those widget-only blue edge values with neutral `var(--line)` and removed the active outline.
- Did not edit panel selectors.

## Output / artifacts
- `artifacts/delegation-proof.json` records distinct delegated role contexts.
- `artifacts/implementation-note.md` summarizes the source change.
- `artifacts/acceptance-result.json` records the final verdict.

## Open questions / risks
No tests or validation were run by explicit user instruction.

## Recommended next step
Commit and push the scoped CSS fix.
