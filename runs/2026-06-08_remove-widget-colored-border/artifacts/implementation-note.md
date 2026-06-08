# Implementation Note

Removed widget-only colored border styling while preserving the widget material.

- `app/static/dashboard-grid.css`: `.widget-card-custom` and custom-colored widget states now use `var(--line)` for the border.
- `app/static/dashboard-grid.css`: removed the unused widget custom border tint token.
- `app/static/themes.css`: high-specificity custom-colored widget overrides now keep the neutral line border instead of forcing `--panel-accent`.
- Panel selectors were not changed.

No tests or validation were run by explicit user instruction.
