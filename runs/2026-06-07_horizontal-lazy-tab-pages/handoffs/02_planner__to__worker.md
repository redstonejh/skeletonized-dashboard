# Hand-off: planner -> worker  (run 2026-06-07_horizontal-lazy-tab-pages, step 02)

## Task context
Implement per-tab page state without reintroducing layout profiles.

## What I did
Outlined a runtime that keeps one live page mounted, persists tab/page snapshots together, and reinitializes layout runtimes only for the active page.

## Output / artifacts
- `agents/planner.md` summarizes the plan.

## Open questions / risks
Existing panel hydration still reads the legacy layout store, so tab 1 compatibility must be preserved carefully.

## Recommended next step
Implement the tab hooks, page runtime, save/load integration, and e2e canary.
