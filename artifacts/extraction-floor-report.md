# Extraction Floor Report

Date: 2026-06-05

Verdict: DONE-AT-DOCUMENTED-FLOOR

## Decision

The ES-module split has reached the documented floor for the current architecture. No new extraction was attempted in this pass.

`artifacts/deferred-extractions.md` is now treated as a permanent do-not-retry list for the previously failed factory/dependency-injection extraction attempts. Retrying those clusters with the same approach is considered a workflow bug because parity already rejected them.

`artifacts/app-core-map.md` accounts for 100% of `app/static/app.js` and provides the coupling/canary map for future work. Future extraction work must start with a state-first strategy, such as extracting a shared interaction-state, widget-tool-session, panel-tool-session, or resize-geometry module before peeling any deferred behavior cluster.

## 2026-06-05 State-First Increment

The floor moved: `app/static/modules/interaction-state.js` now owns the first shared interaction state spine. This pass moved tool/session state ownership only; it did not retry any deferred behavior-body cluster.

- `app/static/app.js` line count before this increment: 5270
- `app/static/app.js` line count after this increment: 5263
- New state API: `createWidgetToolSession`, `createPanelToolSession`, `createResizeSessionGeometry`
- Pre-edit resize/pin canaries: 10/10 green after replacing fixed pointer-drag sleeps with commit waits
- Post-edit resize/pin/drag/save canaries: 10/10 green
- MAW run: `runs/2026-06-05_state-first-interaction-state-extraction_2d67`

## 2026-06-05 Increment 2a Resize-Session Extension

The floor moved only at the state-spine layer. `createResizeSessionGeometry` now owns the group-resize preview entries, derived preview member/start-bound/source/metrics maps, reflow item list, preview cols/rows, snapshots, and runtime surface handles. `runGroupResize` still lives in `app/static/app.js`; `group-resize-runtime` remains deferred until the remaining app.js-local behavior dependencies are reviewed and moved without a body-first factory/DI retry.

- Added canary: deterministic select-mode multi-resize commit check
- Pre-edit canaries: 10/10 green with two matching behavior baselines
- Post-2a canaries: 10/10 green
- Behavior diff: post-2a baseline hash matches pre-edit baseline
- MAW run: `runs/2026-06-05_increment-2-move-rungroupresize-onto_03e2`

## 2026-06-05 Increment 3b Primitive Rewire Shipped

The floor moved for the primitive delegate layer. `app/static/app.js` no longer owns named delegate closures for panel span/position/height or widget tools/span/position primitives. Panel consumers bind directly to `panelRuntime` methods, widget consumers bind directly to `widgetRuntimeController` methods, and `initializePanelRuntimes` now binds panel containment after creating `panelRuntime` so the previous init order remains intact.

- Completed clusters: `panel-core-primitives`, `widget-primitive-runtime`
- `app/static/app.js` line count after this increment: 5240
- Added canaries: widget resize-snap, widget tools-init/action
- Phase A canaries: 10/10 green after widget oracle hardening
- Final canaries: 10/10 green
- Resistance: panel `applyPanelSpan`, widget `applyWidgetSpan`, app init `ensureTools`, and runtime `ensureTools` no-op mutations were all caught
- MAW run: `runs/2026-06-05_increment-3b-close-widget-resistance_d428`

## Current State

- `app/static/app.js` line count: 5323
- `app/static/modules/*.js` count: 62
- `app/static/app.js` SHA256: `C3458D3B2F97E1D076983CEE875A69420D67CC07F00F0ADB3D1DCE41A0030E4C`
- Core coverage artifact: `artifacts/app-core-map.md`
- Deferred cluster artifact: `artifacts/deferred-extractions.md`

## Permanent Do-Not-Retry Clusters

Do not retry these with the same factory/DI extraction strategy:

- `ordered-drag-runtime`
- `widget-layout-lifecycle`
- `panel-layout-lifecycle`
- `group-resize-runtime`
- `conditional-style-runtime`
- `widget-runtime-meaning-hydration`
- `panel-core-primitives`
- `ordered-grid-items-runtime`
- `widget-primitive-runtime`
- `widget-content-runtime`
- `mixed-context-query-compatibility`

## Stop Condition

No unattempted, non-deferred, cohesive extraction remains that is both large enough to materially reduce `app.js` and safe to attempt without first introducing shared state/session modules. This pass therefore terminates without extraction.

## Required Canary Before Any Future Extraction

Before any future attempt, keep these canaries green:

- Electron e2e: `npm run test:e2e`
- MAW preserve-parity against the frozen interaction baseline, especially:
  - resize-snap span and height
  - panel pin toggle
  - drag live ghost
  - grid snap
  - collision/reflow
  - save/reload identical

