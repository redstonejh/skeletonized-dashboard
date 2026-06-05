# Feature Removal Deferred Items

Captured: 2026-06-05

The approved removal deleted the legacy debug mode, relationship editing runtime, object rail remnants, empty relationship graph shim, and related CSS selectors. The only remaining live-code match for the requested broad term scan is the browser `overflow-anchor` property used by drag/resize scroll stabilization.

## CSS Scroll Stabilization Property

- Symbol/file: `overflowAnchor` and `overflow-anchor`, `app/static/drag-runtime.js`, `app/static/modules/layout-history-runtime.js`
- Why deferred: this is not the removed object rail feature. It is the browser scroll anchoring property toggled during drag/resize and undo cleanup so the viewport does not jump while objects move.
- KEEP behavior served: drag-with-live-ghost, edge auto-scroll, resize, collision/reflow, undo cleanup.
- Needed to remove safely: replace the scroll-stabilization mechanism with an equivalent viewport lock and prove drag/resize/edge-scroll parity. This should not be retried as part of removed-feature cleanup.

