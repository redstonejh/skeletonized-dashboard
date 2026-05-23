# Grid System

## Purpose

The grid system owns placement, occupancy, drag, resize, sparse layout, pinning, and drop commits for every dashboard object. It must remain deterministic, visually polished, and shared by panels and widgets.

## Universal Object Model

Everything visible on the dashboard should participate in the same grid unless explicitly locked:

- Widgets
- Panels
- Context panels
- Timeframe or command-surface widgets
- Future graph, table, calendar, and stat widgets

All objects must use the same placement, occupancy, snapping, collision, resize, and persistence rules.

## Sparse Placement

Sparse placement is valid.

- Users may intentionally leave empty cells, rows, or columns.
- Dropping into open space should preserve that placement.
- The grid must not auto-pack or collapse items upward unless the user explicitly invokes a layout action.
- Surrounding items should shift only when required by an occupied target or resize conflict.

## Spatial Workspace Direction

The current grid is the foundation for a future pan-and-zoom canvas.

- Grid placement remains deterministic even when the viewport can pan or zoom.
- Canvas regions may expand the available workspace horizontally and vertically.
- Region-aware coordinates should extend the current grid model instead of replacing it with chaotic freeform positioning.
- Sparse placement remains valid across the larger canvas.
- Pinned items remain hard reservations within their region or global canvas coordinates.
- Camera movement must not mutate committed layout state.
- Zoom-level density changes must not change saved grid coordinates unless the user performs an explicit layout action.

## Occupancy Rules

- Occupancy is global across widgets and panels.
- Items must not pass through, overwrite, or ignore each other.
- Pinned items reserve their cells and cannot be displaced.
- Invalid drops resolve to the nearest valid slot or are rejected cleanly.
- Final committed positions must always be valid grid coordinates.

## Drag Rules

- The active item lifts above the grid.
- Drag preview clamps to visible/grid bounds.
- Pointer tracking is separate from layout calculation.
- Neighboring items may visually shift as a reversible preview.
- Committed layout state must not mutate during hover/collision preview.
- Only final drop commits layout changes.
- If a drag is canceled, all preview-shifted items return to committed positions.

## Resize Rules

- Resize preview snaps cleanly to grid units.
- Resize handles remain visually attached.
- Left-edge resize keeps the right boundary anchored while column and span change.
- Surrounding items respond predictably.
- Final size commits only on resize end.
- Pinned items block resize expansion.
- Placeholder/content areas must resize with the object body without fixed offsets.

## Group Transform Rules

Grouping is a multi-selection transform, not a container.

- Selected widgets and panels remain individual grid objects.
- Dragging one selected movable item moves the selected movable set.
- Relative offsets and intentional sparse gaps are preserved.
- Pinned selected items remain fixed and reserve their cells.
- Group drag resolves to the nearest valid shared delta when the requested delta collides with pinned or external occupancy.
- Group resize uses the selected set's bounding box.
- Items resize proportionally from that shared boundary.
- Each item clamps to its own minimum valid size.
- The most constrained selected item defines the group's minimum shrink threshold.
- Group resize must not depend on which selected item is active, focused, or has its menu open.

See `docs/grouping-system.md` and `docs/interaction-principles.md`.

## Ordered Insertion

When dropping into an occupied top or middle slot, reflow must be local and directional.

Example:

```text
Before:
[A] [B] [C]
[D] [E] [F]

Drop X into A:
[X] [A] [B]
[C] [D] [E]
[F]
```

Do not wrap the displaced first item to the end unless that is the only valid sparse resolution and the user explicitly requested a pack/reorder action.

## Pin Behavior

- Pinned items cannot be moved directly until unpinned.
- Pinned items cannot be displaced by other items.
- Pinned cells are hard reservations.
- Drops or resizes that require moving a pinned item must resolve around it or fail.
- Pin state must not trap menus open.

## Chevron/Header Context Drop

Panel headers may expose context drop targets.

- Dragging a context-capable stat to the panel chevron/header attaches context to the panel.
- This must not corrupt grid placement.
- Invalid context drops must not commit layout or context state.
- Context drop hit testing must not conflict with normal panel dragging, resizing, or collapse behavior.

## Implementation Plan

### Maintain Current Grid Mechanics

- Keep the ordered-slot movement feel.
- Keep sparse placement.
- Keep global occupancy across panels and widgets.
- Keep pinned item protection.
- Preserve existing CSS classes and visual transitions.

### Phase 2: State Normalization

- Represent every dashboard object as a `GridItem`.
- Store type, id, row, column, row span, column span, pinned state, and locked capabilities.
- Keep committed layout separate from preview layout.
- Leave room for future region id, canvas coordinates, zoom-independent grid coordinates, and camera state.

### Phase 3 And 4: Context Integration

- Add panel membership and scope ownership without splitting occupancy systems.
- Add Engineer Mode link overlays without interfering with drag or resize hit testing.

### Phase 6: Tests

- Drag and resize each widget type.
- Verify sparse placement remains.
- Verify pinned items are not displaced.
- Verify drag previews are reversible.
- Verify panel and widget occupancy is global.
- Verify context header drops do not change grid size unexpectedly.
- Future spatial tests must verify pan/zoom preserves grid alignment, ghost previews, drop commits, and resize snapping.
