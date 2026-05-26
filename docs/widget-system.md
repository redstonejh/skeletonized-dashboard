# Widget System

## Purpose

The widget system defines every dashboard object that can be created, configured, rendered, placed, persisted, and connected through context. Widgets must preserve the existing dashboard visual language and participate in the universal grid unless explicitly locked.

## Universal Dashboard Object Rules

Every object should be treated as a dashboard object unless documented otherwise.

Objects include:

- Stat widgets
- Data Filter widgets
- Filter Control widgets
- Text / Notes widgets
- Region Summary widgets
- Image widgets
- Video widgets
- PDF / Document widgets
- Activity Feed widgets
- AI Assistant widgets
- Context Inspector widgets
- Graph widgets
- Table widgets
- Calendar widgets
- Timeframe or command-surface widgets
- Panels and context panels

Panels are dashboard objects, but they are not content types. Panels are layout containers that can eventually host widgets or content components. Tables, menus, notes, charts, and calendars should be modeled as widgets or panel content rather than inherent panel identities.

Default capabilities:

- Draggable
- Resizable where appropriate
- Pinnable
- Renameable
- Recolorable or theme-aware
- Hideable or deletable
- Configurable
- Persisted in layout profiles
- Eligible for context wiring when it emits or consumes context

If an object is non-resizable, locked, or non-deletable, that must be explicit in config, visible in UI where relevant, and documented.

## Initial Widget Types

### Stat Widget

- Displays a number or value.
- Supports configurable label, optional icon, optional theme/color variant.
- May emit context when clicked if configured as a source.
- Should use existing widget glass styling and compact content rhythm.

### Data Filter Widget

- First-class explicit dataflow widget for boolean/logical filtering and future transform chains.
- Exposes Engineer Mode input/output ports and stores the selected logical operator in widget config.
- Current modes are Logic Operator and Type Conversion. Logic Operator supports `AND`, `OR`, and `NOT`. Type Conversion stores source type, target type, conversion behavior, fallback behavior, and fallback/default value as one configurable mode rather than many one-off conversion widgets.
- Does not replace ambient spatial context inheritance; it consumes and emits explicit dataflow only.

### Chart Widget

The chart widget uses a shared chart runtime registry rather than one renderer branch. Each chart type declares its display name, category, required fields, supported aggregations, default config, renderer, and adaptive density behavior.

Current runtime-backed chart types:

- Basic comparison: bar, horizontal bar, grouped bar, stacked bar, lollipop
- Time series: line, multi-line, area, stacked area, sparkline
- Distribution: histogram, box plot hook
- Relationship: scatter, bubble, heatmap
- Composition: pie, donut
- Ranking/progress: gauge, radial progress, progress bar, KPI trend card

Chart data must react to inherited and wired context. Chart rendering should resize cleanly inside the existing widget body with no overflow, jitter, or source-specific logic. Advanced types such as treemap, candlestick, map, sankey, network, radar, sunburst, violin, density, correlation matrix, and geographic maps remain deferred hooks rather than dashboard-specific one-offs.

### Table Widget

- Generic configurable table.
- Supports placeholder/demo data.
- Supports filtering from active context.
- Uses existing table-content styling when rendered inside or near panels.
- Must preserve readable spacing, alignment, and contrast across background tones.

### Calendar Widget

- Generic calendar view.
- Supports inherited or wired context.
- Uses the same glass/panel styling and theme-aware controls.
- Must resize predictably.

### Timeframe Widget

- Reusable command-surface widget for dashboard time context.
- First-class widget type, available through the dashboard Add menu.
- Uses the shared widget shell, widget controls, drag/resize affordances, save/load persistence, and adaptive density rules.
- Supports configurable preset count, labels, ranges, refresh behavior, and layout mode.
- Current presets: Today, Yesterday, Last 7 days, Last 30 days, Month to date, Year to date, and Custom range.
- Supports compact mode, dropdown mode, and segmented-pill mode.
- Emits normalized timeframe context such as `{ preset: "last_7_days", start: "2026-05-19", end: "2026-05-25" }`.
- Can provide inherited timeframe context to panels and child widgets.
- Can participate in Engineer Mode wiring as a context source.
- Must remain theme-aware and avoid stretched toolbar composition.
- Default layout should be compact and modular, with grouped glass control clusters.
- Internal preset, selector, refresh, and calendar controls are compact pressable controls and should depress on hover/active while the outer widget body keeps large-object hover presence.

### Search Widget

- Reusable contextual search widget for keyword filtering inside the current dashboard, panel, or wired context.
- Searches generic data values, table rows, graph labels/categories, and contextual fields.
- Emits search context such as `{ key: "query", value: "keyword" }`.
- Consumes inherited context so searches can scope to a panel, linked widget, timeframe, category, or active filter.
- Supports contextual placeholder text and clear/reset actions.
- Must look like a floating glass capsule or compact pill control, not a browser-default search input.
- Must support compact and expanded configurations without breaking the Apple-glass rhythm.

### Filter Control Widget

- Reusable contextual filter widget for the current workspace region or panel-local context.
- Emits normalized `ContextFilter` objects from scoped widget state rather than hardcoding data-source behavior.
- Supports text search, dropdown/category, multi-select, number range, date range, and boolean toggle controls.
- Uses semantic mappings when explicit fields are not configured.
- Adapts from one compact control at small sizes to stacked controls and richer filter panels at larger sizes.
- Filter config is saved with widget layout state and participates in undo/redo as a normal widget edit.

### Text / Notes Widget

- First-class widget type for user-authored notes, labels, explanations, and lightweight documentation.
- Stores editable plain text in widget config rather than a separate object store.
- Works as a normal widget in the main workspace and panel-local grids, including drag, resize, pin, duplicate/copy, delete, save/load, and undo/redo.
- Treats non-empty note text as meaningful content for smart delete confirmation.
- Uses adaptive density: compact preview at small sizes, editable note body at medium sizes, and a roomier document/card treatment at larger sizes.

### Region Summary Widget

- First-class spatial awareness widget for summarizing the current divider-defined region.
- Reads committed spatial region metadata through the dashboard spatial runtime rather than raw data-source details.
- Shows the inherited region name, row range, nearby widget/panel/anchor counts, and inherited data-source label when available.
- Works as a normal widget in the main workspace and panel-local grids, including drag, resize, pin, duplicate/copy, delete, save/load, and undo/redo.
- Does not participate in anchor rail behavior, mini-map rendering, or special collision logic beyond its own normal widget footprint.

### Media / Rich Content Widgets

- Image, Video, and PDF / Document widgets are normal registry-backed widgets for visual references, embedded media, and inline document references.
- Source references, captions, fit mode, playback/embed metadata, document type, page, and text content live in widget config and persist through the same save/load, copy/paste, and undo/redo paths as other widgets.
- Image widgets support `contain`, `cover`, `fill`, and `center` fit modes.
- Video widgets support direct video URLs/data references and safe YouTube/Vimeo embed conversion through sandboxed iframe previews.
- PDF / Document widgets support sandboxed document previews and text/markdown content previews without executing arbitrary scripts.
- Upload UI and durable file storage are intentionally deferred until the app has a real asset system; saved media widgets should use persistent URLs or app-owned asset references, not raw temporary blob URLs.

### System / Meta Widgets

- Activity Feed, AI Assistant, and Context Inspector widgets are normal registry-backed widgets for workspace-aware operational surfaces.
- Activity Feed shows recent local workspace activity such as creation, deletion, save/load, history, mode, config, and context-update events. The widget persists its config, while transient event history remains runtime state unless a future persisted activity log is added.
- AI Assistant is a local placeholder only. It resolves the current workspace/region/panel/selection scope and displays the context it would use, but it does not call external AI APIs.
- Context Inspector is Engineer Mode only. The widget is hidden in normal user mode and shows resolved context, region inheritance, active filters, time range, data source, semantic mapping, selected-object metadata, and region debug info when Engineer Mode is active.

### Panel Containers

- Collapsible container.
- Current panels are blank layout containers with title, color, collapse, pin, drag, resize, grouping, and persistence behavior.
- Tables, menus, notes, charts, calendars, and similar experiences should be modeled as widgets or content components, not as panel identities.
- Future panel nesting may allow child widgets inside panels.
- Future context inheritance may let panels provide context scope to children and receive attached context pills through header/chevron drop behavior.
- Do not expose a separate "Context Panel" create-menu item until it has distinct server-backed behavior and persistence semantics.

## Widget Configuration

Use neutral config terms:

- `id`
- `type`
- `title`
- `label`
- `icon`
- `themeVariant`
- `dataSource`
- `dataset`
- `query`
- `fieldMap`
- `transforms`
- `aggregations`
- `computedFields`
- `display`
- `presets`
- `range`
- `refresh`
- `placeholder`
- `emittedContext`
- `consumedContext`
- `filterBindings`
- `capabilities`
- `layout`

Avoid domain terms such as alert, severity, threat, incident, client, mailbox, vendor, scanner, webhook, or scoring.

## Lifecycle

1. Registry defines the widget type, defaults, capabilities, renderer, and config schema.
2. User creates the widget from the GUI.
3. Widget receives a stable id and default layout.
4. Renderer builds DOM from state.
5. Grid engine places the widget.
6. Data binding resolves the widget's source, query, field mapping, transforms, aggregations, and formatting.
7. Context engine subscribes the widget to inherited and wired context.
8. Widget emits context through configured interactions.
9. Persistence saves widget config, layout, panel membership, data binding, context links, and theme state.

## Runtime Contract

The phase-2 foundation now lives in `app/static/widget-registry.js`. The registry owns widget definitions and renderers, while `app/static/app.js` continues to own the shared dashboard shell, grid placement, drag, resize, settings controls, save/load, and context resolution lifecycle.

Each registry definition includes:

- `type` and `displayName`
- `layer`, currently `presentation`, `backend`, or `both`
- `defaultSize` and `minSize`
- `capabilities` such as reading context, writing context, requiring a data source, filters, time range, and resize support
- `supportedSettings`
- `queryRequirements`
- `getDefaultConfig()`

Presentation-layer widgets are the normal visible dashboard surface. Backend-layer widgets are Engineer Underlay objects: they are hidden in Normal Mode, visible only while Engineer Mode is active, and still use the same widget registry, grid geometry, config persistence, undo/redo, and save/load mechanics as presentation widgets. Current backend widgets are Data Filter and Context Inspector. Legacy Stat Filter and Logic Gate concepts resolve through Data Filter aliases/config, and Type Conversion is a Data Filter mode rather than a separate widget. Future Sort, Join, Transform, Query/API/SQL, JSON/data inspector, conditional styling processor, and normalization widgets should be registered as `layer: "backend"` unless their primary job is to show information directly to the user. Dataflow wires remain explicit `output -> input` routes in the underlay and must not replace ambient divider/panel context inheritance.
- optional `resolveQuery(config, resolvedContext)`
- `render({ instance, definition, resolvedContext, data, status })`

Current registry-backed types:

- `stat`
- `timeframe`
- `search`
- `filter`
- `text`
- `region-summary`
- `image`
- `video`
- `document`
- `activity-feed`
- `ai-assistant`
- `context-inspector`
- `data-filter`
- `shift`
- `table`
- `chart` with `graph` as the add-menu alias
- `calendar`

Widgets resolve inherited workspace context first, then ask their registry definition for a neutral `ContextQuery`. Data-bound widgets query through the source-agnostic context adapter layer and render normalized `DataResult` rows. The Stat widget is the first canonical metric consumer: it resolves semantic value/date/filter context, queries through the adapter layer, computes count/sum/average/min/max metrics, and renders empty, loading, ready, error, and no-data states through the shared widget surface. The Filter Control widget emits normalized `ContextFilter` objects into its current region so sibling Stat, Table, Chart, and future data-bound widgets react through the same context query path. The Time Range Control widget emits a normalized `timeRange` into its current region from presets or custom start/end dates, using the semantic date field at query time. The Text / Notes widget is the first authored-content widget: it stores plain text in widget config while preserving normal widget interaction and persistence behavior. The Region Summary widget reads committed divider-region metadata through `window.dashboardSpatialRuntime` and renders a lightweight local overview without querying raw data. Image, Video, and PDF / Document widgets are first-class rich-content widgets: they store persistent URL/reference config, captions, fit/page/playback settings, and safe preview state in normal widget config while preserving drag, resize, pin, copy/paste, delete, save/load, and panel containment behavior. Activity Feed, AI Assistant, Context Inspector, Data Filter, and Shift widgets read or configure workspace meta/computational state without becoming special dashboard objects; Data Filter stores either logical operator config or type-conversion config and exposes normal Engineer Mode input/output ports, while Shift consumes explicit incoming dataflow signal state to transition between configured State A/State B material states. The Table widget is the first row-based consumer: it resolves configured or semantic columns, queries filtered/time-ranged rows, adapts visible row and column density to widget size, and works in both the main workspace and panel-local grids. The Chart widget uses `window.dashboardChartRuntime` to choose a chart definition, resolve semantic/configured fields, query normalized rows, aggregate where needed, and render adaptive SVG chart surfaces for comparison, time-series, distribution, relationship, composition, and progress views. Unknown widget types render a generic unsupported-widget state instead of throwing or corrupting layout.

The registry is intentionally not responsible for dashboard interaction mechanics. Adding a future widget type should require adding a registry definition and targeted tests, not editing drag, resize, collision, save/load, or panel containment code.

## Data Binding Rules

- Widget renderers consume normalized data, not source-specific API responses.
- Data source selection, dataset/query selection, field mapping, filters, transforms, aggregations, and display formatting belong in widget config.
- Stat widgets may derive count, sum, average, min, max, distinct count, or calculated values from a binding.
- Chart widgets map fields to x-axis, y-axis, series, size, color, grouping, aggregation, and timeframe roles through the chart runtime registry.
- Table widgets map fields to visible columns, sorting, filtering, grouping, pagination, and conditional formatting.
- Time Range Control widgets map Today, Yesterday, Last 7 days, Last 30 days, Month to date, Year to date, and Custom range selections to normalized context `timeRange` values.
- Search widgets map keyword context to configured searchable fields.
- Filter Control widgets map UI controls to normalized text, equality, multi-value, range, date, and boolean context filters.
- Text / Notes widgets map user-authored plain text to widget config only; future markdown support should remain inside the widget runtime contract.
- Region Summary widgets map committed spatial/divider metadata to a visual overview only; they do not duplicate inherited context into widget config.
- Image, Video, and PDF / Document widgets map user-provided source references to sanitized media/document previews in widget config. Upload persistence is deferred until a durable asset system exists; temporary blob URLs should not be treated as saved layout state.
- Activity Feed widgets map transient local workspace events to a visual log while persisting only display config.
- AI Assistant widgets map resolved context and current scope to a non-functional placeholder surface; external AI integration is intentionally deferred.
- Context Inspector widgets map resolved context and region metadata to Engineer Mode debug output only.
- Context filters must pass through the data/query layer rather than being duplicated in each widget renderer.
- Formula and computed-field support must be sandboxed and must not evaluate arbitrary JavaScript.

## Rendering Rules

- Rendering must be deterministic from state.
- Do not store hidden widget state only in DOM attributes.
- Do not duplicate panel and widget control logic.
- Do not create new visual language for widget content.
- Use existing glass, pill, icon button, menu, popover, and theme token patterns.
- Widget controls must keep the same icon alignment and hover behavior as existing panel/widget controls.

## Adding A New Widget Type

1. Add a registry entry with type id, label, default title, default size, min size, capabilities, config defaults, and renderer.
2. Add neutral placeholder/demo data if needed.
3. Add context capabilities only if the widget can emit or consume context.
4. Add Playwright tests for create, render, drag, resize, pin, delete, save/load, theme behavior, and any context behavior.
5. Update this document if the type introduces new capabilities.

## Implementation Plan

### Phase 2 Foundation

- Create `widget-registry.js`.
- Move widget type defaults out of scattered DOM logic.
- Normalize current placeholder widgets into registry-backed types.
- Keep class names and visual output stable.

### Phase 3 Context Integration

- Add `emitsContext` and `consumesContext` capabilities.
- Implement Data Filter output for table and graph widgets.
- Display active and inherited context indicators.
- Add local demo-data bindings so stat, table, and graph widgets share one query/filter path.
- Add Timeframe Widget context emission and query integration.
- Add Search Widget keyword context emission and field binding.

### Phase 4 Engineer Mode Integration

- Add source/target handles based on widget capabilities.
- Allow explicit links from stat widgets to tables, graphs, calendars, and panels.

### Phase 6 Test Gate

- Each widget type must pass create, move, resize, pin, delete, persistence, context, and screenshot coverage before being considered stable.

### Future Data Binding Gate

- Each data-bound widget must pass source selection, dataset/query selection, field mapping, aggregation, filtering, formula validation, context updates, persistence, and error-state tests.
