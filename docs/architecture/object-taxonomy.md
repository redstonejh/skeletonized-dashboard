# Object Taxonomy

## Purpose

This document defines the major object classes in the spatial workspace. The goal is to prevent future features from blurring panels, widgets, dividers, anchors, groups, and context scopes into one overloaded component.

## Object Classes

| Object | Grid occupant | Viewport-fixed | Can contain content | Can own context | Navigation target | Current status |
| --- | --- | --- | --- | --- | --- | --- |
| Widget | Yes | No | It is content | Yes, if capable | Yes | Current |
| Panel | Yes | No | Future container | Yes | Yes | Current |
| Context Divider | Yes | No | No | Yes, zone scope | Yes | Foundation implemented |
| Spatial Anchor | No | Yes | No | References context | It navigates | Floating navigation layer implemented |
| Group selection | Composite of occupants | No | No | Temporary now | Yes, future | Current temporary |
| Persistent group | Composite record | No | No | Possible | Yes | Future |
| Spatial Context Zone | Derived from dividers | No | No | Yes | Yes | Future |
| Saved viewport | No | View/camera state | No | Optional | Yes | Future |

## Widgets

Purpose:

- Render functional content or compact controls.
- Emit, consume, or display context when configured.
- Includes command-surface widget types such as timeframe controls; these are widgets, not special toolbar components.

Interaction model:

- Drag, resize, pin, configure, group, delete, save/load.
- Compact controls use pressable depression behavior.
- Large widget body may keep subtle hover presence.

Footprint behavior:

- Occupies grid cells.
- Minimum footprint is defined by usable content and adaptive density.
- Sparse placement is valid.

Resize rules:

- Resizes through the shared grid/preview system.
- Dense widgets should adapt internal density before increasing minimum footprint.

Persistence rules:

- Persist id, type, config, layout, size, color/accent, pin/lock state, data binding, and context capabilities.
- Do not persist hover, focus, live preview, or temporary displacement.

Contextual behavior:

- May emit context.
- May consume inherited or wired context.
- May show active or inherited context indicators.

Visual role:

- Primary content surface.
- Shares the same glass material system over any background tone.

Navigation role:

- Can be an anchor target.
- Can be focused by search, context path, or saved viewport.

## Panels

Purpose:

- Generic spatial containers.
- Future host for widgets or content components.
- Not inherent content types.

Interaction model:

- Drag, resize, collapse/expand, pin, configure, group, delete, save/load.
- Expansion uses local accordion pressure.

Footprint behavior:

- Occupies grid cells.
- Collapsed footprint and expanded footprint must remain authoritative and deterministic.

Resize rules:

- Resizes through the shared preview/live clone system.
- Open panels must remain visually and logically expanded unless explicitly collapsed.

Persistence rules:

- Persist committed panel layout, collapsed state, saved height, color/accent, title, pin/lock state, future child membership, and panel context.
- Do not persist temporary expansion pushdown as a new baseline unless a committed layout action explicitly changes it.

Contextual behavior:

- Panels are natural context scopes.
- Future child widgets inherit panel context.
- Panel header/context pills may attach local context.

Visual role:

- Large spatial glass container.
- Should not become a table, note, menu, chart, or calendar identity by itself.

Navigation role:

- Can be anchor target.
- Collapsed panels remain valid navigation targets through their header.

## Context Dividers

Purpose:

- Mark semantic boundaries in the workspace.
- Define Spatial Context Zones.

Interaction model:

- Future vertical drag, select, rename, accent, inspect context, create anchor, delete.
- No panel-like body or content insertion.

Footprint behavior:

- Occupies a narrow grid row footprint.
- Full-width by default.
- Reserves space like any other grid occupant.

Resize rules:

- Initially non-resizable or vertical-only movement.
- Column-scoped resizing is future-only.

Persistence rules:

- Persist id, label, icon, accent, committed row/span, scope id, zone context defaults, and anchor compatibility.
- Do not persist live divider drag preview or prospective zone membership.

Contextual behavior:

- Owns a zone-level context scope.
- Objects inherit zone context by committed membership.

Visual role:

- Calm glass boundary, not panel, tab, folder, or table row.

Navigation role:

- Natural anchor target.
- Can become a landmark in overview/minimap systems.

Current implementation:

- Uses `data-workspace-object-type="divider"`.
- Reuses the existing grid/menu/drag/resize/persistence system.
- Owns `contextScopeId` and starts a row-based region.
- Stays visually and behaviorally distinct from panels by not exposing a panel body.

## Spatial Anchors

Purpose:

- Provide tabless navigation back to meaningful workspace places.

Interaction model:

- Activate to navigate.
- Reposition in viewport side-rail space.
- Suppressed during protected dashboard interactions.

Footprint behavior:

- Does not occupy normal dashboard grid cells.
- Does not push or get pushed by widgets, panels, or dividers.
- Uses side/offset placement in a floating navigation layer.
- Only other anchors participate in anchor rail collision.

Resize rules:

- Not grid-resizable.
- May have compact/expanded display modes.

Persistence rules:

- Persist anchor id, label, icon, viewport position, target id/type, target snapshot fallback, alignment, context metadata, pin state, and scope.
- Store separately from grid layout.

Contextual behavior:

- May reference inherited context from creation source.
- Does not silently mutate context.

Visual role:

- Quiet floating glass navigation control.
- Secondary to dashboard content.

Current implementation:

- Uses `data-workspace-object-type="anchor"`.
- Stores navigation target metadata.
- Renders under `.workspace-anchor-layer`, outside `.widget-layout` and `.panel-layout`.
- Persists through anchor-specific storage instead of widget/panel layout.
- Uses fixed left/right side rails with local anchor-to-anchor spacing.
- Does not reuse widget drag, resize, menu, pin, grouping, collision, or grid persistence plumbing.

Navigation role:

- Primary future local navigation layer.
- Should feel like spatial bookmarking, not page switching.

## Groups

Purpose:

- Current: temporary multi-selection transform.
- Future: optional persistent semantic group after selection behavior is stable.

Interaction model:

- Move and resize as one composite spatial object.
- Members keep individual identity and capabilities.

Footprint behavior:

- Composite footprint drives collision/reflow during active group interaction.
- Member previews are visual, not independent collision sources.

Persistence rules:

- Current group selection is not persisted.
- Group transform results persist as normal member layout.
- Future persistent groups should store membership separately from member layout.

Contextual behavior:

- Temporary group does not create context by default.
- Future semantic group may own context only through explicit user intent.

Navigation role:

- A selected or persistent group can be an anchor target.

## Future Contextual Objects

Potential future objects include:

- Context badges.
- Relationship links.
- Region labels.
- Overview/minimap markers.
- Saved viewport markers.

Rules:

- They must declare whether they occupy the grid.
- They must declare whether they persist.
- They must not hijack panel/widget behavior.
- They must not introduce product-specific concepts.
