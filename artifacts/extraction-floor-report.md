# Extraction Floor Report

Date: 2026-06-05

Verdict: DONE-AT-DOCUMENTED-FLOOR

## Decision

The ES-module split has reached the documented floor for the current architecture. No new extraction was attempted in this pass.

`artifacts/deferred-extractions.md` is now treated as a permanent do-not-retry list for the previously failed factory/dependency-injection extraction attempts. Retrying those clusters with the same approach is considered a workflow bug because parity already rejected them.

`artifacts/app-core-map.md` accounts for 100% of `app/static/app.js` and provides the coupling/canary map for future work. Future extraction work must start with a state-first strategy, such as extracting a shared interaction-state, widget-tool-session, panel-tool-session, or resize-geometry module before peeling any deferred behavior cluster.

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

