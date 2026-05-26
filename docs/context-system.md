# Context System

## Purpose

The context system lets widgets and panels share generic state such as filters, selected values, categories, timeframe, row selections, and emitted widget state. Context must remain neutral and must not reference any domain-specific monitoring concepts.

## Vocabulary

- `context`: Generic state that can affect one or more dashboard objects.
- `filter`: A context value used to narrow data.
- `value`: The selected or emitted value.
- `category`: A key or grouping name for a value.
- `source`: Object that emits context.
- `target`: Object that consumes context.
- `link`: Explicit connection between a source and target.
- `scope`: Boundary that owns inherited context, usually a panel.
- `inheritedContext`: Context received from a parent scope.
- `emittedContext`: Context produced by a widget or panel.
- `activeContext`: Context currently applied to a widget or scope.
- `queryContext`: Context values passed into a widget data binding or query definition.
- `timeframeContext`: A context value describing the active time range or refresh mode.
- `searchContext`: A context value describing an active keyword or scoped text query.

## Core Models

### ContextScope

A scope owns context for a region of the dashboard. Panels are the primary scope.

Fields:

- `id`
- `ownerId`
- `ownerType`
- `parentScopeId`
- `activeContext`
- `attachedContext`

### ContextValue

Represents one generic context entry.

Fields:

- `id`
- `key`
- `value`
- `label`
- `sourceId`
- `sourceType`
- `scope`
- `createdAt`

### ContextLink

Represents explicit wiring between source and target.

Fields:

- `id`
- `sourceId`
- `targetId`
- `contextKeys`
- `enabled`
- `createdAt`

### FilterBinding

Maps a context value to a widget data field.

Fields:

- `id`
- `widgetId`
- `contextKey`
- `dataField`
- `operator`

## Propagation Rules

- Widgets inside a panel inherit that panel's active context.
- Panel collapse state must not stop context propagation.
- A stat inside a panel may emit context to sibling widgets in that panel.
- Explicit links can pass context from one widget or panel to another.
- Wired context and inherited context should merge deterministically.
- If context values conflict, use a documented precedence order.

Recommended precedence:

1. Direct widget selection
2. Explicit wired context
3. Panel attached context
4. Parent inherited context
5. Dashboard/global context

## Source-Agnostic Spatial Context

The workspace now has a phase-1 source-agnostic context foundation. Context records can reference a generic `DataSource` by id and carry `SemanticMapping` rules that describe what source fields mean to the workspace. Widgets resolve context dynamically from their current spatial region and query through the adapter registry instead of hard-coding CSV, JSON, API, SQL, or other source behavior.

Spatial inheritance rules:

- Dividers define workspace regions.
- Each region can own a `WorkspaceContext`.
- Widgets inherit the root context, then the current divider region context, then any local object context.
- Moving a widget across a divider changes its resolved context without copying context into widget state.
- Save/load and live undo snapshots include data sources and workspace contexts alongside widgets, panels, dividers, and anchors.

Debug visibility is available through `window.dashboardContextEngine` and Engineer Mode. Context labels, inherited-context badges, region hints, and other physical context visualizations are hidden in normal mode and are revealed only while Engineer Mode is active. The debug API can register adapters, set data sources, set workspace contexts, resolve a widget's context, introspect a context schema, and query through the resolved adapter contract.

## Panel Context Inheritance

Panels are context scopes.

- A filtered panel passes its context to child widgets.
- A context pill attached to a panel header becomes panel context.
- Child widgets show an inherited context indicator when a panel context affects them.
- Removing a panel context pill clears that inherited filter from children.
- Moving a widget out of a panel removes inherited panel context unless an explicit link remains.
- Future spatial regions may also become context scopes, but they must use the same deterministic propagation model as panels.

## Spatial Context Navigation

In a future pan-and-zoom workspace, context should remain understandable at every zoom level.

- Zoomed-out views should show region, panel, group, and link-level context summaries.
- Zoomed-in views should show widget-level active context, clear actions, and field-level indicators where useful.
- Camera focus actions may navigate to context sources, affected targets, or downstream links.
- Panning or zooming must never change committed context state.
- Collapsing a spatial region or panel must not break context propagation.

## Data Filter Flow

1. Data Filter widget is configured with a mode such as Logic Operator or Type Conversion.
2. Engineer Mode dataflow links route explicit output signals/data into the filter input.
3. The filter produces a normalized output signal/data shape for downstream widgets.
4. Table, chart, stat, and future transform widgets can consume that output through explicit dataflow.
5. Active filter indicators appear only where the resulting data/query state requires them.
6. User clears or rewires the explicit dataflow/filter chain without mutating ambient divider context.

Type Conversion is one Data Filter mode. It stores source type, target type, conversion behavior, fallback behavior, and fallback/default value in widget config so conversions such as string-to-boolean or float-to-integer remain one configurable dataflow object rather than separate widgets.

## Timeframe Context Flow

1. Timeframe Widget is configured with presets, labels, ranges, and refresh behavior.
2. User selects a preset, custom range, live mode, or refresh interval.
3. Context engine emits a neutral timeframe context value.
4. Linked widgets, inherited panel children, and wired downstream targets receive the timeframe context.
5. Data-bound widgets pass the timeframe into their query bindings.
6. Active timeframe indicators appear on affected widgets or panels.
7. Clearing or changing timeframe recomputes query context deterministically.

Example:

```json
{ "key": "timeframe", "value": "last_30_days", "label": "30 Days" }
```

## Search Context Flow

1. Search Widget receives typed keyword input or a selected token.
2. The widget emits search context scoped to the dashboard, a panel, or explicit links.
3. Tables filter rows, graphs filter labels/categories/series, stats recompute against filtered data, and panels can pass the search context to children.
4. Clear/reset removes the search context and restores downstream widgets.

Example:

```json
{ "key": "query", "value": "example", "label": "Search: example" }
```

Search context must not behave like a generic global web search. It should resolve through inherited and wired dashboard context.

## Query Integration

- Context is not a separate data system. It should become query input for widgets with data bindings.
- A context value may map to a field filter through `FilterBinding`.
- Query results should be recomputed from committed context state, not from hover state or transient DOM state.
- Context-driven query updates must be deterministic and reversible.
- Clearing context must invalidate or refresh affected query results.
- Timeframe and search context must use the same propagation and query-binding path as explicit filter outputs.

## Chevron/Header Drop Behavior

Users can drag a Stat or Data Filter widget onto a panel chevron/header context target.

Expected behavior:

- Valid drop attaches the stat's emitted context to the panel.
- Attached context appears as a compact pill or badge near the panel header.
- Widgets inside the panel inherit the attached context.
- Removing the pill clears the panel-attached context.
- Invalid drops are gracefully rejected with no layout corruption.

This interaction should be direct and polished, not modal-first.

## UI Affordances

Use existing Apple-glass controls:

- Context badge or pill
- Inherited context indicator
- Linked context indicator
- Active filter indicator
- Active timeframe indicator
- Active search indicator
- Clear filter action

All indicators must be theme-aware and must not hard-code blue.

## Implementation Plan

### Phase 3: Context Engine

- Create `context-engine.js`.
- Define context state in `dashboard-state.js`.
- Implement deterministic propagation from scopes, links, and widget emissions.
- Add stat-to-table and stat-to-graph filtering with placeholder/demo data.
- Feed active context into a shared local query path instead of per-widget filtering code.
- Add timeframe context propagation from Timeframe Widget presets.
- Add search context propagation from Search Widget keyword input.

### Phase 3: Panel Inheritance

- Give panels `ContextScope` records.
- Track child widget membership.
- Apply inherited context to children during render and after movement.

### Phase 4: Wiring

- Store `ContextLink` records.
- Feed links into the same propagation engine.
- Add delete and persistence behavior.

### Phase 6: Test Coverage

- Stat click filters table.
- Stat click filters graph.
- Clear filter restores table and graph.
- Panel context affects child widgets.
- Wired context affects downstream widgets.
- Deleting a link removes wired inherited context.
- Future spatial tests verify context indicators, inherited scopes, and wired links under pan, zoom, and region collapse.
