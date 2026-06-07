# Performance Deferred Items

## M1 photo layer cache / opacity swap

- **Attempted change:** replace the single photo backdrop track in `app/static/modules/background-controller.js` with persistent per-tone photo tracks and compositor opacity swaps, plus `.workspace-photo-layer-root` / `.workspace-photo-track.is-active` CSS in `app/static/dashboard-grid.css`.
- **Why deferred:** the candidate failed the theme/background switch gate and worsened the 100-object stall. The measured 100-object max frame rose to `2010ms` with `8` long tasks, and 30-object p95 remained `260ms`.
- **KEEP behavior at risk:** background/photo switching and resting photo-glass look. The app still behaved visibly, but the perf gate regressed hard enough to reject the structural change before parity acceptance.
- **Evidence:** `artifacts/perf-m1-photo-layer-cache.json`.
- **Needed for safe retry:** a renderer design that warms GPU resources without mounting all tone layers into the live document or triggering bulk style/compositor work. A likely next pass should isolate predecode/prepaint in a separate inert/offscreen document or explicit low-resolution transitional layer, then swap only after the high-resolution surface is ready.

## CSS paint containment on panels/widgets

- **Attempted change:** add `contain: paint` to `.widget-layout > .widget-card`, `.panel-internal-widget-grid > .widget-card`, and `.panel-layout > .db-panel` in `app/static/dashboard-grid.css`.
- **Why deferred:** mixed perf result with clear resize regression. `100`-object `resize-snap` regressed from `p95 29.9ms / max 179.9ms / 3 long tasks` to `p95 200ms / max 650.2ms / 64 long tasks`; `30`-object resize also regressed from `p95 29.9ms / 0 long tasks` to `p95 90ms / 63 long tasks`.
- **KEEP behavior at risk:** resize-snap span and resize/collision cadence. Even if visual behavior remained plausible, the canary interaction became materially slower.
- **Evidence:** `artifacts/perf-contain-paint.json`.
- **Needed for safe retry:** containment must be applied only to a narrower non-resizing subtree or paired with a resize-state override that removes containment before the first resize frame.

## M3 resize lifecycle rAF coalescing

- **Attempted change:** coalesce `resize-runtime.js` pointermove `onMove` work to one `requestAnimationFrame`, while keeping the former interaction-scroll update immediate and flushing before its frames.
- **Why deferred:** the state-first cadence split still regressed the resize canary. `100`-object `resize-snap` worsened from `p95 29.9ms / max 179.9ms / 3 long tasks` to `p95 290ms / max 670ms / 67 long tasks`; `30`-object max also worsened from `69.9ms` to `180.3ms`.
- **KEEP behavior at risk:** resize-snap span and resize/collision cadence. The failure indicates the expensive reflow work is tied to pointer cadence and final flush timing more deeply than the shared lifecycle wrapper can safely separate.
- **Evidence:** `artifacts/perf-m3-resize-raf.json`.
- **Needed for safe retry:** extract explicit resize session state and split live-surface updates from sparse-grid reflow inside the panel/widget resize runtimes themselves, not only in the shared lifecycle wrapper.
