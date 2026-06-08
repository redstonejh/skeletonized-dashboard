# Implementation Note

Removed the interaction-state rule that could force neighboring widgets to pure white.

- `app/static/dashboard-grid.css`: in the non-dragged widget hover/focus rule under `panel-interaction-active` and `panel-resize-active`, removed `background: var(--surface) !important`.
- The rule still suppresses transform and shadow jitter during interaction.
- Existing widget glass, hover, and custom-color material rules now remain the source of truth during drag/collision.

No tests or validation were run by explicit user instruction.
