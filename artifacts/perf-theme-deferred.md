# Deferred Theme Switch Optimization

## photo-background switch decode/compositor path
- Cost: 30-object baseline p95 270.1ms; 100-object baseline includes long tasks and max frame 919.6ms.
- Dominant trace evidence: `RunTask`, `EventHandler::handleMousePressEvent`/`handleMouseReleaseEvent`, compositor commit, and repeated `GpuImageDecodeCache::DecodeImage` events even after JS Image decode/prewarm attempts.
- Attempts made and reverted: hover preview coalescing, image src/decode preload, offscreen CSS prewarm, and img-panel substitution. None reliably met p95 <= 16.67ms with zero long tasks.
- KEEP behavior risk: a deeper fix likely requires changing photo backdrop rendering or the has-photo/data-background CSS invalidation path, which needs full computed-CSS parity across every background and glass surface.
- Needed safe fix: design a photo renderer that keeps decoded compositor resources resident without changing the resting CSS/glass look, then validate with full theme/background computed-CSS parity.
