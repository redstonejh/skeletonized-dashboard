# Demo Simulation System

## Purpose

The demo simulation runtime proves the dashboard as a generic operational/business workspace without requiring a real backend, API key, database, or customer data. It is deliberately separate from widget renderers and layout mechanics.

Runtime files:

- `app/static/data-simulation-runtime.js`: deterministic data generation, reusable data transforms, safe expression evaluation, use-case matrix, and demo workspace preset definitions.
- `app/static/app.js`: registers the generated rows through the existing source-agnostic context/query adapter and exposes `window.dashboardDemoWorkspaceRuntime`.
- `app/static/widget-registry.js`: asks the demo runtime for widget demo data when no real context is resolved.

## Generated Data

The generator is seeded and repeatable. It produces related fake datasets for:

- customers/accounts
- sites and locations
- technicians
- work orders
- events
- assets/equipment
- inspections
- sensor readings
- revenue and costs
- inventory
- service requests
- project progress
- geospatial coordinates
- categorical summaries and status histories

Rows include ids, labels, timestamps, categories, status values, owners, coordinates, numeric values, relationships, missing/stale/warning states, outliers, negative values, and empty subsets.

## Transform Runtime

`window.dashboardDataTransformRuntime` provides reusable query utilities:

- field filters
- text/search-style contains filters
- equation filters
- calculated fields
- group-by aggregations
- count/sum/avg/min/max
- time bucketing by hour/day/week/month
- sorting and limiting
- threshold classification
- unit conversion
- stale-data detection
- safe expression evaluation

Expressions are parsed by a small deterministic evaluator. They do not call `eval`, construct functions, or execute arbitrary JavaScript. Supported examples include:

- `revenue - cost`
- `completed / total`
- `avg(responseTime)`
- `count(status = "Open")`
- `reading > threshold`
- `hoursSince(lastUpdated)`
- `value * conversionFactor`

Invalid expressions return widget/query error states through the existing query runtime instead of breaking layout.

## Widget Use-Case Matrix

The runtime exposes `window.dashboardDemoWorkspaceRuntime.useCaseMatrix()`.

Current coverage:

- Stat: aggregations, derived metrics, threshold and stale states.
- Table: entity lists, event logs, work orders, inventory, search/filter results, calculated columns.
- Chart: time series, category comparison, distributions, ratios, progress, grouped aggregates, time buckets.
- Map: fake site/field coordinates and status overlays.
- Filter/Search/Timeframe: context writers and dataset reducers.
- Calendar: dated work and inspection records.
- Text/Notes: explanations and operator notes through persisted config.
- Media: honest safe-reference empty/configured states.
- Activity Feed / AI Assistant / Context Inspector: local workspace meta state without external integrations.
- Data Filter / Shift: Engineer Mode proof surfaces for equations, logic, conversion, and conditional signals.

## Demo Workspace Presets

`window.dashboardDemoWorkspaceRuntime.applyPreset(presetId, options)` creates seeded data sources, root workspace context, widgets, panels, and panel-local widgets.

Current presets:

- `executive-overview`
- `operations-command-center`
- `maintenance-planning`
- `customer-success`
- `ai-scenario-analysis`
- `engineer-dataflow-demo`
- `panel-containment-stress`
- `geospatial-operations`
- `asset-health`
- `financial-forecasting`
- `alarm-analytics`
- `live-dispatch-board`

Preset layout objects are normal registry-backed widgets and panels. Data source rows are persisted only as demo data sources when a preset is intentionally applied. Transient widget query results are not written into widget config, panel child ownership, or saved layout snapshots.

## Layout Selector Integration

Demo and generated workspaces are first-class layout sources in the existing Layout selector. The selector groups saved user profiles, demo workspaces, AI generated examples, and generated history without adding a second launcher.

Selecting a demo workspace loads it into an isolated generated profile such as `demo:executive-overview`. This keeps user Layout 1-10 storage clean until the user explicitly presses Save, which copies the current generated workspace into the selected user layout slot. Generated profiles are reload-safe and editable, but they are separate from permanent saved layouts.

AI generated examples use the same layout-source path. They seed demo data, ask the local AI Workspace Operator to build a visual answer, persist that generated workspace under an isolated profile such as `ai-example:cost-reduction-scenario`, and register it in generated history for reopening.

## Validation Expectations

Automated checks should verify visible content, not DOM existence alone:

- titles and primary values are visible
- charts render SVG marks
- tables render rows and cells
- maps render coordinate markers
- panels retain panel-local child widgets after save/load
- calculated fields and equation filters alter the data result
- demo rows do not leak into widget config
- unknown widget fallback remains safe

## Known Limits

The demo runtime is local and deterministic. It is not a real data connector, scheduler, asset store, API client, permission system, or external AI integration. Media widgets still require safe configured URLs or asset references. Engineer dataflow evaluation is represented through generalized query/expression utilities and existing underlay widgets; it is not a noisy node-editor workflow.
