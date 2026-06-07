# Change Summary

- `app/static/modules/widget-layout-runtime.js`
  - Removed left-click body workbench opening.
  - Removed settings click/pointerdown open and hover approach open.
  - Kept right-click `__openCustomization`.
  - Allowed contextmenu through interactive widget content.

- `app/static/modules/panel-layout-runtime.js`
  - Removed settings click open.
  - Removed hover/focus approach open.
  - Kept right-click path through `panel-action-controls.js`.

- `app/static/dashboard-grid.css`
  - Removed `:focus-within` selectors that made drawers visible without the open class.

- `electron-tests/dashboard-electron.spec.js`
  - Added right-click-only drawer canary.
  - Removed obsolete left-click widget workbench expectation.
