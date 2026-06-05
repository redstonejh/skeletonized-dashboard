# Deferred Perf Optimizations

## active-glass-lod
- Bottleneck: backdrop-filter/WebGL glass paint during active drag/resize and background switching.
- Attempt: disabled backdrop-filter on panel/widget surfaces and hid the liquid-glass WebGL canvas while body.panel-interaction-active/body.panel-resize-active was set.
- Result: rejected. It improved 30-object resize long tasks, but regressed edge-auto-scroll heavily (100-object p95 60.5ms -> 640.1ms, long tasks 6 -> 186) and worsened multiple collision/drag cases.
- Canary affected: edge-auto-scroll and collision/reflow perf canaries.
- Needed safe fix: isolate the WebGL/glass repaint loop with a targeted renderer pause/throttle that does not force layer invalidation across the full workspace.

## resize-raf-coalescing
- Bottleneck: resize/collision handlers process pointermove directly.
- Attempt: coalesced resize pointermove to requestAnimationFrame and flushed before pointerup.
- Result: rejected. It improved 100-object collision-heavy reflow (p95 190.2ms -> 40ms, long tasks 77 -> 9) but regressed resize-snap and edge-auto-scroll (30-object edge p95 30.4ms -> 260ms, long tasks 0 -> 169).
- Canary affected: resize-snap span and edge-auto-scroll timing/runway behavior.
- Needed safe fix: split resize geometry state and edge-scroll update cadence first, then coalesce only the expensive layout/reflow portion while preserving immediate scroll/runway updates.
