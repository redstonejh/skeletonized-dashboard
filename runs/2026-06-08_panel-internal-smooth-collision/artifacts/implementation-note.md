# Implementation Note

Changed the existing ordered/reflow item collection paths:

- `app/static/modules/ordered-grid-items-runtime.js` now treats `.panel-internal-widget-grid` as a widget grid when choosing direct child widget items.
- `app/static/app.js` local collision item collection now treats panel-internal grids as widget layouts.
- `app/static/app.js` `reflowItemsForLayout` now includes `.panel-internal-widget-grid > .widget-card` and `.panel-internal-widget-grid > .widget-placeholder`.

This reuses the existing `animateOrderedGridReflow`/ordered collision path. No new animation system was added.

No tests or validation commands were run by explicit user instruction.

