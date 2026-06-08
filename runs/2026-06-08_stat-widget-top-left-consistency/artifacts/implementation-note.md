# Implementation Note

Changed the shared stat widget shell alignment in `app/static/dashboard-grid.css`.

- `.widget-shell-stat .widget-shell-content` now uses `align-content: start`.
- `.widget-shell-stat .stat-val` now uses `align-self: start`.
- This keeps one shared code path for dashboard and panel-contained stat widgets.
- No panel-only selector or one-off override was added.

No tests or validation were run by explicit user instruction.
