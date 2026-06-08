# Implementation Note

## Root Cause
Panel-contained widget drag enters the panel-local branch in `ordered-drag-runtime.js`. That branch calls `pointInRect()` from `pointerInsidePanelShell()`, but the extracted runtime did not destructure or receive `pointInRect` from `app.js`. Dashboard-level widget drag does not use that panel-local exit check, so dashboard widgets still moved.

## Changes
- Passed `pointInRect` into `createOrderedDragRuntime()` and destructured it in `ordered-drag-runtime.js`.
- Removed the dead `panel-internal-widget-grid` pointer delegate from `widget-layout-runtime.js`; it was a workaround path looking for handles from layout-level pointer events, while each widget already owns its move binding.
- Removed the previous panel-internal floor bypass by restoring panel-body height handling in `viewportRowFloorForLayout()` and letting `snapshotCommittedPageBottom()` use the shared floor function.
- Reduced widget base glass fill from `0.04` to `0.03`.
- Changed custom widget tint backing from a mixed `--glass-surface` fill to a low-alpha accent wash.

## Validation
Not run. The user explicitly instructed: "NO TESTS -- do not run the e2e/canary suite or any validation; I verify manually."
