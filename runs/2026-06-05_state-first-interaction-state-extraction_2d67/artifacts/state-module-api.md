# Interaction State Module API

Module: `app/static/modules/interaction-state.js`

## Exports

- `createWidgetToolSession()`
  - `clearCloseTimer()`
  - `setCloseTimer(timerId)`

- `createPanelToolSession()`
  - `clearToolsCloseTimer()`
  - `getMovedDuringPointer()`
  - `setMovedDuringPointer(value)`
  - `getSuppressHeaderToggleUntil()`
  - `setSuppressHeaderToggleUntil(value)`
  - `isToolPointerCaptured()`
  - `setToolPointerCapture(value)`
  - `setToolsCloseTimer(timerId)`

- `createResizeSessionGeometry(options)`
  - Stores `resizeStartSnapshot`, `resizeParentPanelLayoutSnapshot`, `startRects`, `startBounds`, `groupBox`, `startWidth`, and `startHeight`.
  - Owns mutable preview geometry through `getPreviewCols()`, `getPreviewRows()`, and `setPreviewSize(cols, rows)`.

## Boundary

Only state ownership moved. Drag, resize, pin, collision, persistence, and layout behavior bodies remain in `app/static/app.js`.
