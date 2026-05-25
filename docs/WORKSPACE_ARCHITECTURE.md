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
| Context Region | Divider-region model only, not a collision object | Derived from workspace root plus committed dividers | Not draggable, not selectable, not independently rendered outside Engineer Mode overlays/debug surfaces | Persisted as context records keyed by region id; membership is recomputed from committed divider/object positions | Semantic/debug layer only | Provides inherited context to objects whose committed position belongs to the region |
| Panel Child Widget | Panel internal grid only | Owning panel via panel-child widget record and panel-local grid | Drag and resize within the panel-local grid; collision only with sibling children | Stored inside the owning panel's `childWidgets` records with local coordinates, runtime type, config, and material metadata | Owning panel's `.panel-internal-widget-grid` | Inherits panel context first, then the panel's surrounding divider region |

The executable object types are declared in `app/static/app.js` as `WORKSPACE_OBJECT_TYPES`. Their baseline behavior is declared in `WORKSPACE_OBJECT_CAPABILITIES`, including whether the object participates in grid collision, uses a panel content area, uses the anchor layer, or uses the divider surface.

## Layout Domains

| Domain | Collision scope | Placement rules | Preview/commit lifecycle | Persistence ownership | Render layer |
| --- | --- | --- | --- | --- | --- |
| Global Workspace Grid | Root widgets, panels, and dividers in the active layout | Sparse grid placement, committed row/column spans, normal collision/reflow, no global auto-pack | Live drag/resize previews are temporary; committed layout updates happen on release/save paths | Widget layout and panel layout stores plus layout history snapshots | `.widget-layout` and `.panel-layout` |
| Panel Internal Grid | Child widgets owned by one panel | Panel-local grid coordinates; collision/reflow only among siblings; dynamic vertical growth | Panel-local preview state remains scoped to the panel and commits to child widget records | Owning panel's `childWidgets` records and normal history/save/load snapshots | `.panel-internal-widget-grid` |
| Anchor Rail | Anchors only | Left-side viewport rail; vertical positioning/reorder; no dashboard grid snapping | Live rail drag/ghost state is temporary; rail position/order commits on release | Floating-anchor records plus layout history/save/load | `.workspace-anchor-layer` |
| Divider Regions | Derived semantic regions between committed dividers | Region membership follows current committed divider row order | Prospective drag context may be shown only as preview; committed context resolution uses saved layout state | Workspace context records keyed by root/divider region ids | Engineer/debug overlays and data attributes, not a grid layer |

These domains are intentionally separate. Visual styling may be shared, but collision and persistence ownership do not cross domains.

## Widget Runtime Contract

Widgets are registered through `app/static/widget-registry.js` and consumed by `app/static/app.js` through `window.dashboardWidgetRuntime`.

Each widget definition declares:

- `type` and `displayName`
- `defaultSize` and `minSize`
- `capabilities`
- `supportedSettings`
- `queryRequirements`
- `getDefaultConfig()`
- `resolveQuery(config, resolvedContext)`
- `render(props)`

The registry currently includes first-class definitions for stat, timeframe, search, table, chart, stat-filter, and calendar widgets. Timeframe and Search Bar are widget types, not special dashboard chrome. Unknown widget types resolve through the unsupported-widget fallback instead of breaking the renderer.

Core layout, drag, resize, collision, save/load, and menu code should not need edits when a new widget type is added. New widget behavior belongs in the widget definition and should consume a resolved context rather than raw data-source details.

## Context Inheritance Backbone

The context chain is:

```text
Data source -> adapter -> normalized schema/query contract -> semantic mapping
Divider -> derived context region -> resolved object context -> widget query
```

Workspace context entities are stored separately from widgets and dividers. Dividers own region ids, regions are derived from current committed divider positions, and objects resolve inherited context dynamically from their committed spatial membership.

The context engine exposes these stable helpers on `window.dashboardContextEngine`:

- `deriveContextRegions(layoutKey)` returns root/divider regions from committed divider positions.
- `resolveRegionForY(value, layoutKey)` returns the region for a committed grid row or object.
- `getNearestDividerAbove(value, layoutKey)` returns the nearest committed divider above a row or object.
- `resolveObjectContext(item)` resolves the object's inherited and local context.
- `mergeContext(inheritedContext, localOverride)` merges inherited and local context using the shared context merge logic.
- `queryContext(context, request)` and `queryWidget(widget, request)` query through data-source adapters.

Context visualizations, badges, inherited labels, and debug overlays are gated by Engineer Mode. Context logic may run in normal mode, but context UI should not render unless the Engineer button enables it.

## Save/Load And History Ownership

The top-level layout state owns:

- global widgets and their runtime metadata;
- panels and their child widget records;
- dividers and their region/context metadata;
- anchors and rail/navigation metadata;
- data sources and workspace contexts;
- active layout/profile snapshots.

Undo/redo checkpoints are created through the shared layout history paths. Preview state, drag ghosts, collision placeholders, hover-only context, and temporary region previews are not durable state and must not be persisted.

Save/load restores committed records first, then recomputes derived region membership and resolved context. Anchor links persist by target id, not by cached pixel coordinates.

## Intentionally Deferred

The architecture intentionally does not include a heavy context editor UI, backend data-source execution, server-side permissions, product-specific widgets, or mobile/responsive architecture changes. Those systems can be added later without changing the foundational taxonomy, layout-domain ownership, widget runtime contract, or context inheritance backbone.

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
