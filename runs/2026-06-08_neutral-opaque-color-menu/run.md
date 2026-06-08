# Run: neutral-opaque-color-menu

## Task
Make the customization color menu neutral, opaque, and never pure white.

## Outcome
SHIP by implementation-only user rule. No tests or validation commands were run by request.

## Changes
- Removed color-menu accent syncing from panel/widget open and selection paths.
- Made `.panel-color-menu` chrome neutral and opaque in both dashboard-grid and themes layers.
- Made menu labels neutral instead of object-accent colored.
- Rendered white swatches as gray through the shared swatch builder.
- Kept clear/no-color as the same shared swatch-control path.

