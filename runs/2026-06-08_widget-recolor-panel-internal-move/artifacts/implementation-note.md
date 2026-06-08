# Implementation Note

Widget recolor now mixes low-alpha `--panel-accent-rgb` overlays into `--glass-surface`, preserving translucency instead of using an opaque `--surface` paint block.

Panel-internal widget layouts no longer participate in `viewportRowFloorForLayout`; `ordered-drag-runtime` also treats their row floor as unbounded so internal drag and collision placement can move freely as the panel grows to fit.

No tests or validation commands were run per user instruction.

