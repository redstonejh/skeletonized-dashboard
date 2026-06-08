# Hand-off: planner -> worker  (run 2026-06-08_default-widget-visuals, step 02)

## Task context
Remove widget prompt fallbacks while preserving library-backed renderers.

## What I did
Mapped 11 registered widget definitions and all `widgetHint` call sites.

## Output / artifacts
- artifacts/widget-defaults-inventory.json (final type/default map)

## Open questions / risks
Do not remove ECharts, Leaflet, TanStack, Monaco, wells, or the data.rows seam.

## Recommended next step
Patch widget defaults and test coverage.

