# Dashboard Data Seam Audit

Date: 2026-06-08

Scope: static audit of the skeletonized Electron dashboard client. No backend, network client, or dataflow engine was added.

## Executive Summary

The dashboard already has a primary widget render seam:

1. `app/static/widget-registry.js` registers widget definitions.
2. `app/static/widget-runtime.js` builds a widget instance from the DOM.
3. `renderRuntimeContent(widget, { data })` scopes row data through the active page timeframe.
4. `registry.renderWidget(definition, { instance, data })` calls each definition's `render({ instance, data })` or `renderContent({ instance, data })`.

This pass makes that seam sufficient for future backend-fed data by adding one client-side ingestion interface and removing the remaining row-data bypasses:

- `window.dashboardWidgetDataRuntime.ingest(payload)` is the single future backend entry point. It accepts widget-keyed, type-keyed, and default data and refreshes widgets through the normal render seam.
- `window.dashboardWidgetDataRuntime.queryAllWidgets()` exposes query descriptors derived from each widget definition and config, so a future backend layer can inspect what each widget needs before fetching.
- `stat` now calculates from injected row data instead of only from `config.value`.
- `table` no longer substitutes baked sample rows when injected rows are empty.
- `region-summary` can render from injected summary data before falling back to the local spatial runtime.

## Unified Client-Side Ingestion Point

Future backend integration should push already-fetched data into the renderer through:

```js
window.dashboardWidgetDataRuntime.ingest({
  widgets: {
    widgetKey: { rows: [...] }
  },
  types: {
    chart: { rows: [...] }
  },
  default: { rows: [] }
});
```

Resolution order for a widget render is:

1. Explicit `renderRuntimeContent(widget, { data })`.
2. Data stored for the widget key.
3. Data stored for the widget context override id.
4. Data stored for `type:<widgetType>`.
5. Data stored for `*`.
6. The instance's existing `data` object.
7. `{ rows: [] }`.

The payload is normalized to `{ rows: [...] }` while preserving extra metadata such as `schema`, `summary`, or source-specific fields.

The query-planning seam is:

```js
window.dashboardWidgetDataRuntime.queryAllWidgets();
window.dashboardWidgetDataRuntime.queryForWidget(widgetElement);
window.dashboardWidgetRuntime.dataRequestForWidget(definition, instance);
```

The descriptor includes widget id, type, category, capabilities, config, query-affecting settings, field names, and active timeframe.

## Timeframe Flow

The timeframe widget writes page-level client state. `app.js` stores the active range per layout, then refreshes widgets. During render, `scopedDataForTimeRange(data, timeRange, definition)` filters `data.rows` for widgets whose definition declares `capabilities.supportsTimeRange`.

The date field comes from the timeframe range's `field` when present, otherwise from common row fields such as `date`, `time`, `timestamp`, `createdAt`, and `updatedAt`. A backend integration can either fetch pre-scoped rows using `queryAllWidgets()` descriptors or push broad rows and let the renderer apply the client-side timeframe filter.

## Widget Matrix

| Widget type | Data entry seam | Expected data shape | Config to query mapping | Gaps / status |
| --- | --- | --- | --- | --- |
| `stat` | `definition.renderContent({ instance })` receives `instance.data` from `renderRuntimeContent`. | `{ rows: [{ [valueField]: number, date?: string }] }`. `count` counts rows; `sum`, `avg`, `min`, and `max` aggregate `valueField` or `value`. | `metric`, `valueField`, `calculatedFields`, and `equationFilters` are query-affecting fields. Timeframe applies because the widget supports time ranges. | Fixed: it now uses injected rows and only falls back to `config.value` when no aggregate can be computed. |
| `chart` / eCharts | `chart` passes `instance.data.rows` into chart definitions and body mounting. | `{ rows: [{ [xField], [yField], [seriesField]?, [sizeField]?, date?: string }] }`. | `chartType`, `xField`, `yField`, `seriesField`, `aggregation`, `calculatedFields`, `equationFilters`, `timeBucket`, and `limit`. | Good seam. All chart variants share the same row model. |
| `table` | `definition.render({ instance })` and `mountTableBodyRenderer` read `instance.data.rows` and optional `instance.data.schema.fields`. | `{ rows: [record], schema?: { fields: string[] \| { key/name }[] } }`. | `columns`, `calculatedFields`, `equationFilters`, `limit`, `sortBy`, and `sortDirection`. | Fixed: baked `DEFAULT_TABLE_ROWS` fallback was removed, so empty backend rows render as empty rows rather than samples. |
| `map` | `render` and `mountBodyRenderer` call `mapExtractPoints(instance.data, config, ...)`. | `{ rows: [{ [latitudeField]: number, [longitudeField]: number, [locationField]?: string, value?: number, category?: string, date?: string }] }`. | `latitudeField`, `longitudeField`, `locationField`, `layerType`, and `limit`. | Good seam for points. Region/route/heatmap semantics are still represented by `layerType`; a future backend can specialize the returned rows for that layer. |
| `calendar` | `mountBodyRenderer` calls `calendarExtractEvents(instance.data, config, ...)`. | `{ rows: [{ [dateField]: date string, [labelField]?: string, state?: string }] }`. | `dateField`, `labelField`, and `limit`; timeframe applies. | Good seam. Static current-month markup is only the pre-mount shell; hydrated events use injected data. |
| `timeframe` | Control widget, not a backend row consumer. It writes shared page timeframe state. | N/A for rows. Config contains selected filter/preset/custom range. | Filter config resolves to `{ start, end, field, preset, label }`, which scopes visualization data. | No backend gap; future backend code should consume query descriptors containing the active timeframe. |
| `text` | Config-driven render seam. | No row data required. Text is `config.body`; title/placeholder are config. | `title`, `body`, and `placeholder` are content/config, not query fields. | Acceptable: backend population would update widget config or call the same render seam with config changes, not row data. |
| `image` | Config-driven media render seam. | No row data required. Uses `src`, `alt`, `caption`, `fit`, and well tone config. | Media source fields are config/asset fields, not row query fields. | Acceptable: future backend can populate config/asset values. |
| `video` | Config-driven media render seam. | No row data required. Uses `src`, `embedType`, `autoplay`, `muted`, and `caption`. | Media source fields are config/asset fields, not row query fields. | Acceptable: future backend can populate config/asset values. |
| `document` | Config-driven media/document render seam. | No row data required. Uses `src`, `documentType`, `currentPage`, `content`, and `caption`. | Media/content fields are config/asset fields, not row query fields. | Acceptable: future backend can populate config/asset values. |
| `region-summary` | `definition.render({ instance })` now checks `instance.data.summary` or the first row before using `dashboardSpatialRuntime`. | `{ summary: { id, label, widgets, panels, startRow, endRow } }` or `{ rows: [{ id, label, widgets, panels, startRow, endRow }] }`. | No query fields currently; it is a summary/context widget. | Fixed: a backend can now inject a summary through the same data seam. Local spatial runtime remains a fallback. |
| `unsupported` | Unsupported visual render only. | N/A. | N/A. | No backend seam expected beyond unsupported metadata. |

## Chart Variants

The `chart` definition covers bar, horizontal/grouped/stacked bar, line, multi-line, area, stacked-area, pie, donut, scatter, bubble, histogram, heatmap, radial progress, gauge, KPI trend, and sparkline through the shared chart row seam. These variants differ only in how they interpret fields and aggregation:

- Category/series charts use `xField`, `yField`, optional `seriesField`, and `aggregation`.
- Scatter/bubble use numeric `xField`, `yField`, and optional `sizeField`.
- Histogram, gauge, radial progress, KPI trend, and sparkline use the configured value field.
- Heatmap uses `xField`, `seriesField`, and `yField` as cell axes/value.

## Remaining Boundaries

- This is still a client-only seam. There are no network calls, API clients, or backend dataflow processes.
- Media and text widgets are intentionally config/content widgets rather than row-data widgets. A future backend can still populate them by updating widget config or by extending the ingestion contract to include config patches, but they do not need `{ rows }`.
- Query descriptors are declarative. They describe what each widget needs; they do not execute requests.
- Client-side timeframe filtering remains available even if a future backend also pre-filters rows.

## Static Review Result

The data seam is now consistent for row-backed widgets, control widgets, and config-backed content/media widgets:

- Row-backed widgets receive data through `renderRuntimeContent` and `definition.render({ instance, data })`.
- One in-memory ingestion point can populate all widgets by widget key, context key, type, or default feed.
- One query descriptor path exposes config-to-query information from the registry.
- No hardcoded sample rows remain in the table path.
