# Workspace Architecture

This document records the current implementation contract for the spatial workspace. It complements the forward-looking notes in `docs/architecture/` with the concrete object boundaries, layout domains, runtime contracts, and persistence ownership that the app code is expected to preserve.

## Audit Status

The project already has the core infrastructure for workspace object identity, scoped layout behavior, widget runtime registration, source-agnostic context resolution, and layout history. This pass formalizes that infrastructure, names the stable context-engine helpers, and adds fast contract tests so future work does not collapse these systems back into one implicit renderer.

## Workspace Object Taxonomy

| Object | Collision domain | Parent ownership | Interaction rules | Persistence rules | Render layer | Context inheritance |
| --- | --- | --- | --- | --- | --- | --- |
| Widget | Global workspace grid unless `parentPanelId`/panel-child ownership exists | Workspace root or panel internal grid | Drag, resize when supported, settings, pin, duplicate/delete through widget controls | Stored with widget layout metadata, runtime type, config, color/material, context metadata, and optional panel-child coordinates | `.widget-layout` for root widgets; `.panel-internal-widget-grid` for panel children | Resolves inherited region/panel context dynamically; does not copy inherited context into widget state |
| Panel | Global workspace grid | Workspace root | Drag, resize, expand/collapse, settings, delete; may own an internal child grid when open | Stored with panel layout metadata, expanded/collapsed state, color/material, context metadata, and child widget records | `.panel-layout` | Inherits the surrounding divider region; can also act as a context scope for child widgets |
| Divider | Global workspace grid | Workspace root | Drag/position as a semantic boundary; no panel content or anchor behavior | Stored with committed grid row/span, title, context scope id, context metadata, and divider object metadata | `.panel-layout` as a divider surface | Starts a derived context region; objects below inherit that region until the next divider |
| Anchor | Anchor rail only | Workspace anchor layer | Viewport-side navigation; rail movement/reorder only; no grid resize, no grid collision, no panel containment | Stored in floating-anchor records with id, rail position/order, link target id, color/material, and context/navigation metadata | `.workspace-anchor-layer` | May reference context/navigation metadata but does not participate in region derivation |
| Context Region | Divider-region model only, not a collision object | Derived from workspace root plus committed dividers | Not draggable, not selectable, and not rendered as inherited-context debug overlays by default | Persisted as context records keyed by region id; membership is recomputed from committed divider/object positions | Semantic layer only | Provides inherited context to objects whose committed position belongs to the region |
| Panel Child Widget | Panel internal grid only | Owning panel via panel-child widget record and panel-local grid | Drag and resize within the panel-local grid; collision only with sibling children | Stored inside the owning panel's `childWidgets` records with local coordinates, runtime type, config, and material metadata | Owning panel's `.panel-internal-widget-grid` | Inherits panel context first, then the panel's surrounding divider region |

The executable object types are declared in `app/static/app.js` as `WORKSPACE_OBJECT_TYPES`. Their baseline behavior is declared in `WORKSPACE_OBJECT_CAPABILITIES`, including whether the object participates in grid collision, uses a panel content area, uses the anchor layer, or uses the divider surface.

## Layout Domains

| Domain | Collision scope | Placement rules | Preview/commit lifecycle | Persistence ownership | Render layer |
| --- | --- | --- | --- | --- | --- |
| Global Workspace Grid | Root widgets, panels, and dividers in the active layout | Sparse grid placement, committed row/column spans, normal collision/reflow, no global auto-pack | Live drag/resize previews are temporary; committed layout updates happen on release/save paths | Widget layout and panel layout stores plus layout history snapshots | `.widget-layout` and `.panel-layout` |
| Panel Internal Grid | Child widgets owned by one panel | Panel-local grid coordinates; collision/reflow only among siblings; dynamic vertical growth | Panel-local preview state remains scoped to the panel and commits to child widget records | Owning panel's `childWidgets` records and normal history/save/load snapshots | `.panel-internal-widget-grid` |
| Anchor Rail | Anchors only | Left-side viewport rail; vertical positioning/reorder; no dashboard grid snapping | Live rail drag/ghost state is temporary; rail position/order commits on release | Floating-anchor records plus layout history/save/load | `.workspace-anchor-layer` |
| Divider Regions | Derived semantic regions between committed dividers | Region membership follows current committed divider row order | Prospective drag context may be shown only as preview; committed context resolution uses saved layout state | Workspace context records keyed by root/divider region ids | Data attributes/context runtime, not a grid layer |

These domains are intentionally separate. Visual styling may be shared, but collision and persistence ownership do not cross domains.

Open panels are forgiving container targets. Direct body entry, slow intentional header entry, and a small tolerance around the panel body should all keep the drag in panel-local mode, with the snapped preview clamped to the nearest valid internal grid slot. Only pointers clearly outside the panel/tolerance area return to normal workspace collision.

## Widget Runtime Contract

Widgets are registered through `app/static/widget-registry.js` and consumed by `app/static/app.js` through `window.dashboardWidgetRuntime`.

Each widget definition declares:

- `type` and `displayName`
- `defaultSize` and `minSize`
- `capabilities`
- `supportedSettings`
- `settingsSchema`
- `queryRequirements`
- `getDefaultConfig()`
- `resolveQuery(config, resolvedContext)`
- `render(props)`

The registry currently includes first-class definitions for stat, timeframe, search, table, chart, stat-filter, and calendar widgets. Timeframe and Search Bar are widget types, not special dashboard chrome. Unknown widget types resolve through the unsupported-widget fallback instead of breaking the renderer.

Core layout, drag, resize, collision, save/load, and menu code should not need edits when a new widget type is added. New widget behavior belongs in the widget definition and should consume a resolved context rather than raw data-source details.

Widget settings use the centralized schema path exposed as `window.dashboardWidgetSettingsRuntime`. A widget definition declares grouped fields, defaults, validation hints, and whether a field affects query/context resolution. The dashboard generates the readable widget settings menu from that schema where possible; custom settings panels are reserved for controls that need bespoke interaction. Schema commits update widget config, save with normal layout persistence, create undo history checkpoints, and invalidate the shared query cache only for fields marked as query/context affecting.

Widget interaction surfaces are split by intent. Clicking the widget body opens the widget workbench for data, query, context, filter, operator, media-source, or widget-specific behavior. Clicking the settings control opens the visual/customization surface for appearance, material, title, density, display, and layout preferences. The split keeps semantic behavior out of the cosmetic settings menu while preserving the same widget shell, drag, resize, and panel-containment mechanics.

Data-bound widgets use the shared query lifecycle in `window.dashboardQueryRuntime`. Widget definitions still declare `resolveQuery(config, resolvedContext)` and `render(props)`, but loading, ready, empty, error, stale refresh, retry, cancellation, cache invalidation, and in-flight query deduplication are centralized. Query keys are deterministic fingerprints of widget type/config, resolved context, semantic mapping, filters, time range, data source identity, and the normalized query request. Stat, Table, Chart, and Calendar widgets therefore share the same context -> adapter -> cache -> render lifecycle instead of each owning ad hoc async state.

The widget runtime also owns adaptive visual density through `resolveWidgetDensity(instance, availableSize, definition)`. Density tiers are `tiny`, `compact`, `standard`, `expanded`, and `rich`; the dashboard stamps widget surfaces with matching `data-density` and `widget-density-*` classes. Density responds to committed widget cols/rows, measured content space after controls, and whether the widget is panel-contained. It may change typography, spacing, visible metadata, chart/table detail, and internal control composition, but it must never change grid footprint, collision behavior, context membership, save/load records, or undo history.

## Workspace Event Bus

`window.dashboardWorkspaceEvents` is the centralized event layer for workspace activity. It exposes `emit(event)`, `on(type, listener)`, `recent(options)`, `history()`, `clear()`, and configurable retention. Events are structured records with `id`, `type`, `timestamp`, `source`, optional object/region/panel ids, and a `payload` object.

Events describe what happened; they are not canonical state and are not persisted with layouts. The bus currently emits object creation/deletion/move/resize, panel open/collapse, widget panel-containment transitions, anchor link/reorder/delete, divider movement/context changes, context updates, query start/success/failure, save/load completion, and undo/redo. Activity Feed and Engineer/debug surfaces consume the same bus so future AI/context tooling can subscribe without coupling directly to widget, query, or history internals.

## Relationship Graph And Logical Operators

Workspace computational relationships live in a persisted sidecar graph exposed through `window.dashboardRelationshipRuntime`. The graph stores `relationships`, `contextLinks`, `operators`, and `styleRules` by stable object ids rather than DOM nodes. Relationships support `context`, `filter`, `query`, `containment`, `operator`, and `semantic` types; logical operators currently support `AND`, `OR`, and `NOT` nodes with normalized input/output ids.

Context Links are semantic graph edges with `{ id, sourceObjectId, targetObjectId, mode }`, where `mode` is `inherit`, `share`, `override`, or `reference`. They let a divider, panel, widget, context record, or future logic node resolve context from a non-adjacent source while physical region ownership remains unchanged. Dividers still define visual/organizational regions; a linked divider region can resolve its semantic context from another divider/context source without copying that context into the divider or its child objects. Circular links are rejected or short-circuited during resolution.

Style rules evaluate logic expressions against widget query results, resolved context, widget config, and constants, then apply temporary visual effects such as accent color, text color, background tint, rim state, icon state, or future visibility state. Style rules are persisted and undoable, but their computed CSS variables/classes are ephemeral render state and must not be copied into widget config or layout geometry.

The graph is state, not layout. It is included in save/load snapshots and undo/redo checkpoints, but it does not participate in dashboard grid collision, panel internal grid collision, anchor rail positioning, or object placement. Runtime-derived relationships may be calculated from committed context inheritance, explicit Context Links, panel containment, filter propagation, operator chains, and style-rule data/effect flow for diagnostics and APIs, but those derived links are not saved as separate layout objects and are not rendered as an always-on wire graph by default.

Relationship links and wire handles are hidden in normal mode. Engineer Mode reveals small left-side wire nodules on connectable widgets, panels, dividers, and logical nodes; anchors and minimap overlays are excluded. Dragging from a nodule shows a temporary red preview wire, dropping on another valid nodule creates a persisted cross-region semantic/context link, and invalid drops or Escape cancel without saving preview state. Existing explicit links render as low-opacity paths from committed object positions. Local inherited divider context is intentionally implicit and should not be rendered as a dense wire graph, label field, or region-debug surface. The overlay uses `pointer-events: none` by default, with nodules as the only pointer-active editing controls, so normal object drag/resize/body behavior remains isolated from graph editing.

## Engineer Mode Infrastructure

`window.dashboardEngineerMode` is the centralized Engineer Mode store. The Engineer button is the only normal UI control that toggles the mode, while the runtime exposes `isEnabled()`, `getState()`, `set(enabled)`, `toggle()`, `onChange(listener)`, and `refresh()` for tests and developer tooling.

Normal mode hides semantic wiring UI. Engineer Mode adds `body.engineer-mode-active` and renders `.workspace-engineer-overlay-layer` for wire handles and explicit relationship links only by default. Context badges, inherited-context labels, giant region bands, diagnostics panels, minimap overlays, and other debug surfaces should not appear automatically just because Engineer Mode is enabled. The overlay must never replace canonical state or change committed layout, collision, save/load, undo/redo, or query behavior. Engineer visibility is not part of the persisted workspace snapshot.

## Context Inheritance Backbone

The context chain is:

```text
Data source -> adapter -> normalized schema/query contract -> semantic mapping
Divider -> derived context region -> resolved object context -> widget query
```

Workspace context entities are stored separately from widgets and dividers. Dividers own region ids, regions are derived from current committed divider positions, and objects resolve inherited context dynamically from their committed spatial membership.

Context resolution first follows the physical divider region chain, then applies any semantic Context Links targeting the active divider, panel, widget, or context source. Linked context is resolved by object/context id at query time, so moving dividers or widgets does not require copying context values or updating cached coordinates. Removing a link restores normal nearest-divider inheritance.

The context engine exposes these stable helpers on `window.dashboardContextEngine`:

- `deriveContextRegions(layoutKey)` returns root/divider regions from committed divider positions.
- `resolveRegionForY(value, layoutKey)` returns the region for a committed grid row or object.
- `getNearestDividerAbove(value, layoutKey)` returns the nearest committed divider above a row or object.
- `resolveObjectContext(item)` resolves the object's inherited and local context.
- `mergeContext(inheritedContext, localOverride)` merges inherited and local context using the shared context merge logic.
- `queryContext(context, request)` and `queryWidget(widget, request)` query through data-source adapters.

Local context inheritance remains ambient and mostly invisible. Context logic may run in normal mode and Engineer Mode, but inherited-context badges, labels, and region overlays should not render by default; only intentional cross-region semantic links use the Engineer wire layer.

## Save/Load And History Ownership

The top-level layout state owns:

- global widgets and their runtime metadata;
- panels and their child widget records;
- dividers and their region/context metadata;
- anchors and rail/navigation metadata;
- data sources and workspace contexts;
- active layout/profile snapshots.

`app/static/app.js` now exposes `window.dashboardPersistenceRuntime` as the canonical persistence contract for architecture checks. Existing per-object localStorage records remain the app's load path, while the runtime derives a versioned `PersistedWorkspace` sidecar on save:

- `version`;
- `objects`;
- `widgets`;
- `panels`;
- `dividers`;
- `anchors`;
- `contexts`;
- `dataSources`;
- `relationships`;
- `contextLinks`;
- `operators`;
- `styleRules`;
- optional `assets`.

The sidecar stores committed layout ownership only. Root widgets use the global workspace grid, panel-contained widgets use `parentPanelId` plus panel-local coordinates, anchors use rail position/order and `linkedDividerId`, and dividers/context regions use semantic ids rather than cached pixels.

Undo/redo checkpoints are created through the shared layout history paths. Preview state, drag ghosts, collision placeholders, hover-only context, and temporary region previews are not durable state and must not be persisted.

Save/load restores committed records first, then recomputes derived region membership and resolved context. Anchor links persist by target id, not by cached pixel coordinates.

Persistence validation is centralized through `dashboardPersistenceRuntime.validate()` and `validateSnapshot()`. Validation checks duplicate ids, missing widget types, unknown widget fallback, missing panel parents, missing linked dividers, temporary asset references, and transient preview/tool state. Diagnostics remain runtime/API state unless an explicit inspector surface is opened; they should not be dumped onto the default Engineer Mode workspace.

Media and document widgets use a separate asset registry exposed as `window.dashboardAssetRuntime`. Image, video, and document widget config stores stable `assetId` references plus display settings; raw URLs/data URLs live in asset metadata under the layout-scoped asset store. Legacy `src` widget configs are migrated into assets when rendered or saved. Deleting a widget does not remove its asset record because other widgets may share the same `assetId`; unused-asset cleanup is intentionally deferred.

## Intentionally Deferred

The architecture intentionally does not include a heavy context editor UI, backend data-source execution, server-side permissions, product-specific widgets, or mobile/responsive architecture changes. Those systems can be added later without changing the foundational taxonomy, layout-domain ownership, widget runtime contract, or context inheritance backbone.

Hidden computational easter eggs are also deferred. The workspace may eventually allow playful simulation-like behaviors, such as reactive pixel grids, signal-flow experiments, or tiny redstone-like visual logic systems, but only as emergent configurations of the real logic graph, event bus, context inheritance, conditional styling, widget runtime, and visual-state systems. They should remain hidden in Engineer/experimental tooling, never clutter Normal Mode, and should not introduce a separate toy engine that bypasses canonical workspace state.

### Compact Workspace Mode

Compact Workspace Mode is deferred as a future system. It is not a scaled-down version of the desktop spatial workspace; it needs its own constrained-viewport interaction contract.

Expected compact-mode concerns include:

- single-column layout behavior;
- collapsed navbar and grouped workspace chrome;
- simplified drag/resize and placement interactions;
- anchor rail compression or anchor drawer behavior;
- responsive density scaling;
- progressive disclosure for controls, menus, context indicators, and navigation.

Compact mode should wait until desktop interaction laws, panel containment, context inheritance, widget runtime architecture, and performance systems have stabilized. Until then, responsive work should avoid weakening the desktop/spatial interaction model or mixing compact-mode rules into the global grid, panel internal grid, anchor rail, or divider-region domains.
