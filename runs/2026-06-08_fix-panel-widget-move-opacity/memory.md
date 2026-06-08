# Memory

## 2026-06-08 - conductor
Confirmed dashboard checkout, reused the available real sub-agent contexts, and scoped the task to in-panel widget move plus widget opacity.

## 2026-06-08 - worker
Found the panel-local drag failure in the extracted drag runtime: `ordered-drag-runtime.js` calls `pointInRect()` for panel-exit checks but did not receive it in the dependency bag. Wired the dependency from `app.js`.

## 2026-06-08 - worker
Removed the dead panel-internal widget drag delegate from `widget-layout-runtime.js` and restored the panel-body viewport floor path instead of the prior internal-layout floor bypass.

## 2026-06-08 - worker
Reduced widget glass fill alpha and replaced the custom widget color backing with a low-alpha accent wash so widgets stay translucent.

## 2026-06-08 - acceptance_gate
Accepted without running tests or deterministic checks because the user explicitly required no validation in this run.
