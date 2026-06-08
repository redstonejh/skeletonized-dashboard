# Strip Backend Gating; Keep Viz Libs

Task: remove legacy backend/config gating from visualization widgets while preserving ECharts, TanStack Table, Monaco, Leaflet, wells, and the config/data seam.

Acceptance result: SHIP

## Final result summary

Acceptance verdict: SHIP

The chart/table/map/code renderers mount their real library surfaces with empty default data and no legacy required-field/data-source prompt. The render path accepts `data.rows` through `renderRuntimeContent(..., { data })` / registry props for future real data wiring.
