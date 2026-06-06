# Hand-off: worker -> critic  (run 2026-06-05_increment-2-move-rungroupresize-onto_03e2, step 02)

## Task context
Increment 2 is a state-bound retry for the historically deferred `group-resize-runtime` cluster.

## What I did
Extended `createResizeSessionGeometry` with preview-entry, reflow-item, runtime-surface, and preview-map accessors. Rewired the in-place `runGroupResize` body to source preview members, start bounds, source maps, metrics maps, preview cols/rows, reflow items, and snapshots through that API. Added the deterministic select-mode multi-resize canary and kept hardened commit waits in the existing resize/move canary.

## Output / artifacts
- artifacts/resize-session-geometry-api.json  (new state module API)
- artifacts/group-resize-runtime-inventory.json  (2b dependency inventory and stop decision)
- artifacts/post-2a-canary-determinism.json  (10/10 post-2a canary proof)
- artifacts/post-2a-behavior-diff.json  (post-2a behavior equals baseline)

## Open questions / risks
The body move remains coupled to app.js-local behavior helpers for live surfaces, sparse reflow, footprint ghosts, panel/internal-grid sync, and commit/cleanup lifecycle. Moving it now would require broad DI across behavior bodies and risks repeating the known failed strategy.

## Recommended next step
Critic should verify 2a behavior neutrality and accept the stop-after-2a decision as `NEEDS-HUMAN` for 2b rather than claiming the full body move shipped.
