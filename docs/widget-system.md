# Widget System

## Purpose

The widget system defines every dashboard object that can be created, configured, rendered, placed, persisted, and connected through context. Widgets must preserve the existing dashboard visual language and participate in the universal grid unless explicitly locked.

## Universal Dashboard Object Rules

Every object should be treated as a dashboard object unless documented otherwise.

Objects include:

- Stat widgets
- Stat + Filter widgets
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

### Stat + Filter Widget

- Displays a tracked number.
- Emits a filter context when clicked.
- Example neutral behavior: a stat showing `5` for `status = red` emits `{ key: "status", value: "red" }`.
- Linked or inherited tables and graphs filter to matching rows.

### Graph Widget

Supports graph types that are reasonable for vanilla JS and the current stack:

- Line
- Bar
- Area
- Pie
- Donut
- Scatter
- Stacked bar
- Sparkline
- Histogram
- Timeline

Graph data must react to inherited and wired context. Graph rendering should resize cleanly inside the existing widget body with no overflow, jitter, or hard-coded colors.

### Table Widget

- Generic configurable table.
- Supports placeholder/demo data.
- Supports filtering from active context.
- Uses existing table-content styling when rendered inside or near panels.
- Must preserve readable spacing, alignment, and dark-mode contrast.

### Calendar Widget

- Generic calendar view.
- Supports inherited or wired context.
- Uses the same glass/panel styling and theme-aware controls.
- Must resize predictably.

### Timeframe Widget

- Reusable command-surface widget for dashboard time context.
- Supports configurable preset count, labels, ranges, refresh behavior, and layout mode.
- Example presets: Today, 7 Days, 30 Days, This Week, Last Quarter, Custom, Live, Refresh Interval.
- Supports compact mode, dropdown mode, and segmented-pill mode.
- Emits timeframe context such as `{ key: "timeframe", value: "last_7_days" }`.
- Can provide inherited timeframe context to panels and child widgets.
- Can participate in Engineer Mode wiring as a context source.
- Must remain theme-aware and avoid stretched toolbar composition.
- Default layout should be compact and modular, with grouped glass control clusters.

### Search Widget

- Reusable contextual search widget for keyword filtering inside the current dashboard, panel, or wired context.
- Searches generic data values, table rows, graph labels/categories, and contextual fields.
- Emits search context such as `{ key: "query", value: "keyword" }`.
- Consumes inherited context so searches can scope to a panel, linked widget, timeframe, category, or active filter.
- Supports contextual placeholder text and clear/reset actions.
- Must look like a floating glass capsule or compact pill control, not a browser-default search input.
- Must support compact and expanded configurations without breaking the Apple-glass rhythm.

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

## Data Binding Rules

- Widget renderers consume normalized data, not source-specific API responses.
- Data source selection, dataset/query selection, field mapping, filters, transforms, aggregations, and display formatting belong in widget config.
- Stat widgets may derive count, sum, average, min, max, distinct count, or calculated values from a binding.
- Graph widgets map fields to x-axis, y-axis, series, grouping, aggregation, and timeframe roles.
- Table widgets map fields to visible columns, sorting, filtering, grouping, pagination, and conditional formatting.
- Timeframe widgets map preset selections to timeframe context and optional query date ranges.
- Search widgets map keyword context to configured searchable fields.
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
- Implement stat filtering for table and graph widgets.
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
