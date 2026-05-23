# Spatial Workspace

## Vision

The long-term workspace direction is a continuous, zoomable dashboard canvas. The canvas becomes the organizational structure, reducing or eliminating the need for tab-based segmentation.

This is a future direction, not permission to destabilize the current grid. The existing dashboard grid, Apple-glass visual language, and deterministic interaction model remain the foundation.

## Principles

### Continuous Canvas

- Users can pan horizontally and vertically across one unified workspace.
- Workspace regions can expand, collapse, and be navigated spatially.
- Navigation should be spatial first, not tab first.
- The canvas should preserve mental mapping and placement intent.

### Zoomable Hierarchy

- Zoom out for an overview of regions, panels, groups, and context flows.
- Zoom in for detailed interaction with widgets, tables, graphs, calendars, and panels.
- Zoom levels may reveal or hide density intelligently.
- Sections can compact or expand depending on focus.

### Contextual Panels And Widgets

- Panels act as spatial context containers.
- Widgets inside panels inherit context from parent scopes.
- Context inheritance should remain visible through subtle badges, glow, link indicators, or other quiet affordances.
- Engineer Mode wiring must remain spatially coherent under pan and zoom.

### Interaction And Motion

- Panning, zooming, and focus transitions must be smooth and predictable.
- Snap-to-grid and grid occupancy still provide structure.
- Inertia may be used only if it preserves user orientation and does not fight precise placement.
- Motion should preserve mental mapping: no disorienting jumps, flicker, or scale snapping.

### Context Navigation

Users should always understand:

- Which panel, widget, region, or group is focused.
- Which context scope is active.
- Which filters, timeframe, search terms, or links are affecting visible data.

Useful future affordances:

- Mini-map or workspace overview.
- Spatial Anchors for floating viewport-fixed bookmarks into widgets, panels, groups, regions, contexts, or saved viewport positions.
- Focus breadcrumbs.
- Subtle region highlights.
- Context path indicators.
- Camera focus actions from context badges or links.

## Benefits

- Removes rigid page/tab hierarchy.
- Supports an infinite composable dashboard workspace.
- Makes Engineer Mode wiring easier to understand spatially.
- Encourages direct manipulation and visual composition.
- Fits the Apple-glass tactile workspace identity.

## Guardrails

- Keep grid-based placement for predictability.
- Do not introduce freeform chaotic positioning before deterministic grid behavior is preserved.
- Do not replace the visual language.
- Do not make zoom/pan controls feel like a generic map app or BI canvas.
- Do not let zoom break text legibility, menu positioning, drag handles, resize handles, or context links.
- Do not allow tab-based features to become the main organization model if spatial navigation can solve the need.

## Future Systems

- Canvas camera state: pan, zoom, focused region, and overview position.
- Spatial regions: named, collapsible areas of the workspace.
- Region-aware grid coordinates.
- Mini-map or overview rail.
- Spatial Anchors as a tabless floating navigation layer; see `docs/spatial-anchors.md`.
- Context-aware camera focus.
- Zoom-density rules for labels, handles, graph detail, table density, and wiring overlays.
- Engineer Mode link routing that accounts for zoom, pan, and region collapse.

## Testing Requirements

- Pan and zoom preserve grid alignment.
- Drag and resize work correctly at multiple zoom levels.
- Ghost previews match final drop positions under zoom.
- Menus and popovers position correctly under pan and zoom.
- Engineer Mode links route correctly under pan, zoom, and region collapse.
- Context inheritance indicators remain understandable at overview and detail zoom levels.
- No tabs are required for primary navigation.
