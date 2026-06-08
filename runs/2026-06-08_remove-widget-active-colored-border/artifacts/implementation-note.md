# Implementation Note

Removed the remaining widget-only colored edge source.

- `app/static/dashboard-grid.css`: `.stat-card:hover`, `.stat-card:focus-visible`, and `.stat-card.active` now use the neutral `var(--line)` edge.
- `app/static/dashboard-grid.css`: the blue active outline was removed from widget cards.
- `app/static/dashboard-grid.css`: `.widget-layout > .stat-card.active:hover` no longer restores a blue border/outline.
- Panel selectors were not changed.

No tests or validation were run by explicit user instruction.
