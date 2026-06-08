# Implementation Note

Changed files:

- `app/static/dashboard-grid.css`
- `app/static/themes.css`
- `app/static/modules/panel-appearance-runtime.js`
- `app/static/modules/widget-layout-hydration.js`

Root sources addressed:

- Base widget `border: 1.5px solid var(--line)` now uses a transparent border.
- Widget hover/focus and panel-interaction widget border overrides now use transparent border color.
- Custom-colored widget CSS no longer restores a visible border.
- Selected/group-selected widget outline rules are neutralized while panel group selection remains unchanged.
- Drag/resize live widget rings no longer add accent-colored outlines.
- Widget recolor no longer writes an inline `border` style during apply/menu selection/hydration.

Tests were intentionally not run per user instruction.
