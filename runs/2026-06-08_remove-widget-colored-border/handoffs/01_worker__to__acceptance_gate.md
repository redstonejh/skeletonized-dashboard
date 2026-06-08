# Hand-off: worker -> acceptance_gate  (run 2026-06-08_remove-widget-colored-border, step 01)

## Task context
Widgets had an extra colored edge that panels did not. The requested result is a neutral widget edge matching the panel edge while preserving the rest of the widget glass material.

## What I did
- Changed `.widget-card-custom` from an accent-mixed border to `var(--line)`.
- Changed custom-colored widget border overrides to `var(--line)` so recolor still tints the widget body without adding a colored outline.
- Removed the now-unused widget custom border tint variable.
- Did not edit panel selectors.

## Output / artifacts
- `artifacts/delegation-proof.json` records distinct delegated role contexts.
- `artifacts/implementation-note.md` summarizes the source changes.
- `artifacts/acceptance-result.json` records the final verdict.

## Open questions / risks
No tests or validation were run by explicit user instruction.

## Recommended next step
Commit and push the scoped CSS fix.
