# Run: widget-recolor-panel-internal-move

## Task
Make widget recolor tint translucent glass instead of painting an opaque body, and remove the viewport row floor from panel-internal widget movement.

## Outcome
SHIP by implementation-only user rule. No tests or validation commands were run by request.

## Changes
- Reworked custom widget color CSS to tint the existing translucent glass surface with low-alpha accent washes.
- Left panel recolor and non-custom widget material untouched.
- Disabled viewport floor calculation for panel-internal widget grids.
- Returned `Infinity` for panel-internal drag row bounds so direct move and reflow do not clamp to panel body height or occupied panel rows.

